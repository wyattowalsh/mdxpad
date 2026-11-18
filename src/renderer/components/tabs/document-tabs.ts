/**
 * Keep the open document and the tab bar on the same file.
 */

import type { DocumentId } from '@shared/types/document';
import { checkDirtyState } from '@renderer/commands/file-commands';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore, type Tab } from '@renderer/stores/tab-store';

let applyingTab = false;

function tabSnapshot(): Omit<Tab, 'id'> {
  const document = useDocumentStore.getState();
  return {
    filePath: document.filePath,
    fileName: document.fileName,
    isDirty: document.isDirty,
    content: document.content,
    savedContent: document.savedContent,
  };
}

function activeTab(): Tab | null {
  const store = useTabStore.getState();
  return store.tabs.find((tab) => tab.id === store.activeTabId) ?? null;
}

function showTab(tab: Tab): void {
  applyingTab = true;
  try {
    useDocumentStore.setState({
      fileId: tab.filePath === null ? null : (tab.filePath as unknown as DocumentId),
      filePath: tab.filePath,
      fileName: tab.fileName,
      content: tab.content,
      savedContent: tab.savedContent,
      isDirty: tab.content !== tab.savedContent,
      lastKnownMtime: null,
      externalChangeDetected: false,
      externalContent: null,
      externalMtime: null,
    });
  } finally {
    applyingTab = false;
  }
}

function claimEmptyUntitled(current: Tab): boolean {
  const document = useDocumentStore.getState();
  if (current.filePath !== null || document.filePath === null) {
    return false;
  }
  if (current.isDirty || current.content.length > 0) {
    return false;
  }
  useTabStore.getState().updateTab(current.id, tabSnapshot());
  return true;
}

function adoptOpenFile(filePath: string): boolean {
  const existing = useTabStore.getState().tabs.find((tab) => tab.filePath === filePath);
  if (!existing) {
    return false;
  }
  if (existing.isDirty) {
    useTabStore.getState().setActiveTab(existing.id);
    showTab(existing);
    return true;
  }
  useTabStore.getState().updateTab(existing.id, tabSnapshot());
  useTabStore.getState().setActiveTab(existing.id);
  return true;
}

/** Mirror the open document into the active tab, or open a tab for it. */
export function syncDocumentTab(): void {
  if (applyingTab) {
    return;
  }
  const document = useDocumentStore.getState();
  const current = activeTab();
  if (current?.filePath === document.filePath) {
    useTabStore.getState().updateTab(current.id, tabSnapshot());
    return;
  }
  if (current && claimEmptyUntitled(current)) {
    return;
  }
  if (document.filePath !== null && adoptOpenFile(document.filePath)) {
    return;
  }
  useTabStore.getState().addTab(tabSnapshot());
}

/** Save the current document into its tab, then show the selected tab. */
export function activateDocumentTab(id: string): void {
  const store = useTabStore.getState();
  if (store.activeTabId === id) {
    return;
  }
  const target = store.tabs.find((tab) => tab.id === id);
  if (!target) {
    return;
  }
  const current = activeTab();
  const document = useDocumentStore.getState();
  if (current?.filePath === document.filePath) {
    store.updateTab(current.id, tabSnapshot());
  }
  useTabStore.getState().setActiveTab(id);
  showTab(target);
}

/** Close one tab. A dirty tab stays open when the confirmation is declined. */
export function closeDocumentTab(id: string): void {
  const store = useTabStore.getState();
  const tab = store.tabs.find((item) => item.id === id);
  if (!tab) {
    return;
  }
  if (tab.isDirty && !checkDirtyState()) {
    return;
  }
  const wasActive = store.activeTabId === id;
  store.removeTab(id);
  if (!wasActive) {
    return;
  }
  const next = activeTab();
  if (next) {
    showTab(next);
    return;
  }
  applyingTab = true;
  try {
    useDocumentStore.getState().newDocument();
  } finally {
    applyingTab = false;
  }
  syncDocumentTab();
}

function closeTabs(ids: readonly string[]): void {
  if (ids.length === 0) {
    return;
  }
  const dirty = useTabStore.getState().tabs.some((tab) => ids.includes(tab.id) && tab.isDirty);
  if (dirty && !checkDirtyState()) {
    return;
  }
  for (const id of ids) {
    useTabStore.getState().removeTab(id);
  }
  const next = activeTab();
  if (next) {
    showTab(next);
  }
}

/** Close every tab except one, after confirming when a closed tab is dirty. */
export function closeOtherDocumentTabs(id: string): void {
  const ids = useTabStore
    .getState()
    .tabs.filter((tab) => tab.id !== id)
    .map((tab) => tab.id);
  const before = useTabStore.getState().tabs.length;
  closeTabs(ids);
  if (useTabStore.getState().tabs.length === before) {
    return;
  }
  useTabStore.getState().setActiveTab(id);
  const next = activeTab();
  if (next) {
    showTab(next);
  }
}

/** Close tabs to the right, after confirming when one of them is dirty. */
export function closeDocumentTabsToRight(id: string): void {
  const tabs = useTabStore.getState().tabs;
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index === -1) {
    return;
  }
  closeTabs(tabs.slice(index + 1).map((tab) => tab.id));
}

/** Follow document changes for the life of the shell. */
export function subscribeDocumentTabs(): () => void {
  syncDocumentTab();
  return useDocumentStore.subscribe(() => {
    syncDocumentTab();
  });
}
