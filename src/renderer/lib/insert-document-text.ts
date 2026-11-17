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
