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

function splitRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!isTableRow(trimmed)) {
    return null;
  }
  const inner = trimmed.slice(1, -1);
  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index] ?? '';
    const next = inner[index + 1] ?? '';
    if (char === '\\' && ESCAPABLE.test(next)) {
      current += next;
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

function alignOf(cell: string): TableAlign | null {
  const match = /^\s*(:?)-{3,}(:?)\s*$/.exec(cell);
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
