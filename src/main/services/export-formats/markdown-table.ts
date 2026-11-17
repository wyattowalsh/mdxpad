export interface MarkdownTable {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

const SEPARATOR_CELL = /^\s*:?-{3,}:?\s*$/;

export function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1;
}

function splitRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!isTableRow(trimmed)) {
    return null;
  }
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
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
  if (!separator.every((cell) => SEPARATOR_CELL.test(cell))) {
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
  return { headers: header, rows };
}

export function markdownTableToHtml(
  table: MarkdownTable,
  renderCell: (cell: string) => string
): string {
  const head = table.headers.map((cell) => `<th>${renderCell(cell)}</th>`).join('');
  const body = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderCell(cell)}</td>`).join('')}</tr>`)
    .join('\n');
  return `<table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

export function markdownTableToLatex(
  table: MarkdownTable,
  renderCell: (cell: string) => string
): string {
  const align = 'l'.repeat(table.headers.length);
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
