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
  DocumentId,
} from '@shared/contracts/autosave-schemas';

// =============================================================================
// IPC HELPERS
// =============================================================================

/**
 * Check if recovery data exists via preload bridge.
 * Falls back to a safe no-data response outside Electron (tests/browser).
 */
const checkRecovery = (): Promise<RecoveryCheckResponse> => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (window.mdxpad) {
    return window.mdxpad.recoveryCheck();
  }
  return Promise.resolve({ hasRecoveryData: false, count: 0 });
};

/**
 * List recoverable documents via preload bridge.
 * Falls back to an empty list outside Electron.
 */
const listRecovery = (): Promise<RecoveryListResponse> => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (window.mdxpad) {
    return window.mdxpad.recoveryList();
  }
  return Promise.resolve({ entries: [] });
};

/**
 * Restore selected documents via preload bridge.
 * Falls back to a deterministic error outside Electron.
 */
const restoreRecovery = (request: RecoveryRestoreRequest): Promise<RecoveryRestoreResponse> => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (window.mdxpad) {
    return window.mdxpad.recoveryRestore(request);
  }
  return Promise.resolve({ ok: false, error: 'Recovery API not available - preload needs update' });
};

/**
 * Discard recovery data via preload bridge.
 * Falls back to a deterministic no-op outside Electron.
 */
const discardRecovery = (request: RecoveryDiscardRequest): Promise<RecoveryDiscardResponse> => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (window.mdxpad) {
    return window.mdxpad.recoveryDiscard(request);
  }
  return Promise.resolve({ discardedCount: request.documentIds.length });
};

async function acceptRecovery(
  decision: RecoveryDecision,
  onRestore: ((documents: readonly RestoredDocument[]) => void) | undefined,
  apply: {
    setError: (message: string | null) => void;
    setRestoredDocuments: (documents: readonly RestoredDocument[]) => void;
    setIsDialogOpen: (open: boolean) => void;
    setHasRecoveryData: (value: boolean) => void;
    setEntries: (entries: readonly RecoveryDialogEntry[]) => void;
  }
): Promise<void> {
  const response = await restoreRecovery({ decision });
  if (!response.ok) {
    apply.setError(response.error);
    return;
  }
  const openError = await openThenRelease(response.restored, onRestore);
  if (openError !== null) {
    apply.setError(openError);
    return;
  }
  apply.setRestoredDocuments(response.restored);
  apply.setIsDialogOpen(false);
  apply.setHasRecoveryData(false);
  apply.setEntries([]);
}

async function openThenRelease(
  restored: readonly RestoredDocument[],
  onRestore: ((documents: readonly RestoredDocument[]) => void) | undefined
): Promise<string | null> {
  try {
    onRestore?.(restored);
  } catch (error) {
    return error instanceof Error ? error.message : 'Could not open the recovered document';
  }
  const documentIds = restored.map((document) => document.documentId);
  if (documentIds.length === 0) {
    return null;
  }
  await discardRecovery({ documentIds });
  return null;
}

function withoutRecoveryEntry(
  entries: readonly RecoveryDialogEntry[],
  documentId: DocumentId
): readonly RecoveryDialogEntry[] {
  return entries.filter((entry) => entry.documentId !== documentId);
}

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
  /**
   * Discard one saved recovery file and leave every other entry in place.
   * Returns false when that file is still listed.
   */
  releaseRecovery: (documentId: DocumentId) => Promise<boolean>;
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
  const { onRestore, onDiscard, onDismiss, autoCheck = true } = options ?? {};

  // ==========================================================================
  // STATE
  // ==========================================================================

  /** Whether the initial check is in progress */
  const [isChecking, setIsChecking] = useState(false);

  /** Whether recovery data exists */
  const [hasRecoveryData, setHasRecoveryData] = useState(false);

  /** Recovery entries for dialog display */
  const [entries, setEntries] = useState<readonly RecoveryDialogEntry[]>([]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

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
  const handleDecision = useCallback(
    async (decision: RecoveryDecision): Promise<void> => {
      setIsProcessing(true);
      setError(null);

      try {
        switch (decision.action) {
          case 'accept':
            await acceptRecovery(decision, onRestoreRef.current, {
              setError,
              setRestoredDocuments,
              setIsDialogOpen,
              setHasRecoveryData,
              setEntries,
            });
            break;

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
    },
    [entries]
  );

  const releaseRecovery = useCallback(async (documentId: DocumentId): Promise<boolean> => {
    setIsProcessing(true);
    setError(null);
    try {
      const response = await discardRecovery({ documentIds: [documentId] });
      if (response.discardedCount < 1) {
        setError('Could not remove the saved recovery copy');
        return false;
      }
      const nextEntries = withoutRecoveryEntry(entriesRef.current, documentId);
      setEntries(nextEntries);
      const stillHasRecovery = nextEntries.length > 0;
      setHasRecoveryData(stillHasRecovery);
      setIsDialogOpen(stillHasRecovery);
      return true;
    } catch (err) {
      console.error('[useRecoveryCheck] Failed to release one recovery file:', err);
      setError(err instanceof Error ? err.message : 'Recovery operation failed');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    isChecking,
    hasRecoveryData,
    entries,
    isDialogOpen,
    handleDecision,
    releaseRecovery,
    restoredDocuments,
    error,
    isProcessing,
  };
}

// Default export for convenience
export default useRecoveryCheck;
