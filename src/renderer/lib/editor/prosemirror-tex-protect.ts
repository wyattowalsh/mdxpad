import { mathDelimiterAt, mathSpanEnd, unescapedDelimiterIndex } from '@shared/lib/math-span';

export const TEX_INLINE_OPEN = '\uE013';
export const TEX_INLINE_CLOSE = '\uE014';
export const TEX_DISPLAY_OPEN = '\uE015';
export const TEX_DISPLAY_CLOSE = '\uE016';

const MATH_STAR = '\uE017';
const MATH_UNDER = '\uE018';
const MATH_DOLLAR = '\uE019';
const MATH_BACKSLASH = '\uE01A';
const MATH_LINE = '\uE01B';
const MATH_ESCAPE = '\uE01C';
export const MATH_PIPE = '\uE01D';
const ESCAPED_PUNCTUATION = /\\([!"#%&'()*+,./:;<=>?@[\]^_`{|}~-])/g;

function takeDollarMath(value: string, index: number): number {
  const delimiter = mathDelimiterAt(value, index);
  return delimiter === null ? -1 : mathSpanEnd(value, index, delimiter);
}

function strikeEnd(value: string, index: number): number {
  if (!value.startsWith('~~', index)) {
    return -1;
  }
  const end = value.indexOf('~~', index + 2);
  return end === -1 ? -1 : end + 2;
}

function texCloser(value: string, from: number, close: string): number {
  let index = from;
  while (index < value.length) {
    const code = copyCodeSpan(value, index);
    if (code) {
      index = code.next;
      continue;
    }
    const link = readLinkSpan(value, index);
    if (link) {
      index = link.next;
      continue;
    }
    const strike = strikeEnd(value, index);
    if (strike !== -1) {
      index = strike;
      continue;
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

function escapedBackslash(value: string, index: number): boolean {
  let count = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    count += 1;
  }
  return count % 2 === 1;
}

function takeTexMath(value: string, index: number): number {
  const display = value.startsWith('\\[', index);
  const inline = value.startsWith('\\(', index);
  if ((!display && !inline) || escapedBackslash(value, index)) {
    return -1;
  }
  const close = display ? '\\]' : '\\)';
  const end = texCloser(value, index + 2, close);
  if (end === -1) {
    return -1;
  }
  return end + close.length;
}

function quoteDepthBefore(value: string, index: number): number {
  const start = value.lastIndexOf('\n', index - 1) + 1;
  const prefix = value.slice(start, index);
  return prefix.match(/>/g)?.length ?? 0;
}

interface MathWrap {
  readonly open: string;
  readonly close: string;
  readonly body: string;
}

function mathWrap(value: string): MathWrap {
  const delimiter = mathDelimiterAt(value, 0);
  if (delimiter !== null && value.endsWith(delimiter) && value.length > delimiter.length * 2) {
    return {
      open: delimiter,
      close: delimiter,
      body: value.slice(delimiter.length, value.length - delimiter.length),
    };
  }
  if (value.startsWith('\\[') && value.endsWith('\\]')) {
    return { open: '\\[', close: '\\]', body: value.slice(2, -2) };
  }
  if (value.startsWith('\\(') && value.endsWith('\\)')) {
    return { open: '\\(', close: '\\)', body: value.slice(2, -2) };
  }
  return { open: '', close: '', body: value };
}

function shieldMathBody(value: string): string {
  return value
    .replaceAll('\\\\', MATH_BACKSLASH)
    .replaceAll('\\$', MATH_DOLLAR)
    .replace(ESCAPED_PUNCTUATION, (_match, punct: string) => `${MATH_ESCAPE}${punct}`)
    .replaceAll('*', MATH_STAR)
    .replaceAll('_', MATH_UNDER)
    .replaceAll('|', MATH_PIPE);
}

function lineIndent(value: string, index: number): string {
  const start = value.lastIndexOf('\n', index - 1) + 1;
  let cursor = start;
  while (value[cursor] === ' ' || value[cursor] === '\t') {
    cursor += 1;
  }
  return value.slice(start, cursor);
}

function columnWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    width = char === '\t' ? width + 4 - (width % 4) : width + 1;
  }
  return width;
}

function continuationWidth(value: string, index: number): number {
  const start = value.lastIndexOf('\n', index - 1) + 1;
  const prefix = value.slice(start, index);
  if (/^[ \t]{0,3}>/.test(prefix)) {
    return 0;
  }
  const marker = /^(?:[ \t]*)(?:[-+*]|\d{1,9}[.)])[ \t]+/.exec(prefix);
  if (marker?.[0]) {
    return columnWidth(marker[0]);
  }
  return columnWidth(lineIndent(value, index));
}

function stripColumns(line: string, width: number): string {
  let seen = 0;
  let index = 0;
  while (index < line.length && seen < width) {
    const char = line[index] ?? '';
    if (char !== ' ' && char !== '\t') {
      return line;
    }
    const next = char === '\t' ? 4 - (seen % 4) : 1;
    if (seen + next > width) {
      return line;
    }
    seen += next;
    index += 1;
  }
  return seen === width ? line.slice(index) : line;
}

function dedentMathSpan(span: string, width: number): string {
  if (width === 0 || !span.includes('\n')) {
    return span;
  }
  return span
    .split('\n')
    .map((line, index) => (index === 0 ? line : stripColumns(line, width)))
    .join('\n');
}

function lineStartsWithQuote(value: string, index: number): boolean {
  const start = value.lastIndexOf('\n', index - 1) + 1;
  return /^ {0,3}(?:>[ \t]?)+/.test(value.slice(start, index));
}

function openerListIndent(value: string, index: number): number {
  const start = value.lastIndexOf('\n', index - 1) + 1;
  const line = value.slice(start, index);
  const quoted = /^(?:>[ \t]?)*/.exec(line)?.[0] ?? '';
  const marker = /^(?:[-+*]|\d{1,9}[.)])[ \t]+/.exec(line.slice(quoted.length));
  return marker?.[0].length ?? 0;
}

