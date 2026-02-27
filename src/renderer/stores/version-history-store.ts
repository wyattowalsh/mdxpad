/**
 * Version History Store
 *
 * Zustand store with Immer middleware for version history state management.
 * Tracks version entries, selection, and loading state for the version
 * history panel.
 *
 * @module renderer/stores/version-history-store
 */

import type { Draft } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { VersionEntry, VersionSource } from '@shared/contracts/history-schemas';

// ============================================================================
// Types
// ============================================================================

/**
 * Version history state interface.
 */
export interface VersionHistoryState {
  /** List of version entries sorted by timestamp (newest first) */
  readonly entries: readonly VersionEntry[];
  /** Currently selected version entry ID */
  readonly selectedEntryId: string | null;
  /** Whether version history is loading */
  readonly isLoading: boolean;
  /** Error message, if any */
  readonly error: string | null;
  /** Current file path for which history is loaded */
  readonly currentFilePath: string | null;
}

/**
 * Version history store actions interface.
 */
export interface VersionHistoryActions {
  /** Load version history for a file */
  readonly loadHistory: (entries: readonly VersionEntry[], filePath: string) => void;
  /** Select a version entry */
  readonly selectEntry: (entryId: string | null) => void;
  /** Set loading state */
  readonly setLoading: (isLoading: boolean) => void;
  /** Set error state */
  readonly setError: (error: string | null) => void;
  /** Add a single entry (e.g., after creating a snapshot) */
  readonly addEntry: (entry: VersionEntry) => void;
  /** Clear all history */
  readonly clearHistory: () => void;
  /** Reset to initial state */
  readonly reset: () => void;
}

/**
 * Combined version history store type.
 */
export type VersionHistoryStore = VersionHistoryState & VersionHistoryActions;

// ============================================================================
// Initial State
// ============================================================================

/**
 * Initial version history state.
 */
export const INITIAL_VERSION_HISTORY_STATE: VersionHistoryState = {
  entries: [],
  selectedEntryId: null,
  isLoading: false,
  error: null,
  currentFilePath: null,
};

// ============================================================================
// Action Helpers
// ============================================================================

/** Mutable draft setter type used by Immer middleware */
type ImmerSet = (fn: (draft: Draft<VersionHistoryStore>) => void) => void;

function createHistoryDataActions(
  set: ImmerSet
): Pick<VersionHistoryActions, 'loadHistory' | 'addEntry' | 'clearHistory' | 'reset'> {
  return {
    loadHistory: (entries, filePath) =>
      set((draft) => {
        draft.entries = [...entries].sort((a, b) => b.timestamp - a.timestamp);
        draft.currentFilePath = filePath;
        draft.isLoading = false;
        draft.error = null;
        draft.selectedEntryId = null;
      }),
    addEntry: (entry) =>
      set((draft) => {
        const mutableEntries = [...draft.entries];
        const idx = mutableEntries.findIndex((e) => e.timestamp <= entry.timestamp);
        if (idx === -1) mutableEntries.push(entry);
        else mutableEntries.splice(idx, 0, entry);
        draft.entries = mutableEntries;
      }),
    clearHistory: () =>
      set((draft) => {
        draft.entries = [];
        draft.selectedEntryId = null;
        draft.error = null;
        draft.currentFilePath = null;
      }),
    reset: () =>
      set((draft) => {
        draft.entries = [];
        draft.selectedEntryId = null;
        draft.isLoading = false;
        draft.error = null;
        draft.currentFilePath = null;
      }),
  };
}

// ============================================================================
// Store Creation
// ============================================================================

/**
 * Version history store hook.
 * Manages version history state including entries, selection, and loading.
 */
export const useVersionHistoryStore = create<VersionHistoryStore>()(
  immer((set) => ({
    ...INITIAL_VERSION_HISTORY_STATE,

    selectEntry: (entryId) =>
      set((draft) => {
        draft.selectedEntryId = entryId;
      }),

    setLoading: (isLoading) =>
      set((draft) => {
        draft.isLoading = isLoading;
        if (isLoading) draft.error = null;
      }),

    setError: (error) =>
      set((draft) => {
        draft.error = error;
        draft.isLoading = false;
      }),

    ...createHistoryDataActions(set),
  }))
);

// ============================================================================
// Selectors
// ============================================================================

/** Select all version entries */
export const selectEntries = (state: VersionHistoryStore): readonly VersionEntry[] => state.entries;

/** Select the currently selected entry */
export const selectSelectedEntry = (state: VersionHistoryStore): VersionEntry | undefined =>
  state.entries.find((e) => e.id === state.selectedEntryId);

/** Select loading state */
export const selectIsLoading = (state: VersionHistoryStore): boolean => state.isLoading;

/** Select error state */
export const selectError = (state: VersionHistoryStore): string | null => state.error;

/** Select current file path */
export const selectCurrentFilePath = (state: VersionHistoryStore): string | null =>
  state.currentFilePath;

/** Select entries filtered by source */
export const selectEntriesBySource = (
  state: VersionHistoryStore,
  source: VersionSource
): readonly VersionEntry[] => state.entries.filter((e) => e.source === source);

/** Select whether history has entries */
export const selectHasEntries = (state: VersionHistoryStore): boolean => state.entries.length > 0;
