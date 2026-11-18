import type { Schema, Slice } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';

import { serializeMdxContent } from './prosemirror-mdx-serializer';

/** Markdown for a copied selection, including marks and list markers. */
export function markdownForSlice(schema: Schema, slice: Slice): string {
  const doc = schema.topNodeType.createAndFill();
  if (!doc || slice.content.size === 0) {
    return '';
  }
  try {
    const next = EditorState.create({ schema, doc }).tr.replace(0, doc.content.size, slice).doc;
    return serializeMdxContent(next).trimEnd();
  } catch {
    return '';
  }
}
