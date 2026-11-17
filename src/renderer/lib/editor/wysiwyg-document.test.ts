import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { afterEach, describe, expect, it } from 'vitest';

import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import {
  documentFromMarkdown,
  insertWysiwygLink,
  replaceWysiwygDocument,
} from './wysiwyg-document';

describe('replaceWysiwygDocument', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  function createView(markdown: string): EditorView {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = new EditorView(container, {
      state: EditorState.create({
        doc: documentFromMarkdown(markdown),
        schema: mdxSchema,
        plugins: [history()],
      }),
    });
    views.push(view);
    return view;
  }

  it('keeps the cursor when outside markdown replaces the document', () => {
    const view = createView('Hello world');
    let cursor = 1;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.includes('Hello')) {
        cursor = pos + 'Hello'.length;
        return false;
      }
      return true;
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, cursor)));

    replaceWysiwygDocument(view, 'Hello world!');

    expect(view.state.selection.from).toBe(cursor);
    expect(view.state.doc.textContent).toContain('Hello world!');
  });

  it('starts a newly opened document at the beginning', () => {
    const view = createView('Hello world');
    let cursor = 1;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.includes('Hello')) {
        cursor = pos + 'Hello'.length;
        return false;
      }
      return true;
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, cursor)));

    replaceWysiwygDocument(view, 'Another file', 'start');

    expect(view.state.selection.from).toBeLessThan(cursor);
    expect(view.state.doc.textContent).toContain('Another file');
  });

  it('replaces frontmatter when outside markdown replaces the document', () => {
    const view = createView('---\ntitle: Old\n---\n\n# Body\n');

    replaceWysiwygDocument(view, '---\ntitle: New\n---\n\n# Changed\n');

    const serialized = serializeMdxContent(view.state.doc);
    expect(serialized).toContain('title: New');
    expect(serialized).not.toContain('title: Old');
    expect(serialized).toContain('# Changed');
  });

  it('inserts a link at an empty caret', () => {
    const view = createView('Hello');
    const start = TextSelection.near(view.state.doc.resolve(0));
    view.dispatch(view.state.tr.setSelection(start));

    insertWysiwygLink(view, 'https://example.com');

    expect(serializeMdxContent(view.state.doc)).toContain(
      '[https://example.com](https://example.com)'
    );
  });
});