function shieldMathBreaks(value: string, indent: number, quotes: number): string {
  if (quotes <= 0) {
    return value.replaceAll('\n', `\n${MATH_LINE}`);
  }
  const space = indent > 0 ? `(?: {${indent}})?` : '';
  return value.replaceAll(
    new RegExp(`\\n[ \\t]*(?:>[ \\t]?){0,${quotes}}${space}`, 'g'),
    (match) => `${match}${MATH_LINE}`
  );
}

function shieldMathPiece(value: string, indent: number, quotes: number): string {
  const wrapped = mathWrap(value);
  let shielded = shieldMathBody(wrapped.body);
  if (shielded.includes('\n')) {
    shielded = shieldMathBreaks(shielded, indent, quotes);
  }
  return `${wrapped.open}${shielded}${wrapped.close}`;
}

/** Keep emphasis markers inside formulas from being parsed as Markdown. */
export function shieldMathMarkup(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    const code = copyCodeSpan(value, index);
    if (code) {
      result += code.text;
      index = code.next;
      continue;
    }
    const link = readLinkSpan(value, index);
    if (link) {
      result += shieldLink(link.text);
      index = link.next;
      continue;
    }
    const mathEnd = takeDollarMath(value, index);
    const texEnd = mathEnd === -1 ? takeTexMath(value, index) : -1;
    const end = mathEnd === -1 ? texEnd : mathEnd;
    if (end !== -1) {
      const span = dedentMathSpan(value.slice(index, end), continuationWidth(value, index));
      const quoted = lineStartsWithQuote(value, index);
      result += shieldMathPiece(
        span,
        quoted ? openerListIndent(value, index) : -1,
        quoted ? quoteDepthBefore(value, index) : 0
      );
      index = end;
      continue;
    }
    result += value.charAt(index);
    index += 1;
  }
  return result;
}

