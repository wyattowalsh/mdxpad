import type { Node as ProseMirrorNode } from 'prosemirror-model';

import { serializeMdxContent } from './prosemirror-mdx-serializer';

export interface WysiwygCommentAnchor {
  readonly anchorFrom: number;
  readonly anchorTo: number;
  readonly quote: string;
}

let readSelection: (() => WysiwygCommentAnchor | null) | null = null;

/** The visual editor registers this while it is on screen. */
export function registerWysiwygComment(
  read: (() => WysiwygCommentAnchor | null) | null
): void {
  readSelection = read;
}

/** The current visual selection, or null when that editor is closed or nothing is selected. */
export function readWysiwygComment(): WysiwygCommentAnchor | null {
  return readSelection?.() ?? null;
}

/** Map a visual selection onto character offsets in the saved markdown. */
export function wysiwygCommentAnchor(
  doc: ProseMirrorNode,
  from: number,
  to: number
): WysiwygCommentAnchor | null {
  const quote = doc.textBetween(from, to).trim();
  if (from === to || quote.length === 0) {
    return null;
  }
  const full = serializeMdxContent(doc);
  const before = serializeMdxContent(doc.cut(0, from));
  const found = full.indexOf(quote, Math.max(0, before.length - quote.length));
  const anchorFrom = found === -1 ? before.length : found;
  return { anchorFrom, anchorTo: anchorFrom + quote.length, quote };
}
