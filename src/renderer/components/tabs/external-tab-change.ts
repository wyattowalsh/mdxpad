/**
 * Disk changes for a file that is open in a tab other than the one on screen.
 */

import { useTabStore } from '@renderer/stores/tab-store';

interface PendingExternalChange {
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
  if (!change) {
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
  pending.set(filePath, { content, mtime });
  return true;
}
