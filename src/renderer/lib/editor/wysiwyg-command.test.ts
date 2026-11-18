import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { applyVisualEdit } from './wysiwyg-command';

function viewWith(source: string): EditorView {
  const doc = parseMdxContent(source);
  if (!doc) {
    throw new Error('markdown did not parse');
  }
  const host = document.createElement('div');
  return new EditorView(host, {
    state: EditorState.create({ doc, schema: mdxSchema }),
  });
}

describe('applyVisualEdit', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('bolds the selected words', () => {
    const view = viewWith('Hello\n');
    views.push(view);
    let from = 0;
    let to = 0;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Hello') {
        from = pos;
        to = pos + node.nodeSize;
      }
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
    expect(applyVisualEdit(view, 'bold')).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('**Hello**');
  });

  it('jumps to the requested source line', () => {
    const view = viewWith('Hello\n\nGoodbye\n');
    views.push(view);
    const goodbye =
      serializeMdxContent(view.state.doc)
        .split('\n')
        .findIndex((line) => line.trim() === 'Goodbye') + 1;
    vi.spyOn(globalThis, 'prompt').mockReturnValue(String(goodbye));
    expect(applyVisualEdit(view, 'goToLine')).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('Goodbye');
    vi.restoreAllMocks();
  });

  it('turns the current paragraph into a heading', () => {
    const view = viewWith('Hello\n');
    views.push(view);
    expect(applyVisualEdit(view, 'heading1')).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('# Hello');
  });
});
