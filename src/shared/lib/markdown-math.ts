import { Parser, type Options as AcornOptions } from 'acorn';

import { fenceIndentedCode, nextProseColumns, nextProseFence } from './indented-code';
import { mathDelimiterAt, mathSpanEnd, unescapedDelimiterIndex } from './math-span';
import { renderableMathTex, repairedMathSpan } from './renderable-math';
import {
  angleDestinationEnd,
  escapeLooseTags,
  escapeTemplatePlaceholders,
  linkUrlsWithEscapedAngles,
} from './markdown-tags';

const MDX_EXPRESSION_OPTIONS: AcornOptions = {
  ecmaVersion: 2024,
  sourceType: 'module',
  preserveParens: true,
};

function copyCodeSpan(value: string, index: number): { text: string; next: number } | null {
  if (value[index] !== '`') {
    return null;
  }
  let ticks = 0;
  while (value[index + ticks] === '`') {
    ticks += 1;
  }
  const closer = value.indexOf('`'.repeat(ticks), index + ticks);
  if (closer === -1) {
    return { text: value.slice(index), next: value.length };
  }
  return { text: value.slice(index, closer + ticks), next: closer + ticks };
}

const VOID_TAGS = 'br|hr|img|input|meta|link|source|wbr|area|base|col|embed|track';

function stripHtmlComments(value: string): string {
  return value.replace(/<!--[\s\S]*?-->/g, '');
}

function closeVoidTags(value: string): string {
  return value.replace(
    new RegExp(`<(${VOID_TAGS})(\\s[^<>]*?)?>`, 'gi'),
    (full, name: string, attrs: string | undefined) =>
      full.endsWith('/>') ? full : `<${name}${attrs ?? ''} />`
  );
}

function mapOutsideCode(prose: string, mapText: (text: string) => string): string {
  let result = '';
  let index = 0;
  while (index < prose.length) {
    const code = copyCodeSpan(prose, index);
    if (code) {
      result += code.text;
      index = code.next;
      continue;
    }
    const nextTick = prose.indexOf('`', index);
    const end = nextTick === -1 ? prose.length : nextTick;
    result += mapText(prose.slice(index, end));
    index = end;
  }
  return result;
}

function keptAngle(value: string, match: string, offset: number): boolean {
  return angleDestinationEnd(value, offset) === offset + match.length;
}

function rewriteAutolinks(value: string): string {
  return value
    .replace(/<(https?:\/\/[^>\s]+)>/gi, (match, url: string, offset: number) =>
      keptAngle(value, match, offset) ? match : `[${url}](${url})`
    )
    .replace(
      /<((?:mailto:)?)([^\s@<>:]+@[^\s@<>]+\.[^\s@<>]+)>/gi,
      (match, scheme: string, email: string, offset: number) =>
        keptAngle(value, match, offset) ? match : `[${scheme}${email}](mailto:${email})`
    );
}

function closingBrace(value: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let index = open; index < value.length; index += 1) {
    const char = value[index] ?? '';
    if (quote) {
      if (char === '\\') {
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function remainderIsEmpty(value: string): boolean {
  const withoutComments = value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\r\n]*(\r\n|\n|\r)/g, '');
  return /^[ \t\n\r]*$/.test(withoutComments);
}

function leavesExpressionForMdx(trimmed: string): boolean {
  return (
    trimmed.length === 0 ||
    trimmed.startsWith('...') ||
    trimmed.startsWith('<') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('//')
  );
}

function shouldEscapeExpression(expression: string): boolean {
  const trimmed = expression.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('%')) {
    return true;
  }
  if (leavesExpressionForMdx(trimmed)) {
    return false;
  }
  try {
    const node = Parser.parseExpressionAt(expression, 0, MDX_EXPRESSION_OPTIONS);
    return !remainderIsEmpty(expression.slice(node.end));
  } catch {
    return true;
  }
}

function escapeMdxSyntax(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    if (value.startsWith('<=', index)) {
      result += '&lt;=';
      index += 2;
      continue;
    }
    if (value[index] === '{' && value[index - 1] !== '\\') {
      const end = closingBrace(value, index);
      if (end === -1) {
        result += '{';
        index += 1;
        continue;
      }
      const expression = value.slice(index + 1, end);
      result += shouldEscapeExpression(expression)
        ? `\\{${expression}\\}`
        : value.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    result += value[index] ?? '';
    index += 1;
  }
  return result;
}

