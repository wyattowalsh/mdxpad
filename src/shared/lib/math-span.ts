/**
 * The end of a `$...$` or `$$...$$` span.
 * An escaped dollar stays inside the formula.
 */

import { isCurrencySpan } from './currency-span';

function escapedAt(raw: string, index: number): boolean {
  let count = 0;
  for (let cursor = index - 1; cursor >= 0 && raw[cursor] === '\\'; cursor -= 1) {
    count += 1;
  }
  return count % 2 === 1;
}

function bracketClose(raw: string, open: number): number {
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
      return cursor;
    }
  }
  return -1;
}

function dollarInBrackets(raw: string, index: number): boolean {
  if (raw[index] !== '$') {
    return false;
  }
  let depth = 0;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const char = raw[cursor] ?? '';
    if (char === '\n') {
      return false;
    }
    if (char === ']') {
      if (!escapedAt(raw, cursor)) {
        depth += 1;
      }
      continue;
    }
    if (char !== '[' || escapedAt(raw, cursor)) {
      continue;
    }
    if (depth > 0) {
      depth -= 1;
      continue;
    }
    return bracketClose(raw, cursor) > index;
  }
  return false;
}

function dollarInUrl(raw: string, index: number): boolean {
  if (raw[index] !== '$') {
    return false;
  }
  let start = index;
  while (start > 0 && !/\s/.test(raw[start - 1] ?? '')) {
    start -= 1;
  }
  const from = raw[start] === '(' ? start + 1 : start;
  const match = /^https?:\/\/[^\s<]+/i.exec(raw.slice(from));
  if (!match) {
    return false;
  }
  const end = from + match[0].length;
  return index >= from && index < end;
}

function dollarInEmail(raw: string, index: number): boolean {
  if (raw[index] !== '$') {
    return false;
  }
  let start = index;
  while (start > 0 && /[A-Za-z0-9+._$]/.test(raw[start - 1] ?? '')) {
    start -= 1;
  }
  const match =
    /^[A-Za-z0-9+._$]+@[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?)+/.exec(
      raw.slice(start)
    );
  if (!match) {
    return false;
  }
  const end = start + match[0].length;
  return index >= start && index < end;
}

function escapedDelimiter(raw: string, index: number): boolean {
  let count = 0;
  for (let cursor = index - 1; cursor >= 0 && raw.charAt(cursor) === '\\'; cursor -= 1) {
    count += 1;
  }
  return count % 2 === 1;
}

function parenClose(raw: string, open: number): number {
  let depth = 0;
  for (let cursor = open; cursor < raw.length; cursor += 1) {
    const char = raw[cursor] ?? '';
    if (char === '\\') {
      cursor += 1;
      continue;
    }
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char !== ')') {
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return cursor;
    }
  }
  return -1;
}

function dollarCrossesParen(raw: string, index: number): boolean {
  if (raw[index] !== '$' || raw[index + 1] === '$') {
    return false;
  }
  let depth = 0;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const char = raw[cursor] ?? '';
    if (char === '\n') {
      return false;
    }
    if (char === ')') {
      if (!escapedAt(raw, cursor)) {
        depth += 1;
      }
      continue;
    }
    if (char !== '(' || escapedAt(raw, cursor)) {
      continue;
    }
    if (depth > 0) {
      depth -= 1;
      continue;
    }
    const close = parenClose(raw, cursor);
    if (close < index) {
      return false;
    }
    const next = unescapedDelimiterIndex(raw, index + 1, '$');
    return next === -1 || next > close;
  }
  return false;
}

function dollarGluedToWord(raw: string, index: number): boolean {
  if (raw[index] !== '$' || raw[index + 1] === '$') {
    return false;
  }
  const previous = index === 0 ? '' : (raw[index - 1] ?? '');
  return /[A-Za-z0-9_:]/.test(previous);
}

export function mathDelimiterAt(raw: string, index: number): '$' | '$$' | null {
  if (
    raw.charAt(index) !== '$' ||
    escapedDelimiter(raw, index) ||
    dollarInEmail(raw, index) ||
    dollarInBrackets(raw, index) ||
    dollarInUrl(raw, index) ||
    dollarCrossesParen(raw, index) ||
    dollarGluedToWord(raw, index)
  ) {
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
    if (
      delimiter === '$' &&
      raw[index] === '$' &&
      (dollarInEmail(raw, index) || dollarInBrackets(raw, index) || dollarInUrl(raw, index))
    ) {
      index += 1;
      continue;
    }
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
