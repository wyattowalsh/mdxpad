import { newlineInCode } from 'prosemirror-commands';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { toggleVisualList, visualListKeymap } from './wysiwyg-list';

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

describe('visual lists', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('wraps the paragraph in a bullet list and lifts it back out', () => {
    const view = open('Hello\n');
    views.push(view);
    expect(toggleVisualList(view, 'bullet')).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('- Hello');
    expect(toggleVisualList(view, 'bullet')).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('Hello');
    expect(serializeMdxContent(view.state.doc)).not.toContain('- Hello');
  });

  it('switches a bullet list to a numbered list', () => {
    const view = open('Hello\n');
    views.push(view);
    toggleVisualList(view, 'bullet');
    expect(toggleVisualList(view, 'ordered')).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('1. Hello');
    expect(serializeMdxContent(view.state.doc)).not.toContain('- Hello');
  });

  it('nests the second item when Tab is pressed', () => {
    const view = open('- one\n- two\n');
    views.push(view);
    let from = 0;
    let to = 0;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'two') {
        from = pos;
        to = pos + node.nodeSize;
      }
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
    expect(visualListKeymap().Tab?.(view.state, view.dispatch)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('  - two');
  });

  it('leaves the list when Enter is pressed in an empty item', () => {
    const view = open('Hello\n');
    views.push(view);
    toggleVisualList(view, 'bullet');
    let end = 0;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Hello') {
        end = pos + node.text.length;
      }
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    const enter = visualListKeymap().Enter;
    expect(enter?.(view.state, view.dispatch)).toBe(true);
    expect(enter?.(view.state, view.dispatch)).toBe(true);
    const saved = serializeMdxContent(view.state.doc);
    expect(saved.match(/^- /gm)?.length).toBe(1);
    expect(saved).toContain('Hello');
  });

  it('joins the next list item on Delete', () => {
    const view = open('- one\n- two\n');
    views.push(view);
    let end = 0;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'one') {
        end = pos + node.text.length;
      }
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    expect(visualListKeymap().Delete?.(view.state, view.dispatch)).toBe(true);
    const saved = serializeMdxContent(view.state.doc);
    expect(saved).toContain('onetwo');
    expect(saved.match(/^- /gm)?.length).toBe(1);
  });

  it('joins a list item with the one above on Backspace', () => {
    const view = open('- one\n- two\n');
    views.push(view);
    let start = 0;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'two') {
        start = pos;
      }
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start)));
    expect(visualListKeymap().Backspace?.(view.state, view.dispatch)).toBe(true);
    const saved = serializeMdxContent(view.state.doc);
    expect(saved).toContain('onetwo');
    expect(saved.match(/^- /gm)?.length).toBe(1);
  });

  it('keeps Enter and Backspace inside a code block in a list', () => {
    const view = open('- item\n\n  ```\n  code\n  ```\n');
    views.push(view);
    let middle = 0;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'code') {
        middle = pos + 2;
      }
    });
    expect(middle).toBeGreaterThan(0);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, middle)));
    const enter = visualListKeymap().Enter;
    expect(enter?.(view.state, view.dispatch, view)).toBe(false);
    expect(newlineInCode(view.state, view.dispatch)).toBe(true);
    const saved = serializeMdxContent(view.state.doc);
    expect(saved).toContain('co\n  de');
    expect(saved.match(/```/g)?.length).toBe(2);

    let codeStart = 0;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.startsWith('co')) {
        codeStart = pos;
      }
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, codeStart)));
    expect(visualListKeymap().Backspace?.(view.state, view.dispatch, view)).toBe(false);
    const afterBackspace = serializeMdxContent(view.state.doc);
    expect(afterBackspace).toContain('co\n  de');
    expect(afterBackspace.match(/```/g)?.length).toBe(2);
    expect(afterBackspace.match(/^- /gm)?.length).toBe(1);
  });

  it('starts a new item when Enter is pressed in a list', () => {
    const view = open('Hello\n');
    views.push(view);
    toggleVisualList(view, 'bullet');
    expect(visualListKeymap().Enter?.(view.state, view.dispatch)).toBe(true);
    expect(serializeMdxContent(view.state.doc)).toContain('- Hello');
    expect(serializeMdxContent(view.state.doc).match(/^- /gm)?.length).toBe(2);
  });
});
