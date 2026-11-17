import { advanceFence } from './markdown-fence';

const DEFINITION = /^ {0,3}\[\^([^\]]+)\]:[ \t]*(.*)$/;
const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

function superscript(value: number): string {
  return String(value).replace(/\d/g, (digit) => SUPERSCRIPT[Number(digit)] ?? digit);
}

function noteNumber(id: string, order: string[]): number {
  let index = order.indexOf(id);
  if (index === -1) {
    order.push(id);
    index = order.length - 1;
  }
  return index + 1;
}

function copyCodeSpan(line: string, index: number): number {
  let ticks = 0;
  while (line[index + ticks] === '`') {
    ticks += 1;
  }
  const closer = line.indexOf('`'.repeat(ticks), index + ticks);
  return closer === -1 ? line.length : closer + ticks;
}

function replaceFootnoteLine(
  line: string,
  notes: ReadonlyMap<string, string>,
  order: string[]
): string {
  let result = '';
  let index = 0;
  while (index < line.length) {
    if (line[index] === '`') {
      const next = copyCodeSpan(line, index);
      result += line.slice(index, next);
      index = next;
      continue;
    }
    if (line.startsWith('[^', index)) {
      const end = line.indexOf(']', index + 2);
      const id = end === -1 ? '' : line.slice(index + 2, end);
      if (id.length > 0 && notes.has(id)) {
        result += superscript(noteNumber(id, order));
        index = end + 1;
        continue;
      }
    }
    result += line.charAt(index);
    index += 1;
  }
  return result;
}

function isNoteContinuation(line: string): boolean {
  return line.startsWith('    ') || line.startsWith('\t');
}

function continuationText(line: string): string {
  return line.startsWith('\t') ? line.slice(1) : line.slice(4);
}

function collectNotes(lines: readonly string[]): { kept: string[]; notes: Map<string, string> } {
  const notes = new Map<string, string>();
  const kept: string[] = [];
  let fence: string | null = null;
  let currentId: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const next = advanceFence(line, fence);
    const boundary = fence !== next;
    const inside = fence !== null;
    fence = next;
    if (inside || boundary) {
      currentId = null;
      kept.push(line);
      continue;
    }
    const definition = DEFINITION.exec(line);
    const id = definition?.[1];
    if (id) {
      notes.set(id, definition[2] ?? '');
      currentId = id;
      continue;
    }
    if (currentId && line.trim().length === 0 && isNoteContinuation(lines[index + 1] ?? '')) {
      notes.set(currentId, `${notes.get(currentId) ?? ''}\n`);
      continue;
    }
    if (currentId && isNoteContinuation(line)) {
      notes.set(currentId, `${notes.get(currentId) ?? ''}\n${continuationText(line)}`);
      continue;
    }
    currentId = null;
    kept.push(line);
  }
  return { kept, notes };
}

/** Replace footnote markers with superscripts and list the notes at the end. */
export function applyFootnotes(content: string): string {
  const { kept, notes } = collectNotes(content.split('\n'));
  if (notes.size === 0) {
    return content;
  }
  const order: string[] = [];
  const body = kept
    .map((line) => replaceFootnoteLine(line, notes, order))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  for (const id of notes.keys()) {
    if (!order.includes(id)) {
      order.push(id);
    }
  }
  const listed = order.map((id, index) => `${index + 1}. ${notes.get(id) ?? ''}`).join('\n');
  return `${body}\n\n## Notes\n\n${listed}\n`;
}
