import { canOpenEmphasis, canOpenStrikethrough, containsColumnPipe } from '@shared/lib/emphasis-flank';
import { skipHtmlElement } from '@shared/lib/html-element-span';
import { mathDelimiterAt, mathSpanEnd, unescapedDelimiterIndex } from '@shared/lib/math-span';

import { MATH_PIPE, copyCodeSpan, readDestination } from './prosemirror-tex-protect';

interface TextSpan {
  readonly text: string;
  readonly next: number;
}

function readInlineLink(value: string, index: number): TextSpan | null {
  const image = value[index] === '!' && value[index + 1] === '[';
  const labelOpen = image ? index + 1 : value[index] === '[' ? index : -1;
  if (labelOpen === -1) {
    return null;
  }
  let depth = 0;
  let cursor = labelOpen;
  while (cursor < value.length) {
    const char = value[cursor] ?? '';
    if (char === '\\') {
      cursor += 2;
      continue;
    }
    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        break;
      }
    }
    cursor += 1;
  }
  if (value[cursor] !== ']') {
    return null;
  }
  const from = image ? index : labelOpen;
  const destination = readDestination(value, cursor + 1);
  if (destination !== null) {
    return { text: value.slice(from, destination.next), next: destination.next };
  }
  const reference = readReferenceTail(value, cursor);
  return reference === null ? null : { text: value.slice(from, reference), next: reference };
}

function readReferenceTail(value: string, labelEnd: number): number | null {
  if (value[labelEnd + 1] !== '[') {
    return null;
  }
  let depth = 0;
  let ref = labelEnd + 1;
  while (ref < value.length) {
    const char = value[ref] ?? '';
    if (char === '\\') {
      ref += 2;
      continue;
    }
    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return ref + 1;
      }
    }
    ref += 1;
  }
  return null;
}

function readAutolink(value: string, index: number): TextSpan | null {
  if (value[index] !== '<') {
    return null;
  }
  const end = value.indexOf('>', index + 1);
  if (end === -1) {
    return null;
  }
  const body = value.slice(index + 1, end);
  if (body.includes('\n') || body.includes(' ')) {
    return null;
  }
  const url = /^https?:\/\//i.test(body) || body.includes('@');
  return url ? { text: value.slice(index, end + 1), next: end + 1 } : null;
}

function emphasisMarker(value: string, index: number): string {
  if (value.startsWith('~~', index)) {
    return '~~';
  }
  if (value.startsWith('**', index)) {
    return '**';
  }
  if (value.startsWith('__', index)) {
    return '__';
  }
  if (value[index] === '*' && value[index + 1] !== '*') {
    return '*';
  }
  if (value[index] === '_' && value[index + 1] !== '_') {
    return '_';
  }
  return '';
}

function readEmphasis(value: string, index: number): TextSpan | null {
  const marker = emphasisMarker(value, index);
  if (marker.length === 0) {
    return null;
  }
  const opens =
    marker === '~~' ? canOpenStrikethrough(value, index) : canOpenEmphasis(value, index);
  if (!opens) {
    return null;
  }
  const end = value.indexOf(marker, index + marker.length);
  if (end === -1 || containsColumnPipe(value.slice(index, end))) {
    return null;
  }
  return { text: value.slice(index, end + marker.length), next: end + marker.length };
}

function hideUnescapedPipes(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? '';
    if (char === '\\') {
      result += `${char}${value[index + 1] ?? ''}`;
      index += 1;
      continue;
    }
    result += char === '|' ? MATH_PIPE : char;
  }
  return result;
}

function protectedSpan(value: string, index: number): TextSpan | null {
  const code = copyCodeSpan(value, index);
  if (code) {
    return code;
  }
  const link = readInlineLink(value, index);
  if (link) {
    return link;
  }
  const autolink = readAutolink(value, index);
  if (autolink) {
    return autolink;
  }
  const htmlEnd = skipHtmlElement(value, index);
  if (htmlEnd > index) {
    return { text: value.slice(index, htmlEnd), next: htmlEnd };
  }
  return readEmphasis(value, index);
}

function mathEndAt(value: string, index: number): number {
  const delimiter = mathDelimiterAt(value, index);
  if (delimiter !== null) {
    return mathSpanEnd(value, index, delimiter);
  }
  const open = value.startsWith('\\[', index) ? '\\[' : value.startsWith('\\(', index) ? '\\(' : '';
  if (open.length === 0) {
    return -1;
  }
  const close = open === '\\[' ? '\\]' : '\\)';
  const end = unescapedDelimiterIndex(value, index + open.length, close);
  return end === -1 ? -1 : end + close.length;
}

/** Keep a bar inside code, a link, or emphasis from splitting a table cell. */
export function shieldCellPipes(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    const span = protectedSpan(value, index);
    if (span) {
      result += hideUnescapedPipes(span.text);
      index = span.next;
      continue;
    }
    result += value[index] ?? '';
    index += 1;
  }
  return result;
}

/** Escape a table-cell bar, leaving one inside a formula, code, link, or emphasis. */
export function escapeTableCell(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    const code = copyCodeSpan(value, index);
    if (code) {
      result += code.text;
      index = code.next;
      continue;
    }
    const mathEnd = mathEndAt(value, index);
    if (mathEnd > index) {
      result += value.slice(index, mathEnd);
      index = mathEnd;
      continue;
    }
    const span = protectedSpan(value, index);
    if (span && span.next > index) {
      result += span.text;
      index = span.next;
      continue;
    }
    const char = value[index] ?? '';
    result += char === '|' && value[index - 1] !== '\\' ? '\\|' : char;
    index += 1;
  }
  return result;
}
