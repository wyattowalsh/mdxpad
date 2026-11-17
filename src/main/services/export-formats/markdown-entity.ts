import { decodeHTMLStrict } from 'entities';

/** Turn a CommonMark character reference into characters. A missing semicolon stays literal. */
export function decodeHtmlEntities(value: string): string {
  return decodeHTMLStrict(value);
}
