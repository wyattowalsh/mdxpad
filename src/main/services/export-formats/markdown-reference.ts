import { mathDelimiterAt, mathSpanEnd, unescapedDelimiterIndex } from '@shared/lib/math-span';

import { applyFootnotes } from './markdown-footnote';
import { advanceFence, fenceIndentedCode, openingFence } from './markdown-fence';
import { readMarkdownTarget } from './markdown-link';
import { listContentColumn } from './markdown-list';
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
    for (let cursor = index + 1; cursor < source.length; cursor += 1) {
      const char = source[cursor] ?? '';
      if (char === '\\') {
        cursor += 1;
        continue;
      }
      if (char === '>') {
        return { value: source.slice(index, cursor + 1), end: cursor + 1 };
      }
      if (char === '\n' || char === '<') {
        return null;
      }
    }
    return null;
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

function texMathSpan(line: string, index: number): { text: string; next: number } | null {
  const display = line.startsWith('\\[', index);
  if (!display && !line.startsWith('\\(', index)) {
    return null;
  }
  const close = display ? '\\]' : '\\)';
  const end = unescapedDelimiterIndex(line, index + 2, close);
  if (end === -1) {
    return null;
  }
  return { text: line.slice(index, end + close.length), next: end + close.length };
}

function mathSpanAt(line: string, index: number): { text: string; next: number } | null {
  const delimiter = mathDelimiterAt(line, index);
  if (!delimiter) {
    return texMathSpan(line, index);
  }
  const end = mathSpanEnd(line, index, delimiter);
  if (end === -1) {
    return null;
  }
  return { text: line.slice(index, end), next: end };
}

function inlineTargetSpan(line: string, index: number): { text: string; next: number } | null {
  const marker = line[index] === '[' || (line[index] === '!' && line[index + 1] === '[');
  if (!marker) {
    return null;
  }
  const link = readMarkdownTarget(line, index);
  if (link?.start !== index) {
    return null;
  }
  return { text: line.slice(index, link.end), next: link.end };
}

function copyProtectedSpan(line: string, index: number): { text: string; next: number } | null {
  return copyCodeSpan(line, index) ?? mathSpanAt(line, index) ?? inlineTargetSpan(line, index);
}

