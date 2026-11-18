/**
 * Apply an AI revision to the open document or to another file that is already open in a tab.
 */

import type { FileError } from '@shared/types/file';
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

function fileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

function openBeforeAccept(path: string): string {
  return `Open ${fileName(path)} before accepting this edit.`;
}

function writeFailure(path: string, error: FileError): string {
  switch (error.code) {
    case 'PERMISSION_DENIED':
    case 'NOT_FOUND':
      return openBeforeAccept(path);
    case 'CANCELLED':
      return 'Saving the edit was cancelled.';
    case 'UNKNOWN':
      return error.message;
    default: {
      const unexpected: never = error;
      return unexpected;
    }
  }
}

/** Apply an edit in the editor, or write a closed file the user can already save. */
export async function acceptDocumentEdit(path: string, modified: string): Promise<string | null> {
  if (applyOpenDocumentEdit(path, modified)) {
    return null;
  }
  if (!('mdxpad' in window) || typeof window.mdxpad.writeFile !== 'function') {
    return openBeforeAccept(path);
  }
  const result = await window.mdxpad.writeFile(path, modified);
  return result.ok ? null : writeFailure(path, result.error);
}
