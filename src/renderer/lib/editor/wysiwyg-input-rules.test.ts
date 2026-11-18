import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { wysiwygInputRules } from './wysiwyg-input-rules';

function open(): EditorView {
  const doc = parseMdxContent('\n');
  if (!doc) {
    throw new Error('markdown did not parse');
  }
  const host = document.createElement('div');
  return new EditorView(host, {
    state: EditorState.create({
      doc,
      schema: mdxSchema,
      plugins: [wysiwygInputRules()],
    }),
  });
}

function type(view: EditorView, text: string): void {
  for (const char of text) {
    const from = view.state.selection.from;
    const handled = view.someProp('handleTextInput', (handler) =>
      handler(view, from, from, char, () => view.state.tr)
    );
    if (handled !== true) {
      view.dispatch(view.state.tr.insertText(char));
    }
  }
}

describe('visual markdown shortcuts', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('turns paired asterisks into bold text', () => {
    const view = open();
    views.push(view);
    type(view, '**Hello**');
    expect(view.state.doc.textContent).toBe('Hello');
    expect(serializeMdxContent(view.state.doc)).toContain('**Hello**');
  });

  it('turns a hash and a space into a heading', () => {
    const view = open();
    views.push(view);
    type(view, '# ');
    expect(view.state.doc.firstChild?.type.name).toBe('heading');
    expect(view.state.doc.firstChild?.attrs.level).toBe(1);
  });

  it('turns a dash and a space into a bullet list', () => {
    const view = open();
    views.push(view);
    type(view, '- ');
    expect(view.state.doc.firstChild?.type.name).toBe('bullet_list');
  });
});