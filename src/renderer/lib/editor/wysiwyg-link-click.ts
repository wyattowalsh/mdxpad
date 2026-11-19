/**
 * Clicks on visual-editor links.
 *
 * A plain click stays in the editor. A modifier click opens a document
 * beside the current file, moves to a heading in this document, or opens
 * an http(s) or mailto address. Other schemes, including file: and
 * javascript:, are not followed.
 */

import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { openPreviewDocumentLink } from '@renderer/lib/preview-document-link';
import { allocateHeadingSlug, normalizedHeadingFragment } from '@shared/lib/markdown-heading';

export type VisualLinkAction =
  | { readonly kind: 'document'; readonly href: string }
  | { readonly kind: 'external'; readonly href: string }
  | { readonly kind: 'heading'; readonly slug: string }
  | { readonly kind: 'ignore' };

const EXTERNAL_LINK = /^(?:https?:\/\/|mailto:)/i;
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function classifyVisualLink(href: string): VisualLinkAction {
  const trimmed = href.trim();
  if (trimmed.length === 0) {
    return { kind: 'ignore' };
  }
  if (trimmed.startsWith('#')) {
    const slug = normalizedHeadingFragment(trimmed);
    return slug ? { kind: 'heading', slug } : { kind: 'ignore' };
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

function focusHeadingSlug(view: EditorView, slug: string): boolean {
  const counts = new Map<string, number>();
  const found: number[] = [];
  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') {
      return true;
    }
    if (found.length === 0 && allocateHeadingSlug(node.textContent, counts) === slug) {
      found.push(pos + 1);
    }
    return false;
  });
  const target = found[0];
  if (target === undefined) {
    return false;
  }
  const selection = TextSelection.near(view.state.doc.resolve(target));
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  view.focus();
  return true;
}

/** Stop the window from navigating, and follow the link on Cmd/Ctrl click. */
export function handleVisualLinkClick(view: EditorView, event: MouseEvent): boolean {
  const href = linkHrefFromTarget(view.dom, event.target);
  if (!href) {
    return false;
  }
  event.preventDefault();
  if (event.metaKey || event.ctrlKey) {
    const action = classifyVisualLink(href);
    if (action.kind === 'heading') {
      focusHeadingSlug(view, action.slug);
      return true;
    }
    followVisualLink(href, {
      document: openPreviewDocumentLink,
      external: openExternal,
    });
    return true;
  }
  return false;
}
