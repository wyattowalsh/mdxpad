export interface MarkdownListItem {
  readonly level: number;
  readonly ordered: boolean;
  readonly start: number;
  readonly text: string;
}

const LIST_ITEM = /^( *)([-*+]|\d+\.)[ \t]+(.*)$/;

/** Read a list item, using two spaces of indent for each nested level. */
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
    text: (match[3] ?? '').trim(),
  };
}

export interface HtmlListFrame {
  readonly kind: 'ul' | 'ol';
  readonly level: number;
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

export function closeHtmlLists(parts: string[], stack: HtmlListFrame[]): void {
  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame) {
      parts.push(listTag(frame.kind, true));
    }
  }
}

export function pushHtmlListItem(
  parts: string[],
  stack: HtmlListFrame[],
  item: MarkdownListItem,
  itemHtml: string
): void {
  const kind = item.ordered ? 'ol' : 'ul';
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (!top || (top.level === item.level && top.kind === kind) || top.level < item.level) {
      break;
    }
    stack.pop();
    parts.push(listTag(top.kind, true));
  }
  const top = stack[stack.length - 1];
  if (!top || top.level < item.level) {
    parts.push(listTag(kind, false, item.start));
    stack.push({ kind, level: item.level });
  }
  parts.push(`<li>${itemHtml}</li>`);
}
