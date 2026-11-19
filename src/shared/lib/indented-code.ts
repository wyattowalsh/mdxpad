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

function emitIndentedFence(output: string[], lines: readonly string[], indent = ''): void {
  if (lines.length === 0) {
    return;
  }
  const marker = '`'.repeat(Math.max(3, longestBacktickRun(lines) + 1));
  const fenced = lines.map((line) => (line.length === 0 ? '' : `${indent}${line}`));
  output.push(`${indent}${marker}`, ...fenced, `${indent}${marker}`);
}

function quotedCode(line: string): { prefix: string; body: string } | null {
  const lead = /^( {0,3})/.exec(line)?.[1] ?? '';
  let rest = line.slice(lead.length);
  let depth = 0;
  while (rest.startsWith('>')) {
    const after = rest.slice(1);
    rest = after.startsWith(' ') ? after.slice(1) : after;
    depth += 1;
  }
  if (depth === 0) {
    return null;
  }
  const expanded = rest.replaceAll('\t', '    ');
  const spaces = /^ */.exec(expanded)?.[0].length ?? 0;
  if (spaces < 4 || expanded.trim().length === 0) {
    return null;
  }
  return { prefix: `${lead}${'> '.repeat(depth)}`, body: expanded.slice(4) };
}

function listCodeBody(line: string, column: number): string | null {
  const expanded = line.replaceAll('\t', '    ');
  if (expanded.trim().length === 0 || leadingSpaces(expanded) < column + 4) {
    return null;
  }
  return expanded.slice(column + 4);
}

interface FenceState {
  output: string[];
  pendingBlanks: string[];
  codeLines: string[];
  fence: string | null;
  inIndented: boolean;
  codeIndent: string;
  codeKind: 'top' | 'list' | 'quote';
  column: number | null;
}

function closeCode(state: FenceState): void {
  if (!state.inIndented) {
    return;
  }
  emitIndentedFence(state.output, state.codeLines.splice(0), state.codeIndent);
  state.output.push(...state.pendingBlanks.splice(0));
  state.inIndented = false;
  state.codeIndent = '';
  state.codeKind = 'top';
}

function blankBefore(state: FenceState): boolean {
  const last = state.output[state.output.length - 1] ?? '';
  return (
    state.output.length === 0 || last.trim() === '' || /^(?: {0,3}>[ \t]?)+$/.test(last)
  );
}

function footnoteParagraph(state: FenceState, line: string): boolean {
  if (leadingSpaces(line) >= 8) {
    return false;
  }
  for (let index = state.output.length - 1; index >= 0; index -= 1) {
    const previous = state.output[index] ?? '';
    if (previous.trim().length === 0) {
      continue;
    }
    if (/^\[\^[^\]]+\]:/.test(previous)) {
      return true;
    }
    if (leadingSpaces(previous) >= 4) {
      continue;
    }
    return false;
  }
  return false;
}

function openCode(
  state: FenceState,
  body: string,
  indent: string,
  kind: FenceState['codeKind']
): void {
  state.codeLines.push(body);
  state.codeIndent = indent;
  state.codeKind = kind;
  state.inIndented = true;
}

function activeCode(state: FenceState, line: string): string | null {
  if (state.codeKind === 'quote') {
    const quoted = quotedCode(line);
    return quoted !== null && quoted.prefix === state.codeIndent ? quoted.body : null;
  }
  if (state.codeKind === 'list' && state.column !== null) {
    return listCodeBody(line, state.column);
  }
  return state.inIndented ? indentedCodeText(line) : null;
}

function continueCode(state: FenceState, line: string): boolean {
  if (!state.inIndented) {
    return false;
  }
  const code = activeCode(state, line);
  if (code !== null) {
    state.codeLines.push(...state.pendingBlanks.splice(0), code);
    return true;
  }
  if (line.trim().length === 0 || (state.codeKind === 'quote' && /^(?:>[ \t]?)+$/.test(line))) {
    state.pendingBlanks.push('');
    return true;
  }
  closeCode(state);
  state.output.push(line);
  state.column = nextListColumn(state.column, line);
  return true;
}

function startCode(state: FenceState, line: string): boolean {
  const quoted = quotedCode(line);
  if (quoted !== null && blankBefore(state)) {
    openCode(state, quoted.body, quoted.prefix, 'quote');
    return true;
  }
  const top = indentedCodeText(line);
  const insideList = state.column !== null && leadingSpaces(line) >= state.column;
  if (top !== null && blankBefore(state) && !insideList && !footnoteParagraph(state, line)) {
    state.column = null;
    openCode(state, top, '', 'top');
    return true;
  }
  if (state.column !== null && blankBefore(state)) {
    const listed = listCodeBody(line, state.column);
    if (listed !== null) {
      openCode(state, listed, ' '.repeat(state.column), 'list');
      return true;
    }
  }
  return false;
}

function consumeLine(state: FenceState, line: string): void {
  const next = advanceFence(line, state.fence);
  if (state.fence || next) {
    closeCode(state);
    state.output.push(line);
    state.fence = next;
    return;
  }
  if (continueCode(state, line) || startCode(state, line)) {
    return;
  }
  state.output.push(line);
  state.column = nextListColumn(state.column, line);
}

/** Turn indented code, including code in a list or quote, into a fence. */
export function fenceIndentedCode(content: string): string {
  const state: FenceState = {
    output: [],
    pendingBlanks: [],
    codeLines: [],
    fence: null,
    inIndented: false,
    codeIndent: '',
    codeKind: 'top',
    column: null,
  };
  for (const line of content.split('\n')) {
    consumeLine(state, line);
  }
  closeCode(state);
  return state.output.join('\n');
}
