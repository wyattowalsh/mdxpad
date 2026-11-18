/**
 * Clicks on visual-editor links.
 *
 * A plain click stays in the editor. A modifier click opens a document
 * beside the current file, or an http(s) or mailto address. Other schemes,
 * including file: and javascript:, are not followed.
 */

import type { EditorView } from 'prosemirror-view';

import { openPreviewDocumentLink } from '@renderer/lib/preview-document-link';

export type VisualLinkAction =
  | { readonly kind: 'document'; readonly href: string }
  | { readonly kind: 'external'; readonly href: string }
  | { readonly kind: 'ignore' };

const EXTERNAL_LINK = /^(?:https?:\/\/|mailto:)/i;
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function classifyVisualLink(href: string): VisualLinkAction {
  const trimmed = href.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) {
    return { kind: 'ignore' };
  }
  if (EXTERNAL_LINK.test(trimmed)) {
    return { kind: 'external', href: trimmed };
  }
  if (HAS_SCHEME.test(trimmed)) {
    return { kind: 'ignore' };
  }
  return { kind: 'document', href: trimmed };
}

export function linkHrefFromTarget(root: HTMLElement, target: EventTarget | null): string | null {
  const element =
    target instanceof Element ? target : target instanceof Text ? target.parentElement : null;
  const anchor = element?.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement) || !root.contains(anchor)) {
    return null;
  }
  return anchor.getAttribute('href');
}

export function followVisualLink(
  href: string,
  open: {
    readonly document: (href: string) => void;
    readonly external: (href: string) => void;
  }
): void {
  const action = classifyVisualLink(href);
  if (action.kind === 'document') {
    open.document(action.href);
    return;
  }
  if (action.kind === 'external') {
    open.external(action.href);
  }
}

function openExternal(href: string): void {
  window.open(href, '_blank', 'noopener,noreferrer');
}

/** Stop the window from navigating, and follow the link on Cmd/Ctrl click. */
export function handleVisualLinkClick(view: EditorView, event: MouseEvent): boolean {
  const href = linkHrefFromTarget(view.dom, event.target);
  if (!href) {
    return false;
  }
  event.preventDefault();
  if (event.metaKey || event.ctrlKey) {
    followVisualLink(href, {
      document: openPreviewDocumentLink,
      external: openExternal,
    });
    return true;
  }
  return false;
}
