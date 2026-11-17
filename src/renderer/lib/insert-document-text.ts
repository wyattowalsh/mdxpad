/**
 * Insert generated text into the open document without dropping existing content.
 */

export function insertDiagramFence(current: string, fence: string): string {
  if (current.length === 0) {
    return fence;
  }
  if (current.endsWith('\n')) {
    return `${current}\n${fence}`;
  }
  return `${current}\n\n${fence}`;
}

export interface TextInsertionPoint {
  readonly from: number;
  readonly to: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function blockPrefix(before: string): string {
  if (before.length === 0 || before.endsWith('\n\n')) {
    return '';
  }
  if (before.endsWith('\n')) {
    return '\n';
  }
  return '\n\n';
}

function blockSuffix(after: string): string {
  if (after.length === 0 || after.startsWith('\n\n')) {
    return '';
  }
  if (after.startsWith('\n')) {
    return '\n';
  }
  return '\n\n';
}

/** Insert a block at the cursor, or replace the selection. */
export function insertTextAtSelection(
  current: string,
  text: string,
  selection: TextInsertionPoint | null
): string {
  if (!selection) {
    return insertDiagramFence(current, text);
  }
  const from = clamp(selection.from, 0, current.length);
  const to = clamp(selection.to, from, current.length);
  if (from !== to) {
    return `${current.slice(0, from)}${text}${current.slice(to)}`;
  }
  const before = current.slice(0, from);
  const after = current.slice(from);
  return `${before}${blockPrefix(before)}${text}${blockSuffix(after)}${after}`;
}

export function joinVoiceTranscript(current: string, addition: string): string {
  if (addition.length === 0) {
    return current;
  }
  if (current.length === 0 || /\s$/.test(current) || /^\s/.test(addition)) {
    return `${current}${addition}`;
  }
  return `${current} ${addition}`;
}

/** Add spaces around spoken text when it would otherwise stick to the neighboring characters. */
export function speechToInsert(
  beforeChar: string,
  afterChar: string,
  addition: string,
  replacing: boolean
): string {
  if (replacing || addition.length === 0) {
    return addition;
  }
  let text = addition;
  if (beforeChar.length > 0 && !/\s/.test(beforeChar) && !/^\s/.test(text)) {
    text = ` ${text}`;
  }
  if (afterChar.length > 0 && !/\s/.test(afterChar) && !/\s$/.test(text)) {
    text = `${text} `;
  }
  return text;
}

/** Insert spoken text at the cursor and return where the next word should continue. */
export function insertVoiceAtSelection(
  current: string,
  addition: string,
  selection: TextInsertionPoint | null
): { readonly text: string; readonly cursor: number } {
  if (addition.length === 0) {
    const cursor = selection ? clamp(selection.from, 0, current.length) : current.length;
    return { text: current, cursor };
  }
  if (!selection) {
    const text = joinVoiceTranscript(current, addition);
    return { text, cursor: text.length };
  }
  const from = clamp(selection.from, 0, current.length);
  const to = clamp(selection.to, from, current.length);
  const before = current.slice(0, from);
  const after = current.slice(to);
  const spoken = joinVoiceTranscript(before, addition);
  const needsSpace = after.length > 0 && !/^\s/.test(after) && !/\s$/.test(spoken);
  const text = `${spoken}${needsSpace ? ' ' : ''}${after}`;
  return { text, cursor: spoken.length + (needsSpace ? 1 : 0) };
}
