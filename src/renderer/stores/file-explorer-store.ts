/**
 * File Explorer Store
 *
 * Manages file tree filter state with localStorage persistence.
 * Provides fuzzy filtering capabilities for the file explorer sidebar.
 *
 * Feature: 014-smart-filtering
 * @module renderer/stores/file-explorer-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

import type {
  FilterQuery,
  MatchResult,
  MatchResultMap,
} from '../lib/fuzzy-match/types';
import { INITIAL_FILTER_QUERY } from '../lib/fuzzy-match/types';
import {
  loadPersistedFilterQuery,
  saveFilterQuery,
} from '../lib/fuzzy-match/persistence';

// Enable Immer's MapSet plugin for Map/Set support in state
enableMapSet();

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Filter input debounce delay in milliseconds.
 * Per FR-010: 50ms debounce after last keystroke.
 */
export const FILTER_DEBOUNCE_MS = 50;

/**
 * Maximum filter query length.
 * Per spec edge case: Truncate input at 256 characters maximum.
 */
export const MAX_FILTER_QUERY_LENGTH = 256;

/**
 * Empty state message when no files match filter.
 * Per FR-011: Display clear empty state message.
 */
export const FILTER_EMPTY_STATE_MESSAGE = 'No files match your filter' as const;

// =============================================================================
// STATE INTERFACE
// =============================================================================

/**
 * Filter-specific state slice.
 *
 * Manages the file tree filter query, match results, and filtering status.
 * Integrated into the file explorer store.
 */
export interface FileTreeFilterState {
  /** Current filter query */
  readonly query: FilterQuery;
  /** Map of node IDs to match results */
  readonly matchResults: MatchResultMap;
  /** Whether filter is currently being computed (debounce pending) */
  readonly isFiltering: boolean;
  /** Total count of directly matching nodes */
  readonly matchCount: number;
  /**
   * Project path for persistence (used to generate storage key).
   * A "project" is defined as the root directory path opened in the file explorer.
   * Each unique project path gets its own isolated filter persistence in localStorage.
   */
  readonly projectPath: string | null;
}

// =============================================================================
// ACTIONS INTERFACE
// =============================================================================

/**
 * Filter store actions.
 *
 * Provides methods for managing filter state, including query updates,
 * result application, and persistence operations.
 */
export interface FileTreeFilterActions {
  /**
   * Set the filter query value.
   * Triggers debounced filtering (50ms).
   * Truncates input at MAX_FILTER_QUERY_LENGTH characters.
   *
   * @param value - New filter query string
   */
  readonly setFilterQuery: (value: string) => void;

  /**
   * Clear the filter query and restore full tree view.
   * Also persists the cleared state.
   */
  readonly clearFilter: () => void;

  /**
   * Apply filter results to state.
   * Called after debounced fzf computation completes.
   *
   * @param results - Map of node IDs to match results
   * @param matchCount - Total count of direct matches
   */
  readonly applyFilterResults: (
    results: MatchResultMap,
    matchCount: number
  ) => void;

  /**
   * Set filtering in-progress state.
   *
   * @param isFiltering - Whether filtering is in progress
   */
  readonly setIsFiltering: (isFiltering: boolean) => void;

  /**
   * Set the current project path (for persistence key).
   * Called when project/workspace changes.
   *
   * @param path - Project root path
   */
  readonly setProjectPath: (path: string) => void;

  /**
   * Load persisted filter query for current project.
   * Called on project open.
   */
  readonly loadPersistedFilter: () => void;

  /**
   * Persist current filter query for current project.
   * Called on filter change (debounced with filter computation).
   */
  readonly persistFilter: () => void;
}

// =============================================================================
// COMBINED STORE TYPE
// =============================================================================

/**
 * Combined file explorer store type with filter support.
 */
export type FileExplorerStore = FileTreeFilterState & FileTreeFilterActions;

// =============================================================================
// INITIAL STATE
// =============================================================================

/**
 * Initial filter state.
 *
 * Represents the default state when no filter is active and no project
 * is currently open.
 */
export const INITIAL_FILTER_STATE: FileTreeFilterState = {
  query: INITIAL_FILTER_QUERY,
  matchResults: new Map(),
  isFiltering: false,
  matchCount: 0,
  projectPath: null,
};

// =============================================================================
// STORE CREATION
// =============================================================================

/**
 * File explorer store hook.
 *
 * Manages file tree filter state with localStorage persistence.
 * Uses Zustand with Immer for immutable state updates.
 *
 * @example
 * ```tsx
 * const { query, setFilterQuery, clearFilter, matchResults } = useFileExplorerStore();
 *
 * // Set filter query (debounced externally)
 * setFilterQuery('component');
 *
 * // Clear filter
 * clearFilter();
 *
 * // Check match results
 * const match = matchResults.get(nodeId);
 * ```
 */
