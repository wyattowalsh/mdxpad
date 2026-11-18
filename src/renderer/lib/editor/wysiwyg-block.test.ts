import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { toggleBlockquote, toggleHeading } from './wysiwyg-block';

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

describe('visual block toggles', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('turns a heading back into a paragraph', () => {
    const view = open('Hello\n');
    views.push(view);
    expect(toggleHeading(view, 1)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('# Hello');
    expect(toggleHeading(view, 1)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).not.toContain('# Hello');
  });

  it('lifts a quote back into a paragraph', () => {
    const view = open('Hello\n');
    views.push(view);
    expect(toggleBlockquote(view)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('> Hello');
    expect(toggleBlockquote(view)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).not.toContain('> Hello');
  });
});