function rewriteLine(line: string, references: ReadonlyMap<string, string>): string {
  let result = '';
  let index = 0;
  while (index < line.length) {
    const kept = copyProtectedSpan(line, index);
    if (kept) {
      result += kept.text;
      index = kept.next;
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

function imageMarkerEscaped(line: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && line[cursor] === '\\'; cursor -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

function rewriteImageReferenceLine(line: string, references: ReadonlyMap<string, string>): string {
  let result = '';
  let index = 0;
  while (index < line.length) {
    const kept = copyProtectedSpan(line, index);
    if (kept) {
      result += kept.text;
      index = kept.next;
      continue;
    }
    const marker =
      line[index] === '!' && line[index + 1] === '[' && !imageMarkerEscaped(line, index);
    const match = marker ? REFERENCE.exec(line.slice(index + 1)) : null;
    const text = match?.[1];
    const explicit = match?.[2];
    const label = explicit === undefined || explicit.length === 0 ? text : explicit;
    const href = label ? references.get(referenceLabel(label)) : undefined;
    if (match && text && href) {
      result += `![${text}](${href})`;
      index += match[0].length + 1;
      continue;
    }
    result += line[index] ?? '';
    index += 1;
  }
  return result;
}

function leadingSpaces(line: string): number {
  return /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
}

function updateListColumn(current: number | null, line: string): number | null {
  const column = listContentColumn(line);
  if (column !== null) {
    return column;
  }
  if (line.trim().length === 0 || (current !== null && leadingSpaces(line) >= current)) {
    return current;
  }
  return null;
}

function lineStartsIndentedCode(
  line: string,
  previousBlank: boolean,
  listColumn: number | null
): boolean {
  const indented = line.startsWith('    ') || line.startsWith('\t');
  return indented && previousBlank && !(listColumn !== null && leadingSpaces(line) >= listColumn);
}

function rewriteImageReferenceLines(
  content: string,
  references: ReadonlyMap<string, string>
): string {
  const output: string[] = [];
  let fence: string | null = null;
  let inCode = false;
  let listColumn: number | null = null;
  for (const line of content.split('\n')) {
    const next = advanceFence(line, fence);
    const inside = fence !== null || next !== null;
    fence = next;
    if (inside) {
      inCode = false;
      output.push(line);
      continue;
    }
    const indented = line.startsWith('    ') || line.startsWith('\t');
    const previousBlank = output.length === 0 || (output[output.length - 1] ?? '').trim() === '';
    if (inCode && (indented || line.trim().length === 0)) {
      output.push(line);
      continue;
    }
    if (lineStartsIndentedCode(line, previousBlank, listColumn)) {
      inCode = true;
      listColumn = null;
      output.push(line);
      continue;
    }
    inCode = false;
    output.push(line.trim().length === 0 ? line : rewriteImageReferenceLine(line, references));
    listColumn = updateListColumn(listColumn, line);
  }
  return output.join('\n');
}

/** Turn image references into inline images so export can embed the files. */
export function expandImageReferences(content: string): string {
  const { references } = collectReferences(fenceIndentedCode(content).split('\n'));
  if (references.size === 0) {
    return content;
  }
  return rewriteImageReferenceLines(content, references);
}

function referenceLabelsOnLine(line: string): string[] {
  const labels: string[] = [];
  let index = 0;
  while (index < line.length) {
    const kept = copyProtectedSpan(line, index);
    if (kept) {
      index = kept.next;
      continue;
    }
    const image =
      line[index] === '!' && line[index + 1] === '[' && !imageMarkerEscaped(line, index);
    const start = image ? index + 1 : index;
    const match = line[start] === '[' ? REFERENCE.exec(line.slice(start)) : null;
    const text = match?.[1];
    if (!match || !text) {
      index += 1;
      continue;
    }
    const explicit = match[2];
    const label = explicit === undefined || explicit.length === 0 ? text : explicit;
    labels.push(referenceLabel(label));
    index = start + match[0].length;
  }
  return labels;
}

function labelsStillUsed(lines: readonly string[], consumed: ReadonlySet<number>): Set<string> {
  const used = new Set<string>();
  let fence: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const next = advanceFence(line, fence);
    const boundary = fence !== next;
    fence = next;
    if (fence || boundary || consumed.has(index)) {
      continue;
    }
    for (const label of referenceLabelsOnLine(line)) {
      used.add(label);
    }
  }
  return used;
}

function unreferencedDefinitionLines(lines: readonly string[]): Set<number> {
  const { consumed } = collectReferences(lines);
  const used = labelsStillUsed(lines, consumed);
  const drop = new Set<number>();
  let fence: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const next = advanceFence(line, fence);
    const boundary = fence !== next;
    fence = next;
    if (fence || boundary || drop.has(index) || !consumed.has(index)) {
      continue;
    }
    const definition = splitDefinition(lines, index);
    const label = definition ? referenceLabel(definition.label) : '';
    if (!definition || used.has(label)) {
      continue;
    }
    for (let offset = 0; offset < definition.consumed; offset += 1) {
      drop.add(index + offset);
    }
  }
  return drop;
}

function definitionAddress(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('<')) {
    return /^\S+/.exec(trimmed)?.[0] ?? trimmed;
  }
  let end = 1;
  while (end < trimmed.length) {
    if (trimmed[end] === '\\') {
      end += 2;
      continue;
    }
    if (trimmed[end] === '>') {
      return trimmed.slice(1, end);
    }
    end += 1;
  }
  return trimmed;
}

function unsafeDefinitionLines(
  lines: readonly string[],
  keep: (address: string) => boolean
): Set<number> {
  const drop = new Set<number>();
  let fence: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const next = advanceFence(line, fence);
    const boundary = fence !== next;
    fence = next;
    if (fence || boundary || drop.has(index)) {
      continue;
    }
    const definition = splitDefinition(lines, index);
    if (!definition || keep(definitionAddress(definition.destination))) {
      continue;
    }
    for (let offset = 0; offset < definition.consumed; offset += 1) {
      drop.add(index + offset);
    }
  }
  return drop;
}

/** Remove definitions whose pictures were already written inline and nothing else uses. */
export function dropUnreferencedDefinitions(content: string): string {
  const lines = content.split('\n');
  const drop = unreferencedDefinitionLines(lines);
  if (drop.size === 0) {
    return content;
  }
  return lines.map((line, index) => (drop.has(index) ? '' : line)).join('\n');
}

/** Remove reference definitions whose address cannot be opened from an export. */
export function dropUnsafeLinkDefinitions(
  content: string,
  keep: (address: string) => boolean
): string {
  const lines = content.split('\n');
  const drop = unsafeDefinitionLines(lines, keep);
  if (drop.size === 0) {
    return content;
  }
  return lines.map((line, index) => (drop.has(index) ? '' : line)).join('\n');
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
