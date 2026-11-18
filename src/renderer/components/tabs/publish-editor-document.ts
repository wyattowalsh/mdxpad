import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

import { liveSourceText } from './live-source-text';

let baselineKey: string | null = null;
let baselineText: string | null = null;

/** Remember the text the source editor was given for this document. */
export function noteEditorBaseline(documentKey: string, text: string): void {
  baselineKey = documentKey;
  baselineText = text;
}

function currentDocumentKey(): string {
  return useTabStore.getState().activeTabId ?? useDocumentStore.getState().filePath ?? 'untitled';
}

/**
 * The open document changed from outside the source editor.
 * A delayed editor flush still has the older text and must not replace it.
 */
function openDocumentWasReplaced(documentKey: string, text: string): boolean {
  if (baselineKey !== documentKey || baselineText === null) {
    return false;
  }
  if (currentDocumentKey() !== documentKey) {
    return false;
  }
  const content = useDocumentStore.getState().content;
  return content !== baselineText && content !== text;
}

/**
 * Store editor text for the document that produced it.
 * Switching files updates the store before the editor closes, so a late
 * flush must stay on the tab it came from.
 */
export function publishEditorDocument(documentKey: string, text: string): void {
  if (openDocumentWasReplaced(documentKey, text)) {
    return;
  }
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
  const currentKey = currentDocumentKey();
  if (currentKey !== documentKey) {
    return;
  }
  const document = useDocumentStore.getState();
  if (document.content !== text) {
    document.setContent(text);
  }
  noteEditorBaseline(documentKey, text);
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
