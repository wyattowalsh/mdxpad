/**
 * useAutosave Hook
 *
 * Manages automatic document saving with debouncing, queue management,
 * and failure tracking. Integrates with document store to detect dirty
 * state and triggers autosave via IPC.
 *
 * Features:
 * - T008: Subscribe to document store isDirty, debounce 2s, trigger IPC
 * - T029: Detect read-only documents and skip autosave
 * - T030: Queue with in-progress guard (max 1 pending)
 *
 * @module renderer/hooks/use-autosave
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  useDocumentStore,
  selectIsDirty,
  selectFilePath,
  selectContent,
  selectFileName,
} from '@renderer/stores/document-store';
import { useAutosaveStore } from '@renderer/stores/autosave-store';
import { useTabStore } from '@renderer/stores/tab-store';
import { autosaveDocumentId } from '@renderer/components/tabs/tab-recovery-id';
import type {
  AutosaveTriggerRequest,
  AutosaveTriggerResponse,
} from '@shared/contracts/autosave-ipc';
import type { AutosaveSettings } from '@shared/contracts/autosave-schemas';
import { DEFAULT_AUTOSAVE_SETTINGS } from '@shared/contracts/autosave-schemas';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default debounce delay in milliseconds */
const DEFAULT_DEBOUNCE_MS = 2000;

/** Maximum consecutive failures before stopping automatic saves (FR-013) */
const MAX_CONSECUTIVE_FAILURES = 3;

// =============================================================================
// IPC HELPERS
// =============================================================================

/**
 * Trigger autosave via IPC.
 */
const triggerAutosave = async (
  request: AutosaveTriggerRequest
): Promise<AutosaveTriggerResponse> => {
  return window.mdxpad.autosaveTrigger(request);
};

/**
 * Get autosave settings via IPC.
 */
const getAutosaveSettings = async (): Promise<AutosaveSettings> => {
  return window.mdxpad.settings.get();
};

/**
 * Check if a file path is writable.
 *
 * No dedicated writability IPC exists today. Autosave permission failures are
 * handled via autosave trigger error responses, so this is an optimistic check.
 */
const checkFileWritable = (_filePath: string): Promise<boolean> => {
  return Promise.resolve(true);
};

// =============================================================================
// TYPES
// =============================================================================

/** Options for the useAutosave hook. */
export interface UseAutosaveOptions {
  /** Debounce delay in ms (default 2000) */
  debounceMs?: number;
  /** Enable/disable autosave (default true) */
  enabled?: boolean;
}

