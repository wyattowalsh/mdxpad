import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { FootnoteJumpView } from './prosemirror-footnote-ref';
import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';

describe('visual footnote reference', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('moves the caret to the note when the superscript is clicked', () => {
    const doc = parseMdxContent('A footnote[^1].\n\n[^1]: The note\n');
    if (!doc) {
      throw new Error('footnote markdown did not parse');
    }
    const host = document.createElement('div');
    const view = new EditorView(host, {
      state: EditorState.create({ doc, schema: mdxSchema }),
      nodeViews: {
        footnote_ref: (node, editor) => new FootnoteJumpView(node, editor, 'footnote_label'),
        footnote_label: (node, editor) => new FootnoteJumpView(node, editor, 'footnote_ref'),
      },
    });
    views.push(view);
    host
      .querySelector('sup.footnote-ref')
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(view.state.selection.$from.parent.textContent).toContain('The note');
  });

  it('shows a defined marker as a superscript and saves the marker', () => {
    const doc = parseMdxContent('A footnote[^1].\n\n[^1]: The note\n');
    if (!doc) {
      throw new Error('footnote markdown did not parse');
    }
    const ref = doc.firstChild?.child(1);
    expect(ref?.type.name).toBe('footnote_ref');
    expect(ref?.attrs.id).toBe('1');
    const saved = serializeMdxContent(doc);
    expect(saved).toContain('A footnote[^1].');
    expect(saved).toContain('[^1]: The note');
    expect(saved).not.toContain('\\[');
    const note = doc.child(1);
    expect(note.firstChild?.type.name).toBe('footnote_label');
    expect(note.textContent).toBe('The note');
  });

  it('keeps two notes on their own lines and leaves code and missing markers', () => {
    const adjacentDoc = parseMdxContent('See [^a] and [^b].\n\n[^a]: One\n[^b]: Two\n');
    if (!adjacentDoc) {
      throw new Error('footnote markdown did not parse');
    }
    const adjacent = serializeMdxContent(adjacentDoc);
    expect(adjacent).toContain('[^a]: One');
    expect(adjacent).toContain('[^b]: Two');
    expect(adjacent).not.toContain('    [^b]:');
    const coded = parseMdxContent('See `[^1]` and [^missing].\n\n[^1]: Note\n');
    expect(coded?.textContent).toContain('[^1]');
    expect(coded?.textContent).toContain('[^missing]');
  });
});
