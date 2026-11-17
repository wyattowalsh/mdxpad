export interface EditorCaret {
  readonly anchor: number;
  readonly head: number;
}

export function selectionAfterDocumentUpdate(
  previous: EditorCaret,
  nextLength: number,
  mode: 'preserve' | 'start'
): EditorCaret {
  if (mode === 'start') {
    return { anchor: 0, head: 0 };
  }
  return {
    anchor: Math.max(0, Math.min(nextLength, previous.anchor)),
    head: Math.max(0, Math.min(nextLength, previous.head)),
  };
}
