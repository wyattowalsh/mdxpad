import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { parseMdxContent } from './prosemirror-mdx-parser';

let insertMarkdown: ((markdown: string) => boolean) | null = null;

/** The visual editor registers this while it is on screen. */
export function registerWysiwygInsert(insert: ((markdown: string) => boolean) | null): void {
  insertMarkdown = insert;
}

/** Insert markdown into the visual editor. Returns false when that editor is closed. */
export function insertIntoWysiwyg(markdown: string): boolean {
  return insertMarkdown?.(markdown) ?? false;
}

/** Insert a generated block after the paragraph that holds the caret. */
export function insertMarkdownBlock(view: EditorView, markdown: string): boolean {
  const parsed = parseMdxContent(markdown.endsWith('\n') ? markdown : `${markdown}\n`);
  const block = parsed?.firstChild;
  if (!block) {
    return false;
  }
  const { selection } = view.state;
  const from = selection.$from;
  const insertAt = selection.empty && from.parent.isTextblock ? from.after(from.depth) : null;
  const transaction =
    insertAt === null
      ? view.state.tr.replaceSelectionWith(block)
      : view.state.tr.insert(insertAt, block);
  if (block.isTextblock) {
    const inside = insertAt === null ? transaction.selection.from : insertAt + 1;
    const position = Math.min(Math.max(inside, 0), transaction.doc.content.size);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(position)));
  }
  view.dispatch(transaction.scrollIntoView());
  view.focus();
  return true;
}
