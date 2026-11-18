import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';

import { insertSourceImage, sourceImagePasteExtension } from './source-image-paste';

const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('source picture paste', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
  });

  it('puts a picture after a code fence', async () => {
    const view = new EditorView({
      state: EditorState.create({
        doc: '```\ncode\n```\n',
        extensions: [sourceImagePasteExtension()],
      }),
    });
    views.push(view);
    const inside = view.state.doc.line(2).from;
    view.dispatch({ selection: { anchor: inside } });
    const bytes = Uint8Array.from(atob(PIXEL), (char) => char.charCodeAt(0));
    const file = new File([bytes], 'pixel.png', { type: 'image/png' });
    expect(await insertSourceImage(view, file)).toBe(true);
    const saved = view.state.doc.toString();
    expect(saved).toContain('```\ncode\n```');
    expect(saved.indexOf('```')).toBeLessThan(saved.indexOf('![pixel]'));
  });

  it('inserts a pasted picture as Markdown', async () => {
    const view = new EditorView({
      state: EditorState.create({
        doc: 'Hello',
        extensions: [sourceImagePasteExtension()],
      }),
    });
    views.push(view);
    const bytes = Uint8Array.from(atob(PIXEL), (char) => char.charCodeAt(0));
    const file = new File([bytes], 'pixel.png', { type: 'image/png' });
    expect(await insertSourceImage(view, file)).toBe(true);
    expect(view.state.doc.toString().startsWith('![pixel](data:image/png')).toBe(true);
    expect(view.state.doc.toString()).toContain('Hello');
  });

  it('does not insert a picture after the editor is closed', async () => {
    const view = new EditorView({
      state: EditorState.create({ doc: 'Hello' }),
    });
    const bytes = Uint8Array.from(atob(PIXEL), (char) => char.charCodeAt(0));
    const file = new File([bytes], 'pixel.png', { type: 'image/png' });
    const pending = insertSourceImage(view, file);
    view.destroy();

    expect(await pending).toBe(false);
  });
});