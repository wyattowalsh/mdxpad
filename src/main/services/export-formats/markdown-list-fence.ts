import { isThematicBreak } from './markdown-break';
import { setextLevel } from './markdown-setext';
import { renderFencedCode } from './markdown-code';
import { fenceLanguage, openingFence, closesFence } from './markdown-fence';
import {
  closeHtmlListFrame,
  isListContinuation,
  markListLoose,
  parseListItem,
  renderListItemHtml,
  replaceHtmlListItem,
  shouldOpenListItem,
  type HtmlListFrame,
} from './markdown-list';
import { isTableRow, markdownTableToHtml, parseMarkdownTable } from './markdown-table';
import { readSourceLine, type SourceLine } from './markdown-paragraph';
import { renderDisplayMathBlock } from './markdown-inline-html';
import { displayMathPrefix } from '@shared/lib/math-span';
import { isLazyQuoteLine, quoteBody, quoteMarkerLine, quoteToHtml } from './markdown-quote';

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
  itemMath: string[] | null;
  itemCode: string[] | null;
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
  const opened = openListFence(parseListItem(raw)?.text ?? '', 0);
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
  if (state.loose || state.itemHtml.length > 0) {
    return `${state.itemHtml}<p>${prose}</p>`;
  }
  return prose;
}

function writeListItem(state: HtmlListItemState, render: (text: string) => string): boolean {
  return replaceHtmlListItem(state.parts, composedItemHtml(state, render));
}

/** A thematic break indented into the open list item, up to three extra spaces. */
export function listThematicBreak(line: string, contentColumn: number): boolean {
  const { spaces } = expandedIndent(line);
  if (spaces < contentColumn || spaces > contentColumn + 3) {
    return false;
  }
  return isThematicBreak(line);
}

/** Text of an indented code line inside a list item, or null when the line is not code. */
export function listIndentedCode(line: string, contentColumn: number): string | null {
  if (line.trim().length === 0 || !isListContinuation(line, contentColumn)) {
    return null;
  }
  const { expanded, spaces } = expandedIndent(line);
  if (spaces < contentColumn + 4) {
    return null;
  }
  return expanded.slice(contentColumn + 4);
}

