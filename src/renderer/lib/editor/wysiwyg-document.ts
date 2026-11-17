import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { mdxSchema } from './prosemirror-mdx-schema';
import { parseMdxContent } from './prosemirror-mdx-parser';
import { serializeMdxContent } from './prosemirror-mdx-serializer';

export function documentFromMarkdown(content: string): ProseMirrorNode {
  const doc = parseMdxContent(content) ?? mdxSchema.nodes.doc.createAndFill();
  if (!doc) {
    throw new Error('Could not create a WYSIWYG document');
  }
  return doc;
}

/**
 * Replace the visual document from markdown and keep the cursor
 * as close as the new document allows. Returns false when the
 * document already matches.
 */
export function replaceWysiwygDocument(view: EditorView, markdown: string): boolean {
  if (serializeMdxContent(view.state.doc) === markdown) {
    return false;
  }
  const next = documentFromMarkdown(markdown);
  const cursor = view.state.selection.from;
  const tr = view.state.tr
    .replaceWith(0, view.state.doc.content.size, next.content)
    .setMeta('addToHistory', false);
  const position = Math.max(0, Math.min(cursor, tr.doc.content.size));
  tr.setSelection(TextSelection.near(tr.doc.resolve(position)));
  view.dispatch(tr);
  return true;
}
