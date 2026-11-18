import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { serializeMdxContent } from './prosemirror-mdx-serializer';

let focusLine: ((line: number, column: number) => boolean) | null = null;

/** The visual editor registers this while it is on screen. */
export function registerWysiwygSourceLine(
  focus: ((line: number, column: number) => boolean) | null
): void {
  focusLine = focus;
}

/** Move the visual caret to a source line. Returns false when that editor is closed. */
export function focusWysiwygSourceLine(line: number, column: number): boolean {
  return focusLine?.(line, column) ?? false;
}

function blockSource(doc: ProseMirrorNode, node: ProseMirrorNode): string {
  return serializeMdxContent(doc.type.create(null, [node]));
}

function lineText(source: string, line: number): string {
  const lines = source.split('\n');
  const index = Math.max(0, Math.min(line - 1, lines.length - 1));
  return (lines[index] ?? '').trim();
}

/** Move the caret to the block that contains this source line. */
export function focusSourceLineInView(view: EditorView, line: number, _column: number): boolean {
  const needle = lineText(serializeMdxContent(view.state.doc), line);
  const matches: number[] = [];
  if (needle.length > 0) {
    view.state.doc.descendants((node, pos) => {
      if (!node.isBlock) {
        return false;
      }
      const contains = blockSource(view.state.doc, node)
        .split('\n')
        .some((entry) => entry.trim() === needle);
      if (!contains) {
        return false;
      }
      matches.push(pos + 1);
      return true;
    });
  }
  const target = matches[matches.length - 1] ?? 1;
  const selection = TextSelection.near(
    view.state.doc.resolve(Math.min(target, view.state.doc.content.size))
  );
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  view.focus();
  return true;
}