export function dedentToColumn(line: string, contentColumn: number): string {
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
  if (line.trim().length === 0) {
    return null;
  }
  if (!isListContinuation(line, contentColumn)) {
    return isLazyQuoteLine(line) ? readSourceLine(line).text : null;
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
  state.itemMath = null;
  state.itemCode = null;
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

export type ListMarkerBlock =
  | { readonly kind: 'rule' }
  | { readonly kind: 'math'; readonly lines: readonly string[]; readonly lead?: string }
  | { readonly kind: 'quote'; readonly text: string }
  | { readonly kind: 'table'; readonly row: string };

/** A block that begins on the list marker, such as `1. ***` or `- $$`. */
export function listMarkerBlock(text: string): ListMarkerBlock | null {
  if (isThematicBreak(text)) {
    return { kind: 'rule' };
  }
  const trimmed = text.trim();
  if (trimmed === '$$') {
    return { kind: 'math', lines: [], lead: '' };
  }
  const lead = displayMathPrefix(trimmed);
  if (lead !== null) {
    return { kind: 'math', lines: [], lead };
  }
  if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
    return { kind: 'math', lines: [trimmed.slice(2, -2).trim()] };
  }
  if (isTableRow(trimmed)) {
    return { kind: 'table', row: trimmed };
  }
  const quoted = quoteBody(text);
  return quoted === null ? null : { kind: 'quote', text: quoted };
}

function openMarkerBlock(state: HtmlListItemState, text: string): string | null {
  const block = listMarkerBlock(text);
  if (block === null) {
    return null;
  }
  if (block.kind === 'rule') {
    state.itemHtml = '<hr />';
    state.loose = true;
    return '<hr />';
  }
  if (block.kind === 'math' && block.lines.length > 0) {
    state.itemHtml = renderDisplayMathBlock(block.lines);
    state.loose = true;
    return state.itemHtml;
  }
  if (block.kind === 'math') {
    if (block.lead) {
      state.listLines = [{ text: block.lead, hardBreak: false }];
    }
    state.itemMath = [];
    return '';
  }
  if (block.kind === 'table') {
    state.itemTable = [block.row];
    return '';
  }
  state.itemQuote = [quoteMarkerLine(block.text)];
  return '';
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
  const marker = openMarkerBlock(state, itemText);
  if (marker !== null) {
    return marker;
  }
  state.listLines = [{ text: itemText, hardBreak }];
  return renderListItemHtml(state.listLines, render);
}

export function continueListItem(
  state: HtmlListItemState,
  raw: string,
  render: (text: string) => string,
  lazy = false
): boolean {
  if (
    state.itemFence ||
    state.itemQuote ||
    state.itemTable ||
    state.itemMath ||
    state.itemCode ||
    state.listColumn === null ||
    (!lazy && !isListContinuation(raw, state.listColumn))
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

function leadingSpaces(line: string): number {
  return /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
}

/** Continue the open item, including a lazy line and a paragraph after a nested list. */
export function continueOpenList(
  parts: string[],
  stack: HtmlListFrame[],
  state: HtmlListItemState,
  raw: string,
  render: (text: string) => string
): boolean {
  if (stack.length === 0 || raw.trim().length === 0) {
    return false;
  }
  const marker = parseListItem(raw);
  if (marker && shouldOpenListItem(marker, stack, state.listBreak, false)) {
    return false;
  }
  if (!state.listBreak && state.listLines.length > 0 && parts.at(-1)?.startsWith('<p>')) {
    state.listLines.push(readSourceLine(raw));
    parts[parts.length - 1] = `<p>${renderListItemHtml(state.listLines, render)}</p>`;
    return true;
  }
  if (!state.listBreak) {
    return continueListItem(state, raw, render, true);
  }
  const spaces = leadingSpaces(raw);
  let depth = stack.length - 1;
  while (depth >= 0 && spaces < (stack[depth]?.column ?? 0)) {
    depth -= 1;
  }
  if (depth < 0) {
    return false;
  }
  return continueListParagraph(parts, stack, state, raw, render, depth);
}

function continueListParagraph(
  parts: string[],
  stack: HtmlListFrame[],
  state: HtmlListItemState,
  raw: string,
  render: (text: string) => string,
  depth: number
): boolean {
  const frame = stack[depth];
  if (!frame) {
    return false;
  }
  const returned = stack.length - 1 > depth;
  while (stack.length - 1 > depth) {
    closeHtmlListFrame(parts, stack);
  }
  if (returned) {
    markListLoose(parts, stack);
  }
  if (state.listLines.length > 0) {
    state.itemHtml += `<p>${renderListItemHtml(state.listLines, render)}</p>`;
    state.listLines = [];
  }
  state.listColumn = frame.column;
  state.listBreak = false;
  state.loose = true;
  state.listLines = [readSourceLine(raw)];
  if (!returned) {
    if (writeListItem(state, render)) {
      return true;
    }
    const paragraph = `<p>${renderListItemHtml(state.listLines, render)}</p>`;
    state.listLines = [];
    state.parts.push(paragraph);
    state.itemHtml += paragraph;
    return true;
  }
  state.itemHtml = '';
  parts.push(`<p>${renderListItemHtml(state.listLines, render)}</p>`);
  return true;
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

function closeItemCode(state: HtmlListItemState, render: (text: string) => string): void {
  if (!state.itemCode) {
    return;
  }
  while (state.itemCode[state.itemCode.length - 1] === '') {
    state.itemCode.pop();
  }
  state.itemHtml += renderFencedCode('', state.itemCode);
  state.itemCode = null;
  state.listLines = [];
  state.loose = true;
  writeListItem(state, render);
}

/** A setext underline of the open item's first paragraph becomes a heading. */
export function takeListItemSetext(
  state: HtmlListItemState,
  line: string,
  heading: (level: 1 | 2, text: string) => string,
  listOpen: boolean
): boolean {
  if (
    !listOpen ||
    state.listColumn === null ||
    state.itemFence ||
    state.itemQuote ||
    state.itemTable ||
    state.itemMath ||
    state.itemCode
  ) {
    return false;
  }
  const level = setextLevel(dedentToColumn(line, state.listColumn));
  if (level === null || state.listLines.length === 0) {
    return false;
  }
  const text = state.listLines
    .map((item) => item.text)
    .filter((item) => item.length > 0)
    .join(' ');
  if (text.length === 0) {
    return false;
  }
  state.listLines = [];
  state.itemHtml += heading(level, text);
  state.loose = true;
  state.listBreak = false;
  writeListItem(state, () => '');
  return true;
}

/** Keep a thematic break that belongs to the open item inside that item. */
export function takeListItemRule(
  state: HtmlListItemState,
  line: string,
  render: (text: string) => string,
  listOpen: boolean
): boolean {
  if (
    state.itemFence ||
    state.itemQuote ||
    state.itemTable ||
    state.itemMath ||
    state.itemCode ||
    !listOpen ||
    state.listColumn === null ||
    !listThematicBreak(line, state.listColumn)
  ) {
    return false;
  }
  sealProse(state, render);
  state.itemHtml += '<hr />';
  state.listLines = [];
  state.loose = true;
  state.listBreak = false;
  writeListItem(state, render);
  return true;
}

/** Keep an indented code block that belongs to the open item inside that item. */
export function takeListItemCode(
  state: HtmlListItemState,
  line: string,
  render: (text: string) => string,
  listOpen: boolean
): boolean {
  if (state.itemFence || state.itemQuote || state.itemTable || state.itemMath) {
    return false;
  }
  const column = state.listColumn ?? 2;
  if (state.itemCode) {
    if (line.trim().length === 0) {
      state.itemCode.push('');
      return true;
    }
    const body = listIndentedCode(line, column);
    if (body !== null) {
      state.itemCode.push(body);
      return true;
    }
    closeItemCode(state, render);
    return false;
  }
  if (!listOpen || state.listColumn === null) {
    return false;
  }
  const opened = listIndentedCode(line, column);
  if (opened === null) {
    return false;
  }
  sealProse(state, render);
  state.itemCode = [opened];
  state.listBreak = false;
  return true;
}

function closeItemMath(state: HtmlListItemState, render: (text: string) => string): void {
  if (!state.itemMath) {
    return;
  }
  if (state.listLines.length > 0) {
    const prose = renderListItemHtml(state.listLines, render);
    state.itemHtml += state.itemHtml.length > 0 ? `<p>${prose}</p>` : prose;
    state.listLines = [];
  }
  state.itemHtml += renderDisplayMathBlock(state.itemMath);
  state.itemMath = null;
  writeListItem(state, render);
}

/** Keep a display formula that belongs to the open item inside that item. */
export function takeListItemMath(
  state: HtmlListItemState,
  line: string,
  render: (text: string) => string,
  listOpen: boolean
): boolean {
  if (state.itemFence || state.itemQuote || state.itemTable) {
    return false;
  }
  const column = state.listColumn ?? 2;
  if (state.itemMath) {
    const body = dedentToColumn(line, column);
    const closing = body.trim() === '$$' ? '' : displayMathPrefix(body);
    if (closing !== null) {
      if (closing.length > 0) {
        state.itemMath.push(closing);
      }
      closeItemMath(state, render);
      return true;
    }
    state.itemMath.push(body);
    return true;
  }
  if (!listOpen || state.listColumn === null || !isListContinuation(line, column)) {
    return false;
  }
  const opened = dedentToColumn(line, column);
  if (quoteBody(opened) !== null) {
    return false;
  }
  const lead = opened.trim() === '$$' ? '' : displayMathPrefix(opened);
  if (lead === null) {
    return false;
  }
  if (lead.length > 0) {
    state.listLines.push({ text: lead, hardBreak: readSourceLine(line).hardBreak });
  }
  if (state.listBreak && state.listLines.length > 0) {
    state.itemHtml += `<p>${renderListItemHtml(state.listLines, render)}</p>`;
    state.listLines = [];
  } else {
    sealProse(state, render);
  }
  state.itemMath = [];
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
    state.itemQuote.push(quoteMarkerLine(text));
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
  closeItemCode(state, render);
  closeItemMath(state, render);
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
