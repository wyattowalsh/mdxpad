import { EditorState, NodeSelection, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { markdownForSlice } from './wysiwyg-copy';

function open(source: string): EditorView {
  const doc = parseMdxContent(source);
  if (!doc) {
    throw new Error('markdown did not parse');
  }
  const host = document.createElement('div');
  return new EditorView(host, {
    state: EditorState.create({ doc, schema: mdxSchema }),
  });
}

function selectText(view: EditorView, target: string): void {
  let from = 0;
  let to = 0;
  view.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text?.includes(target) || from !== 0) {
      return;
    }
    const at = node.text.indexOf(target);
    from = pos + at;
    to = from + target.length;
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
}

describe('visual copy', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('copies bold text as Markdown', () => {
    const view = open('**Hello** there\n');
    views.push(view);
    selectText(view, 'Hello');
    expect(markdownForSlice(view.state.schema, view.state.selection.content())).toBe('**Hello**');
  });

  it('copies a list with its markers', () => {
    const view = open('- one\n- two\n');
    views.push(view);
    const list = view.state.doc.firstChild;
    if (!list) {
      throw new Error('missing list');
    }
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    const copied = markdownForSlice(view.state.schema, view.state.selection.content());
    expect(copied).toContain('- one');
    expect(copied).toContain('- two');
  });
});