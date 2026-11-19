/**
 * The end of a `$...$` or `$$...$$` span.
 * An escaped dollar stays inside the formula.
 */

import { isCurrencySpan } from './currency-span';

function escapedDelimiter(raw: string, index: number): boolean {
  let count = 0;
  for (let cursor = index - 1; cursor >= 0 && raw.charAt(cursor) === '\\'; cursor -= 1) {
    count += 1;
  }
  return count % 2 === 1;
}

export function mathDelimiterAt(raw: string, index: number): '$' | '$$' | null {
  if (raw.charAt(index) !== '$' || escapedDelimiter(raw, index)) {
    return null;
  }
  if (raw.startsWith('$$', index)) {
    return '$$';
  }
  return '$';
}

/** The next delimiter, skipping a backslash escape such as `\\)` or `\$`. */
export function unescapedDelimiterIndex(raw: string, from: number, delimiter: string): number {
  let cursor = from;
  while (cursor < raw.length) {
    if (raw.startsWith(delimiter, cursor)) {
      return cursor;
    }
    if (raw.charAt(cursor) === '\\') {
      cursor += 2;
      continue;
    }
    cursor += 1;
  }
  return -1;
}

export function mathCloserIndex(raw: string, from: number, delimiter: '$' | '$$'): number {
  return unescapedDelimiterIndex(raw, from, delimiter);
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
