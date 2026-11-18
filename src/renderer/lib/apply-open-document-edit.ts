/**
 * Apply an AI revision to the open document or to another file that is already open in a tab.
 */

import type { FileError } from '@shared/types/file';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';
import { liveSourceText } from '@renderer/components/tabs/live-source-text';

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

function openTab(path: string) {
  const tabs = useTabStore.getState();
  return tabs.tabs.find((item) => item.id !== tabs.activeTabId && item.filePath === path);
}

function currentText(path: string): string | null {
  const state = useDocumentStore.getState();
  if (path === openDocumentEditPath(state.filePath)) {
    return liveSourceText() ?? state.content;
  }
  return openTab(path)?.content ?? null;
}

export function applyOpenDocumentEdit(path: string, modified: string, original?: string): boolean {
  const state = useDocumentStore.getState();
  if (path === openDocumentEditPath(state.filePath)) {
    const current = liveSourceText() ?? state.content;
    if (original !== undefined && current !== original) {
      return false;
    }
    state.setContent(modified);
    return true;
  }
  const tab = openTab(path);
  if (!tab || (original !== undefined && tab.content !== original)) {
    return false;
  }
  useTabStore.getState().updateTab(tab.id, {
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
export async function acceptDocumentEdit(
  path: string,
  modified: string,
  original?: string
): Promise<string | null> {
  if (original !== undefined && currentText(path) !== null && currentText(path) !== original) {
    return 'This file changed before the edit was accepted.';
  }
  if (applyOpenDocumentEdit(path, modified, original)) {
    return null;
  }
  if (!('mdxpad' in window) || typeof window.mdxpad.writeFile !== 'function') {
    return openBeforeAccept(path);
  }
  const result = await window.mdxpad.writeFile(path, modified);
  return result.ok ? null : writeFailure(path, result.error);
}
