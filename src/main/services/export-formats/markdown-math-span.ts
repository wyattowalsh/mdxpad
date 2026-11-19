/**
 * The end of a `$...$` or `$$...$$` span.
 * An escaped dollar stays inside the formula.
 */

import { isCurrencySpan } from '@shared/lib/currency-span';

export function mathDelimiterAt(raw: string, index: number): '$' | '$$' | null {
  if (index > 0 && raw.charAt(index - 1) === '\\') {
    return null;
  }
  if (raw.startsWith('$$', index)) {
    return '$$';
  }
  return raw.charAt(index) === '$' ? '$' : null;
}

export function mathSpanEnd(raw: string, start: number, delimiter: '$' | '$$'): number {
  let cursor = start + delimiter.length;
  while (cursor < raw.length) {
    if (raw.charAt(cursor) === '\\') {
      cursor += 2;
      continue;
    }
    if (!raw.startsWith(delimiter, cursor)) {
      cursor += 1;
      continue;
    }
    const interior = raw.slice(start + delimiter.length, cursor);
    if (interior.length === 0 || isCurrencySpan(interior)) {
      return -1;
    }
    return cursor + delimiter.length;
  }
  return -1;
}
