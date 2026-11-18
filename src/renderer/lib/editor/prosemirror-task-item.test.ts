import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { TaskListItemView } from './prosemirror-task-item';

describe('visual task checkbox', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('shows a checkbox and saves a click as done', () => {
    const doc = parseMdxContent('- [ ] todo');
    if (!doc) {
      throw new Error('task markdown did not parse');
    }
    const host = document.createElement('div');
    const view = new EditorView(host, {
      state: EditorState.create({ doc, schema: mdxSchema }),
      nodeViews: {
        list_item: (node, editor, getPos) => new TaskListItemView(node, editor, getPos),
      },
    });
    views.push(view);
    const box = host.querySelector('input');
    expect(box).toBeInstanceOf(HTMLInputElement);
    expect(box?.checked).toBe(false);
    if (!(box instanceof HTMLInputElement)) {
      return;
    }
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(serializeMdxContent(view.state.doc)).toContain('[x] todo');
  });

  it('keeps nested and numbered task markers', () => {
    const nestedDoc = parseMdxContent('- [ ] parent\n  - [x] child');
    const numberedDoc = parseMdxContent('1. [ ] first');
    if (!nestedDoc || !numberedDoc) {
      throw new Error('task markdown did not parse');
    }
    const nested = serializeMdxContent(nestedDoc);
    expect(nested).toContain('[ ] parent');
    expect(nested).toContain('[x] child');
    expect(serializeMdxContent(numberedDoc)).toContain('1. [ ] first');
  });
});
