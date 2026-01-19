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
import { useDocumentStore, selectIsDirty, selectFilePath, selectContent, selectFileName } from '@renderer/stores/document-store';
import { useAutosaveStore } from '@renderer/stores/autosave-store';
import type { AutosaveTriggerRequest, AutosaveTriggerResponse } from '@shared/contracts/autosave-ipc';
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
// IPC STUB
// =============================================================================

/**
 * Trigger autosave via IPC.
 *
 * NOTE: This function will need to be updated once the preload API is available.
 * The actual implementation should be:
 *   window.mdxpad.autosave.trigger(request)
 *
 * The preload.ts needs to expose:
 *   autosave: {
 *     trigger: (request: AutosaveTriggerRequest) => Promise<AutosaveTriggerResponse>
 *   }
 */
const triggerAutosave = async (
  request: AutosaveTriggerRequest
): Promise<AutosaveTriggerResponse> => {
  // TODO: Replace with actual IPC call after preload update
  // return window.mdxpad.autosave.trigger(request);
  console.debug('[useAutosave] Autosave triggered (stub):', request.documentId);
  throw new Error('Autosave API not available - preload needs update');
};

/**
 * Get autosave settings via IPC.
 *
 * NOTE: This function will need to be updated once the preload API is available.
 * The actual implementation should be:
 *   window.mdxpad.settings.get()
 */
const getAutosaveSettings = async (): Promise<AutosaveSettings> => {
  // TODO: Replace with actual IPC call after preload update
  // return window.mdxpad.autosave.settingsGet();
  console.debug('[useAutosave] Getting settings (stub - using defaults)');
  return DEFAULT_AUTOSAVE_SETTINGS;
};

/**
 * Check if a file path is writable.
 *
 * NOTE: This function will need to be updated once the preload API is available.
 * The actual implementation should check file system permissions via IPC.
 */
const checkFileWritable = async (_filePath: string): Promise<boolean> => {
  // TODO: Replace with actual IPC call after preload update
  // For now, assume all files are writable
  return true;
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
export function useAutosave(options?: UseAutosaveOptions): UseAutosaveResult {
  const optDebounceMs = options?.debounceMs;
  const enabled = options?.enabled ?? true;

  // Document store selectors
  const isDirty = useDocumentStore(selectIsDirty);
  const filePath = useDocumentStore(selectFilePath);
  const content = useDocumentStore(selectContent);
  const fileName = useDocumentStore(selectFileName);
  const fileId = useDocumentStore((s) => s.fileId);

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

  // State for consecutive failures (exposed to UI)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  // Refs for managing async state
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgressRef = useRef<boolean>(false);
  const pendingQueueRef = useRef<boolean>(false);
  const settingsRef = useRef<AutosaveSettings>(DEFAULT_AUTOSAVE_SETTINGS);
  const isReadOnlyRef = useRef<boolean>(false);
  const documentIdRef = useRef<string | null>(null);

  // Stable document ID - generate for untitled, use fileId for saved files
  useEffect(() => {
    if (fileId) {
      documentIdRef.current = fileId;
    } else if (!documentIdRef.current) {
      // Generate a new ID for untitled documents
      documentIdRef.current = crypto.randomUUID();
    }
  }, [fileId]);

  // Load settings on mount
  useEffect(() => {
    let mounted = true;

    const loadSettings = async (): Promise<void> => {
      try {
        const settings = await getAutosaveSettings();
        if (mounted) {
          settingsRef.current = settings;
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
  const performSave = useCallback(async (): Promise<void> => {
    // Generate document ID if needed
    const documentId = documentIdRef.current ?? crypto.randomUUID();
    if (!documentIdRef.current) {
      documentIdRef.current = documentId;
    }

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
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.warn('[useAutosave] Autosave paused after consecutive failures');
      return;
    }

    saveInProgressRef.current = true;
    startSave(documentId);

    try {
      const request: AutosaveTriggerRequest = {
        documentId: documentId as AutosaveTriggerRequest['documentId'],
        filePath,
        fileName,
        content,
      };

      const response = await triggerAutosave(request);

      if (response.ok) {
        completeSave(response.savedAt);
        setConsecutiveFailures(0);
        console.debug('[useAutosave] Autosave successful at', new Date(response.savedAt).toISOString());
      } else {
        failSave(response.message);
        setConsecutiveFailures((prev) => {
          const newCount = prev + 1;
          if (newCount >= MAX_CONSECUTIVE_FAILURES) {
            console.error('[useAutosave] Max consecutive failures reached, pausing autosave');
          }
          return newCount;
        });
        console.error('[useAutosave] Autosave failed:', response.error, response.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      failSave(message);
      setConsecutiveFailures((prev) => prev + 1);
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
  }, [filePath, fileName, content, startSave, completeSave, failSave]);

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

    await performSave();
  }, [isDirty, performSave]);

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
      return;
    }

    // Clear existing timeout
    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Determine debounce delay: option overrides settings
    const debounceMs = optDebounceMs ?? settingsRef.current.intervalMs ?? DEFAULT_DEBOUNCE_MS;

    // Start debounce timer
    debounceTimeoutRef.current = setTimeout(() => {
      debounceTimeoutRef.current = null;
      void performSave();
    }, debounceMs);
  }, [isDirty, enabled, storeEnabled, optDebounceMs, performSave]);

  // Subscribe to settings changes from other windows/IPC (T020)
  useEffect(() => {
    // TODO: Replace with actual IPC subscription when preload is updated
    // const unsubscribe = window.mdxpad.settings.onChange((newSettings) => {
    //   settingsRef.current = newSettings;
    //   // Reset debounce timer if dirty and enabled
    //   if (isDirty && enabled && storeEnabled) {
    //     if (debounceTimeoutRef.current !== null) {
    //       clearTimeout(debounceTimeoutRef.current);
    //     }
    //     debounceTimeoutRef.current = setTimeout(() => {
    //       debounceTimeoutRef.current = null;
    //       void performSave();
    //     }, newSettings.intervalMs);
    //   }
    // });
    // return () => { unsubscribe(); };

    // Stub: Listen for custom event as placeholder
    const handleSettingsChange = (event: CustomEvent<{ settings: AutosaveSettings }>): void => {
      settingsRef.current = event.detail.settings;
      console.debug('[useAutosave] Settings changed:', event.detail.settings);

      // Reset debounce timer if dirty and enabled
      if (isDirty && enabled && storeEnabled) {
        if (debounceTimeoutRef.current !== null) {
          clearTimeout(debounceTimeoutRef.current);
        }
        const debounceMs = optDebounceMs ?? event.detail.settings.intervalMs ?? DEFAULT_DEBOUNCE_MS;
        debounceTimeoutRef.current = setTimeout(() => {
          debounceTimeoutRef.current = null;
          void performSave();
        }, debounceMs);
      }
    };

    window.addEventListener('mdxpad:settings:change', handleSettingsChange as EventListener);

    return () => {
      window.removeEventListener('mdxpad:settings:change', handleSettingsChange as EventListener);
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

// =============================================================================
// SETTINGS CHANGE HELPER
// =============================================================================

/**
 * Dispatch a settings change event for live update.
 *
 * This is a temporary mechanism until the preload IPC is implemented.
 * The settings panel can call this after successfully saving settings.
 *
 * @param settings - The new settings to broadcast
 */
export function dispatchSettingsChange(settings: AutosaveSettings): void {
  window.dispatchEvent(new CustomEvent('mdxpad:settings:change', {
    detail: { settings },
  }));
}

// Default export for convenience
export default useAutosave;
