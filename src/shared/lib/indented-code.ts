/**
 * Promote a top-level indented code block to a fence.
 * MDX compiles indented lines as prose, which would render a formula inside them.
 */

const LIST_ITEM = /^( *)([-*+]|\d+[.)])[ \t]+/;
const FENCE_MARKER = /^(`{3,}|~{3,})(.*)$/;

function quoteStripped(line: string): string {
  return line.replace(/^(?:>[ \t]?)+/, '');
}

function fenceIndentAllowed(spaces: number, columns: readonly number[]): boolean {
  for (let index = columns.length - 1; index >= 0; index -= 1) {
    const column = columns[index] ?? 0;
    if (spaces >= column && spaces <= column + 3) {
      return true;
    }
    if (spaces >= column) {
      return false;
    }
  }
  return spaces <= 3;
}

function fenceOnLine(
  line: string,
  columns: readonly number[]
): { marker: string; info: string } | null {
  const expanded = quoteStripped(line).replaceAll('\t', '    ');
  const spaces = leadingSpaces(expanded);
  if (!fenceIndentAllowed(spaces, columns)) {
    return null;
  }
  const match = FENCE_MARKER.exec(expanded.slice(spaces));
  const marker = match?.[1] ?? '';
  const info = match?.[2] ?? '';
  if (marker.length === 0) {
    return null;
  }
  if (marker.startsWith('`') && info.includes('`')) {
    return null;
  }
  if (marker.startsWith('~') && info.includes('~')) {
    return null;
  }
  return { marker, info };
}

/** The fence marker after this line, including a fence indented under a list item. */
export function nextProseFence(
  open: string | null,
  line: string,
  columns: readonly number[]
): string | null {
  const found = fenceOnLine(line, columns);
  if (!found) {
    return open;
  }
  if (open === null) {
    return found.marker;
  }
  const sameMark = found.marker.startsWith(open.charAt(0));
  if (found.info.trim().length === 0 && sameMark && found.marker.length >= open.length) {
    return null;
  }
  return open;
}

/** List columns after a prose line that is outside a fence. */
export function nextProseColumns(columns: readonly number[], line: string): number[] {
  return nextListColumns(columns, quoteStripped(line));
}

function leadingSpaces(line: string): number {
  return /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
}

function listColumn(line: string): number | null {
  const match = LIST_ITEM.exec(line.replaceAll('\t', '    '));
  return match ? match[0].length : null;
}

function nextListColumns(columns: readonly number[], line: string): number[] {
  const column = listColumn(line);
  if (column !== null) {
    return [...columns.filter((existing) => existing < column), column];
  }
  if (line.trim().length === 0) {
    return [...columns];
  }
  const spaces = leadingSpaces(line);
  return columns.filter((existing) => spaces >= existing);
}

function activeColumn(columns: readonly number[]): number | null {
  return columns.length > 0 ? (columns[columns.length - 1] ?? null) : null;
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
  columns: number[];
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
  const column = activeColumn(state.columns);
  if (state.codeKind === 'list' && column !== null) {
    return listCodeBody(line, column);
  }
  return state.inIndented ? indentedCodeText(line) : null;
}

function continueCode(state: FenceState, line: string): boolean {
  if (!state.inIndented) {
    return false;
  }
  const code = activeCode(state, line);
  if (code !== null) {
    const blanks = state.pendingBlanks.splice(0).map(() => '');
    state.codeLines.push(...blanks, code);
    return true;
  }
  if (state.codeKind === 'quote' && /^(?:>[ \t]?)+$/.test(line)) {
    state.pendingBlanks.push(line);
    return true;
  }
  if (line.trim().length === 0) {
    state.pendingBlanks.push('');
    return true;
  }
  closeCode(state);
  state.output.push(line);
  state.columns = nextProseColumns(state.columns, line);
  return true;
}

function quotedLineInsideList(state: FenceState, line: string): boolean {
  const column = activeColumn(state.columns);
  if (column === null) {
    return false;
  }
  const stripped = quoteStripped(line);
  return stripped !== line && leadingSpaces(stripped) >= column;
}

function quoteListCode(state: FenceState, line: string): boolean {
  const column = activeColumn(state.columns);
  if (column === null || !blankBefore(state)) {
    return false;
  }
  const stripped = quoteStripped(line);
  if (stripped === line || leadingSpaces(stripped) < column) {
    return false;
  }
  const listed = listCodeBody(stripped, column);
  if (listed === null) {
    return false;
  }
  const lead = line.slice(0, line.length - stripped.length);
  openCode(state, listed, `${lead}${' '.repeat(column)}`, 'quote');
  return true;
}

function startCode(state: FenceState, line: string): boolean {
  if (quoteListCode(state, line)) {
    return true;
  }
  if (quotedLineInsideList(state, line)) {
    return false;
  }
  const quoted = quotedCode(line);
  if (quoted !== null && blankBefore(state)) {
    openCode(state, quoted.body, quoted.prefix, 'quote');
    return true;
  }
  const top = indentedCodeText(line);
  const column = activeColumn(state.columns);
  const insideList = column !== null && leadingSpaces(line) >= column;
  if (top !== null && blankBefore(state) && !insideList && !footnoteParagraph(state, line)) {
    state.columns = [];
    openCode(state, top, '', 'top');
    return true;
  }
  if (column !== null && blankBefore(state)) {
    const listed = listCodeBody(line, column);
    if (listed !== null) {
      openCode(state, listed, ' '.repeat(column), 'list');
      return true;
    }
  }
  return false;
}

function consumeLine(state: FenceState, line: string): void {
  const next = nextProseFence(state.fence, line, state.columns);
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
  state.columns = nextProseColumns(state.columns, line);
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
    columns: [],
  };
  for (const line of content.split('\n')) {
    consumeLine(state, line);
  }
  closeCode(state);
  return state.output.join('\n');
}
