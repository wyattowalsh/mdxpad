import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { findNextInView, replaceNextInView } from './wysiwyg-find';

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

describe('visual find', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('selects each later occurrence and then wraps', () => {
    const view = open('one two one\n');
    views.push(view);
    expect(findNextInView(view, 'one')).toBe(true);
    expect(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to)).toBe(
      'one'
    );
    const first = view.state.selection.from;
    expect(findNextInView(view, 'one')).toBe(true);
    expect(view.state.selection.from).toBeGreaterThan(first);
    expect(findNextInView(view, 'one')).toBe(true);
    expect(view.state.selection.from).toBe(first);
  });

  it('replaces the next occurrence', () => {
    const view = open('one two one\n');
    views.push(view);
    expect(replaceNextInView(view, 'one', 'ONE')).toBe(true);
    expect(view.state.doc.textContent).toContain('ONE');
    expect(view.state.doc.textContent).toContain('one');
  });
});
