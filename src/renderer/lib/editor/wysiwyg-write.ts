import { Fragment } from 'prosemirror-model';
import { TextSelection, type Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { parseMdxContent } from './prosemirror-mdx-parser';

const CONTEXT_RADIUS = 240;

export interface VisualWriteSelection {
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly context: string;
}

interface VisualWriteBridge {
  readonly read: () => VisualWriteSelection | null;
  readonly apply: (expected: VisualWriteSelection, next: string) => boolean;
}

let bridge: VisualWriteBridge | null = null;

/** The visual editor registers this while it is on screen. */
export function registerWysiwygWrite(next: VisualWriteBridge | null): void {
  bridge = next;
}

export function hasWysiwygWrite(): boolean {
  return bridge !== null;
}

export function readWysiwygWriteSelection(): VisualWriteSelection | null {
  return bridge?.read() ?? null;
}

export function applyWysiwygWriteText(expected: VisualWriteSelection, next: string): boolean {
  return bridge?.apply(expected, next) ?? false;
}

/** The current visual selection, including a little surrounding text. */
export function readVisualWrite(view: EditorView): VisualWriteSelection | null {
  const { from, to } = view.state.selection;
  if (from === to) {
    return null;
  }
  const text = view.state.doc.textBetween(from, to, '\n');
  if (text.trim().length === 0) {
    return null;
  }
  const size = view.state.doc.content.size;
  return {
    from,
    to,
    text,
    context: view.state.doc.textBetween(
      Math.max(0, from - CONTEXT_RADIUS),
      Math.min(size, to + CONTEXT_RADIUS),
      '\n'
    ),
  };
}

function hasMarkdownSyntax(value: string): boolean {
  return /[*_`#]/.test(value) || value.includes('\n\n');
}

function parsedReplacement(markdown: string): Fragment | null {
  const parsed = parseMdxContent(markdown);
  if (!parsed || parsed.childCount === 0) {
    return null;
  }
  const only = parsed.childCount === 1 ? parsed.firstChild : null;
  return only?.isTextblock ? only.content : parsed.content;
}

function replacementTransaction(view: EditorView, from: number, to: number, next: string): Transaction {
  if (!hasMarkdownSyntax(next)) {
    return view.state.tr.insertText(next, from, to);
  }
  const content = parsedReplacement(next);
  if (!content) {
    return view.state.tr.insertText(next, from, to);
  }
  try {
    return view.state.tr.replaceWith(from, to, content);
  } catch {
    return view.state.tr.insertText(next, from, to);
  }
}

/** Replace the visual selection when it still matches the text that was sent. */
export function applyVisualWrite(view: EditorView, expected: VisualWriteSelection, next: string): boolean {
  const { from, to } = view.state.selection;
  const current = view.state.doc.textBetween(from, to, '\n');
  if (from !== expected.from || to !== expected.to || current !== expected.text) {
    return false;
  }
  const tr = replacementTransaction(view, from, to, next);
  const head = Math.min(tr.mapping.map(to), tr.doc.content.size);
  view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(head), -1)).scrollIntoView());
  view.focus();
  return true;
}
