import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { toggleCommentInView } from './wysiwyg-comment-toggle';

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

describe('visual comment toggle', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('wraps the current block and restores it', () => {
    const view = open('Hello\n');
    views.push(view);
    expect(toggleCommentInView(view)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('{/* Hello */}');
    expect(toggleCommentInView(view)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('Hello');
    expect(serializeMdxContent(view.state.doc)).not.toContain('{/*');
  });
});
