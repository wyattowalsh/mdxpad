/**
 * Scroll target for the visual editor.
 *
 * Preview sync uses this while the source editor is unmounted.
 */

import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';

import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { sourceCursorAt } from './wysiwyg-cursor';

export interface WysiwygScrollTarget {
  readonly element: HTMLElement;
  readonly firstVisibleLine: () => number;
  readonly cursorLine: () => number;
  readonly totalLines: () => number;
  readonly revealLine: (line: number) => void;
  readonly contentSample: () => { readonly length: number; readonly sample: string };
}

let target: WysiwygScrollTarget | null = null;
const listeners = new Set<() => void>();

/** The visual editor registers this while it is on screen. */
export function registerWysiwygScroll(next: WysiwygScrollTarget | null): void {
  target = next;
  for (const listener of listeners) {
    listener();
  }
}

export function readWysiwygScroll(): WysiwygScrollTarget | null {
  return target;
}

export function subscribeWysiwygScroll(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Source line count, ignoring a single trailing newline from serialization. */
export function sourceLineCount(doc: ProseMirrorNode): number {
  const text = serializeMdxContent(doc);
  if (text.length === 0) {
    return 1;
  }
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  return Math.max(1, body.split('\n').length);
}

/** Source line of the first block that still intersects the scrollport. */
export function firstVisibleSourceLine(view: EditorView, scroller: HTMLElement): number {
  const top = scroller.getBoundingClientRect().top;
  let offset = 0;
  for (let index = 0; index < view.state.doc.childCount; index += 1) {
    const node = view.state.doc.child(index);
    const dom = view.nodeDOM(offset);
    if (dom instanceof HTMLElement && dom.getBoundingClientRect().bottom >= top) {
      return sourceCursorAt(view.state.doc, offset + 1).line;
    }
    offset += node.nodeSize;
  }
  return sourceCursorAt(view.state.doc, view.state.selection.head).line;
}
