import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { handleSlashKey, visibleSlashSession, wysiwygSlashPlugin } from './wysiwyg-slash';

function open(source: string): EditorView {
  const doc = parseMdxContent(source);
  if (!doc) {
    throw new Error('markdown did not parse');
  }
  const host = document.createElement('div');
  return new EditorView(host, {
    state: EditorState.create({
      doc,
      schema: mdxSchema,
      plugins: [wysiwygSlashPlugin()],
    }),
  });
}

function typeQuery(view: EditorView, text: string): void {
  const paragraph = view.state.doc.firstChild;
  if (!paragraph) {
    throw new Error('missing paragraph');
  }
  const tr = view.state.tr.insertText(text, 1, 1 + paragraph.content.size);
  const caret = Math.min(1 + text.length, tr.doc.content.size);
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, caret)));
}

describe('visual slash commands', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('inserts a code block from /code', () => {
    const view = open('Hello\n');
    views.push(view);
    typeQuery(view, '/code');
    expect(visibleSlashSession(view.state)?.commands[0]?.name).toBe('code');
    expect(handleSlashKey(view, 'Enter')).toBe(true);
    expect(view.state.selection.$from.parent.type.name).toBe('code_block');
    expect(serializeMdxContent(view.state.doc)).not.toContain('/code');
  });

  it('moves through the menu with the arrow keys', () => {
    const view = open('\n');
    views.push(view);
    typeQuery(view, '/');
    expect(visibleSlashSession(view.state)?.selected).toBe(0);
    expect(handleSlashKey(view, 'ArrowDown')).toBe(true);
    expect(visibleSlashSession(view.state)?.commands[visibleSlashSession(view.state)?.selected ?? 0]?.name).toBe(
      'code'
    );
  });

  it('hides the menu after Escape', () => {
    const view = open('\n');
    views.push(view);
    typeQuery(view, '/code');
    expect(handleSlashKey(view, 'Escape')).toBe(true);
    expect(visibleSlashSession(view.state)).toBeNull();
    expect(serializeMdxContent(view.state.doc)).toContain('/code');
  });
});
