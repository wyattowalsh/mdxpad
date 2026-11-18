/**
 * useRecoveryRestore Hook
 *
 * Handles document restoration from crash recovery data. Updates the document
 * store with recovered content and metadata, marking documents as dirty since
 * they haven't been saved to disk.
 *
 * Features:
 * - T013: Load recovery content from restored documents
 * - T013: Open restored documents in editor with isDirty=true
 * - Single document restoration (first document if multiple)
 *
 * @module renderer/hooks/use-recovery-restore
 */

import { useCallback, useState } from 'react';
import { openRecoveredDocuments } from '@renderer/components/tabs/restore-document-tabs';
import type { RestoredDocument } from '@shared/contracts/autosave-ipc';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result returned by the useRecoveryRestore hook.
 */
export interface UseRecoveryRestoreResult {
  /**
   * Restore documents from recovery data.
   *
   * For single-document apps, restores the first document in the array.
   * Updates the document store with recovered content and marks as dirty.
   *
   * @param documents - Array of restored documents from recovery:restore IPC
   */
  restoreDocuments: (documents: readonly RestoredDocument[]) => void;

  /** Whether a restore operation is currently in progress */
  isRestoring: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract the filename from a file path.
 * Falls back to provided fileName if path is null.
 *
 * @param filePath - Full path to the file (may be null)
 * @param fallbackName - Fallback name if path is null
 * @returns The filename portion of the path or fallback
 */
function recoveredFrom(entry: unknown): {
  documentId: string;
  filePath: string | null;
  fileName: string;
  content: string;
} | null {
  if (typeof entry !== 'object' || entry === null) {
    return null;
  }
  const doc = entry as RestoredDocument;
  return {
    documentId: doc.documentId,
    filePath: doc.filePath,
    fileName: extractFileName(doc.filePath, doc.fileName),
    content: doc.content,
  };
}

function extractFileName(filePath: string | null, fallbackName: string): string {
  if (!filePath) {
    return fallbackName;
  }
  // Handle both Unix (/) and Windows (\) path separators
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook for handling document restoration from crash recovery.
 *
 * Accepts restored documents from the recovery:restore IPC response and
 * updates the document store with the recovered content. Documents are
 * marked as dirty since the recovered content hasn't been saved to disk.
 *
 * Note: This is a single-document app, so only the first document is restored.
 * Future implementations may support tabs for multiple documents.
 *
 * @returns Object containing restoreDocuments function and isRestoring state
 *
 * @example
 * ```tsx
 * const { restoreDocuments, isRestoring } = useRecoveryRestore();
 *
 * // In recovery dialog handler
 * const handleRestore = async (documentIds: string[]) => {
 *   const response = await window.mdxpad.recovery.restore({ decision: { restore: documentIds, discard: [] } });
 *   if (response.ok) {
 *     restoreDocuments(response.restored);
 *   }
 * };
 * ```
 */
export function useRecoveryRestore(): UseRecoveryRestoreResult {
  const [isRestoring, setIsRestoring] = useState(false);

  const restoreDocuments = useCallback((documents: readonly RestoredDocument[]): void => {
    if (documents.length === 0) {
      console.debug('[useRecoveryRestore] No documents to restore');
      return;
    }

    const recovered = [];
    for (const entry of documents) {
      const doc = recoveredFrom(entry);
      if (!doc) {
        continue;
      }
      recovered.push(doc);
    }
    if (recovered.length === 0) {
      return;
    }

    setIsRestoring(true);

    try {
      openRecoveredDocuments(recovered);
      console.debug('[useRecoveryRestore] Restored %d document(s)', recovered.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[useRecoveryRestore] Failed to restore document:', message);
      throw error;
    } finally {
      setIsRestoring(false);
    }
  }, []);

  return {
    restoreDocuments,
    isRestoring,
  };
}

// Named export (per task requirements)
export { useRecoveryRestore as default };
