import { joinParagraphHtml } from './markdown-marks';
import { readSourceLine, type SourceLine } from './markdown-paragraph';
import { splitTaskItem, taskItemHtml } from './markdown-task';

export type ListDelimiter = '.' | ')' | '-' | '+' | '*';

export interface MarkdownListItem {
  readonly level: number;
  readonly ordered: boolean;
  readonly start: number;
  readonly text: string;
  readonly delimiter?: ListDelimiter;
}

const LIST_ITEM = /^( *)([-*+]|\d+[.)])(?:[ \t]+(.*))?$/;

/** Column where the item text starts, so a later line can continue it. */
export function listContentColumn(line: string): number | null {
  if (parseListItem(line) === null) {
    return null;
  }
  const expanded = line.replaceAll('\t', '    ');
  const spaced = /^( *)([-*+]|\d+[.)])[ \t]+/.exec(expanded);
  if (spaced) {
    return spaced[0].length;
  }
  const bare = /^( *)([-*+]|\d+[.)])/.exec(expanded);
  return bare ? bare[0].length + 1 : null;
}

/** An indented line that continues the open list item, such as a wrapped sentence. */
export function isListContinuation(line: string, minimumIndent = 2): boolean {
  const expanded = line.replaceAll('\t', '    ');
  const spaces = /^ */.exec(expanded)?.[0].length ?? 0;
  if (spaces < minimumIndent || !/\S/.test(expanded)) {
    return false;
  }
  return parseListItem(expanded) === null;
}

/** Render a list item from its source lines, including a mark that crosses a break. */
export function renderListItemHtml(
  lines: readonly SourceLine[],
  render: (text: string) => string
): string {
  const first = lines[0] ?? { text: '', hardBreak: false };
  const task = splitTaskItem(first.text);
  const body = task ? [{ text: task.body, hardBreak: first.hardBreak }, ...lines.slice(1)] : lines;
  const html = joinParagraphHtml(body, render);
  return task ? taskItemHtml(task.checked, html) : html;
}

export function replaceHtmlListItem(parts: string[], html: string): boolean {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index] ?? '';
    if (part.startsWith('<li>') && !part.endsWith('</li>')) {
      parts[index] = `<li>${html}`;
      return true;
    }
    if (part.startsWith('<li>') && part.endsWith('</li>')) {
      return false;
    }
  }
  return false;
}

function closeOpenListItem(parts: string[]): void {
  const last = parts[parts.length - 1];
  if (last === undefined || last === '</li>') {
    return;
  }
  if (last.startsWith('<li>') && !last.endsWith('</li>')) {
    parts[parts.length - 1] = `${last}</li>`;
    return;
  }
  parts.push('</li>');
}

export function parseListItem(line: string): MarkdownListItem | null {
  const match = LIST_ITEM.exec(line.replaceAll('\t', '    '));
  if (!match) {
    return null;
  }
  const marker = match[2] ?? '-';
  const ordered = marker.endsWith('.') || marker.endsWith(')');
  const parsedStart = ordered ? Number.parseInt(marker, 10) : 1;
  const delimiter = marker.endsWith(')')
    ? ')'
    : marker.endsWith('.')
      ? '.'
      : marker === '-' || marker === '+' || marker === '*'
        ? marker
        : undefined;
  return {
    level: Math.min(5, Math.floor((match[1]?.length ?? 0) / 2)),
    ordered,
    start: Number.isFinite(parsedStart) && parsedStart >= 0 ? parsedStart : 1,
    text: readSourceLine(match[3] ?? '').text,
    ...(delimiter ? { delimiter } : {}),
  };
}

export interface HtmlListFrame {
  readonly kind: 'ul' | 'ol';
  readonly level: number;
  readonly delimiter: '' | ListDelimiter;
  column: number;
  loose: boolean;
  /** Index of this list's opening tag in the part buffer. */
  start: number;
}

/** A new list may break a paragraph only when it is unordered or starts at 1. */
export function shouldOpenListItem(
  item: MarkdownListItem,
  stack: readonly { level: number; kind: 'ul' | 'ol'; delimiter: '' | ListDelimiter }[],
  separated: boolean,
  paragraphOpen: boolean
): boolean {
  const current = stack[stack.length - 1];
  const sameList =
    current?.level === item.level &&
    current.kind === (item.ordered ? 'ol' : 'ul') &&
    current.delimiter === (item.delimiter ?? '');
  if (sameList) {
    return true;
  }
  if (current && item.level > current.level) {
    return separated || !item.ordered || item.start === 1;
  }
  if (stack.length > 0) {
    return true;
  }
  return !paragraphOpen || !item.ordered || item.start === 1;
}

function sameHtmlList(frame: HtmlListFrame, item: MarkdownListItem): boolean {
  if (frame.level !== item.level) {
    return false;
  }
  if (frame.kind === 'ul') {
    return !item.ordered && frame.delimiter === (item.delimiter ?? '');
  }
  return item.ordered && frame.delimiter === item.delimiter;
}

