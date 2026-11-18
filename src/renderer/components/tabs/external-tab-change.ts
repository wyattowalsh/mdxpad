/**
 * Disk changes for a file that is open in a tab other than the one on screen.
 */

import { useTabStore } from '@renderer/stores/tab-store';

interface PendingExternalChange {
  readonly kind: 'change' | 'unlink';
  readonly content: string;
  readonly mtime: number;
}

const pending = new Map<string, PendingExternalChange>();

export function resetPendingExternalChanges(): void {
  pending.clear();
}

export function hasPendingExternalChange(filePath: string): boolean {
  return pending.has(filePath);
}

export function clearPendingExternalChange(filePath: string): void {
  pending.delete(filePath);
}

export function externalChangeFields(filePath: string | null): {
  readonly externalChangeDetected: boolean;
  readonly externalContent: string | null;
  readonly externalMtime: number | null;
} {
  const change = filePath === null ? undefined : pending.get(filePath);
  if (change?.kind !== 'change') {
    return { externalChangeDetected: false, externalContent: null, externalMtime: null };
  }
  return {
    externalChangeDetected: true,
    externalContent: change.content,
    externalMtime: change.mtime,
  };
}

/** Record a disk edit for a background tab. Returns false when no such tab is open. */
export function noteInactiveExternalChange(
  filePath: string,
  content: string,
  mtime: number
): boolean {
  const store = useTabStore.getState();
  const active = store.tabs.find((tab) => tab.id === store.activeTabId);
  if (active?.filePath === filePath) {
    return false;
  }
  const tab = store.tabs.find((item) => item.filePath === filePath);
  if (!tab) {
    return false;
  }
  if (content === tab.content) {
    pending.delete(filePath);
    if (tab.isDirty) {
      store.updateTab(tab.id, { savedContent: content, isDirty: false });
    }
    return true;
  }
  if (!tab.isDirty) {
    pending.delete(filePath);
    store.updateTab(tab.id, { content, savedContent: content, isDirty: false });
    return true;
  }
  pending.set(filePath, { kind: 'change', content, mtime });
  return true;
}

export function fileIsMissing(filePath: string | null): boolean {
  return filePath !== null && pending.get(filePath)?.kind === 'unlink';
}

/** Remember that an open file was deleted. `openInEditor` covers a document with no tab yet. */
export function noteFileRemoved(filePath: string, openInEditor: boolean): boolean {
  const hasTab = useTabStore.getState().tabs.some((tab) => tab.filePath === filePath);
  if (!hasTab && !openInEditor) {
    return false;
  }
  pending.set(filePath, { kind: 'unlink', content: '', mtime: Date.now() });
  return true;
}
