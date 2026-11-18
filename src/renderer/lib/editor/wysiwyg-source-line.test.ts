import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { focusSourceLineInView } from './wysiwyg-source-line';

describe('focusSourceLineInView', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('moves the caret to the paragraph on that source line', () => {
    const doc = parseMdxContent('Hello\n\nGoodbye\n');
    if (!doc) {
      throw new Error('markdown did not parse');
    }
    const host = document.createElement('div');
    const view = new EditorView(host, {
      state: EditorState.create({ doc, schema: mdxSchema }),
    });
    views.push(view);
    const lines = serializeMdxContent(view.state.doc).split('\n');
    const goodbye = lines.findIndex((line) => line.trim() === 'Goodbye') + 1;
    expect(focusSourceLineInView(view, goodbye, 1)).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('Goodbye');
  });

  it('places the caret at the source column on that line', () => {
    const doc = parseMdxContent('Hello\n\nGoodbye\n');
    if (!doc) {
      throw new Error('markdown did not parse');
    }
    const host = document.createElement('div');
    const view = new EditorView(host, {
      state: EditorState.create({ doc, schema: mdxSchema }),
    });
    views.push(view);
    const lines = serializeMdxContent(view.state.doc).split('\n');
    const goodbye = lines.findIndex((line) => line.trim() === 'Goodbye') + 1;
    expect(focusSourceLineInView(view, goodbye, 5)).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('Goodbye');
    expect(view.state.selection.$from.parentOffset).toBe(4);
  });
});
