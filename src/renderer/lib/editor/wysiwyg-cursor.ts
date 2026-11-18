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

function markedSource(doc: ProseMirrorNode, pos: number): { source: string; index: number } | null {
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const marked = withSentinel(doc, clamped);
  if (!marked) {
    return null;
  }
  const serialized = serializeMdxContent(marked);
  const index = serialized.indexOf(SENTINEL);
  if (index < 0) {
    return null;
  }
  return { source: serialized.replace(SENTINEL, ''), index };
}

/** Offset of a caret in the serialized Markdown, or null when it cannot be mapped. */
export function sourceOffsetAt(doc: ProseMirrorNode, pos: number): number | null {
  return markedSource(doc, pos)?.index ?? null;
}

/** 1-indexed source position of a caret in the visual document. */
export function sourceCursorAt(doc: ProseMirrorNode, pos: number): SourceCursor {
  const marked = markedSource(doc, pos);
  if (!marked) {
    return { line: 1, column: 1 };
  }
  return cursorFromOffset(marked.source, marked.index);
}
