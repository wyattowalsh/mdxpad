import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { mdxSchema } from './prosemirror-mdx-schema';
import { parseMdxContent } from './prosemirror-mdx-parser';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { indentCodeBlock, outdentCodeBlock } from './wysiwyg-code-indent';
import { visualListKeymap } from './wysiwyg-list';

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

function caretAt(view: EditorView, text: string): void {
  let pos = 0;
  view.state.doc.descendants((node, position) => {
    if (node.isText && node.text === text) {
      pos = position;
    }
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}

describe('visual code indent', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('inserts two spaces at the caret', () => {
    const view = open('```\nhello\n```\n');
    views.push(view);
    caretAt(view, 'hello');
    expect(indentCodeBlock(view.state, view.dispatch)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('  hello');
  });

  it('indents every selected line and Shift-Tab removes that indent', () => {
    const view = open('```\nhello\nworld\n```\n');
    views.push(view);
    let from = 0;
    let to = 0;
    view.state.doc.descendants((node, position) => {
      if (node.isText && node.text === 'hello\nworld') {
        from = position;
        to = position + node.text.length;
      }
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
    expect(indentCodeBlock(view.state, view.dispatch)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('  hello\n  world');
    expect(outdentCodeBlock(view.state, view.dispatch)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('hello\nworld');
    expect(serializeMdxContent(view.state.doc)).not.toContain('  hello');
  });

  it('leaves list nesting to Tab outside a code block', () => {
    const view = open('- one\n- two\n');
    views.push(view);
    caretAt(view, 'two');
    const tab = visualListKeymap().Tab;
    expect(tab?.(view.state, view.dispatch, view)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('two');
    expect(indentCodeBlock(view.state, view.dispatch)).toBe(false);
  });
});