export function restoreMathMarkup(value: string): string {
  return value
    .replaceAll(MATH_LINE, '')
    .replaceAll(MATH_STAR, '*')
    .replaceAll(MATH_UNDER, '_')
    .replaceAll(MATH_DOLLAR, '\\$')
    .replaceAll('%EE%80%9D', '|')
    .replaceAll('%ee%80%9d', '|')
    .replaceAll(MATH_PIPE, '|')
    .replaceAll(MATH_ESCAPE, '\\')
    .replaceAll(MATH_BACKSLASH, '\\\\');
}

const TEX_PAIR: Record<string, string> = {
  '\\[': TEX_DISPLAY_OPEN,
  '\\]': TEX_DISPLAY_CLOSE,
  '\\(': TEX_INLINE_OPEN,
  '\\)': TEX_INLINE_CLOSE,
};

export function copyCodeSpan(value: string, index: number): { text: string; next: number } | null {
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

export function readDestination(
  value: string,
  open: number
): { text: string; next: number } | null {
  if (value[open - 1] !== ']' || value[open] !== '(') {
    return null;
  }
  let depth = 1;
  let angled = false;
  let index = open + 1;
  while (index < value.length && depth > 0) {
    const char = value[index] ?? '';
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '<') {
      angled = true;
    } else if (char === '>') {
      angled = false;
    } else if (!angled && char === '(') {
      depth += 1;
    } else if (!angled && char === ')') {
      depth -= 1;
    }
    if (depth > 0) {
      index += 1;
    }
  }
  if (depth !== 0) {
    return null;
  }
  return { text: value.slice(open, index + 1), next: index + 1 };
}

function readBracketGroup(value: string, open: number, right: string): number {
  if (value[open] !== (right === ')' ? '(' : '[')) {
    return -1;
  }
  let index = open + 1;
  while (index < value.length) {
    if (value[index] === '\\') {
      index += 2;
      continue;
    }
    if (value[index] === right) {
      return index;
    }
    index += 1;
  }
  return -1;
}

function mapInlineTex(value: string, mapSpan: (span: string) => string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    const code = copyCodeSpan(value, index);
    if (code) {
      result += code.text;
      index = code.next;
      continue;
    }
    if (value.startsWith('\\(', index)) {
      const end = unescapedDelimiterIndex(value, index + 2, '\\)');
      if (end !== -1) {
        result += mapSpan(value.slice(index, end + 2));
        index = end + 2;
        continue;
      }
    }
    result += value[index] ?? '';
    index += 1;
  }
  return result;
}

function shieldLabelFormula(label: string): string {
  return mapInlineTex(label, (span) => protectTexDelimiters(shieldMathMarkup(span)));
}

function isInlineSpace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function skipDestination(raw: string): number {
  let index = 0;
  while (index < raw.length && isInlineSpace(raw[index] ?? '')) {
    index += 1;
  }
  if (raw[index] === '<') {
    const close = raw.indexOf('>', index + 1);
    return close === -1 ? raw.length : close + 1;
  }
  let depth = 0;
  while (index < raw.length) {
    const char = raw[index] ?? '';
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '(') {
      depth += 1;
    } else if (char === ')' && depth > 0) {
      depth -= 1;
    } else if (isInlineSpace(char) && depth === 0) {
      break;
    }
    index += 1;
  }
  return index;
}

