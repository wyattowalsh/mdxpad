import type { EditorView } from 'prosemirror-view';

import { speechToInsert } from '@renderer/lib/insert-document-text';

function textBetween(view: EditorView, from: number, to: number): string {
  if (to <= from) {
    return '';
  }
  try {
    return view.state.doc.textBetween(from, to);
  } catch {
    return '';
  }
}

function characterBefore(view: EditorView, position: number): string {
  return textBetween(view, position - 1, position);
}

function characterAfter(view: EditorView, position: number): string {
  return textBetween(view, position, Math.min(view.state.doc.content.size, position + 1));
}

export function insertSpeechIntoView(view: EditorView, addition: string): void {
  if (addition.length === 0) {
    return;
  }
  const { from, to, empty } = view.state.selection;
  const text = speechToInsert(
    characterBefore(view, from),
    characterAfter(view, to),
    addition,
    !empty
  );
  view.dispatch(view.state.tr.insertText(text, from, to).scrollIntoView());
}
