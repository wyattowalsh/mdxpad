import { allocateHeadingSlug, headingSlug, headingTag } from '@shared/lib/markdown-heading';
import { isThematicBreak } from './markdown-break';
import { setextLevel } from './markdown-setext';
import { closesFence, fenceLanguage, openingFence } from './markdown-fence';
import { readHtmlBlock } from './markdown-html';
import { renderFencedCode } from './markdown-code';
import { latexVerbatimLines } from './latex-verbatim';
import { renderedSegments } from './markdown-marks';
import { joinParagraphHtml, readSourceLine, type SourceLine } from './markdown-paragraph';
import {
  isTableRow,
  markdownTableToHtml,
  markdownTableToLatex,
  parseMarkdownTable,
} from './markdown-table';
import {
  closeHtmlLists,
  isListContinuation,
  listContentColumn,
  parseListItem,
  pushHtmlListItem,
  type HtmlListFrame,
  type MarkdownListItem,
} from './markdown-list';
import { splitTaskItem, taskItemLatex } from './markdown-task';

const QUOTE_LINE = /^\s{0,3}>\s?(.*)$/;
const QUOTED_SETEXT = '\uE019';

/** Keep a quoted setext underline distinct from a lazy paragraph line. */
export function quoteMarkerLine(body: string): string {
  return setextLevel(body) === null ? body : `${QUOTED_SETEXT}${body}`;
}

function quotedSetextLevel(line: string): 1 | 2 | null {
  if (!line.startsWith(QUOTED_SETEXT)) {
    return null;
  }
  return setextLevel(line.slice(QUOTED_SETEXT.length));
}

/** A following line that stays inside an open quote, such as a wrapped sentence. */
export function isLazyQuoteLine(line: string): boolean {
  if (
    line.trim().length === 0 ||
    openingFence(line) !== null ||
    parseListItem(line) !== null ||
    isThematicBreak(line)
  ) {
    return false;
  }
  if (/^ {0,3}#{1,6}(?:\s|$)/.test(line)) {
    return false;
  }
  return readHtmlBlock([line], 0) === null;
}

export function quoteBody(line: string): string | null {
  const match = QUOTE_LINE.exec(line);
  if (!match) {
    return null;
  }
  return match[1] ?? '';
}

export type QuoteChunk =
  | { readonly kind: 'paragraph'; readonly lines: string[] }
  | { readonly kind: 'list'; readonly lines: string[] }
  | { readonly kind: 'table'; readonly lines: string[] }
  | { readonly kind: 'code'; readonly lines: string[] }
  | { readonly kind: 'nested'; readonly lines: string[] };

function takeChunk(chunks: QuoteChunk[], current: QuoteChunk | null): QuoteChunk | null {
  if (current) {
    chunks.push(current);
  }
  return null;
}

function fenceStaysInList(line: string, current: QuoteChunk | null): boolean {
  if (current?.kind !== 'list') {
    return false;
  }
  const indent = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
  return indent >= listIndent(current.lines);
}

function listIndent(lines: readonly string[]): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const column = listContentColumn(lines[index] ?? '');
    if (column !== null) {
      return column;
    }
  }
  return 2;
}

function quoteLineKind(line: string, current: QuoteChunk | null): QuoteChunk['kind'] | null {
  if (quoteBody(line) !== null) {
    return 'nested';
  }
  if (line.length === 0) {
    return null;
  }
  if (parseListItem(line) !== null) {
    return 'list';
  }
  if (current?.kind === 'list') {
    const column = listIndent(current.lines);
    const indent = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
    if (openingFence(line) === null && line.trim().length > 0 && indent >= column + 4) {
      return 'list';
    }
    if (openingFence(line) !== null && indent >= column) {
      return 'list';
    }
    if (isListContinuation(line, column)) {
      return 'list';
    }
  }
  if (
    (current === null || current.kind === 'code') &&
    openingFence(line) === null &&
    /^ {4}\S/.test(line.replaceAll('\t', '    '))
  ) {
    return 'code';
  }
  if (isTableRow(line)) {
    return 'table';
  }
  return 'paragraph';
}

function isIndentedCodeChunk(current: QuoteChunk | null): current is Extract<QuoteChunk, { kind: 'code' }> {
  return current?.kind === 'code' && openingFence(current.lines[0] ?? '') === null;
}

