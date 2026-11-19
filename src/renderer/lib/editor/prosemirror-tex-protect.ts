import { isCurrencySpan } from '@shared/lib/currency-span';

export const TEX_INLINE_OPEN = '\uE013';
export const TEX_INLINE_CLOSE = '\uE014';
export const TEX_DISPLAY_OPEN = '\uE015';
export const TEX_DISPLAY_CLOSE = '\uE016';

const MATH_STAR = '\uE017';
const MATH_UNDER = '\uE018';

function takeDollarMath(value: string, index: number): number {
  if (index > 0 && value[index - 1] === '\\') {
    return -1;
  }
  const delimiter = value.startsWith('$$', index) ? '$$' : value[index] === '$' ? '$' : '';
  if (delimiter.length === 0) {
    return -1;
  }
  const end = value.indexOf(delimiter, index + delimiter.length);
  if (end === -1) {
    return -1;
  }
  const interior = value.slice(index + delimiter.length, end);
  if (interior.length === 0 || isCurrencySpan(interior)) {
    return -1;
  }
  return end + delimiter.length;
}

function takeTexMath(value: string, index: number): number {
  const open = value.startsWith('\\[', index) ? '\\[' : value.startsWith('\\(', index) ? '\\(' : '';
  if (open.length === 0) {
    return -1;
  }
  const close = open === '\\[' ? '\\]' : '\\)';
  const end = value.indexOf(close, index + open.length);
  if (end === -1) {
    return -1;
  }
  return end + close.length;
}

function shieldMathPiece(value: string): string {
  return value.replaceAll('*', MATH_STAR).replaceAll('_', MATH_UNDER);
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
      result += shieldMathPiece(value.slice(index, end));
      index = end;
      continue;
    }
    result += value.charAt(index);
    index += 1;
  }
  return result;
}

export function restoreMathMarkup(value: string): string {
  return value.replaceAll(MATH_STAR, '*').replaceAll(MATH_UNDER, '_');
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
