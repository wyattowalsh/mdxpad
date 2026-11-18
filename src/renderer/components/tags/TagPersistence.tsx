/**
 * Move tags from an untitled tab onto the file when that tab is saved.
 */

import { useEffect, useRef } from 'react';
import { useDocumentStore } from '@renderer/stores/document-store';
import { selectActiveTabId, useTabStore } from '@renderer/stores/tab-store';
import { useTagStore } from '@renderer/stores/tag-store';

import { tagDocumentKey } from './tag-document';

export function TagPersistence(): null {
  const filePath = useDocumentStore((state) => state.filePath);
  const activeTabId = useTabStore(selectActiveTabId);
  const documentKey = tagDocumentKey(filePath, activeTabId);
  const previousKey = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousKey.current;
    previousKey.current = documentKey;
    if (
      previous !== null &&
      activeTabId !== null &&
      filePath !== null &&
      previous === `untitled:${activeTabId}`
    ) {
      useTagStore.getState().moveTagsToFile(previous, filePath);
    }
  }, [activeTabId, documentKey, filePath]);

  return null;
}
