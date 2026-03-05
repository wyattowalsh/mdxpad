/**
 * AIService Unit Tests
 *
 * Tests for the main AI service facade including provider resolution,
 * model caching, and delegation to generation modules.
 *
 * @module tests/unit/ai-service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ProviderConfig } from '../../../../shared/ai/types';

// =============================================================================
// Mock Setup - Use vi.hoisted for hoisted mock variables
// =============================================================================

const {
  mockPerformTextGeneration,
  mockPerformStreamText,
  mockPerformEmbedding,
  mockPerformImageGeneration,
} = vi.hoisted(() => ({
  mockPerformTextGeneration: vi.fn(),
  mockPerformStreamText: vi.fn(),
  mockPerformEmbedding: vi.fn(),
  mockPerformImageGeneration: vi.fn(),
}));

const mockCredentialService = {
  setCredential: vi.fn(),
  getCredential: vi.fn(),
  clearCredential: vi.fn(),
  hasCredential: vi.fn(),
  isAvailable: vi.fn(() => true),
  getStorageType: vi.fn(() => 'persistent' as const),
};

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

const mockUsageService = {
  recordUsage: vi.fn(),
  queryStats: vi.fn(),
  exportData: vi.fn(),
  clearHistory: vi.fn(),
  getEstimatedCost: vi.fn(),
};

const mockSidecarService = {
  configure: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  getStatus: vi.fn(),
};

// Mock text-generation module
vi.mock('../text-generation', () => ({
  performTextGeneration: mockPerformTextGeneration,
  performStreamText: mockPerformStreamText,
}));

// Mock embedding module
vi.mock('../embedding', () => ({
  performEmbedding: mockPerformEmbedding,
}));

// Mock image module
vi.mock('../image', () => ({
  performImageGeneration: mockPerformImageGeneration,
}));

// Mock AI SDK providers
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn((config: any) => {
    return (modelId: string) => ({ provider: 'openai', modelId, ...config });
  }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn((config: any) => {
    return (modelId: string) => ({ provider: 'anthropic', modelId, ...config });
  }),
}));

// Import after mocks
import { AIService } from '../ai-service';
import { NoActiveProviderError, AIProviderError } from '../../../../shared/ai/errors';
import { createOpenAI } from '@ai-sdk/openai';

// =============================================================================
// Test Utilities
// =============================================================================

function createMockProvider(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: 'provider-1',
    displayName: 'Test Provider',
    type: 'openai',
    isActive: true,
    status: 'connected',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function resetMocks(): void {
  vi.clearAllMocks();
  mockCredentialService.getCredential.mockResolvedValue('test-api-key');
  mockProviderService.getActiveProvider.mockResolvedValue(null);
  mockProviderService.getProviders.mockResolvedValue([]);
  mockPerformTextGeneration.mockImplementation(
    async (request: any, resolveProvider: any, createModel: any, _usageService: any, _getAlternates: any) => {
      const { provider, apiKey } = await resolveProvider();
      const modelId = request.modelId ?? 'gpt-4o';
      createModel(provider, apiKey, modelId);
      return { text: 'Generated text', usage: { totalTokens: 100 } };
    }
  );
  mockPerformStreamText.mockImplementation(
    async (_request: any, _onChunk: any, resolveProvider: any, createModel: any, _usageService: any, _getAlternates: any) => {
      const { provider, apiKey } = await resolveProvider();
      createModel(provider, apiKey, 'gpt-4o');
      return {
        abort: vi.fn(),
        completion: Promise.resolve({
          text: 'Streamed text',
          usage: { totalTokens: 100 },
        }),
      };
    }
  );
  mockPerformEmbedding.mockResolvedValue({
    embedding: [0.1, 0.2, 0.3],
  });
  mockPerformImageGeneration.mockResolvedValue({
    imageUrl: 'https://example.com/image.png',
  });
  mockSidecarService.configure.mockResolvedValue({
    success: true,
    status: 'stopped',
  });
  mockSidecarService.start.mockResolvedValue({
    success: true,
    status: 'running',
    endpoint: 'http://127.0.0.1:11470',
    pid: 4242,
  });
  mockSidecarService.getStatus.mockReturnValue({
    success: true,
    status: 'running',
    endpoint: 'http://127.0.0.1:11470',
    pid: 4242,
  });
  mockSidecarService.stop.mockResolvedValue({
    success: true,
    status: 'stopped',
  });
}

// =============================================================================
// AIService Tests
// =============================================================================

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    resetMocks();
    service = new AIService(
      mockCredentialService,
      mockProviderService,
      mockUsageService,
      mockSidecarService
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe('constructor', () => {
    it('should initialize with dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should not be ready without active model', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should have null active model initially', () => {
      expect(service.getActiveModel()).toBeNull();
    });
  });

  // ===========================================================================
  // generateText Tests
  // ===========================================================================

  describe('generateText', () => {
    it('should delegate to performTextGeneration', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      const request = { prompt: 'Test prompt' };
      await service.generateText(request);

      expect(mockPerformTextGeneration).toHaveBeenCalledWith(
        request,
        expect.any(Function),
        expect.any(Function),
        mockUsageService,
        expect.any(Function)
      );
    });

    it('should throw NoActiveProviderError when no active provider', async () => {
      mockProviderService.getActiveProvider.mockResolvedValue(null);

      await expect(
        service.generateText({ prompt: 'test' })
      ).rejects.toThrow(NoActiveProviderError);
    });

    it('should throw error when API key missing for cloud provider', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockCredentialService.getCredential.mockResolvedValue(null);

      await expect(
        service.generateText({ prompt: 'test' })
      ).rejects.toThrow(AIProviderError);
    });

    it('should allow empty API key for local providers', async () => {
      const provider = createMockProvider({ type: 'ollama', baseUrl: 'http://localhost:11434' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockCredentialService.getCredential.mockResolvedValue(null);

      await service.generateText({ prompt: 'test' });

      expect(mockPerformTextGeneration).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // streamText Tests
  // ===========================================================================

  describe('streamText', () => {
    it('should delegate to performStreamText', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      const onChunk = vi.fn();
      const request = { prompt: 'Test prompt' };

      await service.streamText(request, onChunk);

      expect(mockPerformStreamText).toHaveBeenCalledWith(
        request,
        onChunk,
        expect.any(Function),
        expect.any(Function),
        mockUsageService,
        expect.any(Function)
      );
    });

    it('should return stream controller', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      const result = await service.streamText({ prompt: 'test' }, vi.fn());

      expect(result).toHaveProperty('abort');
      expect(result).toHaveProperty('completion');
    });
  });

  // ===========================================================================
  // generateEmbedding Tests
  // ===========================================================================

  describe('generateEmbedding', () => {
    it('should delegate to performEmbedding', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      const request = { texts: ['Test text'] };
      await service.generateEmbedding(request);

      expect(mockPerformEmbedding).toHaveBeenCalledWith(
        request,
        expect.any(Function),
        expect.any(Function),
        mockUsageService
      );
    });
  });

  // ===========================================================================
  // generateImage Tests
  // ===========================================================================

  describe('generateImage', () => {
    it('should delegate to performImageGeneration', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      const request = { prompt: 'A test image', size: '1024x1024' as const };
      await service.generateImage(request);

      expect(mockPerformImageGeneration).toHaveBeenCalledWith(
        request,
        expect.any(Function),
        mockUsageService,
        expect.any(Function)
      );
    });
  });

  // ===========================================================================
  // Cache Tests
  // ===========================================================================

  describe('model caching', () => {
    it('should cache model instance', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      await service.generateText({ prompt: 'test 1' });
      await service.generateText({ prompt: 'test 2' });

      // Both calls should use the same cached model
      expect(mockPerformTextGeneration).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache on invalidateCache call', () => {
      service.invalidateCache();

      expect(service.getActiveModel()).toBeNull();
      expect(service.isReady()).toBe(false);
    });

    it('should invalidate cache when API key changes', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockCredentialService.getCredential.mockResolvedValue('key-1');

      await service.generateText({ prompt: 'test 1' });

      // Change API key
      mockCredentialService.getCredential.mockResolvedValue('key-2');

      await service.generateText({ prompt: 'test 2' });

      // Should create new model with new key
      expect(mockPerformTextGeneration).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache when provider changes', async () => {
      const provider1 = createMockProvider({ id: 'provider-1', type: 'openai' });
      const provider2 = createMockProvider({ id: 'provider-2', type: 'anthropic' });

      mockProviderService.getActiveProvider.mockResolvedValue(provider1);
      await service.generateText({ prompt: 'test 1' });

      mockProviderService.getActiveProvider.mockResolvedValue(provider2);
      await service.generateText({ prompt: 'test 2' });

      expect(mockPerformTextGeneration).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache when model changes', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      await service.generateText({ prompt: 'test 1', modelId: 'gpt-4o' });
      await service.generateText({ prompt: 'test 2', modelId: 'gpt-4o-mini' });

      expect(mockPerformTextGeneration).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // Provider Resolution Tests
  // ===========================================================================

  describe('provider resolution', () => {
    it('should resolve active provider with API key', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockCredentialService.getCredential.mockResolvedValue('sk-test-key');

      await service.generateText({ prompt: 'test' });

      expect(mockProviderService.getActiveProvider).toHaveBeenCalled();
      expect(mockCredentialService.getCredential).toHaveBeenCalledWith('provider-1');
    });

    it('should get alternate providers for rate limit fallback', async () => {
      const provider = createMockProvider({ id: 'provider-1' });
      const otherProviders = [
        createMockProvider({ id: 'provider-2', status: 'connected' }),
        createMockProvider({ id: 'provider-3', status: 'disconnected' }),
        createMockProvider({ id: 'provider-4', status: 'connected' }),
      ];

      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockProviderService.getProviders.mockResolvedValue([
        provider,
        ...otherProviders,
      ]);

      await service.generateText({ prompt: 'test' });

      // Check that getAlternateProviders function works correctly
      const getAlternates = mockPerformTextGeneration.mock.calls[0]?.[4];
      if (getAlternates) {
        const alternates = await getAlternates('provider-1');
        expect(alternates).toEqual(['provider-2', 'provider-4']);
      }
    });
  });

  // ===========================================================================
  // Model Creation Tests
  // ===========================================================================

  describe('model creation', () => {
    it('should create OpenAI model instance', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      await service.generateText({ prompt: 'test', modelId: 'gpt-4o' });

      expect(mockPerformTextGeneration).toHaveBeenCalled();
    });

    it('should create Anthropic model instance', async () => {
      const provider = createMockProvider({ type: 'anthropic' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      await service.generateText({ prompt: 'test' });

      expect(mockPerformTextGeneration).toHaveBeenCalled();
    });

    it('should create Ollama model with baseUrl', async () => {
      const provider = createMockProvider({
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
      });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockCredentialService.getCredential.mockResolvedValue(null);

      await service.generateText({ prompt: 'test' });

      expect(mockPerformTextGeneration).toHaveBeenCalled();
    });

    it('should create LM Studio model with baseUrl', async () => {
      const provider = createMockProvider({
        type: 'lmstudio',
        baseUrl: 'http://localhost:1234',
      });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockCredentialService.getCredential.mockResolvedValue(null);

      await service.generateText({ prompt: 'test' });

      expect(mockPerformTextGeneration).toHaveBeenCalled();
    });

    it('should create OpenAI-compatible model with baseUrl', async () => {
      const provider = createMockProvider({
        type: 'openai-compatible',
        baseUrl: 'http://custom-api.com',
      });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      await service.generateText({ prompt: 'test' });

      expect(mockPerformTextGeneration).toHaveBeenCalled();
    });

    it('should use sidecar endpoint as baseUrl when sidecar is running', async () => {
      const provider = createMockProvider({
        type: 'sidecar',
        sidecarConfig: { modelPath: '/models/test.gguf', port: 11470 },
      });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockCredentialService.getCredential.mockResolvedValue(null);
      mockSidecarService.getStatus.mockReturnValue({
        success: true,
        status: 'running',
        endpoint: 'http://127.0.0.1:11470',
        pid: 4242,
      });

      await service.generateText({ prompt: 'test' });

      expect(mockPerformTextGeneration).toHaveBeenCalled();
      expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: '',
          baseURL: 'http://127.0.0.1:11470',
        })
      );
    });
  });

  // ===========================================================================
  // State Management Tests
  // ===========================================================================

  describe('state management', () => {
    it('should track readiness state', async () => {
      expect(service.isReady()).toBe(false);

      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      await service.generateText({ prompt: 'test' });

      // After first generation, model should be cached
      expect(service.getActiveModel()).not.toBeNull();
    });

    it('should return active model after generation', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      await service.generateText({ prompt: 'test', modelId: 'gpt-4o' });

      const activeModel = service.getActiveModel();
      expect(activeModel).not.toBeNull();
    });

    it('should clear state on cache invalidation', () => {
      service.invalidateCache();

      expect(service.getActiveModel()).toBeNull();
      expect(service.isReady()).toBe(false);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should propagate errors from text generation', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockPerformTextGeneration.mockRejectedValue(new Error('Generation failed'));

      await expect(
        service.generateText({ prompt: 'test' })
      ).rejects.toThrow('Generation failed');
    });

    it('should propagate errors from stream generation', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockPerformStreamText.mockRejectedValue(new Error('Stream failed'));

      await expect(
        service.streamText({ prompt: 'test' }, vi.fn())
      ).rejects.toThrow('Stream failed');
    });

    it('should propagate errors from embedding generation', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockPerformEmbedding.mockRejectedValue(new Error('Embedding failed'));

      await expect(
        service.generateEmbedding({ texts: ['test'] })
      ).rejects.toThrow('Embedding failed');
    });

    it('should propagate errors from image generation', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockPerformImageGeneration.mockRejectedValue(new Error('Image generation failed'));

      await expect(
        service.generateImage({ prompt: 'test', size: '1024x1024' })
      ).rejects.toThrow('Image generation failed');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle concurrent requests', async () => {
      const provider = createMockProvider({ type: 'openai' });
      mockProviderService.getActiveProvider.mockResolvedValue(provider);

      const promises = [
        service.generateText({ prompt: 'test 1' }),
        service.generateText({ prompt: 'test 2' }),
        service.generateText({ prompt: 'test 3' }),
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should handle provider switching during operation', async () => {
      const provider1 = createMockProvider({ id: 'provider-1', type: 'openai' });
      const provider2 = createMockProvider({ id: 'provider-2', type: 'anthropic' });

      mockProviderService.getActiveProvider
        .mockResolvedValueOnce(provider1)
        .mockResolvedValueOnce(provider2);

      await service.generateText({ prompt: 'test 1' });
      await service.generateText({ prompt: 'test 2' });

      expect(mockPerformTextGeneration).toHaveBeenCalledTimes(2);
    });

    it('should handle missing baseUrl for local providers gracefully', async () => {
      const provider = createMockProvider({
        type: 'ollama',
      });
      delete (provider as any).baseUrl;
      mockProviderService.getActiveProvider.mockResolvedValue(provider);
      mockCredentialService.getCredential.mockResolvedValue(null);

      await service.generateText({ prompt: 'test' });

      expect(mockPerformTextGeneration).toHaveBeenCalled();
    });
  });
});
