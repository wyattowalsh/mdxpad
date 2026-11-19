/**
 * CSS text can hide a file address inside an escape or a comment.
 */

function cssCodePoint(hex: string): string {
  const code = Number.parseInt(hex, 16);
  if (code === 0 || code > 0x10ffff) {
    return '\uFFFD';
  }
  return String.fromCodePoint(code);
}

function readHexEscape(value: string, start: number): { text: string; next: number } | null {
  if (!/^[0-9a-fA-F]$/.test(value.charAt(start))) {
    return null;
  }
  let hex = '';
  let cursor = start;
  while (cursor < value.length && hex.length < 6 && /^[0-9a-fA-F]$/.test(value.charAt(cursor))) {
    hex += value.charAt(cursor);
    cursor += 1;
  }
  const terminator = value[cursor];
  if (
    terminator === ' ' ||
    terminator === '\t' ||
    terminator === '\n' ||
    terminator === '\r' ||
    terminator === '\f'
  ) {
    cursor += 1;
  }
  return { text: cssCodePoint(hex), next: cursor };
}

/** Turn CSS escapes into the characters a browser would use. */
export function decodeCssEscapes(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charAt(index);
    if (char !== '\\') {
      result += char;
      continue;
    }
    const next = value[index + 1];
    if (next === undefined) {
      break;
    }
    if (next === '\n' || next === '\r' || next === '\f') {
      index += next === '\r' && value[index + 2] === '\n' ? 2 : 1;
      continue;
    }
    const hex = readHexEscape(value, index + 1);
    if (hex) {
      result += hex.text;
      index = hex.next - 1;
      continue;
    }
    result += next;
    index += 1;
  }
  return result;
}

/** Remove CSS comments, including a comment that never closes. */
export function stripCssComments(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    if (value.charAt(index) === '/' && value.charAt(index + 1) === '*') {
      const end = value.indexOf('*/', index + 2);
      index = end === -1 ? value.length : end + 2;
      continue;
    }
    result += value.charAt(index);
    index += 1;
  }
  return result;
}
