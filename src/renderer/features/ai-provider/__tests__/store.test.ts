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
  getSidecarStatus: vi.fn(),
  configureSidecar: vi.fn(),
  startSidecar: vi.fn(),
  stopSidecar: vi.fn(),
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
    sidecarStatus: null,
    isSidecarLoading: false,
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

    it('keeps a provider added while an older list is in flight', async () => {
      const added: ProviderConfig = {
        id: 'added',
        displayName: 'Added',
        type: 'openai',
        isActive: false,
        status: 'disconnected',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      let finishList: (value: { providers: ProviderConfig[]; activeProviderId: null }) => void =
        () => undefined;
      mockAIApi.listProviders.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishList = resolve;
          })
      );
      mockAIApi.addProvider.mockResolvedValue({ success: true, provider: added });

      const pending = useAIProviderStore.getState().fetchProviders();
      await useAIProviderStore.getState().addProvider({ displayName: 'Added', type: 'openai' });
      finishList({ providers: [], activeProviderId: null });
      await pending;

      expect(useAIProviderStore.getState().providers.map((provider) => provider.id)).toEqual([
        'added',
      ]);
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
      await addProvider({ displayName: 'New Provider', type: 'anthropic' }, 'sk-test-key');

      const state = useAIProviderStore.getState();
      expect(state.providers).toHaveLength(1);
      expect(state.providers[0]!.displayName).toBe('New Provider');
    });

    it('should add a sidecar provider with sidecar config', async () => {
      const sidecarProvider: ProviderConfig = {
        id: 'sidecar-1',
        displayName: 'Local Sidecar',
        type: 'sidecar',
        sidecarConfig: {
          modelPath: '/models/llama.gguf',
          port: 11470,
        },
        isActive: false,
        status: 'disconnected',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockAIApi.addProvider.mockResolvedValue({
        success: true,
        provider: sidecarProvider,
      });

      const { addProvider } = useAIProviderStore.getState();
      await addProvider({
        displayName: 'Local Sidecar',
        type: 'sidecar',
        sidecarConfig: {
          modelPath: '/models/llama.gguf',
          port: 11470,
        },
      });

      expect(mockAIApi.addProvider).toHaveBeenCalledWith({
        displayName: 'Local Sidecar',
        type: 'sidecar',
        baseUrl: undefined,
        sidecarConfig: {
          modelPath: '/models/llama.gguf',
          port: 11470,
        },
        apiKey: undefined,
      });
      expect(useAIProviderStore.getState().providers[0]?.type).toBe('sidecar');
    });
  });

  describe('sidecar lifecycle actions', () => {
    it('should fetch and store sidecar status', async () => {
      mockAIApi.getSidecarStatus.mockResolvedValue({
        success: true,
        status: 'running',
        endpoint: 'http://127.0.0.1:11470',
        config: {
          modelPath: '/models/llama.gguf',
          port: 11470,
        },
      });

      const { fetchSidecarStatus } = useAIProviderStore.getState();
      const status = await fetchSidecarStatus();

      expect(status?.status).toBe('running');
      expect(useAIProviderStore.getState().sidecarStatus?.endpoint).toBe('http://127.0.0.1:11470');
      expect(useAIProviderStore.getState().isSidecarLoading).toBe(false);
    });

    it('keeps the sidecar status from the latest action', async () => {
      let finishStatus: (value: { success: boolean; status: 'stopped' }) => void = () => undefined;
      mockAIApi.getSidecarStatus.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishStatus = resolve;
          })
      );
      mockAIApi.startSidecar.mockResolvedValue({
        success: true,
        status: 'running',
        endpoint: 'http://127.0.0.1:11470',
      });

      const pending = useAIProviderStore.getState().fetchSidecarStatus();
      const started = useAIProviderStore.getState().startSidecar({
        modelPath: '/models/llama.gguf',
        port: 11470,
      });
      await started;
      finishStatus({ success: true, status: 'stopped' });
      await pending;

      expect(useAIProviderStore.getState().sidecarStatus?.status).toBe('running');
      expect(useAIProviderStore.getState().isSidecarLoading).toBe(false);
    });

    it('should configure sidecar and persist status', async () => {
      const config = {
        modelPath: '/models/llama.gguf',
        port: 11470,
      };
      mockAIApi.configureSidecar.mockResolvedValue({
        success: true,
        status: 'stopped',
        config,
      });

      const { configureSidecar } = useAIProviderStore.getState();
      const status = await configureSidecar(config);

      expect(mockAIApi.configureSidecar).toHaveBeenCalledWith(config);
      expect(status?.status).toBe('stopped');
      expect(useAIProviderStore.getState().sidecarStatus?.config?.modelPath).toBe('/models/llama.gguf');
      expect(useAIProviderStore.getState().error).toBeNull();
    });

    it('should handle missing model path failure from startSidecar', async () => {
      mockAIApi.startSidecar.mockResolvedValue({
        success: false,
        status: 'error',
        error: { code: 'INVALID_CONFIG', message: 'Model path is required' },
      });

      const { startSidecar } = useAIProviderStore.getState();
      const status = await startSidecar({ modelPath: '' });

      expect(mockAIApi.startSidecar).toHaveBeenCalledWith({ modelPath: '' });
      expect(status?.success).toBe(false);
      expect(useAIProviderStore.getState().error).toBe('Model path is required');
    });

    it('should handle stopSidecar API errors', async () => {
      mockAIApi.stopSidecar.mockRejectedValue(new Error('Failed to stop sidecar process'));

      const { stopSidecar } = useAIProviderStore.getState();
      const status = await stopSidecar();

      expect(status).toBeNull();
      expect(useAIProviderStore.getState().error).toBe('Failed to stop sidecar process');
      expect(useAIProviderStore.getState().isSidecarLoading).toBe(false);
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

  describe('fetchUsageStats', () => {
    function usageResult(totalRequests: number) {
      return {
        success: true,
        stats: {
          totalRequests,
          successfulRequests: totalRequests,
          failedRequests: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
          avgDurationMs: 0,
          byProvider: [],
          byModel: [],
          byOperation: [],
        },
      };
    }

    it('keeps the usage range that was selected last', async () => {
      let finishMonth: (value: ReturnType<typeof usageResult>) => void = () => undefined;
      let finishToday: (value: ReturnType<typeof usageResult>) => void = () => undefined;
      mockAIApi.queryUsage
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishMonth = resolve;
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishToday = resolve;
            })
        );

      const month = useAIProviderStore.getState().fetchUsageStats('month');
      const today = useAIProviderStore.getState().fetchUsageStats('day');
      finishMonth(usageResult(40));
      await month;

      expect(useAIProviderStore.getState().usageStatsTimeRange).toBe('day');
      expect(useAIProviderStore.getState().usageStats).toBeNull();
      expect(useAIProviderStore.getState().isLoading).toBe(true);

      finishToday(usageResult(3));
      await today;

      const state = useAIProviderStore.getState();
      expect(state.usageStatsTimeRange).toBe('day');
      expect(state.usageStats?.totalRequests).toBe(3);
      expect(state.isLoading).toBe(false);
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