const MATH_MARK = '\uE017';

function takeDollarSpan(value: string, index: number): string | null {
  const delimiter = mathDelimiterAt(value, index);
  if (delimiter === null) {
    return null;
  }
  const end = mathSpanEnd(value, index, delimiter);
  return end === -1 ? null : value.slice(index, end);
}

function takeTexSpan(value: string, index: number): string | null {
  const open = value.startsWith('\\[', index) ? '\\[' : value.startsWith('\\(', index) ? '\\(' : '';
  if (open.length === 0) {
    return null;
  }
  const close = open === '\\[' ? '\\]' : '\\)';
  const end = unescapedDelimiterIndex(value, index + open.length, close);
  if (end <= index + open.length) {
    return null;
  }
  return value.slice(index, end + close.length);
}

const LINK_INSIDE = '(?:[^()"\']|"(?:\\\\.|[^"])*"|\'(?:\\\\.|[^\'])*\'|\\([^()]*\\))*';

function balancedLabelEnd(value: string, openIndex: number): number | null {
  let depth = 0;
  for (let index = openIndex; index < value.length; index += 1) {
    const char = value[index];
    if (char === '[') {
      depth += 1;
      continue;
    }
    if (char !== ']') {
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return index;
    }
  }
  return null;
}

/** A markdown link or image, so TeX delimiters inside its address stay escapes. */
function markdownLinkAt(
  value: string,
  index: number
): { labelStart: number; labelEnd: number; end: number } | null {
  const image = value[index] === '!' && value[index + 1] === '[';
  const open = image ? index + 1 : index;
  if (value[open] !== '[') {
    return null;
  }
  const close = balancedLabelEnd(value, open);
  if (close === null || value[close + 1] !== '(') {
    return null;
  }
  const destination = new RegExp(`^(${LINK_INSIDE})\\)`).exec(value.slice(close + 2));
  if (!destination?.[0]) {
    return null;
  }
  return { labelStart: open + 1, labelEnd: close, end: close + 2 + destination[0].length };
}

function shiftMath(text: string, offset: number): string {
  return text.replaceAll(
    new RegExp(`${MATH_MARK}(\\d+)${MATH_MARK}`, 'g'),
    (_match, marker: string) => `${MATH_MARK}${Number(marker) + offset}${MATH_MARK}`
  );
}

function shieldMath(value: string): { text: string; math: string[] } {
  const math: string[] = [];
  let text = '';
  let index = 0;
  while (index < value.length) {
    const code = copyCodeSpan(value, index);
    if (code) {
      text += code.text;
      index = code.next;
      continue;
    }
    const link = markdownLinkAt(value, index);
    if (link) {
      const label = shieldMath(value.slice(link.labelStart, link.labelEnd));
      text += value.slice(index, link.labelStart);
      text += shiftMath(label.text, math.length);
      text += value.slice(link.labelEnd, link.end);
      math.push(...label.math);
      index = link.end;
      continue;
    }
    const span = takeDollarSpan(value, index) ?? takeTexSpan(value, index);
    if (span) {
      text += `${MATH_MARK}${math.length}${MATH_MARK}`;
      math.push(span);
      index += span.length;
      continue;
    }
    text += value[index] ?? '';
    index += 1;
  }
  return { text, math };
}

function restoreMath(value: string, math: readonly string[]): string {
  return value.replace(
    new RegExp(`${MATH_MARK}(\\d+)${MATH_MARK}`, 'g'),
    (_match, index: string) => math[Number(index)] ?? ''
  );
}

const KEPT_HTML = new Set([
  'article',
  'aside',
  'blockquote',
  'div',
  'dl',
  'figure',
  'footer',
  'form',
  'header',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'script',
  'section',
  'style',
  'table',
  'textarea',
  'ul',
]);

function htmlBlockEnd(lines: readonly string[], start: number): number {
  const name = /^ {0,3}<([A-Za-z][A-Za-z0-9-]*)(?=[\s>/]|$)/.exec(lines[start] ?? '')?.[1];
  const tag = name?.toLowerCase() ?? '';
  if (!KEPT_HTML.has(tag)) {
    return start;
  }
  if (new RegExp(`</${tag}\\s*>`, 'i').test(lines[start] ?? '')) {
    return start + 1;
  }
  const close = new RegExp(`^ {0,3}</${tag}\\s*>`, 'i');
  for (let index = start + 1; index < lines.length; index += 1) {
    if (close.test(lines[index] ?? '')) {
      return index + 1;
    }
  }
  return lines.length;
}

