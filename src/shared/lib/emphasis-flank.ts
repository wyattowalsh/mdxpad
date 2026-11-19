/**
 * CommonMark flanking rules for emphasis, and the GFM rule for strikethrough.
 */

const PUNCTUATION = /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/;

function whitespace(char: string): boolean {
  return char.length === 0 || /\s/.test(char);
}

export function flanking(
  value: string,
  index: number,
  length: number,
  char: '*' | '_' | '~'
): { canOpen: boolean; canClose: boolean } {
  const before = index === 0 ? '' : (value[index - 1] ?? '');
  const after = value[index + length] ?? '';
  const beforePunct = PUNCTUATION.test(before);
  const afterPunct = PUNCTUATION.test(after);
  const left = !whitespace(after) && (!afterPunct || whitespace(before) || beforePunct);
  const right = !whitespace(before) && (!beforePunct || whitespace(after) || afterPunct);
  if (char === '*') {
    return { canOpen: left, canClose: right };
  }
  return {
    canOpen: left && (!right || beforePunct),
    canClose: right && (!left || afterPunct),
  };
}

/** Whether `_` or `*` at `index` can open emphasis. */
export function canOpenEmphasis(value: string, index: number): boolean {
  const char = value[index];
  if (char !== '*' && char !== '_') {
    return false;
  }
  let length = 1;
  while (value[index + length] === char) {
    length += 1;
  }
  return flanking(value, index, length, char).canOpen;
}

/** Whether `~~` at `index` can open strikethrough. */
export function canOpenStrikethrough(value: string, index: number): boolean {
  if (value[index] !== '~') {
    return false;
  }
  let length = 0;
  while (value[index + length] === '~') {
    length += 1;
  }
  return length >= 2 && flanking(value, index, length, '~').canOpen;
}
