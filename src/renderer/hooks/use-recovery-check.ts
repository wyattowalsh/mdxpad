/**
 * useRecoveryCheck Hook
 *
 * Manages startup recovery flow for crash recovery functionality (T012).
 * Checks for recovery data on app startup and manages the recovery dialog.
 *
 * Flow:
 * 1. On mount, call mdxpad:recovery:check IPC to detect recoverable documents
 * 2. If hasRecoveryData, call mdxpad:recovery:list to get entries
 * 3. Open recovery dialog with entries for user decision
 * 4. On decision:
 *    - 'accept': call mdxpad:recovery:restore with selectedIds
 *    - 'decline': call mdxpad:recovery:discard with all document IDs
 *    - 'dismiss': close dialog, keep recovery data for next startup
 *
 * Per FR-007: Recovery data is only discarded on explicit decline.
 * Dismissing the dialog (ESC or X button) preserves data for next startup.
 *
 * @module renderer/hooks/use-recovery-check
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  RecoveryCheckResponse,
  RecoveryListResponse,
  RecoveryRestoreRequest,
  RecoveryRestoreResponse,
  RecoveryDiscardRequest,
  RecoveryDiscardResponse,
  RestoredDocument,
} from '@shared/contracts/autosave-ipc';
import type {
  RecoveryDialogEntry,
  RecoveryDecision,
} from '@shared/contracts/autosave-schemas';

// =============================================================================
// IPC STUBS
// =============================================================================

/**
 * Check if recovery data exists via IPC.
 *
 * NOTE: This function will need to be updated once the preload API is available.
 * The actual implementation should be:
 *   window.mdxpad.recovery.check()
 *
 * The preload.ts needs to expose:
 *   recovery: {
 *     check: () => Promise<RecoveryCheckResponse>
 *   }
 *
 * @returns Promise resolving to recovery check response
 */
const checkRecovery = (): Promise<RecoveryCheckResponse> => {
  // TODO: Replace with actual IPC call after preload update
  // return window.mdxpad.recovery.check();
  // Return no recovery data for stub implementation
  return Promise.resolve({ hasRecoveryData: false, count: 0 });
};

/**
 * List all recoverable documents via IPC.
 *
 * NOTE: This function will need to be updated once the preload API is available.
 * The actual implementation should be:
 *   window.mdxpad.recovery.list()
 *
 * The preload.ts needs to expose:
 *   recovery: {
 *     list: () => Promise<RecoveryListResponse>
 *   }
 *
 * @returns Promise resolving to list of recovery entries
 */
const listRecovery = (): Promise<RecoveryListResponse> => {
  // TODO: Replace with actual IPC call after preload update
  // return window.mdxpad.recovery.list();
  return Promise.resolve({ entries: [] });
};

/**
 * Restore selected documents via IPC.
 *
 * NOTE: This function will need to be updated once the preload API is available.
 * The actual implementation should be:
 *   window.mdxpad.recovery.restore(request)
 *
 * The preload.ts needs to expose:
 *   recovery: {
 *     restore: (request: RecoveryRestoreRequest) => Promise<RecoveryRestoreResponse>
 *   }
 *
 * @returns Promise resolving to restore response with recovered documents
 */
const restoreRecovery = (
  _request: RecoveryRestoreRequest
): Promise<RecoveryRestoreResponse> => {
  // TODO: Replace with actual IPC call after preload update
  // return window.mdxpad.recovery.restore(request);
  return Promise.resolve({ ok: false, error: 'Recovery API not available - preload needs update' });
};

/**
 * Discard recovery data via IPC.
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
 * @returns Promise resolving to discard response
 */
