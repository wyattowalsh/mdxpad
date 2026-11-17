import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { insertSpeechIntoView } from './wysiwyg-speech';

describe('insertSpeechIntoView', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('inserts speech at the visual cursor', () => {
    const doc = parseMdxContent('Hello world');
    if (!doc) {
      throw new Error('Could not parse the document');
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = new EditorView(container, {
      state: EditorState.create({ doc, schema: mdxSchema }),
    });
    views.push(view);

    let cursor = 1;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.includes('Hello')) {
        cursor = pos + 'Hello'.length;
        return false;
      }
      return true;
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, cursor)));
    insertSpeechIntoView(view, 'there');
    expect(view.state.doc.textContent).toContain('Hello there');
  });
});
