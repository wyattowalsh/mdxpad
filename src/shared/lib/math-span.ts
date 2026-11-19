/**
 * The end of a `$...$` or `$$...$$` span.
 * An escaped dollar stays inside the formula.
 */

import { isCurrencySpan } from './currency-span';

export function mathDelimiterAt(raw: string, index: number): '$' | '$$' | null {
  if (index > 0 && raw.charAt(index - 1) === '\\') {
    return null;
  }
  if (raw.startsWith('$$', index)) {
    return '$$';
  }
  return raw.charAt(index) === '$' ? '$' : null;
}

export function mathCloserIndex(raw: string, from: number, delimiter: '$' | '$$'): number {
  let cursor = from;
  while (cursor < raw.length) {
    if (raw.charAt(cursor) === '\\') {
      cursor += 2;
      continue;
    }
    if (raw.startsWith(delimiter, cursor)) {
      return cursor;
    }
    cursor += 1;
  }
  return -1;
}

export function mathSpanEnd(raw: string, start: number, delimiter: '$' | '$$'): number {
  const cursor = mathCloserIndex(raw, start + delimiter.length, delimiter);
  if (cursor === -1) {
    return -1;
  }
  const interior = raw.slice(start + delimiter.length, cursor);
  if (interior.length === 0 || isCurrencySpan(interior)) {
    return -1;
  }
  return cursor + delimiter.length;
}

export function nextMathDelimiter(
  raw: string,
  from: number
): { index: number; delimiter: '$' | '$$' } | null {
  let index = from;
  while (index < raw.length) {
    if (raw.charAt(index) === '\\') {
      index += 2;
      continue;
    }
    const delimiter = mathDelimiterAt(raw, index);
    if (delimiter !== null) {
      return { index, delimiter };
    }
    index += 1;
  }
  return null;
}