export const LIST_MARKER_CSS = `
ol.paren, ul.plus, ul.star { list-style: none; padding-left: 1.5rem; }
ol.paren > li { counter-increment: mdx-paren; }
ol.paren > li::before { content: counter(mdx-paren) ") "; }
ul.plus > li::before { content: "+ "; }
ul.star > li::before { content: "* "; }
`;

function listOpenTag(kind: HtmlListFrame['kind'], start: number, delimiter: string): string {
  if (kind === 'ol' && delimiter === ')') {
    const startAttr = start !== 1 ? ` start="${start}"` : '';
    return `<ol class="paren"${startAttr} style="counter-reset: mdx-paren ${start - 1}">`;
  }
  if (kind === 'ol' && start !== 1) {
    return `<ol start="${start}">`;
  }
  if (delimiter === '+' || delimiter === '*') {
    return `<ul class="${delimiter === '+' ? 'plus' : 'star'}">`;
  }
  return kind === 'ol' ? '<ol>' : '<ul>';
}

function listTag(kind: HtmlListFrame['kind'], close: boolean, start = 1, delimiter = ''): string {
  if (close) {
    return kind === 'ol' ? '</ol>' : '</ul>';
  }
  return listOpenTag(kind, start, delimiter);
}

/** A non-blank line indented to an open list item. */
export function continuesList(stack: readonly HtmlListFrame[], line: string): boolean {
  const spaces = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
  return stack.some((frame) => spaces >= frame.column);
}

function isListOpenTag(part: string): boolean {
  return part.startsWith('<ul') || part.startsWith('<ol');
}

function isBlockItemHtml(html: string): boolean {
  return /^<(?:h[1-6]|p|ul|ol|pre|blockquote|table|div|hr)\b/.test(html.trimStart());
}

function wrapLooseItem(parts: string[], index: number): void {
  const part = parts[index] ?? '';
  if (!part.startsWith('<li>') || part.includes('<p>')) {
    return;
  }
  const closed = part.endsWith('</li>');
  const inner = closed ? part.slice('<li>'.length, -'</li>'.length) : part.slice('<li>'.length);
  if (inner.length === 0 || isBlockItemHtml(inner)) {
    return;
  }
  const wrapped = `<p>${inner}</p>`;
  parts[index] = closed ? `<li>${wrapped}</li>` : `<li>${wrapped}`;
}

/** A blank line between items makes every item in the current list loose. */
export function markListLoose(parts: string[], stack: HtmlListFrame[]): void {
  const frame = stack[stack.length - 1];
  if (!frame || frame.loose) {
    return;
  }
  frame.loose = true;
  let depth = 0;
  for (let index = frame.start + 1; index < parts.length; index += 1) {
    const part = parts[index] ?? '';
    if (isListOpenTag(part)) {
      depth += 1;
      continue;
    }
    if (part === '</ul>' || part === '</ol>') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) {
      wrapLooseItem(parts, index);
    }
  }
}

export function closeHtmlListFrame(parts: string[], stack: HtmlListFrame[]): void {
  if (stack.length === 0) {
    return;
  }
  closeOpenListItem(parts);
  const frame = stack.pop();
  if (frame) {
    parts.push(listTag(frame.kind, true));
  }
}

export function closeHtmlLists(parts: string[], stack: HtmlListFrame[]): void {
  while (stack.length > 0) {
    closeHtmlListFrame(parts, stack);
  }
}

export function pushHtmlListItem(
  parts: string[],
  stack: HtmlListFrame[],
  item: MarkdownListItem,
  itemHtml: string,
  column = 2 + item.level * 2,
  separated = false
): void {
  const kind = item.ordered ? 'ol' : 'ul';
  const current = stack[stack.length - 1];
  const sameList = current !== undefined && sameHtmlList(current, item);
  const nested = Boolean(current && current.level < item.level);
  if (separated && (sameList || nested)) {
    markListLoose(parts, stack);
  }
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (!top || sameHtmlList(top, item) || top.level < item.level) {
      break;
    }
    closeOpenListItem(parts);
    stack.pop();
    parts.push(listTag(top.kind, true));
  }
  const top = stack[stack.length - 1];
  if (top && sameHtmlList(top, item)) {
    closeOpenListItem(parts);
    top.column = column;
  }
  if (!top || top.level < item.level) {
    parts.push(listTag(kind, false, item.start, item.delimiter ?? ''));
    stack.push({
      kind,
      level: item.level,
      delimiter: item.delimiter ?? '',
      column,
      loose: false,
      start: parts.length - 1,
    });
  }
  const frame = stack[stack.length - 1];
  const html =
    frame?.loose && itemHtml.length > 0 && !isBlockItemHtml(itemHtml)
      ? `<p>${itemHtml}</p>`
      : itemHtml;
  parts.push(`<li>${html}`);
}
