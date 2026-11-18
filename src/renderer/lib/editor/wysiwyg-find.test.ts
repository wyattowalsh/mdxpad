import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
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

  it('keeps bold when replacing a word inside it', () => {
    const view = open('**Hello world**\n');
    views.push(view);
    expect(replaceNextInView(view, 'world', 'earth')).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('**Hello earth**');
  });

  it('finds words that cross a bold boundary', () => {
    const view = open('Hello **world**\n');
    views.push(view);
    expect(findNextInView(view, 'o w')).toBe(true);
    expect(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to)).toBe(
      'o w'
    );
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
