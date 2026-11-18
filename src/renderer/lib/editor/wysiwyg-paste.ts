import { Slice } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';

import { parseMdxContent } from './prosemirror-mdx-parser';

function markdownDocument(text: string) {
  const source = text.replaceAll('\r\n', '\n');
  return parseMdxContent(source.endsWith('\n') ? source : `${source}\n`);
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
  view.dispatch(view.state.tr.replaceSelection(new Slice(parsed.content, 0, 0)).scrollIntoView());
  view.focus();
  return true;
}
