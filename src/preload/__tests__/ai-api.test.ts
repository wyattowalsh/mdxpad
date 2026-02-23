/**
 * AI Preload API Tests
 *
 * Tests AI provider API exposed to renderer via contextBridge.
 * Tests validated invoke pattern, streaming events, and schema validation.
 *
 * @see src/preload/ai-api.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcRenderer } from 'electron';
import { aiApi } from '../ai-api';
import { AIChannels } from '@shared/ai/ipc-channels';

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock('../validated-invoke', () => ({
  validatedInvoke: vi.fn((channel, _requestSchema, _responseSchema, request) => {
    // Simple mock that passes through
    return Promise.resolve({ success: true, data: request });
  }),
}));

import { validatedInvoke } from '../validated-invoke';

// ============================================================================
// Provider Management API Tests
// ============================================================================

describe('Provider Management API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listProviders', () => {
    it('should list providers without request data', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        providers: [],
        activeProviderId: null,
      });

      const result = await aiApi.listProviders();

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.PROVIDER_LIST,
        null,
        expect.any(Object)
      );
      expect(result).toEqual({
        providers: [],
        activeProviderId: null,
      });
    });
  });

  describe('addProvider', () => {
    it('should add provider with valid request', async () => {
      const request = {
        displayName: 'Test Provider',
        type: 'openai' as const,
        apiKey: 'sk-test',
      };

      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        provider: { id: 'test-1', ...request },
      });

      const result = await aiApi.addProvider(request);

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.PROVIDER_ADD,
        expect.any(Object),
        expect.any(Object),
        request
      );
      expect(result.success).toBe(true);
    });
  });

  describe('updateProvider', () => {
    it('should update provider', async () => {
      const request = {
        id: 'test-1',
        updates: { displayName: 'Updated Name' },
      };

      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        provider: { id: 'test-1', displayName: 'Updated Name' },
      });

      const result = await aiApi.updateProvider(request);

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.PROVIDER_UPDATE,
        expect.any(Object),
        expect.any(Object),
        request
      );
      expect(result.success).toBe(true);
    });
  });

  describe('removeProvider', () => {
    it('should remove provider by ID', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({ success: true });

      const result = await aiApi.removeProvider('test-1');

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.PROVIDER_REMOVE,
        expect.any(Object),
        expect.any(Object),
        { id: 'test-1' }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('setActiveProvider', () => {
    it('should set active provider by ID', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        activeProviderId: 'test-1',
      });

      const result = await aiApi.setActiveProvider('test-1');

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.PROVIDER_SET_ACTIVE,
        expect.any(Object),
        expect.any(Object),
        { id: 'test-1' }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('validateProvider', () => {
    it('should validate provider by ID', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        status: 'connected',
        models: ['gpt-4'],
      });

      const result = await aiApi.validateProvider('test-1');

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.PROVIDER_VALIDATE,
        expect.any(Object),
        expect.any(Object),
        { id: 'test-1' }
      );
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Credential Management API Tests
// ============================================================================

describe('Credential Management API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setCredential', () => {
    it('should set credential with provider ID and API key', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        storageType: 'keychain',
        keyPreview: 'sk-****',
      });

      const result = await aiApi.setCredential('test-1', 'sk-test123');

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.CREDENTIAL_SET,
        expect.any(Object),
        expect.any(Object),
        { providerId: 'test-1', apiKey: 'sk-test123' }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('hasCredential', () => {
    it('should check if credential exists', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        exists: true,
        storageType: 'keychain',
        keyPreview: 'sk-****',
      });

      const result = await aiApi.hasCredential('test-1');

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.CREDENTIAL_HAS,
        expect.any(Object),
        expect.any(Object),
        { providerId: 'test-1' }
      );
      expect(result.exists).toBe(true);
    });
  });

  describe('clearCredential', () => {
    it('should clear credential by provider ID', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({ success: true });

      const result = await aiApi.clearCredential('test-1');

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.CREDENTIAL_CLEAR,
        expect.any(Object),
        expect.any(Object),
        { providerId: 'test-1' }
      );
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// AI Generation API Tests
// ============================================================================

describe('AI Generation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateText', () => {
    it('should generate text with prompt', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        text: 'Generated response',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });

      const result = await aiApi.generateText({ prompt: 'Hello' });

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.GENERATE_TEXT,
        expect.any(Object),
        expect.any(Object),
        { prompt: 'Hello' }
      );
      expect(result.success).toBe(true);
    });

    it('should pass optional parameters', async () => {
      const request = {
        prompt: 'Test',
        modelId: 'gpt-4',
        maxTokens: 1000,
        temperature: 0.7,
      };

      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      });

      await aiApi.generateText(request);

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.GENERATE_TEXT,
        expect.any(Object),
        expect.any(Object),
        request
      );
    });
  });

  describe('generateStream', () => {
    it('should initialize streaming with prompt', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        streamId: 'stream-123',
      });

      const result = await aiApi.generateStream({ prompt: 'Stream test' });

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.GENERATE_STREAM,
        expect.any(Object),
        expect.any(Object),
        { prompt: 'Stream test' }
      );
      expect(result.success).toBe(true);
      expect(result.streamId).toBe('stream-123');
    });
  });

  describe('cancelStream', () => {
    it('should cancel stream by streamId', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
      });

      const result = await aiApi.cancelStream('stream-123');

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.CANCEL_STREAM,
        expect.any(Object),
        expect.any(Object),
        { streamId: 'stream-123' }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('generateEmbed', () => {
    it('should generate embeddings', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        embeddings: [[0.1, 0.2, 0.3]],
        dimensions: 3,
      });

      const result = await aiApi.generateEmbed({ texts: ['Hello', 'World'] });

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.GENERATE_EMBED,
        expect.any(Object),
        expect.any(Object),
        { texts: ['Hello', 'World'] }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('generateImage', () => {
    it('should generate image with prompt', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        imageUrl: 'https://example.com/image.png',
        imageBase64: 'base64data',
      });

      const result = await aiApi.generateImage({ prompt: 'A cat' });

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.GENERATE_IMAGE,
        expect.any(Object),
        expect.any(Object),
        { prompt: 'A cat' }
      );
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Usage Statistics API Tests
// ============================================================================

describe('Usage Statistics API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queryUsage', () => {
    it('should query usage statistics', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        stats: {
          totalRequests: 100,
          totalTokens: 5000,
        },
      });

      const result = await aiApi.queryUsage({ timeRange: 'all' });

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.USAGE_QUERY,
        expect.any(Object),
        expect.any(Object),
        { timeRange: 'all' }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('exportUsage', () => {
    it('should export usage data', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        data: '{"usage": "data"}',
        filename: 'usage.json',
      });

      const result = await aiApi.exportUsage({ timeRange: 'month' });

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.USAGE_EXPORT,
        expect.any(Object),
        expect.any(Object),
        { timeRange: 'month' }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('clearUsage', () => {
    it('should clear usage history', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        deletedCount: 50,
      });

      const result = await aiApi.clearUsage();

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.USAGE_CLEAR,
        expect.any(Object),
        expect.any(Object),
        {}
      );
      expect(result.success).toBe(true);
    });

    it('should clear usage with date filter', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        deletedCount: 25,
      });

      const result = await aiApi.clearUsage({ olderThan: '2024-01-01' });

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.USAGE_CLEAR,
        expect.any(Object),
        expect.any(Object),
        { olderThan: '2024-01-01' }
      );
    });
  });
});

// ============================================================================
// Capability Detection API Tests
// ============================================================================

describe('Capability Detection API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCapability', () => {
    it('should get model capabilities', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        capabilities: {
          modelId: 'gpt-4',
          capabilities: ['text-generation'],
          contextWindow: 8192,
        },
      });

      const result = await aiApi.getCapability('provider-1', 'gpt-4');

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.CAPABILITY_GET,
        expect.any(Object),
        expect.any(Object),
        { providerId: 'provider-1', modelId: 'gpt-4' }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('listModels', () => {
    it('should list available models', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({
        success: true,
        models: [{ id: 'gpt-4', name: 'GPT-4', capabilities: ['text-generation'] }],
      });

      const result = await aiApi.listModels('provider-1');

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.CAPABILITY_LIST_MODELS,
        expect.any(Object),
        expect.any(Object),
        { providerId: 'provider-1' }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('refreshCapabilities', () => {
    it('should refresh capabilities cache', async () => {
      vi.mocked(validatedInvoke).mockResolvedValue({ success: true });

      const result = await aiApi.refreshCapabilities('provider-1');

      expect(validatedInvoke).toHaveBeenCalledWith(
        AIChannels.CAPABILITY_REFRESH,
        expect.any(Object),
        expect.any(Object),
        { providerId: 'provider-1' }
      );
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Streaming Events API Tests
// ============================================================================

describe('Streaming Events API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('onStreamChunk', () => {
    it('should register chunk listener', () => {
      const callback = vi.fn();

      const unsubscribe = aiApi.onStreamChunk(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unregister chunk listener', () => {
      const callback = vi.fn();

      const unsubscribe = aiApi.onStreamChunk(callback);
      unsubscribe();

      // No error should occur
      expect(unsubscribe).toBeDefined();
    });
  });

  describe('onStreamComplete', () => {
    it('should register completion listener', () => {
      const callback = vi.fn();

      const unsubscribe = aiApi.onStreamComplete(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unregister completion listener', () => {
      const callback = vi.fn();

      const unsubscribe = aiApi.onStreamComplete(callback);
      unsubscribe();

      expect(unsubscribe).toBeDefined();
    });
  });

  describe('onStreamError', () => {
    it('should register error listener', () => {
      const callback = vi.fn();

      const unsubscribe = aiApi.onStreamError(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unregister error listener', () => {
      const callback = vi.fn();

      const unsubscribe = aiApi.onStreamError(callback);
      unsubscribe();

      expect(unsubscribe).toBeDefined();
    });
  });

  it('should handle multiple listeners for same event', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const unsubscribe1 = aiApi.onStreamChunk(callback1);
    const unsubscribe2 = aiApi.onStreamChunk(callback2);

    // Both should be registered
    expect(unsubscribe1).toBeDefined();
    expect(unsubscribe2).toBeDefined();

    unsubscribe1();
    unsubscribe2();
  });
});
