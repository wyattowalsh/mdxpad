import { keymap } from 'prosemirror-keymap';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { moveTableCell, wysiwygTableKeymap } from './wysiwyg-table-nav';

const TABLE = '| A | B |\n| --- | --- |\n| 1 | 2 |\n';

function open(source: string): EditorView {
  const doc = parseMdxContent(source);
  if (!doc) {
    throw new Error('markdown did not parse');
  }
  const host = document.createElement('div');
  return new EditorView(host, {
    state: EditorState.create({
      doc,
      schema: mdxSchema,
      plugins: [wysiwygTableKeymap(), keymap({ Tab: () => false })],
    }),
  });
}

describe('visual table navigation', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('moves across a row and into the next row', () => {
    const view = open(TABLE);
    views.push(view);
    expect(view.state.selection.$from.parent.textContent).toBe('A');
    expect(moveTableCell(view.state, view.dispatch, 1)).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('B');
    expect(moveTableCell(view.state, view.dispatch, 1)).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('1');
    expect(moveTableCell(view.state, view.dispatch, -1)).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('B');
  });

  it('adds a row from the last cell', () => {
    const view = open(TABLE);
    views.push(view);
    moveTableCell(view.state, view.dispatch, 1);
    moveTableCell(view.state, view.dispatch, 1);
    moveTableCell(view.state, view.dispatch, 1);
    expect(moveTableCell(view.state, view.dispatch, 1)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('|  |  |');
    expect(view.state.selection.$from.parent.textContent).toBe('');
  });

  it('leaves a paragraph alone', () => {
    const view = open('Hello\n');
    views.push(view);
    expect(moveTableCell(view.state, view.dispatch, 1)).toBe(false);
    expect(serializeMdxContent(view.state.doc)).toContain('Hello');
  });
});
