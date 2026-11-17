/**
 * Tests for Marketplace Store.
 *
 * Tests marketplace fetching, filtering, and installation logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useMarketplaceStore,
  selectMarketplaceTemplates,
  selectMarketplaceStatus,
  selectMarketplaceError,
  selectFilteredMarketplaceTemplates,
  selectMarketplaceCategories,
  selectIsInstalling,
} from './marketplace-store';
import type { MarketplaceState, MarketplaceTemplate, MarketplaceApi } from './marketplace-store';

// =============================================================================
// SETUP
// =============================================================================

const INITIAL: MarketplaceState = {
  templates: [],
  searchQuery: '',
  categoryFilter: null,
  status: 'idle',
  error: null,
  installingIds: [],
  installAvailable: false,
};

const SAMPLE_TEMPLATES: MarketplaceTemplate[] = [
  {
    id: 't1',
    name: 'Blog Post',
    description: 'A basic blog post template',
    author: 'MDXPad',
    category: 'blog',
    previewUrl: 'https://example.com/preview/t1',
    downloadUrl: 'https://example.com/download/t1',
    version: '1.0.0',
    downloads: 100,
  },
  {
    id: 't2',
    name: 'API Documentation',
    description: 'Technical API docs template',
    author: 'Community',
    category: 'docs',
    previewUrl: 'https://example.com/preview/t2',
    downloadUrl: 'https://example.com/download/t2',
    version: '2.0.0',
    downloads: 250,
  },
  {
    id: 't3',
    name: 'Tutorial',
    description: 'Step-by-step tutorial template',
    author: 'MDXPad',
    category: 'blog',
    previewUrl: 'https://example.com/preview/t3',
    downloadUrl: 'https://example.com/download/t3',
    version: '1.1.0',
    downloads: 50,
  },
];

function createMockApi(overrides?: Partial<MarketplaceApi>): MarketplaceApi {
  return {
    list: vi.fn().mockResolvedValue({ success: true, data: SAMPLE_TEMPLATES }),
    install: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

describe('useMarketplaceStore', () => {
  beforeEach(() => {
    useMarketplaceStore.setState(INITIAL);
  });

  describe('fetchTemplates', () => {
    it('should load templates on success', async () => {
      const api = createMockApi();
      useMarketplaceStore.getState().setApi(api);

      await useMarketplaceStore.getState().fetchTemplates();
      const state = useMarketplaceStore.getState();
      expect(state.templates).toHaveLength(3);
      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
    });

    it('should set error on failure', async () => {
      const api = createMockApi({
        list: vi.fn().mockResolvedValue({
          success: false,
          error: 'Network error',
        }),
      });
      useMarketplaceStore.getState().setApi(api);

      await useMarketplaceStore.getState().fetchTemplates();
      const state = useMarketplaceStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('Network error');
    });

    it('should handle thrown errors', async () => {
      const api = createMockApi({
        list: vi.fn().mockRejectedValue(new Error('Connection failed')),
      });
      useMarketplaceStore.getState().setApi(api);

      await useMarketplaceStore.getState().fetchTemplates();
      const state = useMarketplaceStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('Connection failed');
    });
  });

  describe('searchTemplates', () => {
    it('should update search query', () => {
      useMarketplaceStore.getState().searchTemplates('blog');
      expect(useMarketplaceStore.getState().searchQuery).toBe('blog');
    });
  });

  describe('setCategoryFilter', () => {
    it('should set category filter', () => {
      useMarketplaceStore.getState().setCategoryFilter('docs');
      expect(useMarketplaceStore.getState().categoryFilter).toBe('docs');
    });

    it('should clear category filter with null', () => {
      useMarketplaceStore.getState().setCategoryFilter('docs');
      useMarketplaceStore.getState().setCategoryFilter(null);
      expect(useMarketplaceStore.getState().categoryFilter).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      useMarketplaceStore.setState({
        ...INITIAL,
        templates: SAMPLE_TEMPLATES,
        searchQuery: 'test',
        status: 'error',
      });
      useMarketplaceStore.getState().reset();
      const state = useMarketplaceStore.getState();
      expect(state.templates).toHaveLength(0);
      expect(state.searchQuery).toBe('');
      expect(state.status).toBe('idle');
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    useMarketplaceStore.setState({
      ...INITIAL,
      templates: SAMPLE_TEMPLATES,
    });
  });

  it('selectMarketplaceTemplates returns all templates', () => {
    expect(selectMarketplaceTemplates(useMarketplaceStore.getState())).toHaveLength(3);
  });

  it('selectMarketplaceStatus returns current status', () => {
    expect(selectMarketplaceStatus(useMarketplaceStore.getState())).toBe('idle');
  });

  it('selectMarketplaceError returns null when no error', () => {
    expect(selectMarketplaceError(useMarketplaceStore.getState())).toBeNull();
  });

  it('selectFilteredMarketplaceTemplates filters by search query', () => {
    useMarketplaceStore.getState().searchTemplates('blog');
    const filtered = selectFilteredMarketplaceTemplates(useMarketplaceStore.getState());
    expect(filtered).toHaveLength(2); // "Blog Post" and "Tutorial" (in blog category)
  });

  it('selectFilteredMarketplaceTemplates filters by category', () => {
    useMarketplaceStore.getState().setCategoryFilter('docs');
    const filtered = selectFilteredMarketplaceTemplates(useMarketplaceStore.getState());
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe('API Documentation');
  });

  it('selectMarketplaceCategories returns sorted unique categories', () => {
    const cats = selectMarketplaceCategories(useMarketplaceStore.getState());
    expect(cats).toEqual(['blog', 'docs']);
  });

  it('selectIsInstalling returns false when not installing', () => {
    expect(selectIsInstalling('t1')(useMarketplaceStore.getState())).toBe(false);
  });
});
