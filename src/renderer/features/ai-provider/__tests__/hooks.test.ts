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
  useAIProvider,
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
  getSidecarStatus: vi.fn(),
  configureSidecar: vi.fn(),
  startSidecar: vi.fn(),
  stopSidecar: vi.fn(),
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
    sidecarStatus: null,
    isSidecarLoading: false,
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

  describe('useAIProvider sidecar lifecycle actions', () => {
    it('dispatches sidecar lifecycle actions through the store', async () => {
      const sidecarConfig = { modelPath: '/models/llama.gguf', port: 11470 };
      mockAIApi.getSidecarStatus.mockResolvedValue({
        success: true,
        status: 'running',
        endpoint: 'http://127.0.0.1:11470',
        config: sidecarConfig,
      });
      mockAIApi.configureSidecar.mockResolvedValue({
        success: true,
        status: 'stopped',
        config: sidecarConfig,
      });
      mockAIApi.startSidecar.mockResolvedValue({
        success: true,
        status: 'running',
        endpoint: 'http://127.0.0.1:11470',
        config: sidecarConfig,
      });
      mockAIApi.stopSidecar.mockResolvedValue({
        success: true,
        status: 'stopped',
        config: sidecarConfig,
      });

      const { result } = renderHook(() => useAIProvider());

      await act(async () => {
        await result.current.fetchSidecarStatus();
        await result.current.configureSidecar(sidecarConfig);
        await result.current.startSidecar(sidecarConfig);
        await result.current.stopSidecar();
      });

      expect(mockAIApi.getSidecarStatus).toHaveBeenCalledTimes(1);
      expect(mockAIApi.configureSidecar).toHaveBeenCalledWith(sidecarConfig);
      expect(mockAIApi.startSidecar).toHaveBeenCalledWith(sidecarConfig);
      expect(mockAIApi.stopSidecar).toHaveBeenCalledTimes(1);
    });

    it('surfaces sidecar API failure state through hook error', async () => {
      mockAIApi.startSidecar.mockResolvedValue({
        success: false,
        status: 'error',
        error: { code: 'INVALID_CONFIG', message: 'Model path is required' },
      });

      const { result } = renderHook(() => useAIProvider());

      await act(async () => {
        await result.current.startSidecar({ modelPath: '' });
      });

      expect(mockAIApi.startSidecar).toHaveBeenCalledWith({ modelPath: '' });
      expect(result.current.error).toBe('Model path is required');
    });
  });
});
