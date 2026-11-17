import { isThematicBreak } from './markdown-break';
import { closesFence, fenceLanguage, openingFence } from './markdown-fence';
import { readHtmlBlock } from './markdown-html';
import { renderFencedCode } from './markdown-code';
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
  if (current?.kind === 'list' && isListContinuation(line, listIndent(current.lines))) {
    return 'list';
  }
  if (isTableRow(line)) {
    return 'table';
  }
  return 'paragraph';
}

function takeQuoteLine(
  chunks: QuoteChunk[],
  current: QuoteChunk | null,
  line: string
): QuoteChunk | null {
  if (quoteBody(line) === null && openingFence(line)) {
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
  for (const line of lines) {
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

function groupQuoteItems(
  lines: readonly string[]
): { item: MarkdownListItem; body: SourceLine[] }[] {
  const groups: { item: MarkdownListItem; body: SourceLine[] }[] = [];
  for (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }
    const item = parseListItem(line);
    if (item) {
      groups.push({
        item,
        body: [{ text: item.text, hardBreak: readSourceLine(line).hardBreak }],
      });
      continue;
    }
    groups[groups.length - 1]?.body.push(readSourceLine(line));
  }
  return groups;
}

function quoteCodeParts(lines: readonly string[]): { language: string; body: string[] } {
  const [open, ...body] = lines;
  return { language: fenceLanguage(open ?? ''), body };
}

function quoteCodeHtml(lines: readonly string[]): string {
  const code = quoteCodeParts(lines);
  return renderFencedCode(code.language, code.body);
}

function quoteCodeLatex(lines: readonly string[]): string {
  const code = quoteCodeParts(lines);
  const safe = code.language.replaceAll(/[\\%&#_{}]/g, (char) => `\\${char}`);
  const label = safe.length > 0 ? `{\\footnotesize\\ttfamily ${safe}}\n` : '';
  return `${label}\\begin{verbatim}\n${code.body.join('\n')}\n\\end{verbatim}`;
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

function quoteListHtml(lines: readonly string[], renderLine: (line: string) => string): string {
  const parts: string[] = [];
  const stack: HtmlListFrame[] = [];
  for (const group of groupQuoteItems(lines)) {
    pushHtmlListItem(parts, stack, group.item, renderListItemHtml(group.body, renderLine));
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

function quoteListLatex(lines: readonly string[], renderLine: (line: string) => string): string {
  const groups = groupQuoteItems(lines);
  const env = groups[0]?.item.ordered === true ? 'enumerate' : 'itemize';
  const items = groups.map((group) => `\\item ${formatQuoteItem(group.body, renderLine)}`);
  return `\\begin{${env}}\n${items.join('\n')}\n\\end{${env}}`;
}

function joinQuoteLatex(lines: readonly string[], renderLine: (line: string) => string): string {
  return renderedSegments(lines.map((line) => readSourceLine(line)))
    .map((text, index) => (index === 0 ? renderLine(text) : `\\\\\n${renderLine(text)}`))
    .join('');
}

export function quoteToHtml(
  lines: readonly string[],
  renderLine: (line: string) => string
): string {
  const body = quoteChunks(lines)
    .map((chunk) => {
      if (chunk.kind === 'nested') {
        return quoteToHtml(chunk.lines, renderLine);
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
      return `<p>${joinParagraphHtml(
        chunk.lines.map((line) => readSourceLine(line)),
        renderLine
      )}</p>`;
    })
    .join('\n');
  return `<blockquote>\n${body}\n</blockquote>`;
}

export function quoteToLatex(
  lines: readonly string[],
  renderLine: (line: string) => string
): string {
  const body = quoteChunks(lines)
    .map((chunk) => {
      if (chunk.kind === 'nested') {
        return quoteToLatex(chunk.lines, renderLine);
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
      return joinQuoteLatex(chunk.lines, renderLine);
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
