import { Parser, type Options as AcornOptions } from 'acorn';

import { isCurrencySpan } from './currency-span';
import {
  escapeLooseTags,
  escapeTemplatePlaceholders,
  linkUrlsWithEscapedAngles,
} from './markdown-tags';

const FENCE_LINE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const MDX_EXPRESSION_OPTIONS: AcornOptions = {
  ecmaVersion: 2024,
  sourceType: 'module',
  preserveParens: true,
};

function updateFence(fence: string | null, line: string): string | null {
  const match = FENCE_LINE.exec(line);
  if (!match) {
    return fence;
  }
  const marker = match[2] ?? '';
  const info = (match[3] ?? '').trim();
  if (fence === null) {
    return marker;
  }
  if (info.length === 0 && marker.startsWith(fence[0] ?? '') && marker.length >= fence.length) {
    return null;
  }
  return fence;
}

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

function rewriteAutolinks(value: string): string {
  return value
    .replace(/<(https?:\/\/[^>\s]+)>/gi, (_match, url: string) => `[${url}](${url})`)
    .replace(
      /<((?:mailto:)?)([^\s@<>:]+@[^\s@<>]+\.[^\s@<>]+)>/gi,
      (_match, scheme: string, email: string) => `[${scheme}${email}](mailto:${email})`
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
  const delimiter = value.startsWith('$$', index) ? '$$' : value[index] === '$' ? '$' : '';
  if (delimiter.length === 0) {
    return null;
  }
  const end = value.indexOf(delimiter, index + delimiter.length);
  if (end === -1) {
    return null;
  }
  const interior = value.slice(index + delimiter.length, end);
  if (interior.length === 0 || isCurrencySpan(interior)) {
    return null;
  }
  return value.slice(index, end + delimiter.length);
}

function takeTexSpan(value: string, index: number): string | null {
  const open = value.startsWith('\\[', index) ? '\\[' : value.startsWith('\\(', index) ? '\\(' : '';
  if (open.length === 0) {
    return null;
  }
  const close = open === '\\[' ? '\\]' : '\\)';
  const end = value.indexOf(close, index + open.length);
  if (end <= index + open.length) {
    return null;
  }
  return value.slice(index, end + close.length);
}

const LINK_INSIDE =
  '(?:[^()"\']|"(?:\\\\.|[^"])*"|\'(?:\\\\.|[^\'])*\'|\\([^()]*\\))*';

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

function prepareProse(prose: string): string {
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
      const end = prose.indexOf('\\]', index + 2);
      if (end !== -1 && end > index + 2) {
        result += `$$${prose.slice(index + 2, end)}$$`;
        index = end + 2;
        continue;
      }
    }
    if (prose.startsWith('\\(', index)) {
      const end = prose.indexOf('\\)', index + 2);
      if (end !== -1 && end > index + 2) {
        result += `$${prose.slice(index + 2, end)}$`;
        index = end + 2;
        continue;
      }
    }
    result += prose[index] ?? '';
    index += 1;
  }
  return result;
}

function mapFencedProse(content: string, transform: (prose: string) => string): string {
  const output: string[] = [];
  const prose: string[] = [];
  let fence: string | null = null;
  const flush = (): void => {
    if (prose.length === 0) {
      return;
    }
    output.push(transform(prose.join('\n')));
    prose.length = 0;
  };
  for (const line of content.split('\n')) {
    const next = updateFence(fence, line);
    const boundary = fence !== next;
    if (boundary || next !== null) {
      flush();
      output.push(line);
    } else {
      prose.push(line);
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
export function prepareMarkdownSource(content: string): string {
  return mapFencedProse(content, prepareProse);
}
