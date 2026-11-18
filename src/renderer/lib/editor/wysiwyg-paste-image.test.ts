import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { mdxSchema } from './prosemirror-mdx-schema';
import { insertPastedImage } from './wysiwyg-paste-image';

const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function open(): EditorView {
  const doc = parseMdxContent('Hello\n');
  if (!doc) {
    throw new Error('markdown did not parse');
  }
  const host = document.createElement('div');
  return new EditorView(host, {
    state: EditorState.create({ doc, schema: mdxSchema }),
  });
}

describe('pasted pictures', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('puts a picture after a code block and keeps the code inside', async () => {
    const doc = parseMdxContent('```\ncode\n```\n');
    if (!doc) {
      throw new Error('markdown did not parse');
    }
    const host = document.createElement('div');
    const view = new EditorView(host, {
      state: EditorState.create({ doc, schema: mdxSchema }),
    });
    views.push(view);
    const bytes = Uint8Array.from(atob(PIXEL), (char) => char.charCodeAt(0));
    const file = new File([bytes], 'pixel.png', { type: 'image/png' });
    expect(await insertPastedImage(view, file)).toBe(true);
    const saved = serializeMdxContent(view.state.doc);
    expect(saved).toContain('```\ncode\n```');
    expect(saved.indexOf('```')).toBeLessThan(saved.indexOf('![pixel]'));
  });

  it('inserts a pasted picture at the caret', async () => {
    const view = open();
    views.push(view);
    const bytes = Uint8Array.from(atob(PIXEL), (char) => char.charCodeAt(0));
    const file = new File([bytes], 'pixel.png', { type: 'image/png' });
    expect(await insertPastedImage(view, file)).toBe(true);
    let src = '';
    let alt = '';
    view.state.doc.descendants((node) => {
      if (node.type.name === 'image') {
        src = String(node.attrs.src);
        alt = String(node.attrs.alt);
      }
    });
    expect(src.startsWith('data:image/png')).toBe(true);
    expect(alt).toBe('pixel');
    expect(view.state.doc.textContent).toContain('Hello');
  });
});