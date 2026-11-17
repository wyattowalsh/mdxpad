import { applyFootnotes } from './markdown-footnote';
import { advanceFence, fenceIndentedCode, openingFence } from './markdown-fence';
import { quoteBody } from './markdown-quote';
import { closeOpenTableRows } from './markdown-table';

const LINK_LABEL = /^ {0,3}\[([^\]]+)\]:[ \t]*/;

const REFERENCE = /^\[([^\]]+)\](?:\[([^\]]*)\])?(?!\()/;
const TITLE_LINE = /^(?:"[^"]*"|'[^']*'|\([^)]*\))$/;
const LABEL_ONLY = /^ {0,3}\[([^\]]+)\]:[ \t]*$/;
const DESTINATION_LINE = /^(<[^>\n]+>|\S+)(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?$/;

function referenceLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function referenceDestination(raw: string): string {
  if (raw.startsWith('<') && raw.endsWith('>')) {
    return raw.slice(1, -1);
  }
  return raw;
}

function definitionSource(line: string): string {
  let text = line;
  let inner = quoteBody(text);
  while (inner !== null) {
    text = inner;
    inner = quoteBody(text);
  }
  return text;
}

function quoteDepth(line: string): number {
  let depth = 0;
  let text = line;
  let inner = quoteBody(text);
  while (inner !== null) {
    depth += 1;
    text = inner;
    inner = quoteBody(text);
  }
  return depth;
}

function titleContinuation(lines: readonly string[], index: number): string | null {
  const next = lines[index + 1];
  if (next === undefined || quoteDepth(lines[index] ?? '') !== quoteDepth(next)) {
    return null;
  }
  const title = definitionSource(next).trim();
  return TITLE_LINE.test(title) ? title : null;
}

function splitDefinition(
  lines: readonly string[],
  index: number
): { label: string; destination: string; consumed: number } | null {
  const sameLine = linkDefinition(lines[index] ?? '');
  if (sameLine) {
    const title = sameLine.titled ? null : titleContinuation(lines, index);
    return {
      label: sameLine.label,
      destination: title ? `${sameLine.destination} ${title}` : sameLine.destination,
      consumed: title ? 2 : 1,
    };
  }
  const labelMatch = LABEL_ONLY.exec(definitionSource(lines[index] ?? ''));
  const label = labelMatch?.[1];
  const next = lines[index + 1];
  if (!label || label.startsWith('^') || next === undefined || openingFence(next) !== null) {
    return null;
  }
  if (quoteDepth(lines[index] ?? '') !== quoteDepth(next)) {
    return null;
  }
  const destinationLine = definitionSource(next).trim();
  if (!DESTINATION_LINE.test(destinationLine)) {
    return null;
  }
  const title = titleContinuation(lines, index + 1);
  return {
    label,
    destination: title ? `${destinationLine} ${title}` : destinationLine,
    consumed: title ? 3 : 2,
  };
}

function skipSpaces(source: string, index: number): number {
  let cursor = index;
  while (source[cursor] === ' ' || source[cursor] === '\t') {
    cursor += 1;
  }
  return cursor;
}

function readDestinationToken(
  source: string,
  index: number
): { value: string; end: number } | null {
  if (source[index] === '<') {
    const end = source.indexOf('>', index + 1);
    return end === -1 ? null : { value: source.slice(index, end + 1), end: end + 1 };
  }
  let value = '';
  let cursor = index;
  while (cursor < source.length && source[cursor] !== ' ' && source[cursor] !== '\t') {
    const current = source[cursor] ?? '';
    const next = source[cursor + 1] ?? '';
    if (current === '\\' && cursor + 1 < source.length) {
      value += current + next;
      cursor += 2;
      continue;
    }
    value += source[cursor] ?? '';
    cursor += 1;
  }
  return value.length > 0 ? { value, end: cursor } : null;
}

function readTitleToken(source: string, index: number): { raw: string; end: number } | null {
  const quote = source[index];
  const closer = quote === '(' ? ')' : quote;
  if (quote !== '"' && quote !== "'" && quote !== '(') {
    return null;
  }
  let raw = quote;
  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    const char = source[cursor] ?? '';
    const escaped = source[cursor + 1] ?? '';
    if (char === '\\' && cursor + 1 < source.length) {
      raw += char + escaped;
      cursor += 1;
      continue;
    }
    raw += char;
    if (char === closer) {
      return source.slice(cursor + 1).trim().length === 0 ? { raw, end: cursor + 1 } : null;
    }
  }
  return null;
}

