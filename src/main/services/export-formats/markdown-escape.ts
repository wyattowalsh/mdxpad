const ESCAPE_MARK = '\uE011';
const PUNCTUATION = new Set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~');

export interface ProtectedEscapes {
  readonly text: string;
  readonly chars: readonly string[];
}

/** Keep a backslash escape literal outside code spans. */
export function protectEscapes(raw: string): ProtectedEscapes {
  const chars: string[] = [];
  let text = '';
  let index = 0;
  let inCode = false;
  while (index < raw.length) {
    const current = raw.charAt(index);
    if (current === '`') {
      inCode = !inCode;
      text += current;
      index += 1;
      continue;
    }
    const next = raw.charAt(index + 1);
    if (!inCode && current === '\\' && PUNCTUATION.has(next)) {
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