/** Keep a blank line when the next indented line continues the same code block. */
function continueIndentedCode(
  current: QuoteChunk | null,
  line: string,
  pendingBlanks: string[]
): boolean {
  if (!isIndentedCodeChunk(current)) {
    return false;
  }
  if (line.trim().length === 0) {
    pendingBlanks.push('');
    return true;
  }
  if (pendingBlanks.length > 0 && quoteLineKind(line, current) === 'code') {
    current.lines.push(...pendingBlanks.splice(0), quoteBody(line) ?? line);
    return true;
  }
  pendingBlanks.length = 0;
  return false;
}

function takeQuoteLine(
  chunks: QuoteChunk[],
  current: QuoteChunk | null,
  line: string
): QuoteChunk | null {
  if (quoteBody(line) === null && openingFence(line) && !fenceStaysInList(line, current)) {
    takeChunk(chunks, current);
    return { kind: 'code', lines: [line] };
  }
  const kind = quoteLineKind(line, current);
  if (kind === null) {
    if (current?.kind === 'list') {
      current.lines.push(line);
      return current;
    }
    return takeChunk(chunks, current);
  }
  const text = quoteBody(line) ?? line;
  if (current?.kind === kind) {
    current.lines.push(text);
    return current;
  }
  takeChunk(chunks, current);
  return { kind, lines: [text] };
}

export function quoteChunks(lines: readonly string[]): QuoteChunk[] {
  const chunks: QuoteChunk[] = [];
  let current: QuoteChunk | null = null;
  let fence: string | null = null;
  const pendingBlanks: string[] = [];
  for (const line of lines) {
    if (continueIndentedCode(current, line, pendingBlanks)) {
      continue;
    }
    if (fence) {
      if (closesFence(line, fence)) {
        fence = null;
        current = takeChunk(chunks, current);
        continue;
      }
      current?.lines.push(quoteBody(line) ?? line);
      continue;
    }
    current = takeQuoteLine(chunks, current, line);
    if (current?.kind === 'code' && current.lines.length === 1) {
      fence = openingFence(current.lines[0] ?? '');
    }
  }
  takeChunk(chunks, current);
  return chunks;
}

function groupQuoteItems(lines: readonly string[]): {
  item: MarkdownListItem;
  column: number;
  body: SourceLine[];
}[] {
  const groups: { item: MarkdownListItem; column: number; body: SourceLine[] }[] = [];
  for (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }
    const item = parseListItem(line);
    if (item) {
      groups.push({
        item,
        column: listContentColumn(line) ?? 2,
        body: [{ text: item.text, hardBreak: readSourceLine(line).hardBreak }],
      });
      continue;
    }
    const source = readSourceLine(line);
    groups[groups.length - 1]?.body.push({ text: line, hardBreak: source.hardBreak });
  }
  return groups;
}

function shiftIndent(line: string, count: number): string {
  const expanded = line.replaceAll('\t', '    ');
  const spaces = /^ */.exec(expanded)?.[0].length ?? 0;
  return expanded.slice(Math.min(count, spaces));
}

function collectItemCode(
  body: readonly SourceLine[],
  index: number,
  column: number
): { lines: string[]; next: number } {
  const line = body[index]?.text ?? '';
  const lines = [line];
  let cursor = index + 1;
  const marker = openingFence(line);
  if (marker) {
    while (cursor < body.length) {
      const next = body[cursor]?.text ?? '';
      lines.push(next);
      cursor += 1;
      if (closesFence(next, marker)) {
        break;
      }
    }
    return { lines, next: cursor };
  }
  while (cursor < body.length) {
    const next = body[cursor]?.text ?? '';
    const indent = /^ */.exec(next.replaceAll('\t', '    '))?.[0].length ?? 0;
    if (next.trim().length > 0 && indent < column + 4) {
      break;
    }
    lines.push(next);
    cursor += 1;
  }
  return { lines, next: cursor };
}

type QuoteItemPiece =
  | { readonly kind: 'prose'; readonly lines: SourceLine[] }
  | { readonly kind: 'code'; readonly lines: string[] };

function quoteItemPieces(body: readonly SourceLine[], column: number): QuoteItemPiece[] {
  const pieces: QuoteItemPiece[] = [];
  let prose: SourceLine[] = [];
  const flush = (): void => {
    if (prose.length === 0) {
      return;
    }
    pieces.push({ kind: 'prose', lines: prose });
    prose = [];
  };
  prose.push(body[0] ?? { text: '', hardBreak: false });
  let index = 1;
  while (index < body.length) {
    const line = body[index]?.text ?? '';
    const fence = openingFence(line);
    const indent = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
    const code = fence !== null ? indent >= column : line.trim().length > 0 && indent >= column + 4;
    if (!code) {
      const source = body[index] ?? { text: line, hardBreak: false };
      prose.push({ text: source.text.trim(), hardBreak: source.hardBreak });
      index += 1;
      continue;
    }
    flush();
    const block = collectItemCode(body, index, column);
    pieces.push({ kind: 'code', lines: block.lines.map((entry) => shiftIndent(entry, column)) });
    index = block.next;
  }
  flush();
  return pieces;
}

