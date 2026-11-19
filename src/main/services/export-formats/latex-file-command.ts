/**
 * A TeX command that reads a file, or changes how the next line is read,
 * when the exported document is compiled. Math is copied into LaTeX as-is,
 * so these commands are turned into text.
 */

import { mapFencedProse } from '@shared/lib/markdown-math';
import { mathDelimiterAt, mathSpanEnd } from '@shared/lib/math-span';

import { readCodeSpan } from './markdown-escape';
import { closesFence } from './markdown-fence';
import { linkDestination } from './markdown-link';

const LATEX_FILE_COMMANDS = [
  '@@input',
  '@input',
  'includegraphics',
  'InputIfFileExists',
  'IfFileExists',
  'lstinputlisting',
  'verbatiminput',
  'pdffilemoddate',
  'pdffiledump',
  'pdffilesize',
  'pdfximage',
  'pdfmdfivesum',
  'mdfivesum',
  'pdfextension',
  'pdfmapfile',
  'pdfobj',
  'latelua',
  'readline',
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
  'XeTeXpdffile',
  'XeTeXpicfile',
  'ExplSyntaxOn',
  'begincsname',
  'UseName',
  'csname',
  'scantextokens',
  'scantokens',
  'endlinechar',
  'newlinechar',
  'lowercase',
  'uppercase',
  'kcatcode',
  'catcode',
  'lccode',
  'uccode',
  'font',
  'input',
  'write',
  'read',
];

const LATEX_FILE_READ = new RegExp(
  `\\\\(?:${LATEX_FILE_COMMANDS.join('|')})(?![A-Za-z@])`,
  'g'
);

function breakTexCaretEscape(value: string): string {
  return value.replaceAll('^^', '^{}');
}

function disarmFileContents(value: string): string {
  return value.replace(
    /\\(begin|end)(?:\s|%[^\n]*(?:\n|$))*\{filecontents\*?\}/g,
    '\\relax $1{filecontents}'
  );
}

export function disarmLatexFileRead(value: string): string {
  const text = disarmFileContents(breakTexCaretEscape(value));
  return text.replace(LATEX_FILE_READ, (command) => `\\relax ${command.slice(1)}`);
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

const RAW_TEX_FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const RAW_TEX_FORMAT = /(?:^|[\s{])=(?:latex|tex|context|beamer)(?=$|[\s}])/i;

function fenceOpen(line: string): { marker: string; rawTex: boolean } | null {
  const match = RAW_TEX_FENCE.exec(line);
  const marker = match?.[2];
  if (!marker) {
    return null;
  }
  return { marker, rawTex: RAW_TEX_FORMAT.test(match[3] ?? '') };
}

function readUntilClose(
  lines: readonly string[],
  start: number,
  marker: string
): { body: string[]; next: number } {
  const body: string[] = [];
  let next = start;
  while (next < lines.length && !closesFence(lines[next] ?? '', marker)) {
    body.push(lines[next] ?? '');
    next += 1;
  }
  return { body, next };
}

function disarmedBody(body: readonly string[], disarm: boolean): string[] {
  if (!disarm || body.length === 0) {
    return [...body];
  }
  return disarmLatexFileRead(body.join('\n')).split('\n');
}

function replacedCodeSpan(raw: string): string {
  let ticks = 0;
  while (raw[ticks] === '`') {
    ticks += 1;
  }
  const mark = '`'.repeat(ticks);
  const closer = raw.lastIndexOf(mark);
  if (closer < ticks) {
    return raw;
  }
  return `${mark}${disarmLatexFileRead(raw.slice(ticks, closer))}${mark}`;
}

function disarmInlineRawTex(prose: string): string {
  let result = '';
  let index = 0;
  while (index < prose.length) {
    const span = prose[index] === '`' ? readCodeSpan(prose, index) : null;
    if (!span) {
      result += prose[index] ?? '';
      index += 1;
      continue;
    }
    const attr = /^[ \t]*\{[^}\n]*\}/.exec(prose.slice(span.end));
    if (attr && RAW_TEX_FORMAT.test(attr[0])) {
      result += replacedCodeSpan(prose.slice(index, span.end));
      result += attr[0];
      index = span.end + attr[0].length;
      continue;
    }
    result += prose.slice(index, span.end);
    index = span.end;
  }
  return result;
}

/** Turn file-reading commands in Pandoc raw TeX into text. A normal code sample stays. */
export function disarmPandocRawTex(content: string): string {
  const lines = content.split('\n');
  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const opened = fenceOpen(lines[index] ?? '');
    if (opened) {
      const fence = readUntilClose(lines, index + 1, opened.marker);
      output.push(lines[index] ?? '', ...disarmedBody(fence.body, opened.rawTex));
      if (fence.next < lines.length) {
        output.push(lines[fence.next] ?? '');
      }
      index = fence.next < lines.length ? fence.next + 1 : fence.next;
      continue;
    }
    const prose: string[] = [];
    while (index < lines.length && !fenceOpen(lines[index] ?? '')) {
      prose.push(lines[index] ?? '');
      index += 1;
    }
    if (prose.length > 0) {
      output.push(disarmInlineRawTex(prose.join('\n')));
    }
  }
  return output.join('\n');
}

/** Leave the alt text when a picture path can read a file during TeX compilation. */
export function omitTexPictureSyntax(content: string): string {
  return mapFencedProse(content, (prose) =>
    prose.replace(MARKDOWN_IMAGE, (full, alt: string, destination: string) =>
      texPicturePathUnsafe(linkDestination(destination)) ? alt : full
    )
  );
}
