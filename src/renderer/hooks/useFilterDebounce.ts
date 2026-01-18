/**
 * useFilterDebounce Hook
 *
 * Provides debounced fuzzy filtering for the file tree explorer.
 * Implements a 50ms debounce (per FR-010) to prevent excessive recomputation
 * during rapid typing while maintaining responsive feel.
 *
 * @module renderer/hooks/useFilterDebounce
 * @see {@link ../lib/fuzzy-match/matcher.ts} Fuzzy matching implementation
 * @see {@link ../stores/file-explorer-store.ts} Filter state management
 *
 * Feature: 014-smart-filtering
 */

import { useEffect, useRef } from 'react';

import type { FileEntry } from '../lib/fuzzy-match/matcher';
import {
  filterFiles,
  convertToMatchResultMap,
} from '../lib/fuzzy-match/matcher';
import {
  useFileExplorerStore,
  FILTER_DEBOUNCE_MS,
} from '../stores/file-explorer-store';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for the useFilterDebounce hook.
 */
export interface UseFilterDebounceOptions {
  /**
   * Current filter query string.
   * Changes trigger debounced filter computation.
   */
  readonly query: string;

  /**
   * Array of file entries to filter against.
   * Each entry must have id, path, and name properties.
   */
  readonly files: readonly FileEntry[];

  /**
   * Whether the hook is enabled.
   * When false, filtering is paused and no computations occur.
   * @default true
   */
  readonly enabled?: boolean;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for debounced fuzzy filtering of file entries.
 *
 * Implements the following behavior:
 * 1. Debounces filter query changes by FILTER_DEBOUNCE_MS (50ms)
 * 2. When debounce fires:
 *    - If query is empty, applies empty results (shows all files)
 *    - Otherwise, performs fuzzy matching and applies results
 * 3. Cleans up pending timers on unmount or dependency changes
 *
 * @param options - Configuration options including query and files
 * @returns Cleanup function (also cleaned up automatically on unmount)
 *
 * @example
 * ```tsx
 * function FileExplorer() {
 *   const query = useFileExplorerStore((s) => s.query.value);
 *   const files = useFileTreeFiles(); // Array of FileEntry
 *
 *   // Hook handles debouncing and store updates automatically
 *   useFilterDebounce({ query, files });
 *
 *   // Render filtered tree...
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Conditionally enable filtering
 * function ConditionalFilter({ isActive }: { isActive: boolean }) {
 *   const query = useFileExplorerStore((s) => s.query.value);
 *   const files = useFileTreeFiles();
 *
 *   useFilterDebounce({
 *     query,
 *     files,
 *     enabled: isActive, // Only filter when active
 *   });
 * }
 * ```
 */
export function useFilterDebounce(options: UseFilterDebounceOptions): void {
  const { query, files, enabled = true } = options;

  // Store actions
  const applyFilterResults = useFileExplorerStore((s) => s.applyFilterResults);
  const setIsFiltering = useFileExplorerStore((s) => s.setIsFiltering);

  // Refs for debounce timer management
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Skip filtering when disabled
    if (!enabled) {
      return;
    }

    // Clear any pending debounce timer
    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    // Mark filtering as in progress
    setIsFiltering(true);

    // Schedule debounced filter computation
    debounceTimeoutRef.current = setTimeout(() => {
      debounceTimeoutRef.current = null;

      // Handle empty query - show all files
      const trimmedQuery = query.trim();
      if (trimmedQuery === '') {
        applyFilterResults(new Map(), 0);
        return;
      }

      // Perform fuzzy matching
      const fzfResults = filterFiles(files, trimmedQuery);

      // Convert to MatchResultMap for store
      const matchResultMap = convertToMatchResultMap(fzfResults);

      // Apply results to store (also persists and clears isFiltering)
      applyFilterResults(matchResultMap, fzfResults.length);
    }, FILTER_DEBOUNCE_MS);

    // Cleanup function - clear pending timer
    return () => {
      if (debounceTimeoutRef.current !== null) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [query, files, enabled, applyFilterResults, setIsFiltering]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current !== null) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, []);
}

// =============================================================================
// EXPORTS
// =============================================================================

// Re-export types and constants for convenience
export type { FileEntry } from '../lib/fuzzy-match/matcher';
export { FILTER_DEBOUNCE_MS } from '../stores/file-explorer-store';
