import { liveSourceText } from '@renderer/components/tabs/live-source-text';
import { useDocumentStore } from '@renderer/stores/document-store';

/**
 * Prefer keystrokes still in the source editor when this path is the open file.
 * A different file keeps the text the caller already resolved.
 */
export function textOfMatchingDocument(
  sourcePath: string | null | undefined,
  stored: string
): string {
  if (sourcePath !== useDocumentStore.getState().filePath) {
    return stored;
  }
  return liveSourceText() ?? stored;
}
