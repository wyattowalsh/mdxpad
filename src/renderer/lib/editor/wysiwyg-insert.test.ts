import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { insertMarkdownBlock } from './wysiwyg-insert';

describe('insertMarkdownBlock', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('puts a horizontal rule after the paragraph that holds the caret', () => {
    const doc = parseMdxContent('Hello\n\nGoodbye\n');
    if (!doc) {
      throw new Error('markdown did not parse');
    }
    const host = document.createElement('div');
    const view = new EditorView(host, {
      state: EditorState.create({ doc, schema: mdxSchema }),
    });
    views.push(view);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
    expect(insertMarkdownBlock(view, '---')).toBe(true);
    const saved = serializeMdxContent(view.state.doc);
    expect(saved).toContain('Hello');
    expect(saved.indexOf('Hello')).toBeLessThan(saved.indexOf('---'));
    expect(saved.indexOf('---')).toBeLessThan(saved.indexOf('Goodbye'));
  });

  it('places the caret inside an inserted code block', () => {
    const doc = parseMdxContent('Hello\n');
    if (!doc) {
      throw new Error('markdown did not parse');
    }
    const host = document.createElement('div');
    const view = new EditorView(host, {
      state: EditorState.create({ doc, schema: mdxSchema }),
    });
    views.push(view);
    expect(insertMarkdownBlock(view, '```\n\n```')).toBe(true);
    expect(view.state.selection.$from.parent.type.name).toBe('code_block');
    expect(serializeMdxContent(view.state.doc)).toContain('Hello');
  });

  it('puts a diagram after the paragraph that holds the caret', () => {
    const doc = parseMdxContent('Hello\n\nGoodbye\n');
    if (!doc) {
      throw new Error('markdown did not parse');
    }
    const host = document.createElement('div');
    const view = new EditorView(host, {
      state: EditorState.create({ doc, schema: mdxSchema }),
    });
    views.push(view);
    const hello = view.state.doc.firstChild;
    if (!hello) {
      throw new Error('missing paragraph');
    }
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
    expect(insertMarkdownBlock(view, '```mermaid\ngraph TD\n```')).toBe(true);
    const saved = serializeMdxContent(view.state.doc);
    expect(saved.indexOf('Hello')).toBeLessThan(saved.indexOf('mermaid'));
    expect(saved.indexOf('mermaid')).toBeLessThan(saved.indexOf('Goodbye'));
    expect(saved).toContain('graph TD');
  });
});
