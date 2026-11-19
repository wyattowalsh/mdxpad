import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { openPreviewDocumentLink } from '@renderer/lib/preview-document-link';

import { mdxSchema } from './prosemirror-mdx-schema';
import { documentFromMarkdown } from './wysiwyg-document';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { classifyVisualLink, handleVisualLinkClick } from './wysiwyg-link-click';

vi.mock('@renderer/lib/preview-document-link', () => ({
  openPreviewDocumentLink: vi.fn(),
}));

function open(source: string): EditorView {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return new EditorView(host, {
    state: EditorState.create({
      doc: documentFromMarkdown(source),
      schema: mdxSchema,
    }),
  });
}

function click(
  view: EditorView,
  anchor: Element | null,
  modifiers: { meta?: boolean; ctrl?: boolean } = {}
): MouseEvent {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    metaKey: modifiers.meta === true,
    ctrlKey: modifiers.ctrl === true,
  });
  anchor?.dispatchEvent(event);
  handleVisualLinkClick(view, event);
  return event;
}

describe('visual link clicks', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    vi.mocked(openPreviewDocumentLink).mockClear();
    for (const view of views.splice(0)) {
      view.dom.parentElement?.remove();
      view.destroy();
    }
  });

  it('classifies document, web, and unsafe links', () => {
    expect(classifyVisualLink('./notes/a.md')).toEqual({
      kind: 'document',
      href: './notes/a.md',
    });
    expect(classifyVisualLink('https://ex.test/a')).toEqual({
      kind: 'external',
      href: 'https://ex.test/a',
    });
    expect(classifyVisualLink('mailto:ada@ex.test')).toEqual({
      kind: 'external',
      href: 'mailto:ada@ex.test',
    });
    expect(classifyVisualLink('file:///etc/passwd')).toEqual({ kind: 'ignore' });
    expect(classifyVisualLink('javascript:alert(1)')).toEqual({ kind: 'ignore' });
  });

  it('keeps a plain click in the editor', () => {
    const view = open('[Notes](./notes.md)');
    views.push(view);
    const anchor = view.dom.querySelector('a');
    expect(anchor).toBeInstanceOf(HTMLAnchorElement);
    expect(anchor?.getAttribute('style') ?? '').toContain('underline');
    expect(anchor?.getAttribute('style') ?? '').toContain('pointer');
    const event = click(view, anchor);
    expect(event.defaultPrevented).toBe(true);
    expect(openPreviewDocumentLink).not.toHaveBeenCalled();
  });

  it('opens a document link on a modifier click and ignores a file link', () => {
    const view = open('[Notes](./notes.md)');
    views.push(view);
    const anchor = view.dom.querySelector('a');
    click(view, anchor, { meta: true });
    expect(openPreviewDocumentLink).toHaveBeenCalledWith('./notes.md');

    const fileLink = document.createElement('a');
    fileLink.setAttribute('href', 'file:///etc/passwd');
    fileLink.textContent = 'Disk';
    view.dom.appendChild(fileLink);
    click(view, fileLink, { ctrl: true });
    expect(openPreviewDocumentLink).toHaveBeenCalledTimes(1);
  });

  it('leaves a local file off the link and the image', () => {
    const doc = mdxSchema.node('doc', null, [
      mdxSchema.node('paragraph', null, [
        mdxSchema.text('Disk', [mdxSchema.marks.link.create({ href: 'file:///etc/passwd' })]),
        mdxSchema.node('image', { src: 'file:///etc/passwd', alt: 'pic' }),
      ]),
    ]);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, {
      state: EditorState.create({ doc, schema: mdxSchema }),
    });
    views.push(view);
    expect(view.dom.querySelector('a')?.textContent).toBe('Disk');
    expect(view.dom.querySelector('a')?.getAttribute('href')).toBeNull();
    expect(view.dom.querySelector('img')?.getAttribute('src')).toBeNull();
    expect(serializeMdxContent(view.state.doc)).toContain('file:///etc/passwd');

    const documentLink = open('[Notes](./notes.md) ![pic](./pic.png)');
    views.push(documentLink);
    expect(documentLink.dom.querySelector('a')?.getAttribute('href')).toBe('./notes.md');
    expect(documentLink.dom.querySelector('img')?.getAttribute('src')).toBe('./pic.png');
  });
});