const discardRecovery = (
  _request: RecoveryDiscardRequest
): Promise<RecoveryDiscardResponse> => {
  // TODO: Replace with actual IPC call after preload update
  // return window.mdxpad.recovery.discard(request);
  return Promise.resolve({ discardedCount: 0 });
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result returned by the useRecoveryCheck hook.
 */
export interface UseRecoveryCheckResult {
  /** Whether the initial recovery check is in progress */
  isChecking: boolean;
  /** Whether recovery data exists */
  hasRecoveryData: boolean;
  /** List of recoverable document entries for dialog display */
  entries: readonly RecoveryDialogEntry[];
  /** Whether the recovery dialog should be open */
  isDialogOpen: boolean;
  /** Handle user decision from the recovery dialog */
  handleDecision: (decision: RecoveryDecision) => Promise<void>;
  /** Restored documents after successful recovery (for opening in editor) */
  restoredDocuments: readonly RestoredDocument[];
  /** Error message if recovery operation failed */
  error: string | null;
  /** Whether a recovery operation is in progress */
  isProcessing: boolean;
}

/**
 * Options for the useRecoveryCheck hook.
 */
export interface UseRecoveryCheckOptions {
  /**
   * Callback invoked after documents are successfully restored.
   * Use this to open restored documents in the editor.
   *
   * @param documents - Array of restored documents with content
   */
  onRestore?: (documents: readonly RestoredDocument[]) => void;
  /**
   * Callback invoked when recovery data is discarded.
   * Called after user explicitly declines recovery.
   *
   * @param count - Number of documents discarded
   */
  onDiscard?: (count: number) => void;
  /**
   * Callback invoked when user dismisses the dialog.
   * Recovery data is preserved for next startup per FR-007.
   */
  onDismiss?: () => void;
  /**
   * Whether to automatically check for recovery data on mount.
   * Default is true.
   */
  autoCheck?: boolean;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook for managing startup recovery check and dialog flow.
 *
 * This hook automatically checks for recovery data on mount and manages
 * the recovery dialog state. It handles all three user decisions:
 * - accept: Restore selected documents
 * - decline: Discard all recovery data
 * - dismiss: Close dialog, preserve data for next startup
 *
 * Per FR-007: Recovery data is only discarded when user explicitly clicks
 * "Decline". Dismissing the dialog preserves data for next startup.
 *
 * @param options - Optional configuration and callbacks
 * @returns Recovery check state and actions
 *
 * @example
 * ```tsx
 * function App() {
 *   const {
 *     isDialogOpen,
 *     entries,
 *     handleDecision,
 *     restoredDocuments,
 *   } = useRecoveryCheck({
 *     onRestore: (docs) => {
 *       // Open restored documents in editor
 *       docs.forEach(doc => openDocument(doc));
 *     },
 *     onDiscard: (count) => {
 *       console.log(`Discarded ${count} recovery files`);
 *     },
 *   });
 *
 *   return (
 *     <>
 *       {isDialogOpen && (
 *         <RecoveryDialog
 *           entries={entries}
 *           onDecision={handleDecision}
 *         />
 *       )}
 *       <Editor />
 *     </>
 *   );
 * }
 * ```
 */
 
export function useRecoveryCheck(options?: UseRecoveryCheckOptions): UseRecoveryCheckResult {
  const {
    onRestore,
    onDiscard,
    onDismiss,
    autoCheck = true,
  } = options ?? {};

  // ==========================================================================
  // STATE
  // ==========================================================================

  /** Whether the initial check is in progress */
  const [isChecking, setIsChecking] = useState(false);

  /** Whether recovery data exists */
  const [hasRecoveryData, setHasRecoveryData] = useState(false);

  /** Recovery entries for dialog display */
  const [entries, setEntries] = useState<readonly RecoveryDialogEntry[]>([]);

  /** Whether the recovery dialog is open */
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  /** Restored documents after successful recovery */
  const [restoredDocuments, setRestoredDocuments] = useState<readonly RestoredDocument[]>([]);

  /** Error message from recovery operations */
  const [error, setError] = useState<string | null>(null);

  /** Whether a recovery operation (restore/discard) is in progress */
  const [isProcessing, setIsProcessing] = useState(false);

  // ==========================================================================
  // REFS
  // ==========================================================================

  /** Track if check has been performed to prevent duplicate checks */
  const hasCheckedRef = useRef(false);

  /** Store callbacks in refs to avoid effect dependencies */
  const onRestoreRef = useRef(onRestore);
  const onDiscardRef = useRef(onDiscard);
  const onDismissRef = useRef(onDismiss);

  // Update callback refs when props change
  useEffect(() => {
    onRestoreRef.current = onRestore;
    onDiscardRef.current = onDiscard;
    onDismissRef.current = onDismiss;
  }, [onRestore, onDiscard, onDismiss]);

  // ==========================================================================
  // RECOVERY CHECK EFFECT
  // ==========================================================================

  /**
   * Perform recovery check on mount.
   * Checks for recovery data and fetches entries if data exists.
   */
  useEffect(() => {
    // Skip if autoCheck is disabled or already checked
    if (!autoCheck || hasCheckedRef.current) {
      return;
    }

    let mounted = true;
    hasCheckedRef.current = true;

     
    const performCheck = async (): Promise<void> => {
      setIsChecking(true);
      setError(null);

      try {
        // Step 1: Check if recovery data exists
        const checkResponse = await checkRecovery();

        if (!mounted) return;

        setHasRecoveryData(checkResponse.hasRecoveryData);

        if (!checkResponse.hasRecoveryData || checkResponse.count === 0) {
          setIsChecking(false);
          return;
        }

        // Step 2: Fetch recovery entries for dialog
        const listResponse = await listRecovery();

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mounted can change during async
        if (!mounted) return;

        setEntries(listResponse.entries);

        // Step 3: Open recovery dialog if there are entries
        if (listResponse.entries.length > 0) {
          setIsDialogOpen(true);
        }
      } catch (err) {
        console.error('[useRecoveryCheck] Recovery check failed:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Recovery check failed');
        }
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    };

    void performCheck();

    return () => {
      mounted = false;
    };
  }, [autoCheck]);

  // ==========================================================================
  // DECISION HANDLER
  // ==========================================================================

  /**
   * Handle user decision from the recovery dialog.
   *
   * Processes the decision according to FR-007:
   * - accept: Restore selected documents and clean up their recovery files
   * - decline: Discard all recovery data (explicit user action)
   * - dismiss: Close dialog, preserve data for next startup
   *
   * @param decision - User's recovery decision
   */
  const handleDecision = useCallback(async (decision: RecoveryDecision): Promise<void> => {
    setIsProcessing(true);
    setError(null);

    try {
      switch (decision.action) {
        case 'accept': {
          // User wants to restore selected documents

          const restoreRequest: RecoveryRestoreRequest = {
            decision: decision,
          };

          const response = await restoreRecovery(restoreRequest);

          if (response.ok) {
            setRestoredDocuments(response.restored);
            setIsDialogOpen(false);
            setHasRecoveryData(false);
            setEntries([]);

            // Invoke callback with restored documents
            onRestoreRef.current?.(response.restored);
          } else {
            console.error('[useRecoveryCheck] Restore failed:', response.error);
            setError(response.error);
          }
          break;
        }

        case 'decline': {
          // User explicitly declined - discard all recovery data

          // Collect all document IDs from entries
          const allDocumentIds = entries.map((entry) => entry.documentId);

          const discardRequest: RecoveryDiscardRequest = {
            documentIds: allDocumentIds,
          };

          const response = await discardRecovery(discardRequest);

          setIsDialogOpen(false);
          setHasRecoveryData(false);
          setEntries([]);

          // Invoke callback with discard count
          onDiscardRef.current?.(response.discardedCount);
          break;
        }

        case 'dismiss': {
          // User dismissed dialog - preserve data for next startup (FR-007)
          setIsDialogOpen(false);
          // Keep entries and hasRecoveryData as-is for potential re-open

          // Invoke dismiss callback
          onDismissRef.current?.();
          break;
        }

        default: {
          // Exhaustive check - should never reach here
          const _exhaustive: never = decision;
          console.error('[useRecoveryCheck] Unknown decision action:', _exhaustive);
        }
      }
    } catch (err) {
      console.error('[useRecoveryCheck] Decision processing failed:', err);
      setError(err instanceof Error ? err.message : 'Recovery operation failed');
    } finally {
      setIsProcessing(false);
    }
  }, [entries]);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    isChecking,
    hasRecoveryData,
    entries,
    isDialogOpen,
    handleDecision,
    restoredDocuments,
    error,
    isProcessing,
  };
}

// Default export for convenience
export default useRecoveryCheck;
