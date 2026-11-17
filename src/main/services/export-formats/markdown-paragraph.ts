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

/** Soft-wrapped lines stay one phrase. A hard break starts the next phrase. */
export function paragraphSegments(lines: readonly SourceLine[]): string[] {
  const segments: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    current.push(line.text);
    if (line.hardBreak) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    segments.push(current);
  }
  return segments.map((segment) => segment.join(' '));
}

export function joinParagraphHtml(
  lines: readonly SourceLine[],
  render: (text: string) => string
): string {
  return paragraphSegments(lines)
    .map((text) => render(text))
    .join('<br />');
}
