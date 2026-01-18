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
import { useDocumentStore } from '@renderer/stores/document-store';
import type { RestoredDocument } from '@shared/contracts/autosave-ipc';
import type { DocumentId as DocumentStoreId } from '@shared/types/document';

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

  // Get document store state setter via Immer-based store
  // We need direct access to set multiple fields atomically
  const store = useDocumentStore;

  const restoreDocuments = useCallback(
    (documents: readonly RestoredDocument[]): void => {
      // Validate input
      if (!documents || documents.length === 0) {
        console.debug('[useRecoveryRestore] No documents to restore');
        return;
      }

      setIsRestoring(true);

      try {
        // For single-document app, restore only the first document
        const doc = documents[0];

        // Guard against empty array (should not happen after length check, but TypeScript requires this)
        if (!doc) {
          console.error('[useRecoveryRestore] Document array was empty after length check');
          return;
        }

        console.debug(
          '[useRecoveryRestore] Restoring document:',
          doc.documentId,
          doc.filePath ?? 'untitled'
        );

        // Determine the filename
        const fileName = extractFileName(doc.filePath, doc.fileName);

        // Update the document store using Immer set
        // This sets all fields atomically and marks as dirty
        // Note: DocumentId types differ between Zod-branded (autosave schemas) and
        // TypeScript-branded (document store). Both are string-based UUIDs, so cast is safe.
        store.setState((state) => ({
          ...state,
          // Set fileId to the recovery documentId (cast between branded string types)
          fileId: doc.documentId as unknown as DocumentStoreId,
          // Set filePath (null for untitled documents)
          filePath: doc.filePath,
          // Set display name
          fileName,
          // Set content to recovered content
          content: doc.content,
          // Keep savedContent empty to ensure isDirty is true
          // The recovered content hasn't been saved to disk yet
          savedContent: '',
          // Mark as dirty since recovered content needs to be saved
          isDirty: true,
          // Reset mtime since we don't know the current file state
          lastKnownMtime: null,
        }));

        console.debug('[useRecoveryRestore] Document restored successfully:', fileName);

        // Log if multiple documents were provided but only first was restored
        if (documents.length > 1) {
          console.info(
            '[useRecoveryRestore] Multiple documents provided (%d), only first was restored (single-document mode)',
            documents.length
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[useRecoveryRestore] Failed to restore document:', message);
        // Re-throw so caller can handle
        throw error;
      } finally {
        setIsRestoring(false);
      }
    },
    [store]
  );

  return {
    restoreDocuments,
    isRestoring,
  };
}

// Named export (per task requirements)
export { useRecoveryRestore as default };
