/**
 * AI Provider Hooks Tests
 *
 * Unit tests for the AI provider React hooks.
 *
 * @module src/renderer/features/ai-provider/__tests__/hooks.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIProviderStore, selectConnectedProviders } from '../store';
import {
  useActiveProvider,
  useProviderById,
  useProviderSettings,
  useConnectedProviders,
  useHasConnectedProvider,
} from '../hooks';
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

// Sample providers for testing
const sampleProviders: ProviderConfig[] = [
  {
    id: 'provider-1',
    displayName: 'OpenAI',
    type: 'openai',
    isActive: true,
    status: 'connected',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'provider-2',
    displayName: 'Anthropic',
    type: 'anthropic',
    isActive: false,
    status: 'disconnected',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'provider-3',
    displayName: 'Ollama',
    type: 'ollama',
    isActive: false,
    status: 'connected',
    baseUrl: 'http://localhost:11434',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

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

  vi.clearAllMocks();

  // Setup window.mdxpad.ai
  (globalThis as unknown as { window: { mdxpad: { ai: typeof mockAIApi } } }).window = {
    mdxpad: {
      ai: mockAIApi,
    },
  };
});

describe('AI Provider Hooks', () => {
  describe('useActiveProvider', () => {
    it('should return null when no active provider', () => {
      const { result } = renderHook(() => useActiveProvider());
      expect(result.current.activeProvider).toBeNull();
    });

    it('should return active provider when set', () => {
      useAIProviderStore.setState({
        providers: sampleProviders,
        activeProviderId: 'provider-1',
      });

      const { result } = renderHook(() => useActiveProvider());
      expect(result.current.activeProvider?.id).toBe('provider-1');
      expect(result.current.activeProvider?.displayName).toBe('OpenAI');
    });
  });

  describe('useConnectedProviders', () => {
    it('should return empty array when no providers', () => {
      const { result } = renderHook(() => useConnectedProviders());
      expect(result.current).toEqual([]);
    });

    it('should return only connected providers', () => {
      useAIProviderStore.setState({
        providers: sampleProviders,
      });

      const { result } = renderHook(() => useConnectedProviders());
      expect(result.current).toHaveLength(2);
      expect(result.current.map((p) => p.id)).toEqual(['provider-1', 'provider-3']);
    });
  });

  describe('useHasConnectedProvider', () => {
    it('should return false when no connected providers', () => {
      const { result } = renderHook(() => useHasConnectedProvider());
      expect(result.current).toBe(false);
    });

    it('should return true when has connected provider', () => {
      useAIProviderStore.setState({
        providers: sampleProviders,
      });

      const { result } = renderHook(() => useHasConnectedProvider());
      expect(result.current).toBe(true);
    });
  });

  describe('useProviderById', () => {
    it('should return null for non-existent provider', () => {
      useAIProviderStore.setState({
        providers: sampleProviders,
      });

      const { result } = renderHook(() => useProviderById('non-existent'));
      expect(result.current).toBeNull();
    });

    it('should return provider by id', () => {
      useAIProviderStore.setState({
        providers: sampleProviders,
      });

      const { result } = renderHook(() => useProviderById('provider-2'));
      expect(result.current?.displayName).toBe('Anthropic');
    });

    it('should return null for null id', () => {
      useAIProviderStore.setState({
        providers: sampleProviders,
      });

      const { result } = renderHook(() => useProviderById(null));
      expect(result.current).toBeNull();
    });
  });

  describe('useProviderSettings', () => {
    it('should have closed settings initially', () => {
      const { result } = renderHook(() => useProviderSettings());
      expect(result.current.isOpen).toBe(false);
      expect(result.current.selectedProvider).toBeNull();
    });

    it('should open settings', () => {
      const { result } = renderHook(() => useProviderSettings());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should close settings and clear selection', () => {
      useAIProviderStore.setState({
        settingsOpen: true,
        selectedProviderId: 'provider-1',
        providers: sampleProviders,
      });

      const { result } = renderHook(() => useProviderSettings());

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.selectedProvider).toBeNull();
    });

    it('should select provider', () => {
      useAIProviderStore.setState({
        providers: sampleProviders,
      });

      const { result } = renderHook(() => useProviderSettings());

      act(() => {
        result.current.select('provider-2');
      });

      expect(result.current.selectedProvider?.id).toBe('provider-2');
    });
  });
});
