import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { insertHardBreak } from './wysiwyg-break';

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

describe('visual hard breaks', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('breaks a paragraph without splitting the sentence into two paragraphs', () => {
    const view = open('Hello\n');
    views.push(view);
    let inside = 0;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Hello') {
        inside = pos + 2;
      }
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, inside)));
    expect(insertHardBreak(view.state, view.dispatch)).toBe(true);
    const saved = serializeMdxContent(view.state.doc);
    expect(saved).toContain('He\\\n');
    expect(saved).toContain('llo');
    expect(saved).not.toContain('He\n\nllo');
  });

  it('leaves a code block unchanged', () => {
    const view = open('```\nHello\n```\n');
    views.push(view);
    expect(insertHardBreak(view.state, view.dispatch)).toBe(false);
    expect(serializeMdxContent(view.state.doc)).toContain('Hello');
  });
});