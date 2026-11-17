/**
 * Marketplace Store
 *
 * Zustand store with Immer middleware for template marketplace browsing,
 * searching, and installation.
 *
 * @module renderer/stores/marketplace-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Draft } from 'immer';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A template available in the marketplace.
 */
export interface MarketplaceTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly author: string;
  readonly category: string;
  readonly previewUrl: string;
  readonly downloadUrl: string;
  readonly version: string;
  readonly downloads: number;
}

/**
 * Result type for marketplace IPC operations.
 */
export type MarketplaceResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: string };

/**
 * Marketplace loading status.
 */
export type MarketplaceStatus = 'idle' | 'loading' | 'error';

/**
 * API interface for marketplace operations.
 * Abstracts the IPC layer for testability.
 */
export interface MarketplaceApi {
  readonly list: () => Promise<MarketplaceResult<MarketplaceTemplate[]>>;
  readonly install: (id: string) => Promise<MarketplaceResult<void>>;
}

// =============================================================================
// DEFAULT API (IPC-based)
// =============================================================================

const defaultMarketplaceApi: MarketplaceApi = {
  list: async () => {
    const marketplace =
      typeof window !== 'undefined' && 'mdxpad' in window ? window.mdxpad.marketplace : undefined;
    if (!marketplace) {
      return { success: true as const, data: [] };
    }
    const result = await marketplace.list();
    if (!result.success) {
      return { success: false as const, error: result.error ?? 'Failed to fetch templates' };
    }
    return { success: true as const, data: result.data ?? [] };
  },
  install: () => {
    return Promise.resolve({ success: false as const, error: 'Marketplace not configured' });
  },
};

// =============================================================================
// STATE INTERFACE
// =============================================================================

export interface MarketplaceState {
  readonly templates: readonly MarketplaceTemplate[];
  readonly searchQuery: string;
  readonly categoryFilter: string | null;
  readonly status: MarketplaceStatus;
  readonly error: string | null;
  readonly installingIds: readonly string[];
  readonly installAvailable: boolean;
}

// =============================================================================
// ACTIONS INTERFACE
// =============================================================================

export interface MarketplaceStoreActions {
  readonly setApi: (api: MarketplaceApi) => void;
  readonly fetchTemplates: () => Promise<void>;
  readonly installTemplate: (id: string) => Promise<void>;
  readonly searchTemplates: (query: string) => void;
  readonly setCategoryFilter: (category: string | null) => void;
  readonly reset: () => void;
}

export type MarketplaceStore = MarketplaceState & MarketplaceStoreActions;

// =============================================================================
// INITIAL STATE
// =============================================================================

const INITIAL_STATE: MarketplaceState = {
  templates: [],
  searchQuery: '',
  categoryFilter: null,
  status: 'idle',
  error: null,
  installingIds: [],
  installAvailable: false,
};

// =============================================================================
// STORE CREATION
// =============================================================================

/** Mutable reference to the marketplace API */
let marketplaceApi: MarketplaceApi = defaultMarketplaceApi;

// =============================================================================
// ACTION HELPERS
// =============================================================================

type MpSetter = (fn: (draft: Draft<MarketplaceState>) => void) => void;

function createFetchActions(set: MpSetter) {
  return {
    fetchTemplates: async (): Promise<void> => {
      set((draft) => {
        draft.status = 'loading';
        draft.error = null;
      });

      try {
        const result = await marketplaceApi.list();
        if (result.success) {
          set((draft) => {
            draft.templates = result.data;
            draft.status = 'idle';
          });
        } else {
          set((draft) => {
            draft.error = result.error;
            draft.status = 'error';
          });
        }
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to fetch templates';
          draft.status = 'error';
        });
      }
    },

    installTemplate: async (id: string): Promise<void> => {
      set((draft) => {
        draft.installingIds.push(id);
      });

      try {
        const result = await marketplaceApi.install(id);
        if (!result.success) {
          set((draft) => {
            draft.error = result.error;
          });
        }
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to install template';
        });
      } finally {
        set((draft) => {
          draft.installingIds = draft.installingIds.filter((i) => i !== id);
        });
      }
    },
  };
}

function createFilterActions(set: MpSetter) {
  return {
    setApi: (api: MarketplaceApi): void => {
      marketplaceApi = api;
    },

    searchTemplates: (query: string): void => {
      set((draft) => {
        draft.searchQuery = query;
      });
    },

    setCategoryFilter: (category: string | null): void => {
      set((draft) => {
        draft.categoryFilter = category;
      });
    },

    reset: (): void => {
      set(() => ({ ...INITIAL_STATE }));
    },
  };
}

export const useMarketplaceStore = create<MarketplaceStore>()(
  immer((set) => ({
    ...INITIAL_STATE,
    ...createFetchActions(set),
    ...createFilterActions(set),
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectMarketplaceTemplates = (
  state: MarketplaceStore
): readonly MarketplaceTemplate[] => state.templates;

export const selectMarketplaceStatus = (state: MarketplaceStore): MarketplaceStatus => state.status;

export const selectMarketplaceError = (state: MarketplaceStore): string | null => state.error;

export const selectIsInstalling =
  (id: string) =>
  (state: MarketplaceStore): boolean =>
    state.installingIds.includes(id);

export const selectFilteredMarketplaceTemplates = (
  state: MarketplaceStore
): readonly MarketplaceTemplate[] => {
  const { templates, searchQuery, categoryFilter } = state;
  const query = searchQuery.trim().toLowerCase();

  let filtered = [...templates];

  if (query) {
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.author.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
    );
  }

  if (categoryFilter !== null) {
    filtered = filtered.filter((t) => t.category === categoryFilter);
  }

  return filtered;
};

export const selectMarketplaceCategories = (state: MarketplaceStore): readonly string[] => {
  const cats = new Set(state.templates.map((t) => t.category));
  return [...cats].sort();
};
