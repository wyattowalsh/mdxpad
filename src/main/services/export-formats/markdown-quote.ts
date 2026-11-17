const QUOTE_LINE = /^\s{0,3}>\s?(.*)$/;

export function quoteBody(line: string): string | null {
  const match = QUOTE_LINE.exec(line);
  if (!match) {
    return null;
  }
  return match[1] ?? '';
}

export function quoteToHtml(
  lines: readonly string[],
  renderLine: (line: string) => string
): string {
  const paragraphs = lines
    .filter((line) => line.length > 0)
    .map((line) => `<p>${renderLine(line)}</p>`);
  return `<blockquote>\n${paragraphs.join('\n')}\n</blockquote>`;
}

export function quoteToLatex(
  lines: readonly string[],
  renderLine: (line: string) => string
): string {
  const body = lines.map((line) => (line.length > 0 ? renderLine(line) : '')).join('\n\n');
  return `\\begin{quote}\n${body}\n\\end{quote}`;
}
