/**
 * Marketplace Store State Transition & Mock API Tests
 *
 * Tests template fetching, search/filter, category filtering, template
 * installation, error handling (fetch failure, install failure, exceptions),
 * and store reset.
 *
 * NOTE: Scope clarification — despite the `tests/integration/` path, these are
 * unit-level tests exercising the Zustand marketplace-store in isolation with a
 * mocked localStorage and a mock MarketplaceApi injected via `setApi()`. No
 * real HTTP requests, template downloads, or filesystem writes occur. True
 * integration tests would hit a real or locally-served marketplace API, download
 * a template archive, extract it to disk via the main process, and verify that
 * the installed template appears in the template picker and can be used to
 * scaffold a new document.
 *
 * @module tests/integration/marketplace-templates.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store;
      store = rest;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Import after mocks
import {
  useMarketplaceStore,
  selectMarketplaceTemplates,
  selectMarketplaceStatus,
  selectMarketplaceError,
  selectIsInstalling,
  selectFilteredMarketplaceTemplates,
  selectMarketplaceCategories,
} from '@renderer/stores/marketplace-store';
import type { MarketplaceApi, MarketplaceTemplate } from '@renderer/stores/marketplace-store';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SAMPLE_TEMPLATES: MarketplaceTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Blog Post',
    description: 'A standard blog post template',
    author: 'alice',
    category: 'blog',
    previewUrl: 'https://example.com/preview/1',
    downloadUrl: 'https://example.com/download/1',
    version: '1.0.0',
    downloads: 100,
  },
  {
    id: 'tpl-2',
    name: 'API Documentation',
    description: 'Template for API docs',
    author: 'bob',
    category: 'documentation',
    previewUrl: 'https://example.com/preview/2',
    downloadUrl: 'https://example.com/download/2',
    version: '2.1.0',
    downloads: 250,
  },
  {
    id: 'tpl-3',
    name: 'Tutorial Guide',
    description: 'Step-by-step tutorial template',
    author: 'alice',
    category: 'documentation',
    previewUrl: 'https://example.com/preview/3',
    downloadUrl: 'https://example.com/download/3',
    version: '1.2.0',
    downloads: 75,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Marketplace + Templates Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    act(() => {
      useMarketplaceStore.getState().reset();
    });
  });

  describe('fetch and display templates', () => {
    it('should fetch templates from API and store them', async () => {
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockResolvedValue({ success: true, data: SAMPLE_TEMPLATES }),
        install: vi.fn().mockResolvedValue({ success: true }),
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().fetchTemplates();
      });

      const state = useMarketplaceStore.getState();
      expect(selectMarketplaceTemplates(state)).toHaveLength(3);
      expect(selectMarketplaceStatus(state)).toBe('idle');
      expect(selectMarketplaceError(state)).toBeNull();
    });

    it('should handle fetch failure', async () => {
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockResolvedValue({ success: false, error: 'Network error' }),
        install: vi.fn().mockResolvedValue({ success: true }),
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().fetchTemplates();
      });

      const state = useMarketplaceStore.getState();
      expect(selectMarketplaceStatus(state)).toBe('error');
      expect(selectMarketplaceError(state)).toBe('Network error');
    });

    it('should handle fetch exception', async () => {
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockRejectedValue(new Error('Connection refused')),
        install: vi.fn().mockResolvedValue({ success: true }),
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().fetchTemplates();
      });

      const state = useMarketplaceStore.getState();
      expect(selectMarketplaceStatus(state)).toBe('error');
      expect(selectMarketplaceError(state)).toBe('Connection refused');
    });
  });

  describe('search templates', () => {
    it('should filter templates by search query', async () => {
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockResolvedValue({ success: true, data: SAMPLE_TEMPLATES }),
        install: vi.fn().mockResolvedValue({ success: true }),
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().fetchTemplates();
      });

      // Search for "blog"
      act(() => {
        useMarketplaceStore.getState().searchTemplates('blog');
      });

      const state = useMarketplaceStore.getState();
      const filtered = selectFilteredMarketplaceTemplates(state);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe('Blog Post');
    });

    it('should search across name, description, author, and category', async () => {
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockResolvedValue({ success: true, data: SAMPLE_TEMPLATES }),
        install: vi.fn().mockResolvedValue({ success: true }),
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().fetchTemplates();
      });

      // Search by author
      act(() => {
        useMarketplaceStore.getState().searchTemplates('alice');
      });

      let filtered = selectFilteredMarketplaceTemplates(useMarketplaceStore.getState());
      expect(filtered).toHaveLength(2);

      // Search by description
      act(() => {
        useMarketplaceStore.getState().searchTemplates('API');
      });

      filtered = selectFilteredMarketplaceTemplates(useMarketplaceStore.getState());
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe('API Documentation');
    });

    it('should return all templates when search is empty', async () => {
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockResolvedValue({ success: true, data: SAMPLE_TEMPLATES }),
        install: vi.fn().mockResolvedValue({ success: true }),
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().fetchTemplates();
      });

      act(() => {
        useMarketplaceStore.getState().searchTemplates('');
      });

      const filtered = selectFilteredMarketplaceTemplates(useMarketplaceStore.getState());
      expect(filtered).toHaveLength(3);
    });
  });

  describe('category filtering', () => {
    it('should filter by category', async () => {
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockResolvedValue({ success: true, data: SAMPLE_TEMPLATES }),
        install: vi.fn().mockResolvedValue({ success: true }),
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().fetchTemplates();
      });

      act(() => {
        useMarketplaceStore.getState().setCategoryFilter('documentation');
      });

      const state = useMarketplaceStore.getState();
      const filtered = selectFilteredMarketplaceTemplates(state);
      expect(filtered).toHaveLength(2);
      expect(filtered.every((t) => t.category === 'documentation')).toBe(true);
    });

    it('should list available categories', async () => {
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockResolvedValue({ success: true, data: SAMPLE_TEMPLATES }),
        install: vi.fn().mockResolvedValue({ success: true }),
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().fetchTemplates();
      });

      const categories = selectMarketplaceCategories(useMarketplaceStore.getState());
      expect(categories).toContain('blog');
      expect(categories).toContain('documentation');
      expect(categories).toHaveLength(2);
    });

    it('should combine search and category filter', async () => {
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockResolvedValue({ success: true, data: SAMPLE_TEMPLATES }),
        install: vi.fn().mockResolvedValue({ success: true }),
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().fetchTemplates();
      });

      act(() => {
        useMarketplaceStore.getState().searchTemplates('alice');
        useMarketplaceStore.getState().setCategoryFilter('documentation');
      });

      const filtered = selectFilteredMarketplaceTemplates(useMarketplaceStore.getState());
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe('Tutorial Guide');
    });
  });

  describe('install template', () => {
    it('should install a template successfully', async () => {
      const installFn = vi.fn().mockResolvedValue({ success: true });
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockResolvedValue({ success: true, data: SAMPLE_TEMPLATES }),
        install: installFn,
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().fetchTemplates();
      });

      await act(async () => {
        await useMarketplaceStore.getState().installTemplate('tpl-1');
      });

      expect(installFn).toHaveBeenCalledWith('tpl-1');

      // Installing flag should be cleared after completion
      const state = useMarketplaceStore.getState();
      expect(selectIsInstalling('tpl-1')(state)).toBe(false);
      expect(selectMarketplaceError(state)).toBeNull();
    });

    it('should handle install failure', async () => {
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockResolvedValue({ success: true, data: SAMPLE_TEMPLATES }),
        install: vi.fn().mockResolvedValue({ success: false, error: 'Download failed' }),
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().installTemplate('tpl-1');
      });

      const state = useMarketplaceStore.getState();
      expect(selectMarketplaceError(state)).toBe('Download failed');
      expect(selectIsInstalling('tpl-1')(state)).toBe(false);
    });

    it('should handle install exception', async () => {
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockResolvedValue({ success: true, data: [] }),
        install: vi.fn().mockRejectedValue(new Error('Disk full')),
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().installTemplate('tpl-1');
      });

      const state = useMarketplaceStore.getState();
      expect(selectMarketplaceError(state)).toBe('Disk full');
      expect(selectIsInstalling('tpl-1')(state)).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all marketplace state', async () => {
      const mockApi: MarketplaceApi = {
        list: vi.fn().mockResolvedValue({ success: true, data: SAMPLE_TEMPLATES }),
        install: vi.fn().mockResolvedValue({ success: true }),
      };

      act(() => {
        useMarketplaceStore.getState().setApi(mockApi);
      });

      await act(async () => {
        await useMarketplaceStore.getState().fetchTemplates();
      });

      act(() => {
        useMarketplaceStore.getState().searchTemplates('blog');
        useMarketplaceStore.getState().setCategoryFilter('documentation');
      });

      act(() => {
        useMarketplaceStore.getState().reset();
      });

      const state = useMarketplaceStore.getState();
      expect(selectMarketplaceTemplates(state)).toHaveLength(0);
      expect(state.searchQuery).toBe('');
      expect(state.categoryFilter).toBeNull();
      expect(selectMarketplaceStatus(state)).toBe('idle');
    });
  });
});
