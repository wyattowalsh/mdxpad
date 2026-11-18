import type { DocumentId } from '@shared/types/document';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';

import { documentFromMarkdown } from './wysiwyg-document';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { embeddedImageSrc, imageMarkdownForPreview, WysiwygImageView } from './wysiwyg-image';
import { mdxSchema } from './prosemirror-mdx-schema';

describe('wysiwyg image preview', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
    useDocumentStore.getState().reset();
  });

  it('quotes a picture path that contains a space', () => {
    expect(imageMarkdownForPreview('my photo.png')).toBe('![image](<my photo.png>)');
    expect(imageMarkdownForPreview('pixel.png')).toBe('![image](pixel.png)');
  });

  it('reads an embedded picture address', () => {
    const source = '![image](pixel.png)';
    expect(embeddedImageSrc(source, source)).toBeNull();
    expect(embeddedImageSrc(source, '![image](data:image/png;base64,aaaa)')).toBe(
      'data:image/png;base64,aaaa'
    );
  });

  it('shows a local picture and keeps its markdown path', async () => {
    const inline = vi.fn(async () => '![image](data:image/png;base64,aaaa)');
    window.mdxpad = { ...window.mdxpad, inlinePreviewImages: inline };
    useDocumentStore.getState().openDocument(
      {
        fileId: '/docs/note.md' as unknown as DocumentId,
        filePath: '/docs/note.md',
        mtime: 1,
      },
      '![Alt](pixel.png "Sunset")'
    );
    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = new EditorView(container, {
      state: EditorState.create({
        doc: documentFromMarkdown('![Alt](pixel.png "Sunset")\n'),
        schema: mdxSchema,
      }),
      nodeViews: {
        image: (node) => new WysiwygImageView(node),
      },
    });
    views.push(view);

    await vi.waitFor(() => {
      expect(view.dom.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,aaaa');
    });
    expect(inline).toHaveBeenCalledWith('![image](pixel.png)', '/docs/note.md');
    expect(view.dom.querySelector('img')?.getAttribute('alt')).toBe('Alt');
    expect(view.dom.querySelector('img')?.style.maxWidth).toBe('100%');
    expect(serializeMdxContent(view.state.doc)).toContain('![Alt](pixel.png "Sunset")');
    expect(serializeMdxContent(view.state.doc)).not.toContain('data:image');
  });

  it('keeps a picture unloaded when another file is open', async () => {
    let finish: ((value: string) => void) | undefined;
    window.mdxpad = {
      ...window.mdxpad,
      inlinePreviewImages: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    };
    useDocumentStore.getState().openDocument(
      {
        fileId: '/docs/note.md' as unknown as DocumentId,
        filePath: '/docs/note.md',
        mtime: 1,
      },
      '![Alt](pixel.png)'
    );
    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = new EditorView(container, {
      state: EditorState.create({
        doc: documentFromMarkdown('![Alt](pixel.png)\n'),
        schema: mdxSchema,
      }),
      nodeViews: {
        image: (node) => new WysiwygImageView(node),
      },
    });
    views.push(view);
    const image = view.dom.querySelector('img');
    expect(image).toBeTruthy();
    expect(finish).toBeTypeOf('function');

    useDocumentStore.setState({ filePath: '/other/note.md' });
    finish?.('![image](data:image/png;base64,aaaa)');
    await Promise.resolve();

    expect(image?.getAttribute('src')).toBe('');
  });
});
