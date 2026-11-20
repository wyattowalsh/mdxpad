import { readCodeSpan } from './markdown-escape';

export interface HighlightSpan {
  readonly start: number;
  readonly end: number;
  readonly inner: string;
}

function skipHtmlTag(value: string, index: number): number {
  if (value[index] !== '<') {
    return index;
  }
  const match = /^<\/?[A-Za-z][^>\n]*>/.exec(value.slice(index));
  return match ? index + match[0].length : index;
}

function isHighlightOpen(value: string, index: number): boolean {
  if (!value.startsWith('==', index)) {
    return false;
  }
  if (index > 0 && value[index - 1] === '=') {
    return false;
  }
  const next = value[index + 2];
  return next !== undefined && next !== '=' && !/\s/.test(next);
}

function highlightClose(value: string, from: number): number {
  for (let index = from; index < value.length; index += 1) {
    if (value[index] === '\n') {
      return -1;
    }
    const next = value[index + 2];
    const previous = value[index - 1];
    if (
      value.startsWith('==', index) &&
      previous !== '=' &&
      next !== '=' &&
      previous !== undefined &&
      !/\s/.test(previous)
    ) {
      return index;
    }
  }
  return -1;
}

/** The next `==highlight==` pair outside code, with no spaces against the markers. */
export function findHighlight(value: string, from: number): HighlightSpan | null {
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
    if (isHighlightOpen(value, index)) {
      const close = highlightClose(value, index + 2);
      if (close !== -1) {
        return { start: index, end: close + 2, inner: value.slice(index + 2, close) };
      }
    }
    index += 1;
  }
  return null;
}
