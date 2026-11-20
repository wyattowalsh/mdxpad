import { readCodeSpan } from './markdown-escape';

export interface PhraseTag {
  readonly kind: 'mark' | 'underline';
  readonly start: number;
  readonly end: number;
  readonly inner: string;
}

function phraseKind(name: string): PhraseTag['kind'] | null {
  switch (name.toLowerCase()) {
    case 'mark':
      return 'mark';
    case 'u':
      return 'underline';
    default:
      return null;
  }
}

function phraseAt(value: string, index: number): PhraseTag | null {
  if (value[index] !== '<') {
    return null;
  }
  const match = /^<(mark|u)\b[^<>]*>([^<>]*)<\/\1>/i.exec(value.slice(index));
  const kind = phraseKind(match?.[1] ?? '');
  if (!match || kind === null) {
    return null;
  }
  return { kind, start: index, end: index + match[0].length, inner: match[2] ?? '' };
}

/** The next `<mark>` or `<u>` that is outside a code span. */
export function nextPhraseTag(value: string, from: number): PhraseTag | null {
  let index = from;
  while (index < value.length) {
    if (value[index] === '`') {
      const code = readCodeSpan(value, index);
      if (code) {
        index = code.end;
        continue;
      }
    }
    const tag = phraseAt(value, index);
    if (tag) {
      return tag;
    }
    index += 1;
  }
  return null;
}
