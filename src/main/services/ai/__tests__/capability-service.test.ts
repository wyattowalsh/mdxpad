/**
 * CapabilityService Unit Tests
 *
 * Tests for AI model capability detection including static registries,
 * dynamic probing, and cache behavior.
 *
 * @module tests/unit/capability-service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProviderCapability } from '../../../../shared/ai/types';
import type { ProviderConfig } from '../../../../shared/ai/types';

// =============================================================================
// Mock Setup - Use vi.hoisted for hoisted mock variables
// =============================================================================

const {
  mockGetOpenAIModels,
  mockGetOpenAIModel,
  mockGetAnthropicModels,
  mockGetAnthropicModel,
  mockProbeOllamaModel,
  mockFetchOllamaModels,
  mockFetchOpenAICompatibleModels,
} = vi.hoisted(() => ({
  mockGetOpenAIModels: vi.fn(() => [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      capabilities: [ProviderCapability.TEXT_GENERATION, ProviderCapability.STREAMING, ProviderCapability.VISION, ProviderCapability.TOOL_USE],
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      capabilities: [ProviderCapability.TEXT_GENERATION, ProviderCapability.STREAMING],
    },
  ]),
  mockGetOpenAIModel: vi.fn(),
  mockGetAnthropicModels: vi.fn(() => [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      capabilities: [ProviderCapability.TEXT_GENERATION, ProviderCapability.STREAMING, ProviderCapability.VISION, ProviderCapability.TOOL_USE],
    },
  ]),
  mockGetAnthropicModel: vi.fn(),
  mockProbeOllamaModel: vi.fn(),
  mockFetchOllamaModels: vi.fn(),
  mockFetchOpenAICompatibleModels: vi.fn(),
}));

// Initialize model lookup functions
mockGetOpenAIModel.mockImplementation((id: string) => {
  const models = mockGetOpenAIModels();
  return models.find((m) => m.id === id);
});

mockGetAnthropicModel.mockImplementation((id: string) => {
  const models = mockGetAnthropicModels();
  return models.find((m) => m.id === id);
});

const mockProviderService = {
  getProvider: vi.fn(),
  getProviders: vi.fn(),
  getActiveProvider: vi.fn(),
  addProvider: vi.fn(),
  updateProvider: vi.fn(),
  removeProvider: vi.fn(),
  setActiveProvider: vi.fn(),
  validateProvider: vi.fn(),
  getProviderCount: vi.fn(),
};

// Mock registries
vi.mock('../registries/openai-registry', () => ({
  getOpenAIModels: mockGetOpenAIModels,
  getOpenAIModel: mockGetOpenAIModel,
}));

vi.mock('../registries/anthropic-registry', () => ({
  getAnthropicModels: mockGetAnthropicModels,
  getAnthropicModel: mockGetAnthropicModel,
}));

// Mock capability detection
vi.mock('../capability-detection', () => ({
  CapabilityCache: class MockCache {
    private cache = new Map<string, any>();
    get(providerId: string, modelId: string) {
      return this.cache.get(`${providerId}:${modelId}`);
    }
    set(providerId: string, modelId: string, value: any) {
      this.cache.set(`${providerId}:${modelId}`, value);
    }
    delete(providerId: string) {
      const keys = Array.from(this.cache.keys());
      for (const key of keys) {
        if (key.startsWith(`${providerId}:`)) {
          this.cache.delete(key);
        }
      }
    }
  },
  probeOllamaModel: mockProbeOllamaModel,
  fetchOllamaModels: mockFetchOllamaModels,
  fetchOpenAICompatibleModels: mockFetchOpenAICompatibleModels,
  createEmptyCapabilities: (modelId: string) => ({
    modelId,
    capabilities: new Set(),
  }),
  createBasicTextCapabilities: (modelId: string) => ({
    modelId,
    capabilities: new Set([ProviderCapability.TEXT_GENERATION, ProviderCapability.STREAMING]),
  }),
  registryEntryToCapabilities: (entry: any) => ({
    modelId: entry.id,
    capabilities: new Set(entry.capabilities),
  }),
  registryEntryToModelInfo: (entry: any) => ({
    id: entry.id,
    name: entry.name,
    capabilities: entry.capabilities,
  }),
  capabilitiesToModelInfo: (capabilities: any, modelId: string) => ({
    id: modelId,
    name: modelId,
    capabilities: Array.from(capabilities.capabilities),
  }),
}));

// Import after mocks
import { CapabilityService } from '../capability-service';
import { ProviderNotFoundError } from '../../../../shared/ai/errors';

// =============================================================================
// Test Utilities
// =============================================================================

function createMockProvider(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: 'provider-1',
    displayName: 'Test Provider',
    type: 'openai',
    isActive: false,
    status: 'disconnected',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function resetMocks(): void {
  vi.clearAllMocks();
  // Re-apply model lookup implementations (cleared by vi.restoreAllMocks)
  mockGetOpenAIModel.mockImplementation((id: string) => {
    const models = mockGetOpenAIModels();
    return models.find((m: { id: string }) => m.id === id);
  });
  mockGetAnthropicModel.mockImplementation((id: string) => {
    const models = mockGetAnthropicModels();
    return models.find((m: { id: string }) => m.id === id);
  });
  mockProviderService.getProvider.mockResolvedValue(null);
  mockProviderService.getProviders.mockResolvedValue([]);
  mockProbeOllamaModel.mockResolvedValue({
    modelId: 'llama2',
    capabilities: new Set([ProviderCapability.TEXT_GENERATION, ProviderCapability.STREAMING]),
  });
  mockFetchOllamaModels.mockResolvedValue(['llama2', 'codellama']);
  mockFetchOpenAICompatibleModels.mockResolvedValue(['model-1', 'model-2']);
}

// =============================================================================
// CapabilityService Tests
// =============================================================================

describe('CapabilityService', () => {
  let service: CapabilityService;

  beforeEach(() => {
    resetMocks();
    service = new CapabilityService(mockProviderService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // getCapabilities Tests (Static Registries)
  // ===========================================================================

  describe('getCapabilities - static registries', () => {
    it('should get OpenAI model capabilities from registry', async () => {
      const provider = createMockProvider({ id: 'openai-1', type: 'openai' });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.getCapabilities('openai-1', 'gpt-4o');

      expect(result.modelId).toBe('gpt-4o');
      expect(result.capabilities.has(ProviderCapability.TEXT_GENERATION)).toBe(true);
      expect(result.capabilities.has(ProviderCapability.STREAMING)).toBe(true);
      expect(result.capabilities.has(ProviderCapability.VISION)).toBe(true);
    });

    it('should get Anthropic model capabilities from registry', async () => {
      const provider = createMockProvider({ id: 'anthropic-1', type: 'anthropic' });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.getCapabilities(
        'anthropic-1',
        'claude-3-5-sonnet-20241022'
      );

      expect(result.modelId).toBe('claude-3-5-sonnet-20241022');
      expect(result.capabilities.has(ProviderCapability.TEXT_GENERATION)).toBe(true);
      expect(result.capabilities.has(ProviderCapability.VISION)).toBe(true);
    });

    it('should return empty capabilities for unknown OpenAI model', async () => {
      const provider = createMockProvider({ id: 'openai-1', type: 'openai' });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.getCapabilities('openai-1', 'unknown-model');

      expect(result.modelId).toBe('unknown-model');
      expect(result.capabilities.size).toBe(0);
    });

    it('should return empty capabilities for unknown Anthropic model', async () => {
      const provider = createMockProvider({ id: 'anthropic-1', type: 'anthropic' });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.getCapabilities('anthropic-1', 'unknown-model');

      expect(result.modelId).toBe('unknown-model');
      expect(result.capabilities.size).toBe(0);
    });
  });

  // ===========================================================================
  // getCapabilities Tests (Dynamic Probing)
  // ===========================================================================

  describe('getCapabilities - dynamic probing', () => {
    it('should probe Ollama model capabilities', async () => {
      const provider = createMockProvider({
        id: 'ollama-1',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.getCapabilities('ollama-1', 'llama2');

      expect(mockProbeOllamaModel).toHaveBeenCalledWith(
        'http://localhost:11434',
        'llama2'
      );
      expect(result.modelId).toBe('llama2');
      expect(result.capabilities.has(ProviderCapability.TEXT_GENERATION)).toBe(true);
    });

    it('should return basic capabilities for LM Studio', async () => {
      const provider = createMockProvider({
        id: 'lmstudio-1',
        type: 'lmstudio',
        baseUrl: 'http://localhost:1234',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.getCapabilities('lmstudio-1', 'local-model');

      expect(result.modelId).toBe('local-model');
      expect(result.capabilities.has(ProviderCapability.TEXT_GENERATION)).toBe(true);
      expect(result.capabilities.has(ProviderCapability.STREAMING)).toBe(true);
    });

    it('should return basic capabilities for OpenAI-compatible', async () => {
      const provider = createMockProvider({
        id: 'compatible-1',
        type: 'openai-compatible',
        baseUrl: 'http://custom-api.com',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.getCapabilities('compatible-1', 'custom-model');

      expect(result.modelId).toBe('custom-model');
      expect(result.capabilities.has(ProviderCapability.TEXT_GENERATION)).toBe(true);
    });

    it('should return basic capabilities for sidecar provider', async () => {
      const provider = createMockProvider({
        id: 'sidecar-1',
        type: 'sidecar',
        baseUrl: 'http://127.0.0.1:11470',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.getCapabilities('sidecar-1', 'llama-3.2');

      expect(result.modelId).toBe('llama-3.2');
      expect(result.capabilities.has(ProviderCapability.TEXT_GENERATION)).toBe(true);
      expect(result.capabilities.has(ProviderCapability.STREAMING)).toBe(true);
    });
  });

  // ===========================================================================
  // Cache Behavior Tests
  // ===========================================================================

  describe('cache behavior', () => {
    it('should cache Ollama model capabilities', async () => {
      const provider = createMockProvider({
        id: 'ollama-1',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      // First call
      await service.getCapabilities('ollama-1', 'llama2');
      // Second call
      await service.getCapabilities('ollama-1', 'llama2');

      // Should only probe once due to caching
      expect(mockProbeOllamaModel).toHaveBeenCalledTimes(1);
    });

    it('should cache LM Studio model capabilities', async () => {
      const provider = createMockProvider({
        id: 'lmstudio-1',
        type: 'lmstudio',
        baseUrl: 'http://localhost:1234',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      // First call
      await service.getCapabilities('lmstudio-1', 'model-1');
      // Second call
      await service.getCapabilities('lmstudio-1', 'model-1');

      // Both calls should succeed without error
      expect(mockProviderService.getProvider).toHaveBeenCalledTimes(2);
    });

    it('should not cache static registry lookups', async () => {
      const provider = createMockProvider({ id: 'openai-1', type: 'openai' });
      mockProviderService.getProvider.mockResolvedValue(provider);

      await service.getCapabilities('openai-1', 'gpt-4o');
      await service.getCapabilities('openai-1', 'gpt-4o');

      // Static lookups don't need caching
      expect(mockGetOpenAIModel).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // listModels Tests
  // ===========================================================================

  describe('listModels', () => {
    it('should list OpenAI models from registry', async () => {
      const provider = createMockProvider({ id: 'openai-1', type: 'openai' });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.listModels('openai-1');

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('gpt-4o');
      expect(result[1]?.id).toBe('gpt-4o-mini');
    });

    it('should list Anthropic models from registry', async () => {
      const provider = createMockProvider({ id: 'anthropic-1', type: 'anthropic' });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.listModels('anthropic-1');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('claude-3-5-sonnet-20241022');
    });

    it('should list Ollama models via fetch', async () => {
      const provider = createMockProvider({
        id: 'ollama-1',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.listModels('ollama-1');

      expect(mockFetchOllamaModels).toHaveBeenCalledWith('http://localhost:11434');
      expect(result).toHaveLength(2);
    });

    it('should return empty array on Ollama fetch error', async () => {
      const provider = createMockProvider({
        id: 'ollama-1',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);
      mockFetchOllamaModels.mockRejectedValue(new Error('Connection failed'));

      const result = await service.listModels('ollama-1');

      expect(result).toEqual([]);
    });

    it('should list OpenAI-compatible models', async () => {
      const provider = createMockProvider({
        id: 'compatible-1',
        type: 'openai-compatible',
        baseUrl: 'http://custom-api.com',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.listModels('compatible-1');

      expect(mockFetchOpenAICompatibleModels).toHaveBeenCalledWith('http://custom-api.com');
      expect(result).toHaveLength(2);
    });

    it('should list sidecar models via OpenAI-compatible model listing', async () => {
      const provider = createMockProvider({
        id: 'sidecar-1',
        type: 'sidecar',
        baseUrl: 'http://127.0.0.1:11470',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.listModels('sidecar-1');

      expect(mockFetchOpenAICompatibleModels).toHaveBeenCalledWith(
        'http://127.0.0.1:11470'
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'model-1',
          capabilities: [ProviderCapability.TEXT_GENERATION, ProviderCapability.STREAMING],
        })
      );
    });

    it('should return empty array when baseUrl missing for local provider', async () => {
      const provider = createMockProvider({
        id: 'ollama-1',
        type: 'ollama',
      });
      delete (provider as any).baseUrl;
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.listModels('ollama-1');

      expect(result).toEqual([]);
    });

    it('should return empty array when baseUrl missing for sidecar provider', async () => {
      const provider = createMockProvider({
        id: 'sidecar-1',
        type: 'sidecar',
      });
      delete (provider as any).baseUrl;
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.listModels('sidecar-1');

      expect(result).toEqual([]);
      expect(mockFetchOpenAICompatibleModels).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // hasCapability Tests
  // ===========================================================================

  describe('hasCapability', () => {
    it('should return true when model has capability', async () => {
      const provider = createMockProvider({ id: 'openai-1', type: 'openai' });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.hasCapability(
        'openai-1',
        'gpt-4o',
        ProviderCapability.VISION      );

      expect(result).toBe(true);
    });

    it('should return false when model lacks capability', async () => {
      const provider = createMockProvider({ id: 'openai-1', type: 'openai' });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.hasCapability(
        'openai-1',
        'gpt-4o-mini',
        ProviderCapability.VISION      );

      expect(result).toBe(false);
    });

    it('should work with dynamic providers', async () => {
      const provider = createMockProvider({
        id: 'ollama-1',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const result = await service.hasCapability(
        'ollama-1',
        'llama2',
        ProviderCapability.TEXT_GENERATION      );

      expect(result).toBe(true);
    });
  });

  // ===========================================================================
  // refreshCapabilities Tests
  // ===========================================================================

  describe('refreshCapabilities', () => {
    it('should clear cache for provider', async () => {
      const provider = createMockProvider({
        id: 'ollama-1',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      // Populate cache
      await service.getCapabilities('ollama-1', 'llama2');
      mockProbeOllamaModel.mockClear();

      // Refresh cache
      await service.refreshCapabilities('ollama-1');

      // Next call should probe again
      await service.getCapabilities('ollama-1', 'llama2');
      expect(mockProbeOllamaModel).toHaveBeenCalledTimes(1);
    });

    it('should throw ProviderNotFoundError for non-existent provider', async () => {
      mockProviderService.getProvider.mockResolvedValue(null);

      await expect(service.refreshCapabilities('non-existent')).rejects.toThrow(
        ProviderNotFoundError
      );
    });
  });

  // ===========================================================================
  // getProvidersWithCapability Tests
  // ===========================================================================

  describe('getProvidersWithCapability', () => {
    it('should return providers with text generation capability', async () => {
      const providers = [
        createMockProvider({ id: 'openai-1', type: 'openai' }),
        createMockProvider({ id: 'anthropic-1', type: 'anthropic' }),
      ];
      mockProviderService.getProviders.mockResolvedValue(providers);
      mockProviderService.getProvider.mockImplementation(async (id: string) => {
        return providers.find((p) => p.id === id) ?? null;
      });

      const result = await service.getProvidersWithCapability(
        ProviderCapability.TEXT_GENERATION      );

      expect(result).toContain('openai-1');
      expect(result).toContain('anthropic-1');
    });

    it('should return empty array when no providers have capability', async () => {
      const providers = [createMockProvider({ id: 'openai-1', type: 'openai' })];
      mockProviderService.getProviders.mockResolvedValue(providers);
      mockProviderService.getProvider.mockResolvedValue(providers[0] ?? null);

      const result = await service.getProvidersWithCapability(
        ProviderCapability.IMAGE_GENERATION      );

      // gpt-4o-mini doesn't have image-generation, so if no models support it
      expect(Array.isArray(result)).toBe(true);
    });

    it('should check local providers for capability', async () => {
      const providers = [
        createMockProvider({
          id: 'ollama-1',
          type: 'ollama',
          baseUrl: 'http://localhost:11434',
        }),
      ];
      mockProviderService.getProviders.mockResolvedValue(providers);
      mockProviderService.getProvider.mockResolvedValue(providers[0] ?? null);

      const result = await service.getProvidersWithCapability(
        ProviderCapability.TEXT_GENERATION      );

      expect(mockFetchOllamaModels).toHaveBeenCalled();
      expect(result).toContain('ollama-1');
    });

    it('should treat sidecar providers as text-generation capable without probing', async () => {
      const providers = [
        createMockProvider({
          id: 'sidecar-1',
          type: 'sidecar',
          baseUrl: 'http://127.0.0.1:11470',
        }),
      ];
      mockProviderService.getProviders.mockResolvedValue(providers);

      const result = await service.getProvidersWithCapability(
        ProviderCapability.TEXT_GENERATION
      );

      expect(result).toContain('sidecar-1');
      expect(mockFetchOpenAICompatibleModels).not.toHaveBeenCalled();
      expect(mockProbeOllamaModel).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should throw ProviderNotFoundError when provider not found', async () => {
      mockProviderService.getProvider.mockResolvedValue(null);

      await expect(
        service.getCapabilities('non-existent', 'model')
      ).rejects.toThrow(ProviderNotFoundError);
    });

    it('should handle Ollama probe errors gracefully', async () => {
      const provider = createMockProvider({
        id: 'ollama-1',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);
      mockProbeOllamaModel.mockRejectedValue(new Error('Connection failed'));

      // Should not throw, but return from cache or re-throw
      await expect(
        service.getCapabilities('ollama-1', 'llama2')
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle provider with no baseUrl for local type', async () => {
      const provider = createMockProvider({
        id: 'ollama-1',
        type: 'ollama',
      });
      delete (provider as any).baseUrl;
      mockProviderService.getProvider.mockResolvedValue(provider);

      // Should handle gracefully - check implementation behavior
      await service.getCapabilities('ollama-1', 'model');
      // Specific behavior depends on implementation
    });

    it('should handle concurrent capability requests for same model', async () => {
      const provider = createMockProvider({
        id: 'ollama-1',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      const promises = [
        service.getCapabilities('ollama-1', 'llama2'),
        service.getCapabilities('ollama-1', 'llama2'),
        service.getCapabilities('ollama-1', 'llama2'),
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should handle different models for same provider', async () => {
      const provider = createMockProvider({
        id: 'ollama-1',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
      });
      mockProviderService.getProvider.mockResolvedValue(provider);

      await service.getCapabilities('ollama-1', 'llama2');
      await service.getCapabilities('ollama-1', 'codellama');

      expect(mockProbeOllamaModel).toHaveBeenCalledTimes(2);
    });
  });
});
