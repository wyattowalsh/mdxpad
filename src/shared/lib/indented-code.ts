/**
 * Promote a top-level indented code block to a fence.
 * MDX compiles indented lines as prose, which would render a formula inside them.
 */

const FENCE_LINE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const LIST_ITEM = /^( *)([-*+]|\d+[.)])[ \t]+/;

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

function advanceFence(line: string, open: string | null): string | null {
  if (open) {
    return closesFence(line, open) ? null : open;
  }
  return openingFence(line);
}

function leadingSpaces(line: string): number {
  return /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
}

function listColumn(line: string): number | null {
  const match = LIST_ITEM.exec(line.replaceAll('\t', '    '));
  return match ? match[0].length : null;
}

function nextListColumn(current: number | null, line: string): number | null {
  const column = listColumn(line);
  if (column !== null) {
    return column;
  }
  if (line.trim().length === 0 || (current !== null && leadingSpaces(line) >= current)) {
    return current;
  }
  return null;
}

function indentedCodeText(line: string): string | null {
  if (line.trim().length === 0) {
    return null;
  }
  if (line.startsWith('\t')) {
    return line.slice(1);
  }
  if (line.startsWith('    ')) {
    return line.slice(4);
  }
  return null;
}

function longestBacktickRun(lines: readonly string[]): number {
  let longest = 0;
  for (const line of lines) {
    for (const run of line.match(/`+/g) ?? []) {
      longest = Math.max(longest, run.length);
    }
  }
  return longest;
}

function emitIndentedFence(output: string[], lines: readonly string[]): void {
  if (lines.length === 0) {
    return;
  }
  const marker = '`'.repeat(Math.max(3, longestBacktickRun(lines) + 1));
  output.push(marker, ...lines, marker);
}

/** Turn a top-level indented code block into a fence. */
export function fenceIndentedCode(content: string): string {
  const output: string[] = [];
  const pendingBlanks: string[] = [];
  const codeLines: string[] = [];
  let fence: string | null = null;
  let inIndented = false;
  let column: number | null = null;
  const closeCode = (): void => {
    if (!inIndented) {
      return;
    }
    emitIndentedFence(output, codeLines.splice(0));
    output.push(...pendingBlanks.splice(0));
    inIndented = false;
  };
  for (const line of content.split('\n')) {
    const next = advanceFence(line, fence);
    if (fence || next) {
      closeCode();
      output.push(line);
      fence = next;
      continue;
    }
    const code = indentedCodeText(line);
    if (inIndented && code !== null) {
      codeLines.push(...pendingBlanks.splice(0), code);
      continue;
    }
    if (inIndented && line.trim().length === 0) {
      pendingBlanks.push('');
      continue;
    }
    if (inIndented) {
      closeCode();
      output.push(line);
      continue;
    }
    const previousBlank = output.length === 0 || (output[output.length - 1] ?? '').trim() === '';
    if (code !== null && previousBlank && !(column !== null && leadingSpaces(line) >= column)) {
      column = null;
      codeLines.push(code);
      inIndented = true;
      continue;
    }
    output.push(line);
    column = nextListColumn(column, line);
  }
  closeCode();
  return output.join('\n');
}
