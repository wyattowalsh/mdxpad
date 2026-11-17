export interface SourceLine {
  readonly text: string;
  readonly hardBreak: boolean;
}

function trailingBackslashBreak(line: string): SourceLine | null {
  let slashes = 0;
  for (let index = line.length - 1; index >= 0 && line[index] === '\\'; index -= 1) {
    slashes += 1;
  }
  if (slashes % 2 === 0) {
    return null;
  }
  return { text: line.slice(0, -1).trim(), hardBreak: true };
}

/** Read a Markdown line, keeping a hard break made with two spaces or one backslash. */
export function readSourceLine(line: string): SourceLine {
  if (/ {2,}$/.test(line)) {
    return { text: line.replace(/[ ]+$/, '').trim(), hardBreak: true };
  }
  return trailingBackslashBreak(line) ?? { text: line.trim(), hardBreak: false };
}

export function joinParagraphHtml(
  lines: readonly SourceLine[],
  render: (text: string) => string
): string {
  let html = '';
  lines.forEach((line, index) => {
    if (index > 0) {
      html += lines[index - 1]?.hardBreak ? '<br />' : ' ';
    }
    html += render(line.text);
  });
  return html;
}