function shieldTitleInDestination(raw: string): string {
  let index = skipDestination(raw);
  while (index < raw.length && isInlineSpace(raw[index] ?? '')) {
    index += 1;
  }
  const opener = raw[index];
  if (opener !== '"' && opener !== "'" && opener !== '(') {
    return raw;
  }
  const closer = opener === '(' ? ')' : opener;
  const contentStart = index + 1;
  let cursor = contentStart;
  while (cursor < raw.length) {
    if (raw[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (raw[cursor] === closer) {
      break;
    }
    cursor += 1;
  }
  if (raw[cursor] !== closer) {
    return raw;
  }
  const title = raw.slice(contentStart, cursor);
  return raw.slice(0, contentStart) + shieldLabelFormula(title) + raw.slice(cursor);
}

function shieldDestinationTitle(link: string): string {
  const start = link.startsWith('![') ? 1 : 0;
  const labelEnd = readBracketGroup(link, start, ']');
  if (labelEnd === -1 || link[labelEnd + 1] !== '(') {
    return link;
  }
  const destination = readDestination(link, labelEnd + 1);
  if (!destination) {
    return link;
  }
  const insideStart = labelEnd + 2;
  const insideEnd = destination.next - 1;
  const inside = link.slice(insideStart, insideEnd);
  const titled = shieldTitleInDestination(inside);
  if (titled === inside) {
    return link;
  }
  return link.slice(0, insideStart) + titled + link.slice(insideEnd);
}

function shieldLink(link: string): string {
  return shieldDestinationTitle(withLinkLabel(link, shieldLabelFormula));
}

function withLinkLabel(link: string, map: (label: string) => string): string {
  const open = link.startsWith('![') ? 1 : 0;
  const labelEnd = readBracketGroup(link, open, ']');
  if (labelEnd === -1) {
    return link;
  }
  return link.slice(0, open + 1) + map(link.slice(open + 1, labelEnd)) + link.slice(labelEnd);
}

/** A whole link. Formulas in the label stay formulas; the address stays literal. */
export function readLinkSpan(value: string, index: number): { text: string; next: number } | null {
  const start = value[index] === '!' && value[index + 1] === '[' ? index + 1 : index;
  if (value[start] !== '[') {
    return null;
  }
  const labelEnd = readBracketGroup(value, start, ']');
  if (labelEnd === -1) {
    return null;
  }
  const destination = readDestination(value, labelEnd + 1);
  if (destination) {
    return { text: value.slice(index, destination.next), next: destination.next };
  }
  if (value[labelEnd + 1] !== '[') {
    return null;
  }
  const referenceEnd = readBracketGroup(value, labelEnd + 1, ']');
  if (referenceEnd === -1) {
    return null;
  }
  return { text: value.slice(index, referenceEnd + 1), next: referenceEnd + 1 };
}

function matchedTex(value: string): Set<number> {
  const matched = new Set<number>();
  const stack: { index: number; close: string }[] = [];
  let index = 0;
  while (index < value.length) {
    const code = copyCodeSpan(value, index);
    if (code) {
      index = code.next;
      continue;
    }
    const link = readLinkSpan(value, index);
    if (link) {
      index = link.next;
      continue;
    }
    const destination = readDestination(value, index);
    if (destination) {
      index = destination.next;
      continue;
    }
    if (value.charAt(index) === '\\' && value.charAt(index + 1) === '\\') {
      index += 2;
      continue;
    }
    const token = value.slice(index, index + 2);
    if (token === '\\[' || token === '\\(') {
      stack.push({ index, close: token === '\\[' ? '\\]' : '\\)' });
      index += 2;
      continue;
    }
    const top = stack[stack.length - 1];
    if (top?.close === token) {
      stack.pop();
      matched.add(top.index);
      matched.add(index);
      index += 2;
      continue;
    }
    index += 1;
  }
  return matched;
}

/** Hide matched TeX delimiters from Markdown, leaving escaped parentheses in link addresses. */
export function protectTexDelimiters(value: string): string {
  const matched = matchedTex(value);
  let result = '';
  let index = 0;
  while (index < value.length) {
    const code = copyCodeSpan(value, index);
    if (code) {
      result += code.text;
      index = code.next;
      continue;
    }
    const link = readLinkSpan(value, index);
    if (link) {
      result += link.text;
      index = link.next;
      continue;
    }
    const destination = readDestination(value, index);
    if (destination) {
      result += destination.text;
      index = destination.next;
      continue;
    }
    const pair = TEX_PAIR[value.slice(index, index + 2)];
    if (pair && matched.has(index)) {
      result += pair;
      index += 2;
      continue;
    }
    result += value.charAt(index);
    index += 1;
  }
  return result;
}
