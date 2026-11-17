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
 * Replace the visual document from markdown.
 * `preserve` keeps the cursor as close as the new text allows.
 * `start` opens the document at the beginning.
 * Returns false when nothing changes.
 */
export function replaceWysiwygDocument(
  view: EditorView,
  markdown: string,
  selection: 'preserve' | 'start' = 'preserve'
): boolean {
  const sameDocument = serializeMdxContent(view.state.doc) === markdown;
  if (sameDocument && selection === 'preserve') {
    return false;
  }
  if (sameDocument) {
    const start = TextSelection.near(view.state.doc.resolve(0));
    if (view.state.selection.eq(start)) {
      return false;
    }
    view.dispatch(view.state.tr.setSelection(start));
    return true;
  }
  const next = documentFromMarkdown(markdown);
  const frontmatter = typeof next.attrs.frontmatter === 'string' ? next.attrs.frontmatter : '';
  const linkDefinitions =
    typeof next.attrs.linkDefinitions === 'string' ? next.attrs.linkDefinitions : '';
  const cursor = selection === 'start' ? 0 : view.state.selection.from;
  const tr = view.state.tr
    .replaceWith(0, view.state.doc.content.size, next.content)
    .setDocAttribute('frontmatter', frontmatter)
    .setDocAttribute('linkDefinitions', linkDefinitions)
    .setMeta('addToHistory', false);
  const position = Math.max(0, Math.min(cursor, tr.doc.content.size));
  tr.setSelection(TextSelection.near(tr.doc.resolve(position)));
  view.dispatch(tr);
  return true;
}

/** Insert a link. An empty caret uses the URL as the link text. */
export function insertWysiwygLink(view: EditorView, href: string): void {
  const { from, to, empty } = view.state.selection;
  const mark = mdxSchema.marks.link.create({ href });
  if (empty) {
    const text = view.state.schema.text(href, [mark]);
    view.dispatch(view.state.tr.replaceSelectionWith(text, false).scrollIntoView());
    return;
  }
  view.dispatch(view.state.tr.addMark(from, to, mark).scrollIntoView());
}
