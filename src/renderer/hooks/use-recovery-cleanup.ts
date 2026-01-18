/**
 * useRecoveryCleanup Hook
 *
 * Cleans up recovery files after successful manual saves.
 * When a document is saved via File > Save (not autosave), this hook
 * detects the save completion and discards the corresponding recovery
 * file since the content is now safely persisted to disk.
 *
 * Detection approach:
 * - Autosave writes to recovery directory, does NOT clear isDirty
 * - Manual save writes to original file path, clears isDirty via markSaved()
 * - When isDirty transitions from true to false, a manual save occurred
 * - At that point, we discard the recovery file for this document
 *
 * Per FR-008: Clear recovery data after a document is successfully manually saved.
 *
 * @module renderer/hooks/use-recovery-cleanup
 */

import { useEffect, useRef, useCallback } from 'react';
import { useDocumentStore } from '@renderer/stores/document-store';
import type { DocumentId as AutosaveDocumentId } from '@shared/contracts/autosave-schemas';
import type { RecoveryDiscardRequest, RecoveryDiscardResponse } from '@shared/contracts/autosave-ipc';
import type { DocumentId as DocumentStoreId } from '@shared/types/document';

// =============================================================================
// IPC STUB
// =============================================================================

/**
 * Discard recovery files via IPC.
 *
 * Removes recovery files for the specified document IDs from the recovery
 * directory and updates the manifest accordingly.
 *
 * NOTE: This function will need to be updated once the preload API is available.
 * The actual implementation should be:
 *   window.mdxpad.recovery.discard(request)
 *
 * The preload.ts needs to expose:
 *   recovery: {
 *     discard: (request: RecoveryDiscardRequest) => Promise<RecoveryDiscardResponse>
 *   }
 *
 * @param request - Contains array of documentIds to discard
 * @returns Promise resolving to discard count
 */
const discardRecovery = async (
  request: RecoveryDiscardRequest
): Promise<RecoveryDiscardResponse> => {
  // TODO: Replace with actual IPC call after preload update
  // return window.mdxpad.recovery.discard(request);
  console.debug('[useRecoveryCleanup] Discarding recovery for:', request.documentIds);

  // Stub: Return success with count matching request
  return {
    discardedCount: request.documentIds.length,
  };
};

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook that cleans up recovery files after successful manual saves.
 *
 * Subscribes to the document store and monitors the isDirty state. When a
 * document transitions from dirty (isDirty: true) to clean (isDirty: false),
 * this indicates a successful manual save operation (File > Save). At that
 * point, the corresponding recovery file is no longer needed and can be
 * safely discarded.
 *
 * This hook does NOT trigger cleanup for:
 * - Autosaves: These write to recovery files, not the original file
 * - New document creation: isDirty is false but no prior dirty state
 * - Opening files: isDirty is false but no prior dirty state
 *
 * @example
 * ```tsx
 * function App() {
 *   // Call once at app root to enable recovery cleanup
 *   useRecoveryCleanup();
 *
 *   return <Editor />;
 * }
 * ```
 *
 * @remarks
 * - This hook should be called once at the application root level
 * - It uses refs to track previous state without causing re-renders
 * - Recovery discard failures are logged but do not affect the user experience
 */
export function useRecoveryCleanup(): void {
  // Track previous isDirty state to detect transitions
  const prevIsDirtyRef = useRef<boolean | null>(null);

  // Track the document ID that was dirty (before save)
  // This is needed because fileId might change during Save As
  const dirtyDocumentIdRef = useRef<DocumentStoreId | null>(null);

  // Subscribe to document store state
  const isDirty = useDocumentStore((s) => s.isDirty);
  const fileId = useDocumentStore((s) => s.fileId) as DocumentStoreId | null;

  /**
   * Perform the recovery discard operation.
   *
   * Note: DocumentId types differ between Zod-branded (autosave schemas) and
   * TypeScript-branded (document store). Both are string-based UUIDs, so the
   * cast via `unknown` is safe.
   *
   * @param documentId - The document ID whose recovery file should be discarded
   */
  const performDiscard = useCallback(async (documentId: DocumentStoreId): Promise<void> => {
    try {
      // Cast from DocumentStoreId to AutosaveDocumentId via unknown
      // Both are string-based UUIDs with different brand types
      const request: RecoveryDiscardRequest = {
        documentIds: [documentId as unknown as AutosaveDocumentId],
      };

      const response = await discardRecovery(request);

      if (response.discardedCount > 0) {
        console.debug(
          `[useRecoveryCleanup] Successfully discarded ${response.discardedCount} recovery file(s)`
        );
      } else {
        // No recovery file existed - this is normal for documents that were
        // never autosaved or for new documents
        console.debug('[useRecoveryCleanup] No recovery file to discard');
      }
    } catch (error) {
      // Log error but don't disrupt user experience
      // Recovery files will be cleaned up by retention policy if discard fails
      console.error(
        '[useRecoveryCleanup] Failed to discard recovery:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }, []);

  // Main effect: detect isDirty transitions and trigger cleanup
  useEffect(() => {
    // Track the document ID when document becomes dirty
    // This captures the ID before any potential Save As operation
    if (isDirty && !prevIsDirtyRef.current && fileId) {
      dirtyDocumentIdRef.current = fileId;
    }

    // Detect transition: dirty (true) -> clean (false) indicates manual save
    if (prevIsDirtyRef.current === true && isDirty === false) {
      // Get the document ID to discard
      // Priority: use the tracked dirty document ID, fall back to current fileId
      const documentIdToDiscard = dirtyDocumentIdRef.current ?? fileId;

      if (documentIdToDiscard) {
        // Trigger discard asynchronously - don't block the save completion
        void performDiscard(documentIdToDiscard);
      }

      // Clear the tracked dirty document ID
      dirtyDocumentIdRef.current = null;
    }

    // Update previous state for next comparison
    prevIsDirtyRef.current = isDirty;
  }, [isDirty, fileId, performDiscard]);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default useRecoveryCleanup;
