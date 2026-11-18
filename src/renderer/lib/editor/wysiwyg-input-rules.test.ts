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

  it('turns single asterisks into italic text', () => {
    const view = open();
    views.push(view);
    type(view, '*Hello*');
    expect(view.state.doc.textContent).toBe('Hello');
    expect(serializeMdxContent(view.state.doc)).toContain('*Hello*');
  });

  it('turns a quote marker into a blockquote', () => {
    const view = open();
    views.push(view);
    type(view, '> ');
    expect(view.state.doc.firstChild?.type.name).toBe('blockquote');
  });

  it('turns underscores into italic text', () => {
    const view = open();
    views.push(view);
    type(view, '_Hello_');
    expect(view.state.doc.textContent).toBe('Hello');
    const marks = view.state.doc.firstChild?.firstChild?.marks.map((mark) => mark.type.name) ?? [];
    expect(marks).toContain('italic');
  });

  it('turns a markdown link into a link', () => {
    const view = open();
    views.push(view);
    type(view, '[hi](https://ex.test)');
    expect(view.state.doc.textContent).toBe('hi');
    const mark = view.state.doc.firstChild?.firstChild?.marks.find((item) => item.type.name === 'link');
    expect(mark?.attrs.href).toBe('https://ex.test');
  });

  it('turns a markdown image into an image', () => {
    const view = open();
    views.push(view);
    type(view, '![cat](https://ex.test/cat.png)');
    expect(view.state.doc.firstChild?.firstChild?.type.name).toBe('image');
    expect(view.state.doc.firstChild?.firstChild?.attrs.src).toBe('https://ex.test/cat.png');
  });

  it('turns a task marker into a checkbox', () => {
    const view = open();
    views.push(view);
    type(view, '- [ ] ');
    expect(view.state.doc.firstChild?.firstChild?.attrs.task).toBe('open');
    expect(view.state.doc.textContent).not.toContain('[');
    expect(serializeMdxContent(view.state.doc)).toContain('[ ]');
  });

  it('turns a checked task marker into a finished checkbox', () => {
    const view = open();
    views.push(view);
    type(view, '- [x] ');
    expect(view.state.doc.firstChild?.firstChild?.attrs.task).toBe('done');
    expect(serializeMdxContent(view.state.doc)).toContain('[x]');
  });

  it('turns a typed web address into a link', () => {
    const view = open();
    views.push(view);
    type(view, 'https://ex.test ');
    const address = view.state.doc.firstChild?.firstChild;
    expect(address?.text).toBe('https://ex.test');
    expect(address?.marks[0]?.attrs.href).toBe('https://ex.test');
    expect(view.state.doc.textContent.endsWith(' ')).toBe(true);
  });

  it('keeps a period after a typed web address', () => {
    const view = open();
    views.push(view);
    type(view, 'https://ex.test. ');
    const parts: string[] = [];
    view.state.doc.descendants((node) => {
      if (node.isText && node.text) {
        parts.push(node.text);
      }
    });
    expect(parts[0]).toBe('https://ex.test');
    expect(view.state.doc.firstChild?.firstChild?.marks[0]?.attrs.href).toBe('https://ex.test');
    expect(parts.join('')).toBe('https://ex.test. ');
  });

  it('turns a typed email address into a link', () => {
    const view = open();
    views.push(view);
    type(view, 'ada@ex.test ');
    const address = view.state.doc.firstChild?.firstChild;
    expect(address?.text).toBe('ada@ex.test');
    expect(address?.marks[0]?.attrs.href).toBe('mailto:ada@ex.test');
  });

  it('turns a dash and a space into a bullet list', () => {
    const view = open();
    views.push(view);
    type(view, '- ');
    expect(view.state.doc.firstChild?.type.name).toBe('bullet_list');
  });
});