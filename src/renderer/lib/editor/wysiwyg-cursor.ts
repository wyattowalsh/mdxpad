/**
 * Map a visual caret to the source line and column shown in the status bar.
 */

import { Fragment, Slice, type Node as ProseMirrorNode } from 'prosemirror-model';

import { serializeMdxContent } from './prosemirror-mdx-serializer';

const SENTINEL = '\u0000';

export interface SourceCursor {
  readonly line: number;
  readonly column: number;
}

function cursorFromOffset(source: string, offset: number): SourceCursor {
  const clamped = Math.max(0, Math.min(source.length, offset));
  const lines = source.slice(0, clamped).split('\n');
  const last = lines[lines.length - 1] ?? '';
  return { line: lines.length, column: last.length + 1 };
}

function withSentinel(doc: ProseMirrorNode, pos: number): ProseMirrorNode | null {
  const $pos = doc.resolve(pos);
  const marks = $pos.nodeAfter?.isText === true ? $pos.nodeAfter.marks : $pos.marks();
  const text = doc.type.schema.text(SENTINEL, marks);
  try {
    return doc.replace(pos, pos, new Slice(Fragment.from(text), 0, 0));
  } catch {
    return null;
  }
}

/** 1-indexed source position of a caret in the visual document. */
export function sourceCursorAt(doc: ProseMirrorNode, pos: number): SourceCursor {
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const marked = withSentinel(doc, clamped);
  if (!marked) {
    return { line: 1, column: 1 };
  }
  const serialized = serializeMdxContent(marked);
  const index = serialized.indexOf(SENTINEL);
  if (index < 0) {
    return { line: 1, column: 1 };
  }
  return cursorFromOffset(serialized.replace(SENTINEL, ''), index);
}
