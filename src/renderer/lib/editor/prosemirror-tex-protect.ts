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
const ESCAPED_PUNCTUATION = /\\([!"#%&'()*+,./:;<=>?@[\]^_`{|}~-])/g;

function takeDollarMath(value: string, index: number): number {
  const delimiter = mathDelimiterAt(value, index);
  return delimiter === null ? -1 : mathSpanEnd(value, index, delimiter);
}

function takeTexMath(value: string, index: number): number {
  const open = value.startsWith('\\[', index) ? '\\[' : value.startsWith('\\(', index) ? '\\(' : '';
  if (open.length === 0) {
    return -1;
  }
  const close = open === '\\[' ? '\\]' : '\\)';
  const end = unescapedDelimiterIndex(value, index + open.length, close);
  if (end === -1) {
    return -1;
  }
  return end + close.length;
}

function openedInsideQuote(value: string, index: number): boolean {
  const start = value.lastIndexOf('\n', index - 1) + 1;
  const prefix = value.slice(start, index);
  return prefix.includes('>') && /^(?:>[ \t]*)+$/.test(prefix);
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
    .replaceAll('_', MATH_UNDER);
}

function lineIndent(value: string, index: number): string {
  const start = value.lastIndexOf('\n', index - 1) + 1;
  let cursor = start;
  while (value[cursor] === ' ' || value[cursor] === '\t') {
    cursor += 1;
  }
  return value.slice(start, cursor);
}

function dedentMathSpan(span: string, indent: string): string {
  if (indent.length === 0 || !span.includes('\n')) {
    return span;
  }
  return span
    .split('\n')
    .map((line, index) => (index > 0 && line.startsWith(indent) ? line.slice(indent.length) : line))
    .join('\n');
}

function shieldMathPiece(value: string, shieldLines: boolean): string {
  const wrapped = mathWrap(value);
  let shielded = shieldMathBody(wrapped.body);
  if (shieldLines && shielded.includes('\n')) {
    shielded = shielded.replaceAll('\n', `\n${MATH_LINE}`);
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
    const mathEnd = takeDollarMath(value, index);
    const texEnd = mathEnd === -1 ? takeTexMath(value, index) : -1;
    const end = mathEnd === -1 ? texEnd : mathEnd;
    if (end !== -1) {
      const span = dedentMathSpan(value.slice(index, end), lineIndent(value, index));
      result += shieldMathPiece(span, !openedInsideQuote(value, index));
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
    .replaceAll(MATH_ESCAPE, '\\')
    .replaceAll(MATH_BACKSLASH, '\\\\');
}

const TEX_PAIR: Record<string, string> = {
  '\\[': TEX_DISPLAY_OPEN,
  '\\]': TEX_DISPLAY_CLOSE,
  '\\(': TEX_INLINE_OPEN,
  '\\)': TEX_INLINE_CLOSE,
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

function readDestination(value: string, open: number): { text: string; next: number } | null {
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
