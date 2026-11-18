import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { applyVisualWrite, readVisualWrite } from './wysiwyg-write';

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

describe('visual AI write', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('replaces the selected words and keeps markdown emphasis', () => {
    const view = open('Hello world\n');
    views.push(view);
    selectText(view, 'Hello');
    const selection = readVisualWrite(view);
    if (!selection) {
      throw new Error('selection was empty');
    }
    expect(applyVisualWrite(view, selection, '**Hi**')).toBe(true);
    expect(view.state.doc.textContent).toContain('Hi');
    expect(view.state.doc.textContent).not.toContain('Hello');
    let bold = false;
    view.state.doc.descendants((node) => {
      if (node.isText && node.text === 'Hi') {
        bold = node.marks.some((mark) => mark.type.name === 'bold');
      }
    });
    expect(bold).toBe(true);
  });

  it('leaves the document alone when the selection moved', () => {
    const view = open('Hello world\n');
    views.push(view);
    selectText(view, 'Hello');
    const selection = readVisualWrite(view);
    if (!selection) {
      throw new Error('selection was empty');
    }
    selectText(view, 'world');
    expect(applyVisualWrite(view, selection, 'Hi')).toBe(false);
    expect(view.state.doc.textContent).toContain('Hello');
  });
});