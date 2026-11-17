import { openingFence } from './markdown-fence';
import { readHtmlBlock } from './markdown-html';
import { joinParagraphHtml, readSourceLine } from './markdown-paragraph';
import {
  isTableRow,
  markdownTableToHtml,
  markdownTableToLatex,
  parseMarkdownTable,
} from './markdown-table';
import {
  closeHtmlLists,
  parseListItem,
  pushHtmlListItem,
  type HtmlListFrame,
} from './markdown-list';
import { listItemHtml, splitTaskItem, taskItemLatex } from './markdown-task';

const QUOTE_LINE = /^\s{0,3}>\s?(.*)$/;

/** A following line that stays inside an open quote, such as a wrapped sentence. */
export function isLazyQuoteLine(line: string): boolean {
  if (line.trim().length === 0 || openingFence(line) !== null || parseListItem(line) !== null) {
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
  | { readonly kind: 'nested'; readonly lines: string[] };

function takeChunk(chunks: QuoteChunk[], current: QuoteChunk | null): QuoteChunk | null {
  if (current) {
    chunks.push(current);
  }
  return null;
}

export function quoteChunks(lines: readonly string[]): QuoteChunk[] {
  const chunks: QuoteChunk[] = [];
  let current: QuoteChunk | null = null;
  for (const line of lines) {
    const inner = quoteBody(line);
    const kind: QuoteChunk['kind'] | null =
      inner !== null
        ? 'nested'
        : line.length === 0
          ? null
          : parseListItem(line)
            ? 'list'
            : isTableRow(line)
              ? 'table'
              : 'paragraph';
    if (kind === null) {
      current = takeChunk(chunks, current);
      continue;
    }
    const text = inner ?? line;
    if (current?.kind === kind) {
      current.lines.push(text);
      continue;
    }
    current = takeChunk(chunks, current);
    current = { kind, lines: [text] };
  }
  takeChunk(chunks, current);
  return chunks;
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
  for (const line of lines) {
    const item = parseListItem(line);
    if (item) {
      pushHtmlListItem(parts, stack, item, listItemHtml(item.text, renderLine));
    }
  }
  closeHtmlLists(parts, stack);
  return parts.join('\n');
}

function quoteItemLatex(line: string, renderLine: (line: string) => string): string {
  const text = parseListItem(line)?.text ?? line;
  const task = splitTaskItem(text);
  return task ? taskItemLatex(task.checked, renderLine(task.body)) : renderLine(text);
}

function quoteListLatex(lines: readonly string[], renderLine: (line: string) => string): string {
  const first = parseListItem(lines[0] ?? '');
  const env = first?.ordered === true ? 'enumerate' : 'itemize';
  const items = lines.map((line) => `\\item ${quoteItemLatex(line, renderLine)}`);
  return `\\begin{${env}}\n${items.join('\n')}\n\\end{${env}}`;
}

function joinQuoteLatex(lines: readonly string[], renderLine: (line: string) => string): string {
  const parts = lines.map((line) => readSourceLine(line));
  return parts
    .map((line, index) => {
      const text = renderLine(line.text);
      if (index === 0) {
        return text;
      }
      return parts[index - 1]?.hardBreak ? `\\\\\n${text}` : ` ${text}`;
    })
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
