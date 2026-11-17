import { renderFencedCode } from './markdown-code';
import { fenceLanguage, openingFence, closesFence } from './markdown-fence';
import { isListContinuation, renderListItemHtml, replaceHtmlListItem } from './markdown-list';
import { readSourceLine, type SourceLine } from './markdown-paragraph';

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
  listColumn: number | null;
  listBreak: boolean;
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
  const prose = state.listLines.length > 0 ? renderListItemHtml(state.listLines, render) : '';
  return `${state.itemHtml}${prose}`;
}

function writeListItem(state: HtmlListItemState, render: (text: string) => string): boolean {
  return replaceHtmlListItem(state.parts, composedItemHtml(state, render));
}

export function resetListItem(state: HtmlListItemState): void {
  state.itemHtml = '';
  state.listLines = [];
  state.itemFence = null;
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
  if (state.itemFence || state.listColumn === null || !isListContinuation(raw, state.listColumn)) {
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

export function finishListItemFence(
  state: HtmlListItemState,
  render: (text: string) => string
): void {
  if (!state.itemFence) {
    return;
  }
  state.itemHtml += renderFencedCode(state.itemFence.language, state.itemFence.lines);
  state.itemFence = null;
  state.listLines = [];
  writeListItem(state, render);
}
