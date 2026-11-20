import { readCodeSpan } from './markdown-escape';

export interface PairedMark {
  readonly kind: 'highlight' | 'underline' | 'superscript' | 'subscript';
  readonly start: number;
  readonly end: number;
  readonly inner: string;
}

const MARKERS = [
  { char: '=', kind: 'highlight', width: 2 },
  { char: '+', kind: 'underline', width: 2 },
  { char: '^', kind: 'superscript', width: 1 },
  { char: '~', kind: 'subscript', width: 1 },
] as const;

function skipHtmlTag(value: string, index: number): number {
  if (value[index] !== '<') {
    return index;
  }
  const match = /^<\/?[A-Za-z][^>\n]*>/.exec(value.slice(index));
  return match ? index + match[0].length : index;
}

function isMarkOpen(value: string, index: number, char: string, width: number): boolean {
  const token = char.repeat(width);
  if (!value.startsWith(token, index)) {
    return false;
  }
  if (index > 0 && value[index - 1] === char) {
    return false;
  }
  const next = value[index + width];
  return next !== undefined && next !== char && !/\s/.test(next);
}

function markClose(value: string, from: number, char: string, width: number): number {
  const token = char.repeat(width);
  for (let index = from; index < value.length; index += 1) {
    if (value[index] === '\n') {
      return -1;
    }
    const next = value[index + width];
    const previous = value[index - 1];
    if (
      value.startsWith(token, index) &&
      previous !== char &&
      next !== char &&
      previous !== undefined &&
      !/\s/.test(previous)
    ) {
      return index;
    }
  }
  return -1;
}

/** The next paired `==`, `++`, `^`, or `~` mark outside code. */
export function findPairedMark(value: string, from: number): PairedMark | null {
  let index = from;
  while (index < value.length) {
    if (value[index] === '`') {
      const code = readCodeSpan(value, index);
      if (code && code.end > index) {
        index = code.end;
        continue;
      }
    }
    if (value.startsWith('<code', index)) {
      const end = value.indexOf('</code>', index);
      index = end === -1 ? value.length : end + '</code>'.length;
      continue;
    }
    const tagEnd = skipHtmlTag(value, index);
    if (tagEnd > index) {
      index = tagEnd;
      continue;
    }
    for (const marker of MARKERS) {
      if (!isMarkOpen(value, index, marker.char, marker.width)) {
        continue;
      }
      const close = markClose(value, index + marker.width, marker.char, marker.width);
      if (close === -1) {
        continue;
      }
      return {
        kind: marker.kind,
        start: index,
        end: close + marker.width,
        inner: value.slice(index + marker.width, close),
      };
    }
    index += 1;
  }
  return null;
}