/** Result returned by the useAutosave hook. */
export interface UseAutosaveResult {
  /** Current autosave status */
  isSaving: boolean;
  /** Last save timestamp (ms) */
  lastSaveAt: number | null;
  /** Last save result */
  lastSaveResult: 'success' | 'error' | null;
  /** Last save error message */
  lastError: string | null;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Trigger immediate save */
  saveNow: () => Promise<void>;
  /** Disable autosave */
  disable: () => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook for managing automatic document saving.
 *
 * Subscribes to document store's isDirty state and triggers autosave
 * after a configurable debounce period. Implements queue management
 * with in-progress guard and failure tracking.
 *
 * @param options - Optional configuration
 * @returns Autosave state and control functions
 *
 * @example
 * ```tsx
 * const { isSaving, lastSaveAt, lastError, saveNow } = useAutosave();
 *
 * // Manual save
 * await saveNow();
 *
 * // With custom debounce
 * const result = useAutosave({ debounceMs: 5000 });
 * ```
 */
// eslint-disable-next-line max-lines-per-function
export function useAutosave(options?: UseAutosaveOptions): UseAutosaveResult {
  const optDebounceMs = options?.debounceMs;
  const enabled = options?.enabled ?? true;

  // Document store selectors
  const isDirty = useDocumentStore(selectIsDirty);
  const filePath = useDocumentStore(selectFilePath);
  const content = useDocumentStore(selectContent);
  const fileName = useDocumentStore(selectFileName);
  const fileId = useDocumentStore((s) => s.fileId);
  const activeTabId = useTabStore((state) => state.activeTabId);

  // Autosave store selectors and actions
  const storeEnabled = useAutosaveStore((s) => s.enabled);
  const isSaving = useAutosaveStore((s) => s.isSaving);
  const lastSaveAt = useAutosaveStore((s) => s.lastSaveAt);
  const lastSaveResult = useAutosaveStore((s) => s.lastSaveResult);
  const lastError = useAutosaveStore((s) => s.lastError);
  const startSave = useAutosaveStore((s) => s.startSave);
  const completeSave = useAutosaveStore((s) => s.completeSave);
  const failSave = useAutosaveStore((s) => s.failSave);
  const setEnabled = useAutosaveStore((s) => s.setEnabled);
  const setPaused = useAutosaveStore((s) => s.setPaused);

  // State for consecutive failures (exposed to UI)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  // Ref to track latest consecutiveFailures value, avoiding stale closure in performSave
  const consecutiveFailuresRef = useRef(0);
  useEffect(() => {
    consecutiveFailuresRef.current = consecutiveFailures;
  }, [consecutiveFailures]);

  // Refs for managing async state
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgressRef = useRef<boolean>(false);
  const pendingQueueRef = useRef<boolean>(false);
  const settingsRef = useRef<AutosaveSettings>(DEFAULT_AUTOSAVE_SETTINGS);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const performSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const pendingDelayRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const storeEnabledRef = useRef(storeEnabled);
  storeEnabledRef.current = storeEnabled;
  const optDebounceRef = useRef(optDebounceMs);
  optDebounceRef.current = optDebounceMs;
  const isReadOnlyRef = useRef<boolean>(false);
  const documentIdRef = useRef<string | null>(null);
  const documentSnapshotRef = useRef({ content, filePath, fileName });
  documentSnapshotRef.current = { content, filePath, fileName };

  // A saved file uses its file id. An untitled tab keeps a separate id.
  useEffect(() => {
    documentIdRef.current = autosaveDocumentId({
      fileId,
      activeTabId,
      previousId: documentIdRef.current,
    });
  }, [activeTabId, fileId]);

  const restartPendingSave = (settings: AutosaveSettings): void => {
    if (debounceTimeoutRef.current === null) {
      return;
    }
    const debounceMs = optDebounceRef.current ?? settings.intervalMs;
    const keepTimer =
      settings.enabled &&
      enabledRef.current &&
      storeEnabledRef.current &&
      isDirtyRef.current &&
      pendingDelayRef.current === debounceMs;
    if (keepTimer) {
      return;
    }
    clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = null;
    pendingDelayRef.current = null;
    if (!settings.enabled || !enabledRef.current || !storeEnabledRef.current || !isDirtyRef.current) {
      return;
    }
    pendingDelayRef.current = debounceMs;
    debounceTimeoutRef.current = setTimeout(() => {
      debounceTimeoutRef.current = null;
      pendingDelayRef.current = null;
      void performSaveRef.current();
    }, debounceMs);
  };

  // Load settings on mount
  useEffect(() => {
    let mounted = true;

    const loadSettings = async (): Promise<void> => {
      try {
        const settings = await getAutosaveSettings();
        if (mounted) {
          settingsRef.current = settings;
          restartPendingSave(settings);
        }
      } catch (error) {
        console.error('[useAutosave] Failed to load settings:', error);
        // Keep using defaults
      }
    };

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  // Check if file is read-only when filePath changes (T029)
  useEffect(() => {
    let mounted = true;

    const checkWritable = async (): Promise<void> => {
      if (!filePath) {
        // Untitled documents are always "writable" (to recovery dir)
        isReadOnlyRef.current = false;
        return;
      }

      try {
        const writable = await checkFileWritable(filePath);
        if (mounted) {
          isReadOnlyRef.current = !writable;
          if (!writable) {
            console.debug('[useAutosave] File is read-only, autosave disabled:', filePath);
          }
        }
      } catch (error) {
        console.error('[useAutosave] Failed to check file writability:', error);
        // Assume writable on error
        if (mounted) {
          isReadOnlyRef.current = false;
        }
      }
    };

    void checkWritable();

    return () => {
      mounted = false;
    };
  }, [filePath]);

  /**
   * Perform the actual autosave operation.
   */

  const performSave = useCallback(
    async (allowPausedRetry = false): Promise<void> => {
      // Generate document ID if needed
      documentIdRef.current ??= crypto.randomUUID();
      const documentId = documentIdRef.current;

      // Skip if read-only (T029)
      if (isReadOnlyRef.current) {
        console.debug('[useAutosave] Skipping autosave - file is read-only');
        return;
      }

      // Skip if already in progress (T030)
      if (saveInProgressRef.current) {
        // Queue for later (max 1 pending)
        pendingQueueRef.current = true;
        console.debug('[useAutosave] Save in progress, queued for later');
        return;
      }

      // Skip if too many consecutive failures (FR-013)
      if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES && !allowPausedRetry) {
        console.warn('[useAutosave] Autosave paused after consecutive failures');
        setPaused(true, 'Max consecutive failures reached');
        return;
      }

      saveInProgressRef.current = true;
      startSave(documentId);

      try {
        const snapshot = documentSnapshotRef.current;
        const request: AutosaveTriggerRequest = {
          documentId: documentId as AutosaveTriggerRequest['documentId'],
          filePath: snapshot.filePath,
          fileName: snapshot.fileName,
          content: snapshot.content,
        };

        const response = await triggerAutosave(request);

        if (response.ok) {
          completeSave(response.savedAt, documentId);
          setConsecutiveFailures(0);
          consecutiveFailuresRef.current = 0;
          setPaused(false);
          console.debug(
            '[useAutosave] Autosave successful at',
            new Date(response.savedAt).toISOString()
          );
        } else {
          failSave(response.message, documentId);
          setConsecutiveFailures((prev) => {
            const newCount = prev + 1;
            consecutiveFailuresRef.current = newCount;
            if (newCount >= MAX_CONSECUTIVE_FAILURES) {
              console.error('[useAutosave] Max consecutive failures reached, pausing autosave');
              setPaused(true, 'Max consecutive failures reached');
            }
            return newCount;
          });
          console.error('[useAutosave] Autosave failed:', response.error, response.message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        failSave(message, documentId);
        setConsecutiveFailures((prev) => {
          const newCount = prev + 1;
          consecutiveFailuresRef.current = newCount;
          if (newCount >= MAX_CONSECUTIVE_FAILURES) {
            setPaused(true, 'Max consecutive failures reached');
          }
          return newCount;
        });
        console.error('[useAutosave] Autosave error:', message);
      } finally {
        saveInProgressRef.current = false;

        // Process queued save if pending (T030)
        if (pendingQueueRef.current) {
          pendingQueueRef.current = false;
          // Schedule the queued save
          void performSave();
        }
      }
    },
    [startSave, completeSave, failSave, setPaused]
  );
  performSaveRef.current = performSave;

  /**
   * Public method to trigger immediate save.
   */
  const saveNow = useCallback(async (): Promise<void> => {
    // Clear any pending debounce
    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    // Only save if dirty
    if (!isDirty) {
      console.debug('[useAutosave] saveNow called but document is not dirty');
      return;
    }

    const isRetryAfterPause = consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES;
    if (isRetryAfterPause) {
      setConsecutiveFailures(0);
      consecutiveFailuresRef.current = 0;
      setPaused(false);
    }

    await performSave(isRetryAfterPause);
  }, [isDirty, performSave, setPaused]);

  // Main effect: subscribe to isDirty and debounce autosave (T008)
  useEffect(() => {
    // Skip if disabled (hook option or store setting)
    if (!enabled || !storeEnabled) {
      return;
    }

    // Skip if not dirty
    if (!isDirty) {
      // Clear any pending debounce when document becomes clean
      if (debounceTimeoutRef.current !== null) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      return;
    }

    // Skip if read-only (T029)
    if (isReadOnlyRef.current) {
      return;
    }

    // Skip if too many consecutive failures
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      setPaused(true, 'Max consecutive failures reached');
      return;
    }

    // Clear existing timeout
    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Determine debounce delay: option overrides settings
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const debounceMs = optDebounceMs ?? settingsRef.current.intervalMs ?? DEFAULT_DEBOUNCE_MS;

    pendingDelayRef.current = debounceMs;
    debounceTimeoutRef.current = setTimeout(() => {
      debounceTimeoutRef.current = null;
      pendingDelayRef.current = null;
      void performSave();
    }, debounceMs);
  }, [
    content,
    fileName,
    filePath,
    isDirty,
    enabled,
    storeEnabled,
    consecutiveFailures,
    optDebounceMs,
    performSave,
    setPaused,
  ]);

  // Subscribe to settings changes (T020)
  useEffect(() => {
    const unsubscribe = window.mdxpad.settings.onChange((newSettings) => {
      settingsRef.current = newSettings;
      console.debug('[useAutosave] Settings changed:', newSettings);

      // Reset debounce timer if dirty and enabled
      if (isDirty && enabled && storeEnabled) {
        if (debounceTimeoutRef.current !== null) {
          clearTimeout(debounceTimeoutRef.current);
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const debounceMs = optDebounceMs ?? newSettings.intervalMs ?? DEFAULT_DEBOUNCE_MS;
        pendingDelayRef.current = debounceMs;
        debounceTimeoutRef.current = setTimeout(() => {
          debounceTimeoutRef.current = null;
          pendingDelayRef.current = null;
          void performSave();
        }, debounceMs);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isDirty, enabled, storeEnabled, optDebounceMs, performSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current !== null) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, []);

  // Disable function
  const disable = useCallback(() => {
    setEnabled(false);
  }, [setEnabled]);

  return {
    isSaving,
    lastSaveAt,
    lastSaveResult,
    lastError,
    consecutiveFailures,
    saveNow,
    disable,
  };
}

// Default export for convenience
export default useAutosave;
