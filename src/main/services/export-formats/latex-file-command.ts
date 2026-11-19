/**
 * A TeX command that reads a file when the exported document is compiled.
 * Math is copied into LaTeX as-is, so these commands are turned into text.
 */

import { mapFencedProse } from '@shared/lib/markdown-math';
import { mathDelimiterAt, mathSpanEnd } from '@shared/lib/math-span';

import { linkDestination } from './markdown-link';

const LATEX_FILE_COMMANDS = [
  '@@input',
  'includegraphics',
  'InputIfFileExists',
  'lstinputlisting',
  'verbatiminput',
  'pdffilemoddate',
  'pdffiledump',
  'pdffilesize',
  'pdfximage',
  'ShellEscape',
  'directlua',
  'luadirect',
  'luaexec',
  'newwrite',
  'newread',
  'openout',
  'openin',
  'include',
  'special',
  'csname',
  'input',
  'write',
  'read',
];

const LATEX_FILE_READ = new RegExp(`\\\\(?:${LATEX_FILE_COMMANDS.join('|')})\\b`, 'g');

function breakTexCaretEscape(value: string): string {
  return value.replaceAll('^^', '^{}');
}

export function disarmLatexFileRead(value: string): string {
  return breakTexCaretEscape(value).replace(LATEX_FILE_READ, (command) => `\\relax ${command.slice(1)}`);
}

function copyCodeSpan(value: string, index: number): { text: string; next: number } | null {
  if (value[index] !== '`') {
    return null;
  }
  let ticks = 0;
  while (value[index + ticks] === '`') {
    ticks += 1;
  }
  const closer = value.indexOf('`'.repeat(ticks), index + ticks);
  if (closer === -1) {
    return { text: value.slice(index), next: value.length };
  }
  return { text: value.slice(index, closer + ticks), next: closer + ticks };
}

function disarmMathPiece(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    const code = value[index] === '`' ? copyCodeSpan(value, index) : null;
    if (code) {
      result += code.text;
      index = code.next;
      continue;
    }
    const delimiter = mathDelimiterAt(value, index);
    const end = delimiter === null ? -1 : mathSpanEnd(value, index, delimiter);
    if (delimiter !== null && end !== -1) {
      const body = disarmLatexFileRead(value.slice(index + delimiter.length, end - delimiter.length));
      result += `${delimiter}${body}${delimiter}`;
      index = end;
      continue;
    }
    result += value[index] ?? '';
    index += 1;
  }
  return result;
}

/** Turn file-reading commands inside formulas into text, outside code fences. */
export function disarmFileReadsInMath(content: string): string {
  return mapFencedProse(content, disarmMathPiece);
}

const TEX_PICTURE = '^\\{}#$&~';
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g;

function texPictureChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code <= 31 || code === 127 || TEX_PICTURE.includes(char);
}

/** A picture path TeX would tokenize as a command, such as `^^5cinput`. */
export function texPicturePathUnsafe(address: string): boolean {
  let decoded = address;
  try {
    decoded = decodeURI(address);
  } catch {
    decoded = address;
  }
  for (const char of decoded) {
    if (texPictureChar(char)) {
      return true;
    }
  }
  return false;
}

/** Leave the alt text when a picture path can read a file during TeX compilation. */
export function omitTexPictureSyntax(content: string): string {
  return mapFencedProse(content, (prose) =>
    prose.replace(MARKDOWN_IMAGE, (full, alt: string, destination: string) =>
      texPicturePathUnsafe(linkDestination(destination)) ? alt : full
    )
  );
}
