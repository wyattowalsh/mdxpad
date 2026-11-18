export interface SourcePosition {
  readonly line: number;
  readonly column: number;
}

/** Line and column for a character offset in the open document. Both are 1-based. */
export function sourcePosition(content: string, offset: number): SourcePosition {
  const clamped = Math.max(0, Math.min(offset, content.length));
  const lines = content.slice(0, clamped).split('\n');
  const line = lines.length;
  const column = (lines[lines.length - 1]?.length ?? 0) + 1;
  return { line, column };
}