function linkDefinition(
  line: string
): { label: string; destination: string; titled: boolean } | null {
  const source = definitionSource(line);
  const start = LINK_LABEL.exec(source);
  const label = start?.[1];
  if (!start || !label || label.startsWith('^')) {
    return null;
  }
  const destination = readDestinationToken(source, start[0].length);
  if (!destination) {
    return null;
  }
  const title = readTitleToken(source, skipSpaces(source, destination.end));
  if (title === null && skipSpaces(source, destination.end) < source.trimEnd().length) {
    return null;
  }
  return {
    label,
    destination: title ? `${destination.value} ${title.raw}` : destination.value,
    titled: title !== null,
  };
}

function collectReferences(lines: readonly string[]): {
  references: Map<string, string>;
  consumed: Set<number>;
} {
  const references = new Map<string, string>();
  const consumed = new Set<number>();
  let fence: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const next = advanceFence(line, fence);
    const boundary = fence !== next;
    fence = next;
    if (fence || boundary || consumed.has(index)) {
      continue;
    }
    const definition = splitDefinition(lines, index);
    const label = definition ? referenceLabel(definition.label) : '';
    if (!definition || references.has(label)) {
      continue;
    }
    references.set(label, referenceDestination(definition.destination));
    for (let offset = 0; offset < definition.consumed; offset += 1) {
      consumed.add(index + offset);
    }
  }
  return { references, consumed };
}

function copyCodeSpan(line: string, index: number): { text: string; next: number } | null {
  if (line[index] !== '`') {
    return null;
  }
  let ticks = 0;
  while (line[index + ticks] === '`') {
    ticks += 1;
  }
  const closer = line.indexOf('`'.repeat(ticks), index + ticks);
  if (closer === -1) {
    return { text: line.slice(index), next: line.length };
  }
  return { text: line.slice(index, closer + ticks), next: closer + ticks };
}

function rewriteLine(line: string, references: ReadonlyMap<string, string>): string {
  let result = '';
  let index = 0;
  while (index < line.length) {
    const code = copyCodeSpan(line, index);
    if (code) {
      result += code.text;
      index = code.next;
      continue;
    }
    const match = REFERENCE.exec(line.slice(index));
    const text = match?.[1];
    const explicit = match?.[2];
    const label = explicit === undefined || explicit.length === 0 ? text : explicit;
    const href = label ? references.get(referenceLabel(label)) : undefined;
    if (!match || !text || !href) {
      result += line[index] ?? '';
      index += 1;
      continue;
    }
    result += `[${text}](${href})`;
    index += match[0].length;
  }
  return result;
}

function withoutDefinitions(lines: readonly string[], consumed: ReadonlySet<number>): string[] {
  let fence: string | null = null;
  return lines.map((line, index) => {
    const next = advanceFence(line, fence);
    const boundary = fence !== next;
    fence = next;
    if (fence || boundary) {
      return line;
    }
    return consumed.has(index) ? '' : line;
  });
}

/** Turn reference links into inline links and drop their definition lines. */
export function expandLinkReferences(content: string): string {
  const fenced = fenceIndentedCode(applyFootnotes(content));
  const lines = fenced.split('\n');
  const { references, consumed } = collectReferences(lines);
  if (references.size === 0) {
    return closeOpenTableRows(fenced);
  }
  let fence: string | null = null;
  const rewritten = withoutDefinitions(lines, consumed)
    .map((line) => {
      const next = advanceFence(line, fence);
      const boundary = fence !== next;
      fence = next;
      return fence || boundary ? line : rewriteLine(line, references);
    })
    .join('\n');
  return closeOpenTableRows(rewritten);
}
