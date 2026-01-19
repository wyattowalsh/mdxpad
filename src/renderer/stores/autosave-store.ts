/**
 * Autosave Store
 *
 * Zustand store with Immer middleware for autosave state management.
 * Tracks autosave status including save progress, results, and errors.
 *
 * @module renderer/stores/autosave-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// =============================================================================
// STATE INTERFACE
// =============================================================================

/**
 * Autosave status state interface.
 * Tracks the current state of the autosave system.
 */
export interface AutosaveStatus {
  /** Whether autosave is enabled */
  enabled: boolean;
  /** Unix timestamp (ms) of last successful save, null if never saved */
  lastSaveAt: number | null;
  /** Result of the last save attempt */
  lastSaveResult: 'success' | 'error' | null;
  /** Error message from last failed save, null if no error */
  lastError: string | null;
  /** Whether a save operation is currently in progress */
  isSaving: boolean;
  /** Document ID for which a save is pending/in progress */
  pendingSaveDocumentId: string | null;
}

/**
 * Initial autosave status state.
 * Autosave is enabled by default.
 */
const INITIAL_AUTOSAVE_STATUS: AutosaveStatus = {
  enabled: true,
  lastSaveAt: null,
  lastSaveResult: null,
  lastError: null,
  isSaving: false,
  pendingSaveDocumentId: null,
};

// =============================================================================
// ACTIONS INTERFACE
// =============================================================================

/**
 * Autosave store actions interface.
 */
export interface AutosaveStoreActions {
  /** Enable or disable autosave */
  setEnabled: (enabled: boolean) => void;
  /** Mark a save operation as in progress for a document */
  startSave: (documentId: string) => void;
  /** Mark a save operation as successfully completed */
  completeSave: (savedAt: number) => void;
  /** Mark a save operation as failed with an error */
  failSave: (error: string) => void;
  /** Reset to initial state */
  reset: () => void;
}

// =============================================================================
// COMBINED STORE TYPE
// =============================================================================

/**
 * Combined autosave store type.
 */
export type AutosaveStore = AutosaveStatus & AutosaveStoreActions;

// =============================================================================
// STORE CREATION
// =============================================================================

/**
 * Autosave store hook.
 * Manages autosave state including enabled status, save progress, and results.
 *
 * @example
 * ```tsx
 * const { enabled, isSaving, setEnabled, startSave, completeSave, failSave } = useAutosaveStore();
 *
 * // Enable/disable autosave
 * setEnabled(false);
 *
 * // Track save progress
 * startSave(documentId);
 * // ... perform save ...
 * completeSave(Date.now());
 *
 * // Handle save failure
 * failSave('Disk full');
 * ```
 */
export const useAutosaveStore = create<AutosaveStore>()(
  immer((set) => ({
    ...INITIAL_AUTOSAVE_STATUS,

    setEnabled: (enabled) =>
      set((draft) => {
        draft.enabled = enabled;
      }),

    startSave: (documentId) =>
      set((draft) => {
        draft.isSaving = true;
        draft.pendingSaveDocumentId = documentId;
      }),

    completeSave: (savedAt) =>
      set((draft) => {
        draft.isSaving = false;
        draft.pendingSaveDocumentId = null;
        draft.lastSaveAt = savedAt;
        draft.lastSaveResult = 'success';
        draft.lastError = null;
      }),

    failSave: (error) =>
      set((draft) => {
        draft.isSaving = false;
        draft.pendingSaveDocumentId = null;
        draft.lastSaveResult = 'error';
        draft.lastError = error;
      }),

    reset: () =>
      set((draft) => {
        draft.enabled = INITIAL_AUTOSAVE_STATUS.enabled;
        draft.lastSaveAt = INITIAL_AUTOSAVE_STATUS.lastSaveAt;
        draft.lastSaveResult = INITIAL_AUTOSAVE_STATUS.lastSaveResult;
        draft.lastError = INITIAL_AUTOSAVE_STATUS.lastError;
        draft.isSaving = INITIAL_AUTOSAVE_STATUS.isSaving;
        draft.pendingSaveDocumentId = INITIAL_AUTOSAVE_STATUS.pendingSaveDocumentId;
      }),
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Selector for autosave enabled state.
 *
 * @param state - Autosave store state
 * @returns Whether autosave is enabled
 */
export const selectIsEnabled = (state: AutosaveStore): boolean => state.enabled;

/**
 * Selector for save in progress state.
 *
 * @param state - Autosave store state
 * @returns Whether a save operation is currently in progress
 */
export const selectIsSaving = (state: AutosaveStore): boolean => state.isSaving;

/**
 * Selector for last save timestamp.
 *
 * @param state - Autosave store state
 * @returns Unix timestamp (ms) of last successful save, or null if never saved
 */
export const selectLastSaveAt = (state: AutosaveStore): number | null =>
  state.lastSaveAt;

/**
 * Selector for last save result.
 *
 * @param state - Autosave store state
 * @returns Result of the last save attempt ('success', 'error', or null)
 */
export const selectLastSaveResult = (
  state: AutosaveStore
): 'success' | 'error' | null => state.lastSaveResult;

/**
 * Selector for last error message.
 *
 * @param state - Autosave store state
 * @returns Error message from last failed save, or null if no error
 */
export const selectLastError = (state: AutosaveStore): string | null =>
  state.lastError;
