import { readCodeSpan } from './markdown-escape';

export interface PairedMark {
  readonly kind: 'highlight' | 'underline';
  readonly start: number;
  readonly end: number;
  readonly inner: string;
}

const MARKERS = [
  { char: '=', kind: 'highlight' },
  { char: '+', kind: 'underline' },
] as const;

function skipHtmlTag(value: string, index: number): number {
  if (value[index] !== '<') {
    return index;
  }
  const match = /^<\/?[A-Za-z][^>\n]*>/.exec(value.slice(index));
  return match ? index + match[0].length : index;
}

function isMarkOpen(value: string, index: number, char: string): boolean {
  const token = char.repeat(2);
  if (!value.startsWith(token, index)) {
    return false;
  }
  if (index > 0 && value[index - 1] === char) {
    return false;
  }
  const next = value[index + 2];
  return next !== undefined && next !== char && !/\s/.test(next);
}

function markClose(value: string, from: number, char: string): number {
  const token = char.repeat(2);
  for (let index = from; index < value.length; index += 1) {
    if (value[index] === '\n') {
      return -1;
    }
    const next = value[index + 2];
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

/** The next `==highlight==` or `++underline++` pair outside code. */
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
      if (!isMarkOpen(value, index, marker.char)) {
        continue;
      }
      const close = markClose(value, index + 2, marker.char);
      if (close === -1) {
        continue;
      }
      return {
        kind: marker.kind,
        start: index,
        end: close + 2,
        inner: value.slice(index + 2, close),
      };
    }
    index += 1;
  }
  return null;
}
