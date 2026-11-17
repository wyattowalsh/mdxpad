import { keymap } from 'prosemirror-keymap';
import { history, undo } from 'prosemirror-history';
import { EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';

import { parseMdxContent } from '../../lib/editor/prosemirror-mdx-parser';
import { mdxSchema } from '../../lib/editor/prosemirror-mdx-schema';

describe('WYSIWYG history', () => {
  it('undoes an inserted character', () => {
    const doc = parseMdxContent('Hello');
    if (!doc) {
      throw new Error('Expected a document');
    }
    const state = EditorState.create({
      doc,
      plugins: [history(), keymap({ 'Mod-z': undo })],
    });
    const text = doc.textContent;
    const inserted = state.apply(state.tr.insertText('!', text.length + 1));
    let undone = inserted;
    const didUndo = undo(inserted, (transaction) => {
      undone = inserted.apply(transaction);
    });

    expect(didUndo).toBe(true);
    expect(undone.doc.textContent).toBe('Hello');
    expect(mdxSchema).toBe(undone.schema);
  });
});
