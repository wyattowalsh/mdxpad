import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { focusHeadingInView } from './wysiwyg-outline';

describe('focusHeadingInView', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('moves the caret to the second heading with the same name', () => {
    const doc = parseMdxContent('# Intro\n\nBody\n\n## Intro\n\nMore\n');
    if (!doc) {
      throw new Error('markdown did not parse');
    }
    const host = document.createElement('div');
    const view = new EditorView(host, {
      state: EditorState.create({ doc, schema: mdxSchema }),
    });
    views.push(view);
    expect(focusHeadingInView(view, 2, 'Intro', 0)).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('Intro');
    expect(view.state.selection.$from.parent.attrs.level).toBe(2);
  });
});
