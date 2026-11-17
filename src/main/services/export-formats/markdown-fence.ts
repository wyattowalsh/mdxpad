import { listContentColumn } from './markdown-list';

const FENCE_LINE = /^( {0,3})(`{3,}|~{3,})(.*)$/;

function leadingSpaces(line: string): number {
  return /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
}

function nextListColumn(current: number | null, line: string): number | null {
  const column = listContentColumn(line);
  if (column !== null) {
    return column;
  }
  if (line.trim().length === 0 || (current !== null && leadingSpaces(line) >= current)) {
    return current;
  }
  return null;
}

/** The opening marker of a backtick or tilde fence, such as ` ``` ` or `~~~`. */
export function openingFence(line: string): string | null {
  return FENCE_LINE.exec(line)?.[2] ?? null;
}

/** The info word on an opening fence, such as `ts` in ` ```ts `. */
export function fenceLanguage(line: string): string {
  const token = (FENCE_LINE.exec(line)?.[3] ?? '').trim().split(/\s+/, 1)[0] ?? '';
  return /^[A-Za-z0-9_+#.-]+$/.test(token) ? token : '';
}

export function closesFence(line: string, open: string): boolean {
  const match = FENCE_LINE.exec(line);
  const marker = match?.[2];
  if (!marker || !marker.startsWith(open.charAt(0)) || marker.length < open.length) {
    return false;
  }
  return (match[3] ?? '').trim().length === 0;
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

function closeIndentedCode(output: string[], open: boolean): boolean {
  if (open) {
    output.push('```');
  }
  return false;
}

/** Turn a top-level indented code block into a fence so export keeps it as code. */
export function fenceIndentedCode(content: string): string {
  const output: string[] = [];
  const pendingBlanks: string[] = [];
  let fence: string | null = null;
  let inIndented = false;
  let listColumn: number | null = null;
  for (const line of content.split('\n')) {
    const next = advanceFence(line, fence);
    if (fence || next) {
      inIndented = closeIndentedCode(output, inIndented);
      output.push(...pendingBlanks.splice(0), line);
      fence = next;
      continue;
    }
    const code = indentedCodeText(line);
    if (inIndented && code !== null) {
      output.push(...pendingBlanks.splice(0), code);
      continue;
    }
    if (inIndented && line.trim().length === 0) {
      pendingBlanks.push('');
      continue;
    }
    if (inIndented) {
      inIndented = closeIndentedCode(output, true);
      output.push(...pendingBlanks.splice(0), line);
      continue;
    }
    const previousBlank = output.length === 0 || (output[output.length - 1] ?? '').trim() === '';
    if (code !== null && previousBlank) {
      if (listColumn !== null && leadingSpaces(line) >= listColumn) {
        output.push(...pendingBlanks.splice(0), line);
        continue;
      }
      listColumn = null;
      output.push('```', code);
      inIndented = true;
      continue;
    }
    output.push(line);
    listColumn = nextListColumn(listColumn, line);
  }
  inIndented = closeIndentedCode(output, inIndented);
  output.push(...pendingBlanks);
  return output.join('\n');
}

/** Move a fence cursor: a marker while inside, or null outside. */
export function advanceFence(line: string, open: string | null): string | null {
  if (open) {
    return closesFence(line, open) ? null : open;
  }
  return openingFence(line);
}
