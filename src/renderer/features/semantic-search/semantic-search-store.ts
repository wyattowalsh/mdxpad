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
import { withOpenDocumentMatches } from './open-document-matches';

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
  resultGeneration: number;
  statusGeneration: number;
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
  resultGeneration: 0,
  statusGeneration: 0,
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

      const generation = get().resultGeneration + 1;
      const statusGeneration = get().statusGeneration + 1;
      set((draft) => {
        draft.resultGeneration = generation;
        draft.statusGeneration = statusGeneration;
        draft.isSearching = true;
        draft.isIndexing = false;
        draft.error = null;
      });

      try {
        const response = await semanticSearch.search(
          query,
          workspacePath,
          undefined,
          readExcludesForDirectory(workspacePath)
        );
        if (get().resultGeneration !== generation) {
          return;
        }
        if (response.success) {
          const matches = withOpenDocumentMatches(response.results ?? [], workspacePath, query);
          set((draft) => {
            draft.results = matches;
            draft.isSearching = false;
          });
        } else {
          set((draft) => {
            draft.error = response.error?.message ?? 'Search failed';
            draft.isSearching = false;
          });
        }
      } catch (error) {
        if (get().resultGeneration !== generation) {
          return;
        }
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

      const generation = get().statusGeneration + 1;
      const resultGeneration = get().resultGeneration + 1;
      set((draft) => {
        draft.statusGeneration = generation;
        draft.resultGeneration = resultGeneration;
        draft.isIndexing = true;
        draft.isSearching = false;
        draft.error = null;
      });

      try {
        const response = await semanticSearch.indexWorkspace(
          workspacePath,
          forceReindex,
          readExcludesForDirectory(workspacePath)
        );
        if (get().statusGeneration !== generation) {
          return;
        }
        if (response.success) {
          const indexedFiles = response.indexedFiles ?? 0;
          set((draft) => {
            draft.isIndexing = false;
            draft.isIndexed = indexedFiles > 0;
            draft.fileCount = indexedFiles;
            draft.chunkCount = response.totalChunks ?? 0;
            draft.lastIndexedAt = indexedFiles > 0 ? new Date().toISOString() : draft.lastIndexedAt;
            draft.error = indexedFiles > 0 ? null : 'No files were indexed';
          });
        } else {
          set((draft) => {
            draft.error = response.error?.message ?? 'Indexing failed';
            draft.isIndexing = false;
          });
        }
      } catch (error) {
        if (get().statusGeneration !== generation) {
          return;
        }
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
      const generation = get().statusGeneration + 1;
      set((draft) => {
        draft.statusGeneration = generation;
      });
      try {
        const response = await semanticSearch.getIndexStatus(workspacePath);
        if (get().statusGeneration !== generation) {
          return;
        }
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
        draft.resultGeneration += 1;
        draft.statusGeneration += 1;
        draft.isSearching = false;
        draft.isIndexing = false;
      });
    },

    clearError: () => {
      set((draft) => {
        draft.error = null;
      });
    },

    reset: () => {
      const resultGeneration = get().resultGeneration + 1;
      const statusGeneration = get().statusGeneration + 1;
      set(() => ({ ...INITIAL_STATE, resultGeneration, statusGeneration }));
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
