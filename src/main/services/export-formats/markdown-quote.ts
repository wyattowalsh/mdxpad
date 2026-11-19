import { allocateHeadingSlug, headingSlug, headingTag, parseAtxHeading } from '@shared/lib/markdown-heading';
import { isThematicBreak } from './markdown-break';
import { setextLevel } from './markdown-setext';
import {
  closesFence,
  closesIndentedFence,
  fenceLanguage,
  openIndentedFence,
  openingFence,
} from './markdown-fence';
import { readHtmlBlock } from './markdown-html';
import { renderFencedCode } from './markdown-code';
import { renderDisplayMathBlock } from './markdown-inline-html';
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
  renderListItemHtml,
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

/** A setext underline, including one marked while a quote was collected. */
export function quotedUnderlineLevel(line: string): 1 | 2 | null {
  return quotedSetextLevel(line) ?? setextLevel(line);
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

function lastQuoteContent(lines: readonly string[]): string | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? '';
    if (line.trim().length > 0) {
      return line;
    }
  }
  return null;
}

/** A heading has already closed, so the next plain line is not part of the quote. */
export function quoteRejectsLazy(lines: readonly string[]): boolean {
  const last = lastQuoteContent(lines);
  if (!last) {
    return false;
  }
  if (parseAtxHeading(last) !== null) {
    return true;
  }
  if (setextLevel(last) === null) {
    return false;
  }
  return lines.some((line) => line !== last && line.trim().length > 0);
}

/** A wrapped sentence stays in the quote. A line after a heading does not. */
export function continuesQuote(lines: readonly string[], line: string): boolean {
  return lines.length > 0 && isLazyQuoteLine(line) && !quoteRejectsLazy(lines);
}

/** A line of equals signs that underlines the open quote paragraph. */
export function quoteSetextLine(lines: readonly string[], line: string): boolean {
  if (setextLevel(line) !== 1 || quoteRejectsLazy(lines) || quoteFenceOpen(lines)) {
    return false;
  }
  const last = lastQuoteContent(lines);
  if (!last || openingFence(last) !== null || isTableRow(last) || parseListItem(last) !== null) {
    return false;
  }
  return true;
}

/** Keep a wrapped line, including a setext underline, inside the open quote. */
export function takeQuoteContinuation(lines: string[], line: string): boolean {
  if (!quoteSetextLine(lines, line) && !continuesQuote(lines, line)) {
    return false;
  }
  lines.push(setextLevel(line) === null ? line : quoteMarkerLine(line));
  return true;
}

/** A `$$` line that still belongs to the open quote, rather than starting display math. */
export function quoteHoldsDelimiter(lines: readonly string[], line: string): boolean {
  return continuesQuote(lines, line) && line.trim() === '$$';
}

