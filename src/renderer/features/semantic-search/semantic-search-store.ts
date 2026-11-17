/**
 * Semantic Search Store
 *
 * Zustand + Immer store managing semantic search state
 * including query, results, indexing status, and loading states.
 *
 * @module src/renderer/features/semantic-search/semantic-search-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { SemanticSearchResult } from '@shared/contracts/semantic-search-schemas';
import { readExcludesForDirectory } from '@renderer/components/workspace/workspace-folders';

// =============================================================================
// STATE
// =============================================================================

export interface SemanticSearchState {
  query: string;
  results: SemanticSearchResult[];
  isSearching: boolean;
  isIndexing: boolean;
  isIndexed: boolean;
  fileCount: number;
  chunkCount: number;
  lastIndexedAt: string | null;
  error: string | null;
}

export interface SemanticSearchActions {
  setQuery: (query: string) => void;
  search: (workspacePath: string) => Promise<void>;
  indexWorkspace: (workspacePath: string, forceReindex?: boolean) => Promise<void>;
  checkIndexStatus: (workspacePath: string) => Promise<void>;
  clearResults: () => void;
  clearError: () => void;
  reset: () => void;
}

export type SemanticSearchStore = SemanticSearchState & SemanticSearchActions;

// =============================================================================
// INITIAL STATE
// =============================================================================

function semanticSearchApi(): NonNullable<Window['mdxpad']['semanticSearch']> | null {
  if (typeof window === 'undefined' || !('mdxpad' in window) || !window.mdxpad.semanticSearch) {
    return null;
  }
  return window.mdxpad.semanticSearch;
}

function blockedWorkspaceMessage(workspacePath: string, available: boolean): string | null {
  if (workspacePath.trim().length === 0) {
    return 'Open a file inside a folder to search';
  }
  if (!available) {
    return 'Semantic search is not available';
  }
  return null;
}

const INITIAL_STATE: SemanticSearchState = {
  query: '',
  results: [],
  isSearching: false,
  isIndexing: false,
  isIndexed: false,
  fileCount: 0,
  chunkCount: 0,
  lastIndexedAt: null,
  error: null,
};

// =============================================================================
// STORE
// =============================================================================

export const useSemanticSearchStore = create<SemanticSearchStore>()(
  immer((set, get) => ({
    ...INITIAL_STATE,

    setQuery: (query: string) => {
      set((draft) => {
        draft.query = query;
      });
    },

    search: async (workspacePath: string) => {
      const query = get().query.trim();
      if (!query) return;

      const semanticSearch = semanticSearchApi();
      const blocked = blockedWorkspaceMessage(workspacePath, semanticSearch !== null);
      if (blocked !== null || semanticSearch === null) {
        set((draft) => {
          draft.error = blocked ?? 'Semantic search is not available';
          draft.isSearching = false;
        });
        return;
      }

      set((draft) => {
        draft.isSearching = true;
        draft.error = null;
      });

      try {
        const response = await semanticSearch.search(
          query,
          workspacePath,
          undefined,
          readExcludesForDirectory(workspacePath)
        );
        if (response.success && response.results) {
          set((draft) => {
            draft.results = response.results ?? [];
            draft.isSearching = false;
          });
        } else {
          set((draft) => {
            draft.error = response.error?.message ?? 'Search failed';
            draft.isSearching = false;
          });
        }
      } catch (error) {
        set((draft) => {
          draft.error = error instanceof Error ? error.message : 'Search failed';
          draft.isSearching = false;
        });
      }
    },

    indexWorkspace: async (workspacePath: string, forceReindex?: boolean) => {
      const semanticSearch = semanticSearchApi();
      const blocked = blockedWorkspaceMessage(workspacePath, semanticSearch !== null);
      if (blocked !== null || semanticSearch === null) {
        set((draft) => {
          draft.error = blocked ?? 'Semantic search is not available';
          draft.isIndexing = false;
        });
        return;
      }

      set((draft) => {
        draft.isIndexing = true;
        draft.error = null;
      });

      try {
        const response = await semanticSearch.indexWorkspace(
          workspacePath,
          forceReindex,
          readExcludesForDirectory(workspacePath)
        );
        if (response.success) {
          set((draft) => {
            draft.isIndexing = false;
            draft.isIndexed = true;
            draft.fileCount = response.indexedFiles ?? 0;
            draft.chunkCount = response.totalChunks ?? 0;
            draft.lastIndexedAt = new Date().toISOString();
          });
        } else {
          set((draft) => {
            draft.error = response.error?.message ?? 'Indexing failed';
            draft.isIndexing = false;
          });
        }
      } catch (error) {
        set((draft) => {
          draft.error = error instanceof Error ? error.message : 'Indexing failed';
          draft.isIndexing = false;
        });
      }
    },

    checkIndexStatus: async (workspacePath: string) => {
      const semanticSearch = semanticSearchApi();
      if (workspacePath.trim().length === 0 || semanticSearch === null) {
        return;
      }
      try {
        const response = await semanticSearch.getIndexStatus(workspacePath);
        if (response.success) {
          set((draft) => {
            draft.isIndexed = response.isIndexed ?? false;
            draft.fileCount = response.fileCount ?? 0;
            draft.chunkCount = response.chunkCount ?? 0;
            draft.lastIndexedAt = response.lastIndexedAt ?? null;
          });
        }
      } catch {
        // Status check failure is non-critical
      }
    },

    clearResults: () => {
      set((draft) => {
        draft.results = [];
        draft.query = '';
      });
    },

    clearError: () => {
      set((draft) => {
        draft.error = null;
      });
    },

    reset: () => {
      set(() => ({ ...INITIAL_STATE }));
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectQuery = (s: SemanticSearchStore): string => s.query;
export const selectResults = (s: SemanticSearchStore): SemanticSearchResult[] => s.results;
export const selectIsSearching = (s: SemanticSearchStore): boolean => s.isSearching;
export const selectIsIndexing = (s: SemanticSearchStore): boolean => s.isIndexing;
export const selectIsIndexed = (s: SemanticSearchStore): boolean => s.isIndexed;
export const selectError = (s: SemanticSearchStore): string | null => s.error;
