/**
 * Put a restored version into the open document and mark it saved.
 * The history service has already written the same bytes to disk.
 */

import { useDocumentStore } from '@renderer/stores/document-store';

export function applyRestoredVersion(filePath: string, content: string): boolean {
  const state = useDocumentStore.getState();
  if (state.filePath !== filePath) {
    return false;
  }
  state.setContent(content);
  state.markSaved();
  return true;
}
