import { renderFencedCode } from './markdown-code';
import { fenceLanguage, openingFence, closesFence } from './markdown-fence';
import { isListContinuation, renderListItemHtml, replaceHtmlListItem } from './markdown-list';
import { isTableRow, markdownTableToHtml, parseMarkdownTable } from './markdown-table';
import { readSourceLine, type SourceLine } from './markdown-paragraph';
import { isLazyQuoteLine, quoteBody, quoteToHtml } from './markdown-quote';

export interface OpenListFence {
  readonly marker: string;
  readonly language: string;
  readonly indent: number;
}

export interface ListFenceState {
  marker: string;
  language: string;
  indent: number;
  lines: string[];
}

export interface HtmlListItemState {
  parts: string[];
  listLines: SourceLine[];
  itemHtml: string;
  itemFence: ListFenceState | null;
  itemQuote: string[] | null;
  itemTable: string[] | null;
  listColumn: number | null;
  listBreak: boolean;
  loose: boolean;
}

function expandedIndent(line: string): { expanded: string; spaces: number } {
  const expanded = line.replaceAll('\t', '    ');
  const spaces = /^ */.exec(expanded)?.[0].length ?? 0;
  return { expanded, spaces };
}

/** A fence whose indent sits in the open list item, plus up to three extra spaces. */
export function openListFence(line: string, contentColumn: number): OpenListFence | null {
  const { expanded, spaces } = expandedIndent(line);
  if (spaces < contentColumn || spaces > contentColumn + 3) {
    return null;
  }
  const body = expanded.slice(spaces);
  const marker = openingFence(body);
  if (!marker) {
    return null;
  }
  const info = body.slice(marker.length);
  if (
    (marker.startsWith('`') && info.includes('`')) ||
    (marker.startsWith('~') && info.includes('~'))
  ) {
    return null;
  }
  return { marker, language: fenceLanguage(body), indent: spaces };
}

/** A list marker whose text is itself the opening fence. */
export function listFenceOnMarker(raw: string, contentColumn: number): OpenListFence | null {
  const match = /^( *)([-*+]|\d+\.)[ \t]+(.*)$/.exec(raw.replaceAll('\t', '    '));
  const opened = openListFence(match?.[3] ?? '', 0);
  if (!opened) {
    return null;
  }
  return {
    marker: opened.marker,
    language: opened.language,
    indent: contentColumn + opened.indent,
  };
}

function dedentFenceLine(line: string, indent: number): string {
  const { expanded, spaces } = expandedIndent(line);
  return expanded.slice(Math.min(spaces, indent));
}

export function readListFenceLine(
  state: ListFenceState,
  line: string,
  contentColumn: number
): 'open' | 'closed' {
  const { expanded, spaces } = expandedIndent(line);
  if (spaces <= contentColumn + 3 && closesFence(expanded.slice(spaces), state.marker)) {
    return 'closed';
  }
  state.lines.push(dedentFenceLine(line, state.indent));
  return 'open';
}

function composedItemHtml(state: HtmlListItemState, render: (text: string) => string): string {
  if (state.listLines.length === 0) {
    return state.itemHtml;
  }
  const prose = renderListItemHtml(state.listLines, render);
  return state.loose ? `${state.itemHtml}<p>${prose}</p>` : `${state.itemHtml}${prose}`;
}

function writeListItem(state: HtmlListItemState, render: (text: string) => string): boolean {
  return replaceHtmlListItem(state.parts, composedItemHtml(state, render));
}

function dedentToColumn(line: string, contentColumn: number): string {
  const { expanded, spaces } = expandedIndent(line);
  return expanded.slice(Math.min(spaces, contentColumn));
}

/** The text of a quote line indented under the open list item. */
export function readOpenListQuote(line: string, contentColumn: number): string | null {
  if (!isListContinuation(line, contentColumn)) {
    return null;
  }
  return quoteBody(dedentToColumn(line, contentColumn));
}

/** The next quote line, including a lazy continuation, or null when the quote ends. */
export function readListQuoteLine(line: string, contentColumn: number): string | null {
  if (line.trim().length === 0 || !isListContinuation(line, contentColumn)) {
    return null;
  }
  const dedented = dedentToColumn(line, contentColumn);
  const body = quoteBody(dedented);
  if (body !== null) {
    return body;
  }
  if (!isLazyQuoteLine(dedented)) {
    return null;
  }
  return readSourceLine(dedented).text;
}

export function resetListItem(state: HtmlListItemState): void {
  state.itemHtml = '';
  state.listLines = [];
  state.itemFence = null;
  state.itemQuote = null;
  state.itemTable = null;
  state.loose = false;
}

/** A blank line inside an item ends its paragraph. The next text starts another. */
export function breakListParagraph(
  state: HtmlListItemState,
  render: (text: string) => string
): void {
  if (state.listLines.length > 0) {
    state.itemHtml += `<p>${renderListItemHtml(state.listLines, render)}</p>`;
    state.listLines = [];
  }
  state.loose = true;
}

