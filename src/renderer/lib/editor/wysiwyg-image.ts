import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { NodeView } from 'prosemirror-view';

import { useDocumentStore } from '@renderer/stores/document-store';

const REMOTE_IMAGE = /^(?:https?:|data:|mailto:)/i;

interface ImageAttrs {
  readonly src: string;
  readonly alt: string | null;
  readonly title: string | null;
}

function imageAttrs(node: ProseMirrorNode): ImageAttrs {
  const attrs = node.attrs as Partial<ImageAttrs>;
  return {
    src: attrs.src ?? '',
    alt: attrs.alt ?? null,
    title: attrs.title ?? null,
  };
}

/** Markdown that asks preview embedding for one local picture. */
export function imageMarkdownForPreview(src: string): string {
  const destination = /[\s()]/.test(src) ? `<${src.replaceAll('>', '%3E')}>` : src;
  return `![image](${destination})`;
}

/** The embedded address, when preview replaced the local picture. */
export function embeddedImageSrc(source: string, embedded: string): string | null {
  if (embedded === source) {
    return null;
  }
  return /!\[[^\]]*\]\((data:[^)]+)\)/.exec(embedded)?.[1] ?? null;
}

function paintImage(dom: HTMLImageElement, attrs: ImageAttrs, src: string): void {
  dom.alt = attrs.alt ?? '';
  if (attrs.title) {
    dom.title = attrs.title;
  } else {
    dom.removeAttribute('title');
  }
  dom.dataset.mdxSrc = attrs.src;
  dom.src = src;
}

/** Show a local picture without changing the markdown address stored on the node. */
export class WysiwygImageView implements NodeView {
  readonly dom: HTMLImageElement;
  private node: ProseMirrorNode;
  private request = 0;

  constructor(node: ProseMirrorNode) {
    this.node = node;
    this.dom = document.createElement('img');
    this.dom.className = 'wysiwyg-image';
    this.dom.style.maxWidth = '100%';
    this.dom.style.height = 'auto';
    this.show();
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type.name !== 'image') {
      return false;
    }
    this.node = node;
    this.show();
    return true;
  }

  private show(): void {
    const attrs = imageAttrs(this.node);
    const request = ++this.request;
    if (!this.needsLocalFile(attrs.src)) {
      paintImage(this.dom, attrs, attrs.src);
      return;
    }
    paintImage(this.dom, attrs, '');
    const inline = window.mdxpad.inlinePreviewImages;
    const filePath = useDocumentStore.getState().filePath;
    if (inline === undefined || filePath === null) {
      paintImage(this.dom, attrs, attrs.src);
      return;
    }
    const markdown = imageMarkdownForPreview(attrs.src);
    void inline(markdown, filePath)
      .then((next) => {
        if (request === this.request) {
          paintImage(this.dom, attrs, embeddedImageSrc(markdown, next) ?? attrs.src);
        }
      })
      .catch(() => {
        if (request === this.request) {
          paintImage(this.dom, attrs, attrs.src);
        }
      });
  }

  private needsLocalFile(src: string): boolean {
    return src.length > 0 && !REMOTE_IMAGE.test(src) && !src.startsWith('//');
  }
}
