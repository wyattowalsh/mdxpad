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

function codeSpanEnd(raw: string, index: number): number {
  if (raw[index] !== '`') {
    return -1;
  }
  let ticks = 0;
  while (raw[index + ticks] === '`') {
    ticks += 1;
  }
  const marker = '`'.repeat(ticks);
  const closer = raw.indexOf(marker, index + ticks);
  return closer === -1 ? -1 : closer + ticks;
}

function linkBlocksMath(raw: string, index: number): boolean {
  const open = raw[index] === '!' && raw[index + 1] === '[' ? index + 1 : index;
  if (raw[open] !== '[') {
    return false;
  }
  let depth = 0;
  for (let cursor = open; cursor < raw.length; cursor += 1) {
    const char = raw[cursor] ?? '';
    if (char === '\\') {
      cursor += 1;
      continue;
    }
    if (char === '[') {
      depth += 1;
      continue;
    }
    if (char !== ']') {
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return raw[cursor + 1] === '(';
    }
  }
  return false;
}

export function mathCloserIndex(raw: string, from: number, delimiter: '$' | '$$'): number {
  let index = from;
  while (index < raw.length) {
    if (delimiter === '$') {
      const codeEnd = codeSpanEnd(raw, index);
      if (codeEnd !== -1) {
        if (raw.slice(index, codeEnd).includes('$')) {
          return -1;
        }
        index = codeEnd;
        continue;
      }
      if (linkBlocksMath(raw, index)) {
        return -1;
      }
    }
    if (raw.startsWith(delimiter, index) && !escapedDelimiter(raw, index)) {
      return index;
    }
    index += raw[index] === '\\' ? 2 : 1;
  }
  return -1;
}

function hasAlignmentTab(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '\\') {
      index += 1;
      continue;
    }
    if (value[index] === '&') {
      return true;
    }
  }
  return false;
}

export function mathSpanEnd(raw: string, start: number, delimiter: '$' | '$$'): number {
  const cursor = mathCloserIndex(raw, start + delimiter.length, delimiter);
  if (cursor === -1) {
    return -1;
  }
  const interior = raw.slice(start + delimiter.length, cursor);
  if (interior.length === 0) {
    return -1;
  }
  if (delimiter === '$' && (isCurrencySpan(interior) || hasAlignmentTab(interior))) {
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