/** Start a list item, holding a marker-line fence instead of rendering its backticks. */
export function openListItem(
  state: HtmlListItemState,
  raw: string,
  itemText: string,
  hardBreak: boolean,
  column: number,
  render: (text: string) => string
): string {
  resetListItem(state);
  state.listColumn = column;
  state.listBreak = false;
  const fence = listFenceOnMarker(raw, column);
  if (fence) {
    state.itemFence = {
      marker: fence.marker,
      language: fence.language,
      indent: fence.indent,
      lines: [],
    };
    return '';
  }
  state.listLines = [{ text: itemText, hardBreak }];
  return renderListItemHtml(state.listLines, render);
}

export function continueListItem(
  state: HtmlListItemState,
  raw: string,
  render: (text: string) => string
): boolean {
  if (
    state.itemFence ||
    state.itemQuote ||
    state.itemTable ||
    state.listColumn === null ||
    !isListContinuation(raw, state.listColumn)
  ) {
    return false;
  }
  state.listLines.push(readSourceLine(raw));
  const replaced = writeListItem(state, render);
  if (!replaced) {
    state.listLines.pop();
  }
  return replaced;
}

function sealProse(state: HtmlListItemState, render: (text: string) => string): void {
  if (state.listLines.length === 0) {
    return;
  }
  state.itemHtml += renderListItemHtml(state.listLines, render);
  state.listLines = [];
}

/** Keep a fence that belongs to the open item inside that item. */
export function takeListItemFence(
  state: HtmlListItemState,
  line: string,
  render: (text: string) => string,
  listOpen: boolean
): boolean {
  if (state.itemFence) {
    if (readListFenceLine(state.itemFence, line, state.listColumn ?? 2) === 'closed') {
      state.itemHtml += renderFencedCode(state.itemFence.language, state.itemFence.lines);
      state.itemFence = null;
      state.listLines = [];
      state.listBreak = false;
      writeListItem(state, render);
    }
    return true;
  }
  if (!listOpen || state.listColumn === null) {
    return false;
  }
  const opened = openListFence(line, state.listColumn);
  if (!opened) {
    return false;
  }
  sealProse(state, render);
  state.itemFence = {
    marker: opened.marker,
    language: opened.language,
    indent: opened.indent,
    lines: [],
  };
  state.listBreak = false;
  return true;
}

function closeItemTable(state: HtmlListItemState, render: (text: string) => string): void {
  if (!state.itemTable) {
    return;
  }
  const lines = state.itemTable;
  state.itemTable = null;
  const table = parseMarkdownTable(lines);
  state.itemHtml += table
    ? markdownTableToHtml(table, render)
    : lines.map((line) => render(line)).join('');
  state.listLines = [];
  writeListItem(state, render);
}

/** Keep a table that belongs to the open item inside that item. */
export function takeListItemTable(
  state: HtmlListItemState,
  line: string,
  render: (text: string) => string,
  listOpen: boolean
): boolean {
  if (state.itemFence || state.itemQuote) {
    return false;
  }
  const column = state.listColumn ?? 2;
  if (state.itemTable) {
    if (isListContinuation(line, column) && isTableRow(line.trim())) {
      state.itemTable.push(line.trim());
      return true;
    }
    closeItemTable(state, render);
    return false;
  }
  if (!listOpen || state.listColumn === null) {
    return false;
  }
  if (!isListContinuation(line, column) || !isTableRow(line.trim())) {
    return false;
  }
  sealProse(state, render);
  state.itemTable = [line.trim()];
  state.listBreak = false;
  return true;
}

function closeItemQuote(state: HtmlListItemState, render: (text: string) => string): void {
  if (!state.itemQuote) {
    return;
  }
  state.itemHtml += quoteToHtml(state.itemQuote, render);
  state.itemQuote = null;
  state.listLines = [];
  writeListItem(state, render);
}

/** Keep a block quote that belongs to the open item inside that item. */
export function takeListItemQuote(
  state: HtmlListItemState,
  line: string,
  render: (text: string) => string,
  listOpen: boolean
): boolean {
  if (state.itemFence) {
    return false;
  }
  if (state.itemQuote) {
    const text = readListQuoteLine(line, state.listColumn ?? 2);
    if (text === null) {
      closeItemQuote(state, render);
      return false;
    }
    state.itemQuote.push(text);
    return true;
  }
  if (!listOpen || state.listColumn === null) {
    return false;
  }
  const opened = readOpenListQuote(line, state.listColumn);
  if (opened === null) {
    return false;
  }
  sealProse(state, render);
  state.itemQuote = [opened];
  state.listBreak = false;
  return true;
}

export function finishListItemFence(
  state: HtmlListItemState,
  render: (text: string) => string
): void {
  closeItemTable(state, render);
  closeItemQuote(state, render);
  if (!state.itemFence) {
    return;
  }
  state.itemHtml += renderFencedCode(state.itemFence.language, state.itemFence.lines);
  state.itemFence = null;
  state.listLines = [];
  writeListItem(state, render);
}
