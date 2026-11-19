/**
 * A fence that opens on a list marker keeps its following lines only when
 * those lines are indented under the item. Shift them in before parsing.
 */

const FENCE_LINE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const LIST_HEAD = /^( *)([-*+]|\d+[.)])[ \t]+/;

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

/** Indent the body of a fence that starts on a list marker. */
export function indentListMarkerFences(content: string): string {
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
