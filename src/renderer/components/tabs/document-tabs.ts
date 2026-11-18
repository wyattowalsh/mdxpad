/**
 * Keep the open document and the tab bar on the same file.
 */

import { checkDirtyState } from '@renderer/commands/dirty-state';
import { documentIdForPath } from '@renderer/lib/document-id';
import { freshUntitledEpochId, useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore, type Tab } from '@renderer/stores/tab-store';
import type { AutosaveTriggerRequest } from '@shared/contracts/autosave-ipc';
import { recoveryDocumentId } from './tab-recovery-id';

let applyingTab = false;

const MAX_CLOSED_TABS = 20;
const closedTabs: Omit<Tab, 'id'>[] = [];
const tabEpoch = new Map<string, number>();

function noteEpoch(id: string): void {
  tabEpoch.set(id, freshUntitledEpochId());
}

/** Remember that this tab belongs to the current untitled generation. */
export function noteTabEpoch(id: string): void {
  noteEpoch(id);
}

function flushTabRecovery(tab: Tab): void {
  if (
    !tab.isDirty ||
    !('mdxpad' in window) ||
    typeof window.mdxpad.autosaveTrigger !== 'function'
  ) {
    return;
  }
  const state = useDocumentStore.getState();
  const sameDocument = state.filePath === tab.filePath && state.content === tab.content;
  const documentId = (
    sameDocument && state.fileId ? state.fileId : recoveryDocumentId(tab.id)
  ) as AutosaveTriggerRequest['documentId'];
  void window.mdxpad
    .autosaveTrigger({
      documentId,
      filePath: tab.filePath,
      fileName: tab.fileName,
      content: tab.content,
    })
    .catch(() => undefined);
}

function addDocumentTab(): string {
  const id = useTabStore.getState().addTab(tabSnapshot());
  noteEpoch(id);
  return id;
}

function keepUntitledAndStartFresh(current: Tab): boolean {
  const document = useDocumentStore.getState();
  if (document.filePath !== null || current.filePath !== null) {
    return false;
  }
  if (tabEpoch.get(current.id) === freshUntitledEpochId()) {
    return false;
  }
  if (current.content.length === 0 && !current.isDirty) {
    return false;
  }
  flushTabRecovery(current);
  addDocumentTab();
  return true;
}

function rememberClosedTab(tab: Tab): void {
  closedTabs.push({
    filePath: tab.filePath,
    fileName: tab.fileName,
    isDirty: tab.isDirty,
    content: tab.content,
    savedContent: tab.savedContent,
  });
  if (closedTabs.length > MAX_CLOSED_TABS) {
    closedTabs.shift();
  }
}

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
      fileId: tab.filePath === null ? null : documentIdForPath(tab.filePath),
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

function claimUntitledTab(current: Tab): boolean {
  const document = useDocumentStore.getState();
  if (current.filePath !== null || document.filePath === null) {
    return false;
  }
  const blank = !current.isDirty && current.content.length === 0;
  const savedInPlace =
    current.content === document.content || current.content === document.savedContent;
  if (!blank && !savedInPlace) {
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

/** Change tabs and the open document without the tab mirror reacting. */
export function whileApplyingTabs(update: () => void): void {
  applyingTab = true;
  try {
    update();
  } finally {
    applyingTab = false;
  }
}

/** Mirror the open document into the active tab, or open a tab for it. */
export function syncDocumentTab(): void {
  if (applyingTab) {
    return;
  }
  const document = useDocumentStore.getState();
  const recoveredId = document.filePath
    ? documentIdForPath(document.filePath, document.fileId)
    : null;
  if (recoveredId && document.fileId !== recoveredId) {
    applyingTab = true;
    try {
      useDocumentStore.setState({
        fileId: recoveredId,
      });
    } finally {
      applyingTab = false;
    }
  }
  const current = activeTab();
  if (current?.filePath === document.filePath) {
    if (keepUntitledAndStartFresh(current)) {
      return;
    }
    useTabStore.getState().updateTab(current.id, tabSnapshot());
    noteEpoch(current.id);
    return;
  }
  if (current && claimUntitledTab(current)) {
    return;
  }
  if (current && current.filePath !== document.filePath) {
    flushTabRecovery(current);
  }
  if (document.filePath !== null && adoptOpenFile(document.filePath)) {
    return;
  }
  addDocumentTab();
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
  if (current) {
    flushTabRecovery(current);
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
  rememberClosedTab(tab);
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
    const tab = useTabStore.getState().tabs.find((item) => item.id === id);
    if (tab) {
      rememberClosedTab(tab);
    }
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

/** Close whichever tab is showing. */
export function closeActiveDocumentTab(): void {
  const id = useTabStore.getState().activeTabId;
  if (id) {
    closeDocumentTab(id);
  }
}

/** Select a tab by its position in the bar. The first tab is index 0. */
export function activateDocumentTabAt(index: number): void {
  const tab = useTabStore.getState().tabs[index];
  if (tab) {
    activateDocumentTab(tab.id);
  }
}

/** Move to the next or previous tab, wrapping around the bar. */
export function activateRelativeDocumentTab(offset: number): void {
  const store = useTabStore.getState();
  if (store.tabs.length === 0) {
    return;
  }
  const index = store.tabs.findIndex((tab) => tab.id === store.activeTabId);
  const nextIndex = (Math.max(index, 0) + offset + store.tabs.length) % store.tabs.length;
  const tab = store.tabs[nextIndex];
  if (tab) {
    activateDocumentTab(tab.id);
  }
}

/** Open the most recently closed tab again. */
export function reopenClosedTab(): void {
  const closed = closedTabs.pop();
  if (!closed) {
    return;
  }
  const id = useTabStore.getState().addTab(closed);
  noteEpoch(id);
  const created = useTabStore.getState().tabs.find((tab) => tab.id === id);
  if (created) {
    showTab(created);
  }
}

/** True when the active document or another open tab has unsaved edits. */
export function hasUnsavedWork(): boolean {
  if (useDocumentStore.getState().isDirty) {
    return true;
  }
  const activeId = useTabStore.getState().activeTabId;
  return useTabStore.getState().tabs.some((tab) => tab.isDirty && tab.id !== activeId);
}

/** Show the next tab that still has unsaved edits. */
export function revealNextDirtyTab(): void {
  const activeId = useTabStore.getState().activeTabId;
  const next = useTabStore.getState().tabs.find((tab) => tab.isDirty && tab.id !== activeId);
  if (next) {
    activateDocumentTab(next.id);
  }
}

/** Follow document changes for the life of the shell. */
export function subscribeDocumentTabs(): () => void {
  syncDocumentTab();
  return useDocumentStore.subscribe(() => {
    syncDocumentTab();
  });
}
