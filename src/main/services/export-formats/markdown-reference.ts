import { applyFootnotes } from './markdown-footnote';
import { advanceFence, fenceIndentedCode } from './markdown-fence';
import { quoteBody } from './markdown-quote';
import { closeOpenTableRows } from './markdown-table';

const LINK_DEFINITION =
  /^ {0,3}\[([^\]]+)\]:[ \t]+(<[^>\s]+>|\S+)(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/;

const REFERENCE = /^\[([^\]]+)\](?:\[([^\]]*)\])?(?!\()/;
const TITLE_LINE = /^(?:"[^"]*"|'[^']*'|\([^)]*\))$/;

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

function linkDefinition(line: string): { label: string; destination: string } | null {
  const definition = LINK_DEFINITION.exec(definitionSource(line));
  const label = definition?.[1];
  const destination = definition?.[2];
  if (!label || label.startsWith('^') || !destination) {
    return null;
  }
  return { label, destination };
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
    const definition = linkDefinition(line);
    const label = definition ? referenceLabel(definition.label) : '';
    if (!definition || references.has(label)) {
      continue;
    }
    const title = titleContinuation(lines, index);
    const destination = title ? `${definition.destination} ${title}` : definition.destination;
    references.set(label, referenceDestination(destination));
    consumed.add(index);
    if (title) {
      consumed.add(index + 1);
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