function mapOutsideHtml(value: string, mapText: (text: string) => string): string {
  const lines = value.split('\n');
  const parts: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const blockEnd = htmlBlockEnd(lines, index);
    if (blockEnd > index) {
      parts.push(lines.slice(index, blockEnd).join('\n'));
      index = blockEnd;
      continue;
    }
    const prose: string[] = [];
    while (index < lines.length && htmlBlockEnd(lines, index) === index) {
      prose.push(lines[index] ?? '');
      index += 1;
    }
    parts.push(mapText(prose.join('\n')));
  }
  return parts.join('\n');
}

function preparePlainProse(prose: string): string {
  const shielded = shieldMath(prose);
  const cleaned = mapOutsideCode(shielded.text, (text) =>
    escapeMdxSyntax(
      escapeTemplatePlaceholders(closeVoidTags(rewriteAutolinks(stripHtmlComments(text))))
    )
  );
  const escaped = mapOutsideCode(cleaned, (text) =>
    linkUrlsWithEscapedAngles(escapeLooseTags(text, cleaned))
  );
  return replaceTexMath(restoreMath(escaped, shielded.math));
}

function prepareProse(prose: string): string {
  return mapOutsideHtml(prose, preparePlainProse);
}

function replaceTexMath(prose: string): string {
  let result = '';
  let index = 0;
  while (index < prose.length) {
    const code = copyCodeSpan(prose, index);
    if (code) {
      result += code.text;
      index = code.next;
      continue;
    }
    const link = markdownLinkAt(prose, index);
    if (link) {
      result += prose.slice(index, link.labelStart);
      result += replaceTexMath(prose.slice(link.labelStart, link.labelEnd));
      result += prose.slice(link.labelEnd, link.end);
      index = link.end;
      continue;
    }
    if (prose.startsWith('\\[', index)) {
      const end = unescapedDelimiterIndex(prose, index + 2, '\\]');
      if (end !== -1 && end > index + 2) {
        result += `$$${renderableMathTex(prose.slice(index + 2, end))}$$`;
        index = end + 2;
        continue;
      }
    }
    if (prose.startsWith('\\(', index)) {
      const end = unescapedDelimiterIndex(prose, index + 2, '\\)');
      if (end !== -1 && end > index + 2) {
        const interior = prose.slice(index + 2, end).replace(/(?<!\\)\$/g, '\\$');
        result += `$${renderableMathTex(interior)}$`;
        index = end + 2;
        continue;
      }
    }
    const repaired = repairedMathSpan(prose, index);
    if (repaired) {
      result += repaired.text;
      index = repaired.end;
      continue;
    }
    result += prose[index] ?? '';
    index += 1;
  }
  return result;
}

export function mapFencedProse(content: string, transform: (prose: string) => string): string {
  const output: string[] = [];
  const prose: string[] = [];
  let fence: string | null = null;
  let columns: number[] = [];
  const flush = (): void => {
    if (prose.length === 0) {
      return;
    }
    output.push(transform(prose.join('\n')));
    prose.length = 0;
  };
  for (const line of content.split('\n')) {
    const next = nextProseFence(fence, line, columns);
    const boundary = fence !== next;
    if (boundary || next !== null) {
      flush();
      output.push(line);
    } else {
      prose.push(line);
    }
    if (fence === null && next === null) {
      columns = nextProseColumns(columns, line);
    }
    fence = next;
  }
  flush();
  return output.join('\n');
}

/** Turn TeX `\\(...\\)` and `\\[...\\]` into `$` math outside code. */
export function normalizeTexMath(content: string): string {
  return mapFencedProse(content, replaceTexMath);
}

/** Make Markdown safe to compile as MDX and to export without leaking hidden notes. */
export function prepareMarkdownSource(
  content: string,
  options?: { readonly preserveHtml?: boolean }
): string {
  const transform = options?.preserveHtml === true ? prepareProse : preparePlainProse;
  return mapFencedProse(fenceIndentedCode(content), transform);
}
