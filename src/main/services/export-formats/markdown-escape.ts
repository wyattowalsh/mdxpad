import { readMarkdownTarget } from './markdown-link';

const ESCAPE_MARK = '\uE011';
const PUNCTUATION = new Set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~');

export interface CodeSpan {
  readonly text: string;
  readonly end: number;
}

function codeSpanText(text: string): string {
  if (text.length > 1 && text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)) {
    return text.slice(1, -1);
  }
  return text;
}

/** A code span opened and closed by the same number of backticks. */
export function readCodeSpan(raw: string, start: number): CodeSpan | null {
  if (raw[start] !== '`' || (start > 0 && raw[start - 1] === '`')) {
    return null;
  }
  let length = 0;
  while (raw[start + length] === '`') {
    length += 1;
  }
  let cursor = start + length;
  while (cursor < raw.length) {
    if (raw[cursor] !== '`') {
      cursor += 1;
      continue;
    }
    let run = 0;
    while (raw[cursor + run] === '`') {
      run += 1;
    }
    if (run === length) {
      return { text: codeSpanText(raw.slice(start + length, cursor)), end: cursor + run };
    }
    cursor += run;
  }
  return null;
}

export function findCodeSpan(
  raw: string,
  from: number
): (CodeSpan & { readonly start: number }) | null {
  for (let index = from; index < raw.length; index += 1) {
    const span = readCodeSpan(raw, index);
    if (span) {
      return { ...span, start: index };
    }
  }
  return null;
}

export function splitCodeSpans(
  raw: string
): readonly { readonly code: boolean; readonly text: string }[] {
  const parts: { code: boolean; text: string }[] = [];
  let index = 0;
  while (index < raw.length) {
    const span = findCodeSpan(raw, index);
    if (!span) {
      parts.push({ code: false, text: raw.slice(index) });
      break;
    }
    if (span.start > index) {
      parts.push({ code: false, text: raw.slice(index, span.start) });
    }
    parts.push({ code: true, text: span.text });
    index = span.end;
  }
  return parts.length > 0 ? parts : [{ code: false, text: raw }];
}

export interface ProtectedEscapes {
  readonly text: string;
  readonly chars: readonly string[];
}

function shiftEscapeMarks(text: string, offset: number): string {
  return text.replaceAll(
    new RegExp(`${ESCAPE_MARK}(\\d+)${ESCAPE_MARK}`, 'g'),
    (_match, slot: string) => `${ESCAPE_MARK}${Number(slot) + offset}${ESCAPE_MARK}`
  );
}

/** Leave backslash escapes in a link address for the destination parser. */
function protectLink(
  raw: string,
  index: number,
  already: number
): { text: string; chars: string[]; next: number } | null {
  if (raw[index] !== '[' && !(raw[index] === '!' && raw[index + 1] === '[')) {
    return null;
  }
  const target = readMarkdownTarget(raw, index);
  if (target?.start !== index) {
    return null;
  }
  const labelStart = index + (target.image ? 2 : 1);
  const labelEnd = labelStart + target.label.length;
  const label = protectEscapes(raw.slice(labelStart, labelEnd));
  return {
    text:
      raw.slice(index, labelStart) +
      shiftEscapeMarks(label.text, already) +
      raw.slice(labelEnd, target.end),
    chars: [...label.chars],
    next: target.end,
  };
}

function dollarMathEnd(raw: string, index: number): number {
  const marker = raw.startsWith('$$', index) ? '$$' : '$';
  let cursor = index + marker.length;
  while (cursor < raw.length) {
    if (raw.charAt(cursor) === '\\') {
      cursor += 2;
      continue;
    }
    if (raw.startsWith(marker, cursor)) {
      const end = cursor + marker.length;
      return raw.slice(index, end).includes('\\') ? end : index;
    }
    cursor += 1;
  }
  return index;
}

/** Keep a backslash escape literal outside code spans. */
export function protectEscapes(raw: string): ProtectedEscapes {
  const chars: string[] = [];
  let text = '';
  let index = 0;
  while (index < raw.length) {
    const current = raw.charAt(index);
    if (current === '`') {
      const span = readCodeSpan(raw, index);
      text += span ? raw.slice(index, span.end) : current;
      index = span ? span.end : index + 1;
      continue;
    }
    if (current === '$') {
      const mathEnd = dollarMathEnd(raw, index);
      if (mathEnd > index) {
        text += raw.slice(index, mathEnd);
        index = mathEnd;
        continue;
      }
    }
    const link = protectLink(raw, index, chars.length);
    if (link) {
      text += link.text;
      chars.push(...link.chars);
      index = link.next;
      continue;
    }
    const next = raw.charAt(index + 1);
    if (current === '\\' && PUNCTUATION.has(next)) {
      text += `${ESCAPE_MARK}${chars.length}${ESCAPE_MARK}`;
      chars.push(next);
      index += 2;
      continue;
    }
    text += current;
    index += 1;
  }
  return { text, chars };
}

export function restoreEscapes(
  value: string,
  chars: readonly string[],
  render: (char: string) => string
): string {
  return value.replaceAll(
    new RegExp(`${ESCAPE_MARK}(\\d+)${ESCAPE_MARK}`, 'g'),
    (_match, slot: string) => {
      const char = chars[Number(slot)];
      return char ? render(char) : '';
    }
  );
}
