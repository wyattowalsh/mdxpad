import { copyCodeSpan } from './prosemirror-tex-protect';

const DEFINITION = /^ {0,3}\[\^[^\]]+\]:/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const FOOTNOTE_OPEN = '[^';

export const FOOTNOTE_MARK = '\uE010';

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

function looseFollower(lines: readonly string[], index: number): boolean {
  const line = lines[index] ?? '';
  return line.trim().length > 0 && !indented(line) && !DEFINITION.test(line);
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

function replaceFootnoteOpen(value: string): string {
  return value.replaceAll(FOOTNOTE_OPEN, `${FOOTNOTE_MARK}^`);
}

function balancedBracketEnd(value: string, open: number): number {
  if (value[open] !== '[') {
    return -1;
  }
  let depth = 0;
  let index = open;
  while (index < value.length) {
    const code = index === open ? null : copyCodeSpan(value, index);
    if (code) {
      index = code.next;
      continue;
    }
    const char = value[index] ?? '';
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
    index += 1;
  }
  return -1;
}

function linkLabelClose(value: string, index: number): number {
  const image = value[index] === '!' && value[index + 1] === '[';
  const open = image ? index + 1 : index;
  if (value[open] !== '[') {
    return -1;
  }
  const end = balancedBracketEnd(value, open);
  if (end === -1) {
    return -1;
  }
  const next = value[end + 1];
  return next === '(' || next === '[' ? end : -1;
}

/** Keep `[^id]` from being read as a link, except inside a link label or image alt. */
export function protectFootnoteMarkers(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    const code = copyCodeSpan(value, index);
    if (code) {
      result += replaceFootnoteOpen(code.text);
      index = code.next;
      continue;
    }
    const labelEnd = linkLabelClose(value, index);
    if (labelEnd !== -1) {
      result += value.slice(index, labelEnd + 1);
      index = labelEnd + 1;
      continue;
    }
    if (value.startsWith(FOOTNOTE_OPEN, index)) {
      result += `${FOOTNOTE_MARK}^`;
      index += FOOTNOTE_OPEN.length;
      continue;
    }
    result += value[index] ?? '';
    index += 1;
  }
  return result;
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
      if (!fence && DEFINITION.test(line) && looseFollower(lines, index + 1)) {
        output.push('');
      }
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
