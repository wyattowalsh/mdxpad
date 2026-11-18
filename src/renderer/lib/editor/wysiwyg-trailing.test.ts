import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { appendTrailingParagraph, prependLeadingParagraph } from './wysiwyg-trailing';

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

function caretAtEnd(view: EditorView, target: string): void {
  let end = 0;
  view.state.doc.descendants((node, pos) => {
    if (node.isText && node.text === target) {
      end = pos + node.text.length;
    }
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
}

describe('trailing visual blocks', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('adds a paragraph after a final code block', () => {
    const view = open('```\ncode\n```\n');
    views.push(view);
    caretAtEnd(view, 'code');
    expect(appendTrailingParagraph(view.state, view.dispatch)).toBe(true);
    expect(view.state.selection.$from.parent.type.name).toBe('paragraph');
    expect(view.state.doc.lastChild?.type.name).toBe('paragraph');
    expect(view.state.doc.firstChild?.type.name).toBe('code_block');
  });

  it('adds a paragraph before a leading code block', () => {
    const view = open('```\ncode\n```\n');
    views.push(view);
    let start = 0;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'code') {
        start = pos;
      }
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start)));
    expect(prependLeadingParagraph(view.state, view.dispatch)).toBe(true);
    expect(view.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(view.state.doc.child(1).type.name).toBe('code_block');
  });

  it('adds a paragraph after a final quote and before a leading quote', () => {
    const view = open('> Quoted\n');
    views.push(view);
    caretAtEnd(view, 'Quoted');
    expect(appendTrailingParagraph(view.state, view.dispatch)).toBe(true);
    expect(view.state.doc.firstChild?.type.name).toBe('blockquote');
    expect(view.state.doc.lastChild?.type.name).toBe('paragraph');

    const leading = open('> Quoted\n');
    views.push(leading);
    let start = 0;
    leading.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Quoted') {
        start = pos;
      }
    });
    leading.dispatch(leading.state.tr.setSelection(TextSelection.create(leading.state.doc, start)));
    expect(prependLeadingParagraph(leading.state, leading.dispatch)).toBe(true);
    expect(leading.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(leading.state.doc.child(1).type.name).toBe('blockquote');
  });

  it('adds a paragraph after a final list and before a leading list', () => {
    const view = open('- Hello\n');
    views.push(view);
    caretAtEnd(view, 'Hello');
    expect(appendTrailingParagraph(view.state, view.dispatch)).toBe(true);
    expect(view.state.doc.firstChild?.type.name).toBe('bullet_list');
    expect(view.state.doc.lastChild?.type.name).toBe('paragraph');

    const leading = open('1. Hello\n');
    views.push(leading);
    let start = 0;
    leading.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Hello') {
        start = pos;
      }
    });
    leading.dispatch(leading.state.tr.setSelection(TextSelection.create(leading.state.doc, start)));
    expect(prependLeadingParagraph(leading.state, leading.dispatch)).toBe(true);
    expect(leading.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(leading.state.doc.child(1).type.name).toBe('ordered_list');
  });

  it('leaves the middle of a list inside the list', () => {
    const view = open('- One\n- Two\n');
    views.push(view);
    caretAtEnd(view, 'One');
    expect(appendTrailingParagraph(view.state, view.dispatch)).toBe(false);
    expect(view.state.doc.childCount).toBe(1);
  });

  it('leaves a quote alone when a paragraph already follows it', () => {
    const view = open('> Quoted\n\nAfter\n');
    views.push(view);
    caretAtEnd(view, 'Quoted');
    expect(appendTrailingParagraph(view.state, view.dispatch)).toBe(false);
    expect(view.state.doc.childCount).toBe(2);
  });

  it('leaves the cursor inside a code block that is not at the end', () => {
    const view = open('```\ncode\n```\n\nAfter\n');
    views.push(view);
    caretAtEnd(view, 'code');
    expect(appendTrailingParagraph(view.state, view.dispatch)).toBe(false);
    expect(view.state.doc.childCount).toBe(2);
  });
});
