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
});