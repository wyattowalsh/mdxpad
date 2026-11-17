import { joinParagraphHtml } from './markdown-marks';
import { readSourceLine, type SourceLine } from './markdown-paragraph';
import { splitTaskItem, taskItemHtml } from './markdown-task';

export interface MarkdownListItem {
  readonly level: number;
  readonly ordered: boolean;
  readonly start: number;
  readonly text: string;
}

const LIST_ITEM = /^( *)([-*+]|\d+\.)[ \t]+(.*)$/;

/** Column where the item text starts, so a later line can continue it. */
export function listContentColumn(line: string): number | null {
  if (parseListItem(line) === null) {
    return null;
  }
  const expanded = line.replaceAll('\t', '    ');
  const match = /^( *)([-*+]|\d+\.)[ \t]+/.exec(expanded);
  if (!match) {
    return null;
  }
  return (match[1]?.length ?? 0) + (match[2]?.length ?? 1) + 1;
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
  const ordered = marker.endsWith('.');
  const parsedStart = ordered ? Number.parseInt(marker, 10) : 1;
  return {
    level: Math.min(5, Math.floor((match[1]?.length ?? 0) / 2)),
    ordered,
    start: Number.isFinite(parsedStart) && parsedStart > 0 ? parsedStart : 1,
    text: readSourceLine(match[3] ?? '').text,
  };
}

export interface HtmlListFrame {
  readonly kind: 'ul' | 'ol';
  readonly level: number;
  column: number;
}

function listTag(kind: HtmlListFrame['kind'], close: boolean, start = 1): string {
  if (close) {
    return kind === 'ol' ? '</ol>' : '</ul>';
  }
  if (kind === 'ol' && start > 1) {
    return `<ol start="${start}">`;
  }
  return kind === 'ol' ? '<ol>' : '<ul>';
}

/** A non-blank line indented to an open list item. */
export function continuesList(stack: readonly HtmlListFrame[], line: string): boolean {
  const spaces = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
  return stack.some((frame) => spaces >= frame.column);
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
  column = 2 + item.level * 2
): void {
  const kind = item.ordered ? 'ol' : 'ul';
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (!top || (top.level === item.level && top.kind === kind) || top.level < item.level) {
      break;
    }
    closeOpenListItem(parts);
    stack.pop();
    parts.push(listTag(top.kind, true));
  }
  const top = stack[stack.length - 1];
  if (top?.level === item.level && top.kind === kind) {
    closeOpenListItem(parts);
    top.column = column;
  }
  if (!top || top.level < item.level) {
    parts.push(listTag(kind, false, item.start));
    stack.push({ kind, level: item.level, column });
  }
  parts.push(`<li>${itemHtml}`);
}
