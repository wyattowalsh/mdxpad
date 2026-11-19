import { Parser, type Options as AcornOptions } from 'acorn';

import { isCurrencySpan } from './currency-span';
import { fenceIndentedCode, nextProseColumns, nextProseFence } from './indented-code';
import { mathDelimiterAt, mathSpanEnd } from './math-span';
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
  const end = angleDestinationEnd(value, offset);
  return end !== -1 && end >= offset + match.length;
}

function labelOnlyLine(line: string): boolean {
  return /^ {0,3}\[(?!\^)[^\]]+\]:[ \t]*$/.test(line.replace(/^(?: {0,3}> ?)*/, ''));
}

function continuesReferenceDestination(value: string, start: number, index: number): boolean {
  const current = value.slice(start, index).replace(/^(?: {0,3}> ?)*/, '');
  if (start === 0 || !/^\S*$/.test(current)) {
    return false;
  }
  const previousEnd = start - 1;
  let previousStart = previousEnd;
  while (previousStart > 0 && value[previousStart - 1] !== '\n') {
    previousStart -= 1;
  }
  return labelOnlyLine(value.slice(previousStart, previousEnd));
}

function insideBareUrl(value: string, index: number): boolean {
  let start = index;
  while (start > 0 && !/[\s<>]/.test(value[start - 1] ?? '')) {
    start -= 1;
  }
  let end = index;
  while (end < value.length && !/[\s<>]/.test(value[end] ?? '')) {
    end += 1;
  }
  const token = value.slice(start, end);
  if (/^https?:\/\//i.test(token) || /^www\./i.test(token)) {
    return true;
  }
  const plain = token.replace(/\\(.)/g, '$1').replace(/[.,;:!?]+$/u, '');
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(plain);
}

function insideReferenceDestination(value: string, index: number): boolean {
  let start = index;
  while (start > 0 && value[start - 1] !== '\n') {
    start -= 1;
  }
  const prefix = value.slice(start, index).replace(/^(?: {0,3}> ?)*/, '');
  return (
    /^ {0,3}\[(?!\^)[^\]]+\]:[ \t]+\S*$/.test(prefix) ||
    continuesReferenceDestination(value, start, index)
  );
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

function texCloserIndex(value: string, from: number, close: string): number {
  let index = from;
  while (index < value.length) {
    if (copyCodeSpan(value, index) || markdownLinkAt(value, index)) {
      return -1;
    }
    if (value.startsWith('\\\\', index)) {
      index += 2;
      continue;
    }
    if (value.startsWith(close, index)) {
      return index;
    }
    index += 1;
  }
  return -1;
}

function takeTexSpan(value: string, index: number): string | null {
  const display = value.startsWith('\\[', index);
  const inline = value.startsWith('\\(', index);
  if (!display && !inline) {
    return null;
  }
  const close = display ? '\\]' : '\\)';
  const end = texCloserIndex(value, index + 2, close);
  if (end <= index + 2) {
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

function texDelimiter(prose: string, index: number): { text: string; next: number } | null {
  const display = prose.startsWith('\\[', index);
  const inline = prose.startsWith('\\(', index);
  if (!display && !inline) {
    return null;
  }
  if (insideReferenceDestination(prose, index) || insideBareUrl(prose, index)) {
    return null;
  }
  const close = display ? '\\]' : '\\)';
  const end = texCloserIndex(prose, index + 2, close);
  if (end === -1 || end <= index + 2) {
    return null;
  }
  const interior = prose.slice(index + 2, end);
  const body = display ? renderableMathTex(interior) : inlineFormula(interior);
  return { text: display ? `$$${body}$$` : `$${body}$`, next: end + 2 };
}

function inlineFormula(interior: string): string {
  const escaped = interior.replace(/(?<!\\)\$/g, '\\$');
  return renderableMathTex(isCurrencySpan(escaped) ? `{${escaped}}` : escaped);
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
    const angle = prose[index] === '<' ? angleDestinationEnd(prose, index) : -1;
    if (angle !== -1) {
      result += prose.slice(index, angle);
      index = angle;
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
    const tex = texDelimiter(prose, index);
    if (tex) {
      result += tex.text;
      index = tex.next;
      continue;
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
