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
    if (char === '\\' && ESCAPABLE.test(next)) {
      current += next === '|' ? next : `${char}${next}`;
      index += 1;
      continue;
    }
    if (char === '`') {
      const end = readCodeSpan(inner, index);
      if (end > index) {
        current += inner.slice(index, end);
        index = end - 1;
        continue;
      }
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
