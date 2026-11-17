const DEFINITION = /^ {0,3}\[\^[^\]]+\]:/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

export const FOOTNOTE_BLOCK_LANGUAGE = 'mdxpad-footnote';

function definitionBody(line: string): string {
  return line.replace(/^ {0,3}\[\^[^\]]+\]:[ \t]*/, '');
}

function startsBlock(line: string): boolean {
  const trimmed = line.trim();
  return (
    FENCE.test(line) ||
    trimmed === '$$' ||
    trimmed.startsWith('>') ||
    (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1)
  );
}

function indented(line: string): boolean {
  return line.startsWith('    ') || line.startsWith('\t');
}

function continuesFootnote(lines: readonly string[], index: number): boolean {
  const line = lines[index] ?? '';
  if (indented(line)) {
    return true;
  }
  if (line.trim().length > 0) {
    return false;
  }
  const next = lines[index + 1] ?? '';
  return indented(next);
}

function needsBlock(lines: readonly string[], index: number): boolean {
  if (startsBlock(definitionBody(lines[index] ?? ''))) {
    return true;
  }
  for (let cursor = index + 1; cursor < lines.length && continuesFootnote(lines, cursor); cursor += 1) {
    const line = (lines[cursor] ?? '').replace(/^(?: {4}|\t)/, '');
    if (line.trim().length > 0 && startsBlock(line)) {
      return true;
    }
  }
  return false;
}

function longestBacktickRun(value: string): number {
  let longest = 0;
  for (const run of value.match(/`+/g) ?? []) {
    longest = Math.max(longest, run.length);
  }
  return longest;
}

function wrapBlock(block: readonly string[]): string[] {
  const source = block.join('\n');
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(source) + 1));
  return [`${fence}${FOOTNOTE_BLOCK_LANGUAGE}`, ...block, fence];
}

/** Keep a footnote that contains a block from being flattened by the paragraph parser. */
export function protectFootnoteBlocks(value: string): string {
  const lines = value.split('\n');
  const output: string[] = [];
  let fence: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const opener = FENCE.exec(line)?.[1] ?? null;
    if (fence) {
      fence = opener && opener.startsWith(fence[0] ?? '') && opener.length >= fence.length ? null : fence;
      output.push(line);
      continue;
    }
    if (opener) {
      fence = opener;
      output.push(line);
      continue;
    }
    if (!DEFINITION.test(line) || !needsBlock(lines, index)) {
      output.push(line);
      continue;
    }
    const block = [line];
    let cursor = index + 1;
    while (cursor < lines.length && continuesFootnote(lines, cursor)) {
      block.push(lines[cursor] ?? '');
      cursor += 1;
    }
    output.push(...wrapBlock(block));
    index = cursor - 1;
  }
  return output.join('\n');
}
