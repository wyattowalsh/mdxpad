/**
 * Apply an AI revision only when it targets the document that is open.
 */

import { useDocumentStore } from '@renderer/stores/document-store';

export const UNTITLED_EDIT_PATH = 'untitled';
export const MAX_REVISION_CHARS = 6000;

export function openDocumentEditPath(filePath: string | null): string {
  return filePath ?? UNTITLED_EDIT_PATH;
}

export function unwrapDocumentRevision(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:markdown|mdx|md)?\n([\s\S]*?)\n```$/.exec(trimmed);
  return fenced?.[1] ?? trimmed;
}

export function applyOpenDocumentEdit(path: string, modified: string): boolean {
  const state = useDocumentStore.getState();
  if (path !== openDocumentEditPath(state.filePath)) {
    return false;
  }
  state.setContent(modified);
  return true;
}
