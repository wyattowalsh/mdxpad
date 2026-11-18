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
  const transaction =
    selection.empty && from.parent.isTextblock
      ? view.state.tr.insert(from.after(from.depth), block)
      : view.state.tr.replaceSelectionWith(block);
  view.dispatch(transaction.scrollIntoView());
  return true;
}