export const useFileExplorerStore = create<FileExplorerStore>()(
  immer((set, get) => ({
    // Initial state
    ...INITIAL_FILTER_STATE,

    // -------------------------------------------------------------------------
    // Filter Actions
    // -------------------------------------------------------------------------

    setFilterQuery: (value: string) => {
      // Truncate input at MAX_FILTER_QUERY_LENGTH per spec edge case
      const truncatedValue = value.slice(0, MAX_FILTER_QUERY_LENGTH);

      set((draft) => {
        draft.query = {
          value: truncatedValue,
          isActive: truncatedValue.trim().length > 0,
        };
        draft.isFiltering = true;
      });

      // Debounced filter computation triggered externally
      // (via useEffect in component or dedicated hook)
    },

    clearFilter: () => {
      set((draft) => {
        draft.query = INITIAL_FILTER_QUERY;
        draft.matchResults = new Map();
        draft.matchCount = 0;
        draft.isFiltering = false;
      });

      // Persist cleared state
      const { projectPath } = get();
      if (projectPath) {
        saveFilterQuery(projectPath, '');
      }
    },

    applyFilterResults: (
      results: MatchResultMap,
      matchCount: number
    ) => {
      set((draft) => {
        // Create a new mutable Map from the ReadonlyMap for Immer compatibility
        // Immer requires mutable types in the draft
        const mutableResults = new Map<string, MatchResult>();
        Array.from(results.entries()).forEach(([key, value]) => {
          mutableResults.set(key, {
            ...value,
            positions: new Set(value.positions),
          });
        });
        (draft as { matchResults: Map<string, MatchResult> }).matchResults =
          mutableResults;
        draft.matchCount = matchCount;
        draft.isFiltering = false;
      });

      // Persist query after results are applied
      const { projectPath, query } = get();
      if (projectPath) {
        saveFilterQuery(projectPath, query.value);
      }
    },

    setIsFiltering: (isFiltering: boolean) => {
      set((draft) => {
        draft.isFiltering = isFiltering;
      });
    },

    setProjectPath: (path: string) => {
      set((draft) => {
        draft.projectPath = path;
      });
    },

    loadPersistedFilter: () => {
      const { projectPath } = get();
      if (!projectPath) return;

      const persistedQuery = loadPersistedFilterQuery(projectPath);
      if (persistedQuery) {
        set((draft) => {
          draft.query = {
            value: persistedQuery,
            isActive: true,
          };
          draft.isFiltering = true;
        });
        // Trigger filter computation for restored query externally
      }
    },

    persistFilter: () => {
      const { projectPath, query } = get();
      if (projectPath) {
        saveFilterQuery(projectPath, query.value);
      }
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Selector for filter query value.
 *
 * @param state - File explorer store state
 * @returns Current filter query string
 */
export const selectFilterQuery = (state: FileExplorerStore): string =>
  state.query.value;

/**
 * Selector for filter active state.
 *
 * @param state - File explorer store state
 * @returns Whether filter is currently active (non-empty query)
 */
export const selectIsFilterActive = (state: FileExplorerStore): boolean =>
  state.query.isActive;

/**
 * Selector for filtering in-progress state.
 *
 * @param state - File explorer store state
 * @returns Whether filtering computation is in progress
 */
export const selectIsFiltering = (state: FileExplorerStore): boolean =>
  state.isFiltering;

/**
 * Selector for match count.
 *
 * @param state - File explorer store state
 * @returns Total count of directly matching nodes
 */
export const selectMatchCount = (state: FileExplorerStore): number =>
  state.matchCount;

/**
 * Selector for match results map.
 *
 * @param state - File explorer store state
 * @returns Map of node IDs to match results
 */
export const selectMatchResults = (state: FileExplorerStore): MatchResultMap =>
  state.matchResults;

/**
 * Selector factory for node match result.
 *
 * Creates a selector that retrieves the match result for a specific node.
 *
 * @param nodeId - Node ID to get match result for
 * @returns Selector function that returns MatchResult or undefined
 *
 * @example
 * ```tsx
 * const match = useFileExplorerStore(selectNodeMatchResult('/path/to/file.tsx'));
 * if (match?.isDirectMatch) {
 *   // Render with highlighting
 * }
 * ```
 */
export const selectNodeMatchResult =
  (nodeId: string) =>
  (state: FileExplorerStore): MatchResult | undefined =>
    state.matchResults.get(nodeId);

/**
 * Selector for whether to show empty state.
 *
 * Returns true when filter is active, not currently filtering,
 * and no matches were found.
 *
 * @param state - File explorer store state
 * @returns Whether empty state should be displayed
 */
export const selectShowEmptyState = (state: FileExplorerStore): boolean =>
  state.query.isActive && !state.isFiltering && state.matchCount === 0;

/**
 * Selector for project path.
 *
 * @param state - File explorer store state
 * @returns Current project path or null
 */
export const selectProjectPath = (state: FileExplorerStore): string | null =>
  state.projectPath;
