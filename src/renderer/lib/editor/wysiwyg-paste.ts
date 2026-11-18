import { Slice, type Node as ProseMirrorNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { parseMdxContent } from './prosemirror-mdx-parser';

function markdownDocument(text: string) {
  const source = text.replaceAll('\r\n', '\n');
  return parseMdxContent(source.endsWith('\n') ? source : `${source}\n`);
}

function insertBlocks(view: EditorView, parsed: ProseMirrorNode): void {
  const { selection } = view.state;
  const parent = selection.$from.parent;
  if (selection.empty && parent.isTextblock && parent.content.size === 0) {
    const start = selection.$from.before(selection.$from.depth);
    view.dispatch(view.state.tr.replaceWith(start, start + parent.nodeSize, parsed.content).scrollIntoView());
    return;
  }
  if (selection.empty && parent.isTextblock) {
    const insertAt = selection.$from.after(selection.$from.depth);
    const tr = view.state.tr.insert(insertAt, parsed.content);
    const position = Math.min(insertAt + 1, tr.doc.content.size);
    view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(position))).scrollIntoView());
    return;
  }
  view.dispatch(view.state.tr.replaceSelection(new Slice(parsed.content, 0, 0)).scrollIntoView());
}

/** Insert pasted Markdown. Rich HTML stays on the editor's normal paste path. */
export function pastePlainText(view: EditorView, text: string, html: string): boolean {
  if (html.trim().length > 0 || text.trim().length === 0) {
    return false;
  }
  const parsed = markdownDocument(text);
  const only = parsed?.childCount === 1 ? parsed.firstChild : null;
  if (!parsed || parsed.childCount === 0) {
    return false;
  }
  const { selection } = view.state;
  const parent = selection.$from.parent;
  const paragraph = view.state.schema.nodes.paragraph;
  if (only && paragraph && only.type === paragraph && parent.isTextblock && only.isTextblock) {
    view.dispatch(
      view.state.tr.replaceWith(selection.from, selection.to, only.content).scrollIntoView()
    );
    view.focus();
    return true;
  }
  insertBlocks(view, parsed);
  view.focus();
  return true;
}
