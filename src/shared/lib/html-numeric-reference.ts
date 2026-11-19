/**
 * An HTML parser accepts a numeric character reference without a semicolon.
 * `&#102ile` is the address `file`.
 */

import { decodeHTMLStrict } from 'entities';

const DECIMAL = /^[0-9]$/;
const HEX = /^[0-9a-fA-F]$/;

function referenceCode(
  value: string,
  start: number,
  hex: boolean
): { readonly code: number; readonly next: number } | null {
  const digit = hex ? HEX : DECIMAL;
  let cursor = start;
  while (cursor < value.length && digit.test(value.charAt(cursor))) {
    cursor += 1;
  }
  if (cursor === start) {
    return null;
  }
  const code = Number.parseInt(value.slice(start, cursor), hex ? 16 : 10);
  const next = value.charAt(cursor) === ';' ? cursor + 1 : cursor;
  return { code, next };
}

function characterFor(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) {
    return '\uFFFD';
  }
  try {
    return String.fromCodePoint(code);
  } catch {
    return '\uFFFD';
  }
}

/** Decode `&#...` and `&#x...` the way an HTML parser does. */
export function decodeHtmlNumericReferences(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    if (value.startsWith('&#', index)) {
      const marker = value.charAt(index + 2);
      const hex = marker === 'x' || marker === 'X';
      const reference = referenceCode(value, index + (hex ? 3 : 2), hex);
      if (reference) {
        result += characterFor(reference.code);
        index = reference.next - 1;
        continue;
      }
    }
    result += value.charAt(index);
  }
  return result;
}

/** Decode named entities, then numeric references, including a second encoding. */
export function decodeAddressEntities(value: string): string {
  let current = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = decodeHtmlNumericReferences(decodeHTMLStrict(current));
    if (next === current) {
      return current;
    }
    current = next;
  }
  return current;
}
