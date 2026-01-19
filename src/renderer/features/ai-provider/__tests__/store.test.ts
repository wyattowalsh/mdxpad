/**
 * AI Provider Store Tests
 *
 * Unit tests for the AI provider Zustand store.
 *
 * @module src/renderer/features/ai-provider/__tests__/store.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAIProviderStore, selectActiveProvider } from '../store';
import type { ProviderConfig } from '@shared/ai/types';

// Mock the window.mdxpad.ai API
const mockAIApi = {
  listProviders: vi.fn(),
  addProvider: vi.fn(),
  updateProvider: vi.fn(),
  removeProvider: vi.fn(),
  setActiveProvider: vi.fn(),
  validateProvider: vi.fn(),
  queryUsage: vi.fn(),
};

// Setup window mock
beforeEach(() => {
  // Reset store state
  useAIProviderStore.setState({
    providers: [],
    activeProviderId: null,
    isLoading: false,
    isValidating: false,
    settingsOpen: false,
    selectedProviderId: null,
    usageStats: null,
    usageStatsTimeRange: 'week',
    error: null,
  });

  // Reset mocks
  vi.clearAllMocks();

  // Setup window.mdxpad.ai
  (globalThis as unknown as { window: { mdxpad: { ai: typeof mockAIApi } } }).window = {
    mdxpad: {
      ai: mockAIApi,
    },
  };
});

describe('AI Provider Store', () => {
  describe('Initial State', () => {
    it('should have empty providers list', () => {
      const state = useAIProviderStore.getState();
      expect(state.providers).toEqual([]);
    });

    it('should have no active provider', () => {
      const state = useAIProviderStore.getState();
      expect(state.activeProviderId).toBeNull();
    });

    it('should not be loading', () => {
      const state = useAIProviderStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should have settings closed', () => {
      const state = useAIProviderStore.getState();
      expect(state.settingsOpen).toBe(false);
    });
  });

  describe('fetchProviders', () => {
    it('should fetch and set providers', async () => {
      const mockProviders: ProviderConfig[] = [
        {
          id: 'test-1',
          displayName: 'Test OpenAI',
          type: 'openai',
          isActive: true,
          status: 'connected',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockAIApi.listProviders.mockResolvedValue({
        providers: mockProviders,
        activeProviderId: 'test-1',
      });

      const { fetchProviders } = useAIProviderStore.getState();
      await fetchProviders();

      const state = useAIProviderStore.getState();
      expect(state.providers).toHaveLength(1);
      expect(state.activeProviderId).toBe('test-1');
      expect(state.isLoading).toBe(false);
    });

    it('should handle fetch error', async () => {
      mockAIApi.listProviders.mockRejectedValue(new Error('Network error'));

      const { fetchProviders } = useAIProviderStore.getState();
      await fetchProviders();

      const state = useAIProviderStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('addProvider', () => {
    it('should add a new provider', async () => {
      const newProvider: ProviderConfig = {
        id: 'new-1',
        displayName: 'New Provider',
        type: 'anthropic',
        isActive: false,
        status: 'disconnected',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockAIApi.addProvider.mockResolvedValue({
        success: true,
        provider: newProvider,
      });

      const { addProvider } = useAIProviderStore.getState();
      await addProvider(
        { displayName: 'New Provider', type: 'anthropic' },
        'sk-test-key'
      );

      const state = useAIProviderStore.getState();
      expect(state.providers).toHaveLength(1);
      expect(state.providers[0]!.displayName).toBe('New Provider');
    });
  });

  describe('UI State Actions', () => {
    it('should open settings', () => {
      const { openSettings } = useAIProviderStore.getState();
      openSettings();

      const state = useAIProviderStore.getState();
      expect(state.settingsOpen).toBe(true);
    });

    it('should close settings and clear selection', () => {
      useAIProviderStore.setState({
        settingsOpen: true,
        selectedProviderId: 'test-1',
      });

      const { closeSettings } = useAIProviderStore.getState();
      closeSettings();

      const state = useAIProviderStore.getState();
      expect(state.settingsOpen).toBe(false);
      expect(state.selectedProviderId).toBeNull();
    });

    it('should select provider', () => {
      const { selectProvider } = useAIProviderStore.getState();
      selectProvider('test-1');

      const state = useAIProviderStore.getState();
      expect(state.selectedProviderId).toBe('test-1');
    });

    it('should clear error', () => {
      useAIProviderStore.setState({ error: 'Some error' });

      const { clearError } = useAIProviderStore.getState();
      clearError();

      const state = useAIProviderStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('Selectors', () => {
    it('should select active provider', () => {
      useAIProviderStore.setState({
        providers: [
          {
            id: 'test-1',
            displayName: 'Test',
            type: 'openai',
            isActive: true,
            status: 'connected',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        activeProviderId: 'test-1',
      });

      const state = useAIProviderStore.getState();
      const active = selectActiveProvider(state);
      expect(active?.id).toBe('test-1');
    });

    it('should return null when no active provider', () => {
      const state = useAIProviderStore.getState();
      const active = selectActiveProvider(state);
      expect(active).toBeNull();
    });
  });
});
