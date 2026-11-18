/**
 * Apply an AI revision to the open document or to another file that is already open in a tab.
 */

import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

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
  if (path === openDocumentEditPath(state.filePath)) {
    state.setContent(modified);
    return true;
  }
  const tabs = useTabStore.getState();
  const tab = tabs.tabs.find((item) => item.id !== tabs.activeTabId && item.filePath === path);
  if (!tab) {
    return false;
  }
  tabs.updateTab(tab.id, {
    content: modified,
    isDirty: modified !== tab.savedContent,
  });
  return true;
}
