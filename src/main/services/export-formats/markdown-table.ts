import { mathCloserIndex, unescapedDelimiterIndex } from '@shared/lib/math-span';

import { canOpenEmphasis, canOpenStrikethrough } from './markdown-emphasis';
import { isThematicBreak } from './markdown-break';
import { parseListItem } from './markdown-list';
import { advanceFence, openingFence } from './markdown-fence';

export type TableAlign = 'left' | 'center' | 'right';

export interface MarkdownTable {
  readonly headers: readonly string[];
  readonly aligns: readonly TableAlign[];
  readonly rows: readonly (readonly string[])[];
}

const ESCAPABLE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

export function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1;
}

function backtickRun(value: string, index: number): number {
  let length = 0;
  while (value[index + length] === '`') {
    length += 1;
  }
  return length;
}

function readCodeSpan(value: string, index: number): number {
  const run = backtickRun(value, index);
  let cursor = index + run;
  while (cursor < value.length) {
    if (value[cursor] !== '`') {
      cursor += 1;
      continue;
    }
    const closer = backtickRun(value, cursor);
    if (closer === run) {
      return cursor + closer;
    }
    cursor += closer;
  }
  return index;
}

function skipMath(value: string, index: number): number {
  const opener = value.slice(index, index + 2);
  if (opener === '\\(' || opener === '\\[') {
    const closer = opener === '\\(' ? '\\)' : '\\]';
    const end = unescapedDelimiterIndex(value, index + 2, closer);
    return end === -1 ? index : end + closer.length;
  }
  if (value.startsWith('$$', index)) {
    const end = mathCloserIndex(value, index + 2, '$$');
    return end === -1 ? index : end + 2;
  }
  if (value[index] !== '$' || value[index - 1] === '\\') {
    return index;
  }
  let cursor = index + 1;
  while (cursor < value.length) {
    if (value[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (value[cursor] === '$') {
      return cursor + 1;
    }
    cursor += 1;
  }
  return index;
}

function matchingCloser(value: string, open: number, left: string, right: string): number {
  let depth = 0;
  for (let index = open; index < value.length; index += 1) {
    const char = value[index] ?? '';
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === left) {
      depth += 1;
    } else if (char === right) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function skipCloser(value: string, index: number, marker: string): number {
  const end = value.indexOf(marker, index + marker.length);
  return end === -1 ? index : end + marker.length;
}

function skipEmphasis(value: string, index: number): number {
  if (value[index] === '~') {
    let length = 0;
    while (value[index + length] === '~') length += 1;
    if (length < 2 || !canOpenStrikethrough(value, index)) return index + length;
    return skipCloser(value, index, '~~');
  }
  const marker = value[index];
  if (marker !== '*' && marker !== '_') return index;
  let length = 0;
  while (value[index + length] === marker) length += 1;
  if (!canOpenEmphasis(value, index)) return index + length;
  const token = length >= 2 ? `${marker}${marker}` : marker;
  return skipCloser(value, index, token);
}

function skipLink(value: string, index: number): number {
  const image = value[index] === '!' && value[index + 1] === '[';
  const labelStart = image ? index + 1 : value[index] === '[' ? index : -1;
  if (labelStart === -1) {
    return index;
  }
  const labelEnd = matchingCloser(value, labelStart, '[', ']');
  if (labelEnd === -1) {
    return index;
  }
  const next = value[labelEnd + 1];
  if (next !== '(' && next !== '[') {
    return index;
  }
  const end = matchingCloser(value, labelEnd + 1, next, next === '(' ? ')' : ']');
  return end === -1 ? index : end + 1;
}

function skipAutolink(value: string, index: number): number {
  if (value[index] !== '<') {
    return index;
  }
  const end = value.indexOf('>', index + 1);
  if (end === -1) {
    return index;
  }
  const body = value.slice(index + 1, end);
  const url = !body.includes(' ') && (/^https?:\/\//i.test(body) || body.includes('@'));
  return url ? end + 1 : index;
}

function skipProtected(value: string, index: number): number {
  const mathEnd = skipMath(value, index);
  if (mathEnd > index) {
    return mathEnd;
  }
  if (value[index] === '`') {
    const codeEnd = readCodeSpan(value, index);
    if (codeEnd > index) {
      return codeEnd;
    }
  }
  const emphasisEnd = skipEmphasis(value, index);
  if (emphasisEnd > index) {
    return emphasisEnd;
  }
  const linkEnd = skipLink(value, index);
  if (linkEnd > index) {
    return linkEnd;
  }
  return skipAutolink(value, index);
}

function splitCells(line: string): string[] {
  const trimmed = line.trim();
  let inner = trimmed;
  if (inner.startsWith('|')) {
    inner = inner.slice(1);
  }
  if (inner.endsWith('|')) {
    inner = inner.slice(0, -1);
  }
  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index] ?? '';
    const next = inner[index + 1] ?? '';
    const protectedEnd = skipProtected(inner, index);
    if (protectedEnd > index) {
      current += inner.slice(index, protectedEnd);
      index = protectedEnd - 1;
      continue;
    }
    if (char === '\\' && ESCAPABLE.test(next)) {
      current += next === '|' ? next : `${char}${next}`;
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function splitRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!isTableRow(trimmed)) {
    return null;
  }
  return splitCells(trimmed);
}

function containsDelimiterPipe(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (trimmed.startsWith('|') || trimmed.endsWith('|')) {
    return true;
  }
  return splitCells(trimmed).length > 1;
}

function alignOf(cell: string): TableAlign | null {
  const match = /^\s*(:?)-+(:?)\s*$/.exec(cell);
  if (!match) {
    return null;
  }
  const left = match[1] === ':';
  const right = match[2] === ':';
  if (left && right) {
    return 'center';
  }
  if (right) {
    return 'right';
  }
  return 'left';
}

function columnAligns(cells: readonly string[]): TableAlign[] | null {
  const aligns: TableAlign[] = [];
  for (const cell of cells) {
    const align = alignOf(cell);
    if (!align) {
      return null;
    }
    aligns.push(align);
  }
  return aligns;
}

function padRow(cells: readonly string[], width: number): string[] {
  const padded = cells.slice(0, width);
  while (padded.length < width) {
    padded.push('');
  }
  return padded;
}

export function parseMarkdownTable(lines: readonly string[]): MarkdownTable | null {
  const header = splitRow(lines[0] ?? '');
  const separator = splitRow(lines[1] ?? '');
  if (!header || !separator || header.length === 0 || separator.length !== header.length) {
    return null;
  }
  const aligns = columnAligns(separator);
  if (!aligns) {
    return null;
  }
  const rows: string[][] = [];
  for (const line of lines.slice(2)) {
    const cells = splitRow(line);
    if (!cells) {
      return null;
    }
    rows.push(padRow(cells, header.length));
  }
  return { headers: header, aligns, rows };
}

/** Browsers center `th` and draw no cell borders. Every HTML surface sets both. */
export const TABLE_CELL_CSS =
  'table { border-collapse: collapse; } th, td { border: 1px solid #d1d5db; padding: 0.4rem 0.6rem; text-align: left; }';

export function markdownTableToHtml(
  table: MarkdownTable,
  renderCell: (cell: string) => string
): string {
  const cellTag = (tag: 'th' | 'td', cell: string, align: TableAlign): string => {
    const style = align === 'left' ? '' : ` style="text-align: ${align}"`;
    return `<${tag}${style}>${renderCell(cell)}</${tag}>`;
  };
  const head = table.headers
    .map((cell, index) => cellTag('th', cell, table.aligns[index] ?? 'left'))
    .join('');
  const body = table.rows
    .map(
      (row) =>
        `<tr>${row.map((cell, index) => cellTag('td', cell, table.aligns[index] ?? 'left')).join('')}</tr>`
    )
    .join('\n');
  return `<table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

function latexColumn(align: TableAlign): string {
  switch (align) {
    case 'left':
      return 'l';
    case 'center':
      return 'c';
    case 'right':
      return 'r';
    default: {
      const exhaustive: never = align;
      return exhaustive;
    }
  }
}

export function markdownTableToLatex(
  table: MarkdownTable,
  renderCell: (cell: string) => string
): string {
  const align = table.aligns.map((value) => latexColumn(value)).join('');
  const renderRow = (cells: readonly string[]): string =>
    `${cells.map((cell) => renderCell(cell)).join(' & ')} \\\\`;
  return [
    `\\begin{tabular}{${align}}`,
    '\\hline',
    renderRow(table.headers),
    '\\hline',
    ...table.rows.map((row) => renderRow(row)),
    '\\hline',
    '\\end{tabular}',
  ].join('\n');
}

function isDelimiterLine(line: string): boolean {
  if (!containsDelimiterPipe(line)) {
    return false;
  }
  const cells = splitCells(line);
  return cells.length > 0 && cells.every((cell) => alignOf(cell) !== null);
}

function isTableBodyRow(line: string): boolean {
  const trimmed = line.trim();
  if (!containsDelimiterPipe(trimmed) || isThematicBreak(trimmed) || openingFence(line) !== null) {
    return false;
  }
  if (/^#{1,6}(?:\s|$)/.test(trimmed) || trimmed.startsWith('>')) {
    return false;
  }
  return parseListItem(trimmed) === null;
}

function ensureOuterPipes(line: string): string {
  const indent = /^[ \t]*/.exec(line)?.[0] ?? '';
  const trimmed = line.trim();
  const withStart = trimmed.startsWith('|') ? trimmed : `| ${trimmed}`;
  const piped = withStart.endsWith('|') ? withStart : `${withStart} |`;
  return `${indent}${piped}`;
}

/** Add the outer pipes GFM allows writers to omit, without touching fenced code. */
export function closeOpenTableRows(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let fence: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const nextFence = advanceFence(line, fence);
    if (fence !== null || nextFence !== null) {
      fence = nextFence;
      result.push(line);
      continue;
    }
    const next = lines[index + 1];
    if (
      next !== undefined &&
      isTableBodyRow(line) &&
      !isDelimiterLine(line) &&
      isDelimiterLine(next)
    ) {
      result.push(ensureOuterPipes(line));
      result.push(ensureOuterPipes(next));
      index += 1;
      while (index + 1 < lines.length) {
        const body = lines[index + 1] ?? '';
        if (advanceFence(body, null) !== null || !isTableBodyRow(body)) {
          break;
        }
        result.push(ensureOuterPipes(body));
        index += 1;
      }
      continue;
    }
    result.push(line);
  }
  return result.join('\n');
}
