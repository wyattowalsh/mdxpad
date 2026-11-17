import { applyFootnotes } from './markdown-footnote';
import { advanceFence, fenceIndentedCode } from './markdown-fence';
import { closeOpenTableRows } from './markdown-table';

const LINK_DEFINITION =
  /^ {0,3}\[([^\]]+)\]:[ \t]+(<[^>\s]+>|\S+)(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/;

const REFERENCE = /^\[([^\]]+)\](?:\[([^\]]*)\])?(?!\()/;

function referenceLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function referenceDestination(raw: string): string {
  if (raw.startsWith('<') && raw.endsWith('>')) {
    return raw.slice(1, -1);
  }
  return raw;
}

function linkDefinition(line: string): { label: string; destination: string } | null {
  const definition = LINK_DEFINITION.exec(line);
  const label = definition?.[1];
  const destination = definition?.[2];
  if (!label || label.startsWith('^') || !destination) {
    return null;
  }
  return { label, destination };
}

function collectReferences(lines: readonly string[]): Map<string, string> {
  const references = new Map<string, string>();
  let fence: string | null = null;
  for (const line of lines) {
    const next = advanceFence(line, fence);
    const boundary = fence !== next;
    fence = next;
    if (fence || boundary) {
      continue;
    }
    const definition = linkDefinition(line);
    if (!definition || references.has(referenceLabel(definition.label))) {
      continue;
    }
    references.set(referenceLabel(definition.label), referenceDestination(definition.destination));
  }
  return references;
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

function withoutDefinitions(lines: readonly string[]): string[] {
  let fence: string | null = null;
  return lines.map((line) => {
    const next = advanceFence(line, fence);
    const boundary = fence !== next;
    fence = next;
    if (fence || boundary) {
      return line;
    }
    return linkDefinition(line) ? '' : line;
  });
}

/** Turn reference links into inline links and drop their definition lines. */
export function expandLinkReferences(content: string): string {
  const fenced = fenceIndentedCode(applyFootnotes(content));
  const lines = fenced.split('\n');
  const references = collectReferences(lines);
  if (references.size === 0) {
    return closeOpenTableRows(fenced);
  }
  let fence: string | null = null;
  const rewritten = withoutDefinitions(lines)
    .map((line) => {
      const next = advanceFence(line, fence);
      const boundary = fence !== next;
      fence = next;
      return fence || boundary ? line : rewriteLine(line, references);
    })
    .join('\n');
  return closeOpenTableRows(rewritten);
}
