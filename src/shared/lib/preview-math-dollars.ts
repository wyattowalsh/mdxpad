/**
 * Keep preview math from pairing a price, address, or path with the next formula.
 * Remark-math closes at the next `$`. This pass hides dollars that are not formulas
 * and turns a bare email that contains `$` into a mailto link before that happens.
 */

import { isCurrencySpan } from './currency-span';
import { emailBoundsAt, enclosingBracketEnd, mathCloserIndex, mathDelimiterAt } from './math-span';

/** Stands in for a `$` that must not open or close preview math. */
export const PREVIEW_DOLLAR = '\uE018';

function escapedDollar(value: string, index: number): boolean {
  let count = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    count += 1;
  }
  return count % 2 === 1;
}

function codeSpanEnd(value: string, index: number): number {
  if (value[index] !== '`') {
    return -1;
  }
  let ticks = 0;
  while (value[index + ticks] === '`') {
    ticks += 1;
  }
  const marker = '`'.repeat(ticks);
  const closer = value.indexOf(marker, index + ticks);
  return closer === -1 ? -1 : closer + ticks;
}

function fencedBlockEnd(value: string, index: number): number {
  if (index > 0 && value[index - 1] !== '\n') {
    return -1;
  }
  const open = /^(?: {0,3}>[ \t]?){0,3}[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n/.exec(value.slice(index));
  const marker = open?.[1];
  if (!open || !marker) {
    return -1;
  }
  const char = marker.startsWith('`') ? '`' : '~';
  const close = new RegExp(
    `^(?: {0,3}>[ \\t]?){0,3}[ \\t]{0,3}${char}{${String(marker.length)},}[ \\t]*$`,
    'm'
  );
  const found = close.exec(value.slice(index + open[0].length));
  if (!found) {
    return value.length;
  }
  return index + open[0].length + found.index + found[0].length;
}

function passiveEnd(value: string, index: number): number {
  const code = codeSpanEnd(value, index);
  return code === -1 ? fencedBlockEnd(value, index) : code;
}

function displayMathEnd(value: string, index: number): number {
  const closer = mathCloserIndex(value, index + 2, '$$');
  return closer === -1 ? -1 : closer + 2;
}

function bracketDollarIsText(value: string, index: number): boolean {
  if (emailBoundsAt(value, index)) {
    return true;
  }
  const previous = index === 0 ? '' : (value[index - 1] ?? '');
  if (/[A-Za-z0-9_:]/.test(previous)) {
    return true;
  }
  let start = index;
  while (start > 0 && !/[\s[]/.test(value[start - 1] ?? '')) {
    start -= 1;
  }
  return /^https?:\/\//i.test(value.slice(start, index));
}

function bracketFormulaEnd(value: string, index: number, bracket: number): number {
  if (bracketDollarIsText(value, index)) {
    return -1;
  }
  let closer = index + 1;
  while (closer < bracket) {
    if (value[closer] === '\\') {
      closer += 2;
      continue;
    }
    if (value[closer] === '$') {
      break;
    }
    closer += 1;
  }
  if (closer >= bracket || value[closer] !== '$') {
    return -1;
  }
  const interior = value.slice(index + 1, closer);
  return interior.length === 0 || isCurrencySpan(interior) ? -1 : closer + 1;
}

function inlineMathEnd(value: string, index: number): number {
  const bracket = enclosingBracketEnd(value, index);
  if (bracket > index) {
    return bracketFormulaEnd(value, index, bracket);
  }
  if (mathDelimiterAt(value, index) === null) {
    return -1;
  }
  const closer = mathCloserIndex(value, index + 1, '$');
  if (closer === -1) {
    return -1;
  }
  const interior = value.slice(index + 1, closer);
  if (interior.length === 0 || interior.includes('$') || isCurrencySpan(interior)) {
    return -1;
  }
  return closer + 1;
}

function keptMathEnd(value: string, index: number): number {
  if (value[index] !== '$' || escapedDollar(value, index)) {
    return -1;
  }
  return value.startsWith('$$', index) ? displayMathEnd(value, index) : inlineMathEnd(value, index);
}

function emailAlreadyLinked(value: string, start: number): boolean {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const prefix = value.slice(lineStart, start);
  const open = prefix.lastIndexOf('[');
  if (open === -1) {
    return false;
  }
  if (!prefix.slice(open).includes(']')) {
    const lineEnd = value.indexOf('\n', start);
    const rest = value.slice(start, lineEnd === -1 ? value.length : lineEnd);
    return rest.includes('](') || rest.includes(']:');
  }
  const destination = prefix.lastIndexOf('](');
  if (destination === -1) {
    return false;
  }
  const close = value.indexOf(')', lineStart + destination + 2);
  return close === -1 || close >= start;
}

function protectBareEmailDollars(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    const skipped = passiveEnd(value, index);
    if (skipped !== -1) {
      result += value.slice(index, skipped);
      index = skipped;
      continue;
    }
    const email = value[index] === '$' ? emailBoundsAt(value, index) : null;
    const address = email ? value.slice(email.start, email.end) : '';
    const prefix = email ? value.slice(email.start, index) : '';
    if (email && address.includes('$') && !emailAlreadyLinked(value, email.start) && result.endsWith(prefix)) {
      result = result.slice(0, result.length - prefix.length);
      result += `[${address}](mailto:${address})`;
      index = email.end;
      continue;
    }
    result += value[index] ?? '';
    index += 1;
  }
  return result;
}

function maskUnsafeDollars(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    if (value[index] === '\\') {
      result += value.slice(index, index + 2);
      index += 2;
      continue;
    }
    const skipped = passiveEnd(value, index);
    if (skipped !== -1) {
      result += value.slice(index, skipped);
      index = skipped;
      continue;
    }
    const mathEnd = keptMathEnd(value, index);
    if (mathEnd !== -1) {
      result += value.slice(index, mathEnd);
      index = mathEnd;
      continue;
    }
    result += value[index] === '$' ? PREVIEW_DOLLAR : (value[index] ?? '');
    index += 1;
  }
  return result;
}

/** Hide non-formula dollars, then leave real `$...$` and `$$...$$` spans in place. */
export function preparePreviewDollars(value: string): string {
  return maskUnsafeDollars(protectBareEmailDollars(value));
}