function quoteCodeParts(lines: readonly string[]): { language: string; body: string[] } {
  const [open, ...body] = lines;
  return { language: fenceLanguage(open ?? ''), body };
}

function dedentIndentedCode(lines: readonly string[]): string[] {
  return lines.map((line) => line.replace(/^(?: {4}|\t)/, ''));
}

function quoteCodeHtml(lines: readonly string[]): string {
  if (openingFence(lines[0] ?? '') === null) {
    return renderFencedCode('', dedentIndentedCode(lines));
  }
  const code = quoteCodeParts(lines);
  return renderFencedCode(code.language, code.body);
}

function quoteCodeLatex(lines: readonly string[]): string {
  if (openingFence(lines[0] ?? '') === null) {
    return latexVerbatimLines(dedentIndentedCode(lines)).join('\n');
  }
  const code = quoteCodeParts(lines);
  const safe = code.language.replaceAll(/[\\%&#_{}]/g, (char) => `\\${char}`);
  const label = safe.length > 0 ? `{\\footnotesize\\ttfamily ${safe}}\n` : '';
  return `${label}${latexVerbatimLines(code.body).join('\n')}`;
}

function quoteTableHtml(lines: readonly string[], renderLine: (line: string) => string): string {
  const table = parseMarkdownTable(lines);
  if (!table) {
    return `<p>${joinParagraphHtml(
      lines.map((line) => readSourceLine(line)),
      renderLine
    )}</p>`;
  }
  return markdownTableToHtml(table, renderLine);
}

function quoteTableLatex(lines: readonly string[], renderLine: (line: string) => string): string {
  const table = parseMarkdownTable(lines);
  if (!table) {
    return joinQuoteLatex(lines, renderLine);
  }
  return markdownTableToLatex(table, renderLine);
}

function codeSample(lines: readonly string[]): string[] {
  const marker = openingFence(lines[0] ?? '');
  if (!marker) {
    return [...lines];
  }
  const last = lines[lines.length - 1] ?? '';
  return [...lines.slice(1, closesFence(last, marker) ? -1 : undefined)];
}

function renderQuotedItemHtml(
  body: readonly SourceLine[],
  column: number,
  renderLine: (line: string) => string
): string {
  return quoteItemPieces(body, column)
    .map((piece) =>
      piece.kind === 'code'
        ? quoteCodeHtml(codeSample(piece.lines))
        : joinParagraphHtml(piece.lines, renderLine)
    )
    .join('\n');
}

function quoteListHtml(lines: readonly string[], renderLine: (line: string) => string): string {
  const parts: string[] = [];
  const stack: HtmlListFrame[] = [];
  for (const group of groupQuoteItems(lines)) {
    pushHtmlListItem(
      parts,
      stack,
      group.item,
      renderQuotedItemHtml(group.body, group.column, renderLine)
    );
  }
  closeHtmlLists(parts, stack);
  return parts.join('\n');
}

function formatQuoteItem(
  lines: readonly SourceLine[],
  renderLine: (line: string) => string
): string {
  const first = lines[0] ?? { text: '', hardBreak: false };
  const task = splitTaskItem(first.text);
  const body = task ? [{ text: task.body, hardBreak: first.hardBreak }, ...lines.slice(1)] : lines;
  const formatted = renderedSegments(body)
    .map((text, index) => (index === 0 ? renderLine(text) : `\\\\\n${renderLine(text)}`))
    .join('');
  return task ? taskItemLatex(task.checked, formatted) : formatted;
}

function renderQuotedItemLatex(
  body: readonly SourceLine[],
  column: number,
  renderLine: (line: string) => string
): string {
  return quoteItemPieces(body, column)
    .map((piece) =>
      piece.kind === 'code'
        ? quoteCodeLatex(codeSample(piece.lines))
        : formatQuoteItem(piece.lines, renderLine)
    )
    .join('\n');
}

function quoteListLatex(lines: readonly string[], renderLine: (line: string) => string): string {
  const groups = groupQuoteItems(lines);
  const env = groups[0]?.item.ordered === true ? 'enumerate' : 'itemize';
  const items = groups.map(
    (group) => `\\item ${renderQuotedItemLatex(group.body, group.column, renderLine)}`
  );
  return `\\begin{${env}}\n${items.join('\n')}\n\\end{${env}}`;
}

type QuoteParagraphPiece =
  | { readonly kind: 'heading'; readonly level: 1 | 2; readonly text: string }
  | { readonly kind: 'paragraph'; readonly lines: string[] };

export function quoteParagraphPieces(lines: readonly string[]): QuoteParagraphPiece[] {
  const pieces: QuoteParagraphPiece[] = [];
  let paragraph: string[] = [];
  const flush = (): void => {
    if (paragraph.length === 0) {
      return;
    }
    pieces.push({ kind: 'paragraph', lines: paragraph });
    paragraph = [];
  };
  for (const line of lines) {
    const level = paragraph.length > 0 ? quotedSetextLevel(line) : null;
    if (level === null) {
      paragraph.push(line);
      continue;
    }
    const text = paragraph
      .map((item) => readSourceLine(item).text)
      .filter((item) => item.length > 0)
      .join(' ');
    paragraph = [];
    if (text.length > 0) {
      pieces.push({ kind: 'heading', level, text });
    }
  }
  flush();
  return pieces;
}

function quoteHeadingSlug(text: string, slugs?: Map<string, number>): string {
  return slugs ? allocateHeadingSlug(text, slugs) : headingSlug(text);
}

function quoteParagraphHtml(
  lines: readonly string[],
  renderLine: (line: string) => string,
  slugs?: Map<string, number>
): string {
  return quoteParagraphPieces(lines)
    .map((piece) => {
      if (piece.kind === 'heading') {
        return headingTag(piece.level, renderLine(piece.text), quoteHeadingSlug(piece.text, slugs));
      }
      return `<p>${joinParagraphHtml(
        piece.lines.map((line) => readSourceLine(line)),
        renderLine
      )}</p>`;
    })
    .join('\n');
}

function quoteParagraphLatex(
  lines: readonly string[],
  renderLine: (line: string) => string,
  slugs?: Map<string, number>
): string {
  return quoteParagraphPieces(lines)
    .map((piece) => {
      if (piece.kind === 'paragraph') {
        return joinQuoteLatex(piece.lines, renderLine);
      }
      const command = piece.level === 1 ? 'section' : 'subsection';
      const label = `\\label{${quoteHeadingSlug(piece.text, slugs)}}`;
      return `\\${command}{${renderLine(piece.text)}}${label}`;
    })
    .join('\n\n');
}

function joinQuoteLatex(lines: readonly string[], renderLine: (line: string) => string): string {
  return renderedSegments(lines.map((line) => readSourceLine(line)))
    .map((text, index) => (index === 0 ? renderLine(text) : `\\\\\n${renderLine(text)}`))
    .join('');
}

export function quoteToHtml(
  lines: readonly string[],
  renderLine: (line: string) => string,
  slugs?: Map<string, number>
): string {
  const body = quoteChunks(lines)
    .map((chunk) => {
      if (chunk.kind === 'nested') {
        return quoteToHtml(chunk.lines, renderLine, slugs);
      }
      if (chunk.kind === 'list') {
        return quoteListHtml(chunk.lines, renderLine);
      }
      if (chunk.kind === 'table') {
        return quoteTableHtml(chunk.lines, renderLine);
      }
      if (chunk.kind === 'code') {
        return quoteCodeHtml(chunk.lines);
      }
      return quoteParagraphHtml(chunk.lines, renderLine, slugs);
    })
    .join('\n');
  return `<blockquote>\n${body}\n</blockquote>`;
}

export function quoteToLatex(
  lines: readonly string[],
  renderLine: (line: string) => string,
  slugs?: Map<string, number>
): string {
  const body = quoteChunks(lines)
    .map((chunk) => {
      if (chunk.kind === 'nested') {
        return quoteToLatex(chunk.lines, renderLine, slugs);
      }
      if (chunk.kind === 'list') {
        return quoteListLatex(chunk.lines, renderLine);
      }
      if (chunk.kind === 'table') {
        return quoteTableLatex(chunk.lines, renderLine);
      }
      if (chunk.kind === 'code') {
        return quoteCodeLatex(chunk.lines);
      }
      return quoteParagraphLatex(chunk.lines, renderLine, slugs);
    })
    .join('\n\n');
  return `\\begin{quote}\n${body}\n\\end{quote}`;
}

export function quoteLineDepth(line: string): { depth: number; text: string } {
  let depth = 1;
  let text = line;
  let inner = quoteBody(text);
  while (inner !== null) {
    depth += 1;
    text = inner;
    inner = quoteBody(text);
  }
  return { depth, text };
}
