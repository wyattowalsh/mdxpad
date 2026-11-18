import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

import { liveSourceText } from './live-source-text';

/**
 * Store editor text for the document that produced it.
 * Switching files updates the store before the editor closes, so a late
 * flush must stay on the tab it came from.
 */
export function publishEditorDocument(documentKey: string, text: string): void {
  const tabs = useTabStore.getState();
  const tab =
    tabs.tabs.find((item) => item.id === documentKey) ??
    tabs.tabs.find((item) => item.filePath === documentKey);
  if (tab && tab.content !== text) {
    tabs.updateTab(tab.id, {
      content: text,
      isDirty: text !== tab.savedContent,
    });
  }
  const currentKey = tabs.activeTabId ?? useDocumentStore.getState().filePath ?? 'untitled';
  if (currentKey !== documentKey) {
    return;
  }
  const document = useDocumentStore.getState();
  if (document.content !== text) {
    document.setContent(text);
  }
}

/** Copy the source editor into the open document before a close or a tab switch. */
export function captureLiveEditor(): void {
  const text = liveSourceText();
  if (text === null) {
    return;
  }
  const tabs = useTabStore.getState();
  const documentKey = tabs.activeTabId ?? useDocumentStore.getState().filePath ?? 'untitled';
  publishEditorDocument(documentKey, text);
}
