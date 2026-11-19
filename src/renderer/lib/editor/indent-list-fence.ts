/**
 * A fence that opens on a list marker keeps its following lines only when
 * those lines are indented under the item. Shift them in before parsing.
 */

const FENCE_LINE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const LIST_HEAD = /^( *)([-*+]|\d+[.)])[ \t]+/;
const TASK_FENCE =
  /^([ \t]*)([-+*]|\d{1,9}[.)])([ \t]+)\[([ xX])\]([ \t]+)(`{3,}|~{3,})(.*)$/;

interface OpenListFence {
  readonly marker: string;
  readonly column: number;
  readonly depth: number;
}

function openingFence(line: string): string | null {
  return FENCE_LINE.exec(line)?.[2] ?? null;
}

function closesFence(line: string, open: string): boolean {
  const match = FENCE_LINE.exec(line);
  const marker = match?.[2];
  if (!marker || !marker.startsWith(open.charAt(0)) || marker.length < open.length) {
    return false;
  }
  return (match[3] ?? '').trim().length === 0;
}

function splitQuote(line: string): { depth: number; prefix: string; body: string } {
  const prefix = /^(?:>[ \t]?)*/.exec(line)?.[0] ?? '';
  return { depth: (prefix.match(/>/g) ?? []).length, prefix, body: line.slice(prefix.length) };
}

function leadingSpaces(body: string): number {
  return /^ */.exec(body.replaceAll('\t', '    '))?.[0].length ?? 0;
}

function listMarkerFence(body: string): { marker: string; column: number } | null {
  const head = LIST_HEAD.exec(body);
  if (!head) {
    return null;
  }
  const text = body.slice(head[0].length);
  const marker = openingFence(text);
  if (!marker) {
    return null;
  }
  const info = text.slice(marker.length);
  const blocked =
    (marker.startsWith('`') && info.includes('`')) || (marker.startsWith('~') && info.includes('~'));
  return blocked ? null : { marker, column: head[0].length };
}

function indentBody(prefix: string, body: string, column: number): string {
  const spaces = leadingSpaces(body);
  if (spaces >= column) {
    return `${prefix}${body}`;
  }
  return `${prefix}${' '.repeat(column - spaces)}${body}`;
}

function fenceBody(body: string): string {
  return body.replaceAll('\t', '    ').slice(leadingSpaces(body));
}

function columnWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    width = char === '\t' ? width + 4 - (width % 4) : width + 1;
  }
  return width;
}

function takeColumns(line: string, width: number): { rest: string; full: boolean } {
  let seen = 0;
  let index = 0;
  while (index < line.length && seen < width) {
    const char = line[index] ?? '';
    if (char !== ' ' && char !== '\t') {
      break;
    }
    const next = char === '\t' ? 4 - (seen % 4) : 1;
    if (seen + next > width) {
      break;
    }
    seen += next;
    index += 1;
  }
  return { rest: line.slice(index), full: seen === width };
}

function taskFenceEnd(
  lines: readonly string[],
  start: number,
  fence: string,
  prefixWidth: number
): number {
  const char = fence.startsWith('~') ? '~' : '`';
  const close = new RegExp(`^\\${char}{${fence.length},}\\s*$`);
  for (let index = start; index < lines.length; index += 1) {
    const taken = takeColumns(lines[index] ?? '', prefixWidth);
    if (taken.full && close.test(taken.rest)) {
      return index;
    }
  }
  return -1;
}

function taskFenceLines(
  lines: readonly string[],
  index: number,
  match: RegExpExecArray
): { lines: string[]; next: number } | null {
  const fence = match[6];
  if (fence === undefined) {
    return null;
  }
  const indent = match[1] ?? '';
  const marker = match[2] ?? '';
  const gap = match[3] ?? ' ';
  const box = (match[4] ?? ' ').toLowerCase() === 'x' ? 'x' : ' ';
  const fenceGap = match[5] ?? ' ';
  const info = match[7] ?? '';
  const removed = columnWidth(`[${box}]${fenceGap}`);
  const prefixWidth = columnWidth(`${indent}${marker}${gap}[${box}]${fenceGap}`);
  const end = taskFenceEnd(lines, index + 1, fence, prefixWidth);
  if (end === -1) {
    return null;
  }
  const contentColumn = columnWidth(`${indent}${marker}${gap}`);
  const rewritten = [
    `${indent}${marker}${gap}[${box}]`,
    `${' '.repeat(contentColumn)}${fence}${info}`,
  ];
  for (let cursor = index + 1; cursor <= end; cursor += 1) {
    rewritten.push(takeColumns(lines[cursor] ?? '', removed).rest);
  }
  return { lines: rewritten, next: end + 1 };
}

function separateTaskFences(content: string): string {
  const lines = content.split('\n');
  const output: string[] = [];
  let open: string | null = null;
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (open) {
      output.push(line);
      if (closesFence(line.trim(), open)) {
        open = null;
      }
      index += 1;
      continue;
    }
    const match = TASK_FENCE.exec(line);
    const fence = match?.[6] ?? '';
    const info = match?.[7] ?? '';
    const blocked =
      (fence.startsWith('`') && info.includes('`')) || (fence.startsWith('~') && info.includes('~'));
    const rewritten = match && !blocked ? taskFenceLines(lines, index, match) : null;
    if (!rewritten) {
      const opened = openingFence(line.trim());
      if (opened && leadingSpaces(line) <= 3) {
        open = opened;
      }
      output.push(line);
      index += 1;
      continue;
    }
    output.push(...rewritten.lines);
    index = rewritten.next;
  }
  return output.join('\n');
}

/** Indent the body of a fence that starts on a list marker. */
export function indentListMarkerFences(content: string): string {
  return indentListFences(separateTaskFences(content));
}

function indentListFences(content: string): string {
  const lines = content.split('\n');
  const output: string[] = [];
  let outer: string | null = null;
  let listFence: OpenListFence | null = null;
  for (const line of lines) {
    const quoted = splitQuote(line);
    if (listFence && quoted.depth < listFence.depth) {
      listFence = null;
    }
    if (listFence) {
      const body = fenceBody(quoted.body);
      output.push(indentBody(quoted.prefix, quoted.body, listFence.column));
      if (closesFence(body, listFence.marker)) {
        listFence = null;
      }
      continue;
    }
    if (outer) {
      output.push(line);
      if (closesFence(line.trim(), outer)) {
        outer = null;
      }
      continue;
    }
    const opened = listMarkerFence(quoted.body);
    if (opened) {
      listFence = { marker: opened.marker, column: opened.column, depth: quoted.depth };
      output.push(line);
      continue;
    }
    const fence = openingFence(line.trim());
    if (fence && leadingSpaces(quoted.body) <= 3) {
      outer = fence;
    }
    output.push(line);
  }
  return output.join('\n');
}