/** The fence marker still open inside a quote, such as a closer on the next line. */
export function quoteFenceOpen(lines: readonly string[]): string | null {
  let fence: string | null = null;
  for (const line of lines) {
    const body = quoteBody(line) ?? line;
    if (fence) {
      if (closesFence(body, fence)) {
        fence = null;
      }
      continue;
    }
    fence = openingFence(body);
  }
  return fence;
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

function listMarkerFenceOpen(lines: readonly string[]): boolean {
  const marker = openingFence(parseListItem(lines[0] ?? '')?.text ?? '');
  if (marker === null) {
    return false;
  }
  const column = listIndent(lines);
  return lines.slice(1).every((line) => !closesFence(line, marker) && !closesIndentedFence(line, marker, column));
}

function listLazyLine(lines: readonly string[], line: string): boolean {
  const last = lines[lines.length - 1] ?? '';
  return last.trim().length > 0 && isLazyQuoteLine(line);
}

function indentedUnderList(line: string, current: QuoteChunk | null): boolean {
  if (current?.kind !== 'list' || line.trim().length === 0 || parseListItem(line) !== null) {
    return false;
  }
  const column = listIndent(current.lines);
  const indent = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
  return indent >= column;
}

function quoteLineKind(line: string, current: QuoteChunk | null): QuoteChunk['kind'] | null {
  if (indentedUnderList(line, current)) {
    return 'list';
  }
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
    if (listMarkerFenceOpen(current.lines) || listLazyLine(current.lines, line)) {
      return 'list';
    }
    const column = listIndent(current.lines);
    const indent = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
    if (openIndentedFence(line, column) !== null) {
      return 'list';
    }
    if (openingFence(line) === null && line.trim().length > 0 && indent >= column + 4) {
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
  const listed = current?.kind === 'list' ? current.lines : [];
  if (
    quoteBody(line) === null &&
    openingFence(line) !== null &&
    !fenceStaysInList(line, current) &&
    !listMarkerFenceOpen(listed)
  ) {
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
  const opened = openIndentedFence(line, column);
  if (opened) {
    while (cursor < body.length) {
      const next = body[cursor]?.text ?? '';
      lines.push(next);
      cursor += 1;
      if (closesIndentedFence(next, opened.marker, column)) {
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
  | { readonly kind: 'code'; readonly lines: string[] }
  | { readonly kind: 'rule' }
  | { readonly kind: 'math'; readonly lines: string[] }
  | { readonly kind: 'quote'; readonly lines: string[] }
  | { readonly kind: 'table'; readonly lines: string[] }
  | { readonly kind: 'heading'; readonly depth: number; readonly text: string };

function collectMarkerFence(
  body: readonly SourceLine[],
  column: number
): { lines: string[]; next: number } {
  const marker = openingFence(body[0]?.text ?? '') ?? '';
  const lines = [body[0]?.text ?? ''];
  let cursor = 1;
  while (cursor < body.length) {
    const next = body[cursor]?.text ?? '';
    lines.push(next);
    cursor += 1;
    if (closesFence(next, marker) || closesIndentedFence(next, marker, column)) {
      break;
    }
  }
  return { lines, next: cursor };
}

function collectMarkerMath(body: readonly SourceLine[]): { lines: string[]; next: number } {
  const lines: string[] = [];
  let cursor = 1;
  while (cursor < body.length) {
    const next = body[cursor]?.text ?? '';
    cursor += 1;
    if (next.trim() === '$$') {
      break;
    }
    lines.push(next.trim());
  }
  return { lines, next: cursor };
}

function collectMarkerQuote(
  body: readonly SourceLine[],
  first: string
): { lines: string[]; next: number } {
  const lines = [first];
  let cursor = 1;
  while (cursor < body.length) {
    const next = body[cursor]?.text ?? '';
    const nested = quoteBody(next);
    if (nested !== null) {
      lines.push(nested);
      cursor += 1;
      continue;
    }
    if (next.trim().length === 0 || !isLazyQuoteLine(next)) {
      break;
    }
    lines.push(next);
    cursor += 1;
  }
  return { lines, next: cursor };
}

function collectMarkerTable(
  body: readonly SourceLine[],
  first: string
): { lines: string[]; next: number } {
  const lines = [first];
  let cursor = 1;
  while (cursor < body.length && isTableRow(body[cursor]?.text ?? '')) {
    lines.push((body[cursor]?.text ?? '').trim());
    cursor += 1;
  }
  return { lines, next: cursor };
}

function takeMarkerPiece(
  body: readonly SourceLine[],
  column: number
): { piece: QuoteItemPiece; next: number } | null {
  const first = body[0]?.text ?? '';
  const heading = parseAtxHeading(first);
  if (heading) {
    return { piece: { kind: 'heading', depth: heading.depth, text: heading.text }, next: 1 };
  }
  if (isTableRow(first)) {
    const table = collectMarkerTable(body, first.trim());
    return { piece: { kind: 'table', lines: table.lines }, next: table.next };
  }
  if (openingFence(first) !== null) {
    const block = collectMarkerFence(body, column);
    return { piece: { kind: 'code', lines: block.lines }, next: block.next };
  }
  if (isThematicBreak(first)) {
    return { piece: { kind: 'rule' }, next: 1 };
  }
  if (first.trim() === '$$') {
    const math = collectMarkerMath(body);
    return { piece: { kind: 'math', lines: math.lines }, next: math.next };
  }
  const quoted = quoteBody(first);
  if (quoted !== null) {
    const block = collectMarkerQuote(body, quoted);
    return { piece: { kind: 'quote', lines: block.lines }, next: block.next };
  }
  return null;
}

function takeQuotedUnderline(prose: readonly SourceLine[], line: string): QuoteItemPiece | null {
  if (prose.length === 0) {
    return null;
  }
  const level = quotedUnderlineLevel(line);
  if (level === null) {
    return null;
  }
  const text = prose
    .map((item) => item.text)
    .filter((item) => item.length > 0)
    .join(' ');
  return text.length > 0 ? { kind: 'heading', depth: level, text } : null;
}

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
  const marker = takeMarkerPiece(body, column);
  let index = 0;
  if (marker) {
    pieces.push(marker.piece);
    index = marker.next;
  } else if (body.length > 0) {
    prose.push(body[0] ?? { text: '', hardBreak: false });
    index = 1;
  }
  while (index < body.length) {
    const line = body[index]?.text ?? '';
    const indent = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
    const code =
      openIndentedFence(line, column) !== null ||
      (line.trim().length > 0 && indent >= column + 4);
    if (!code) {
      const heading = takeQuotedUnderline(prose, line);
      if (heading) {
        prose = [];
        pieces.push(heading);
        index += 1;
        continue;
      }
      const source = body[index] ?? { text: line, hardBreak: false };
      prose.push({ text: source.text.trim(), hardBreak: source.hardBreak });
      index += 1;
      continue;
    }
    flush();
    const block = collectItemCode(body, index, column);
    const fenceIndent = openIndentedFence(block.lines[0] ?? '', column)?.indent ?? column;
    pieces.push({
      kind: 'code',
      lines: block.lines.map((entry) => shiftIndent(entry, fenceIndent)),
    });
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

function renderQuotedPieceHtml(
  piece: QuoteItemPiece,
  renderLine: (line: string) => string
): string {
  if (piece.kind === 'code') {
    return quoteCodeHtml(codeSample(piece.lines));
  }
  if (piece.kind === 'rule') {
    return '<hr />';
  }
  if (piece.kind === 'math') {
    return renderDisplayMathBlock(piece.lines);
  }
  if (piece.kind === 'quote') {
    return quoteToHtml(piece.lines, renderLine);
  }
  if (piece.kind === 'table') {
    const table = parseMarkdownTable(piece.lines);
    return table ? markdownTableToHtml(table, renderLine) : piece.lines.join('');
  }
  if (piece.kind === 'heading') {
    return headingTag(piece.depth, renderLine(piece.text), headingSlug(piece.text));
  }
  return renderListItemHtml(piece.lines, renderLine);
}

function renderQuotedItemHtml(
  body: readonly SourceLine[],
  column: number,
  renderLine: (line: string) => string
): string {
  let sawBlock = false;
  return quoteItemPieces(body, column)
    .map((piece) => {
      if (piece.kind === 'prose' && sawBlock) {
        return `<p>${renderListItemHtml(piece.lines, renderLine)}</p>`;
      }
      if (piece.kind !== 'prose') {
        sawBlock = true;
      }
      return renderQuotedPieceHtml(piece, renderLine);
    })
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

function renderQuotedPieceLatex(
  piece: QuoteItemPiece,
  renderLine: (line: string) => string
): string {
  if (piece.kind === 'code') {
    return quoteCodeLatex(codeSample(piece.lines));
  }
  if (piece.kind === 'rule') {
    return '\\noindent\\rule{\\textwidth}{0.4pt}';
  }
  if (piece.kind === 'math') {
    return ['$$', ...piece.lines, '$$'].join('\n');
  }
  if (piece.kind === 'quote') {
    return quoteToLatex(piece.lines, renderLine);
  }
  if (piece.kind === 'table') {
    const table = parseMarkdownTable(piece.lines);
    return table ? markdownTableToLatex(table, renderLine) : piece.lines.join('\n');
  }
  if (piece.kind === 'heading') {
    const command = piece.depth === 1 ? 'section' : 'subsection';
    return `\\${command}{${renderLine(piece.text)}}`;
  }
  return formatQuoteItem(piece.lines, renderLine);
}

function renderQuotedItemLatex(
  body: readonly SourceLine[],
  column: number,
  renderLine: (line: string) => string
): string {
  return quoteItemPieces(body, column)
    .map((piece) => renderQuotedPieceLatex(piece, renderLine))
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

type QuoteHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

type QuoteParagraphPiece =
  | { readonly kind: 'heading'; readonly level: QuoteHeadingLevel; readonly text: string }
  | { readonly kind: 'paragraph'; readonly lines: string[] };

const QUOTE_HEADING_COMMANDS = [
  'section',
  'subsection',
  'subsubsection',
  'paragraph',
  'subparagraph',
  'subparagraph',
] as const;

function quoteHeadingCommand(level: number): string {
  return QUOTE_HEADING_COMMANDS[level - 1] ?? 'subparagraph';
}

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
    const atx = parseAtxHeading(line);
    if (atx) {
      flush();
      pieces.push({ kind: 'heading', level: atx.depth, text: atx.text });
      continue;
    }
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
      const command = quoteHeadingCommand(piece.level);
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
