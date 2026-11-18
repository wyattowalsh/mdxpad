import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { pastePlainText } from './wysiwyg-paste';

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

function caretAt(view: EditorView, target: string): void {
  let pos = 0;
  view.state.doc.descendants((node, start) => {
    if (node.isText && node.text?.includes(target)) {
      pos = start + node.text.indexOf(target) + target.length;
    }
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}

describe('visual paste', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('pastes emphasis into the current sentence', () => {
    const view = open('Say there\n');
    views.push(view);
    caretAt(view, 'Say');
    expect(pastePlainText(view, '**Hello**', '')).toBe(true);
    const saved = serializeMdxContent(view.state.doc);
    expect(saved).toContain('**Hello**');
    expect(saved).toContain('Say');
    expect(saved).toContain('there');
  });

  it('pastes a code block after the current sentence', () => {
    const view = open('Hello\n');
    views.push(view);
    caretAt(view, 'He');
    expect(pastePlainText(view, '```\ncode\n```\n', '')).toBe(true);
    const saved = serializeMdxContent(view.state.doc);
    expect(saved).toContain('Hello');
    expect(saved.indexOf('Hello')).toBeLessThan(saved.indexOf('```'));
  });

  it('pastes a list as list items', () => {
    const view = open('Intro\n');
    views.push(view);
    expect(pastePlainText(view, '- one\n- two\n', '')).toBe(true);
    const saved = serializeMdxContent(view.state.doc);
    expect(saved).toContain('- one');
    expect(saved).toContain('- two');
    expect(saved).toContain('Intro');
  });

  it('leaves rich HTML for the normal paste path', () => {
    const view = open('Intro\n');
    views.push(view);
    expect(pastePlainText(view, '**Hello**', '<p><strong>Hello</strong></p>')).toBe(false);
    expect(serializeMdxContent(view.state.doc)).not.toContain('**Hello**');
  });
});