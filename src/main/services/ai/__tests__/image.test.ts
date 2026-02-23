/**
 * Image Generation Module Tests
 *
 * Tests for performImageGeneration function.
 *
 * @module tests/unit/ai/image
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProviderConfig } from '@shared/ai/types';
import { ProviderCapability } from '@shared/ai/types';
import { CapabilityNotSupportedError, RateLimitError, AIProviderError } from '@shared/ai/errors';
import type { IUsageService } from '../usage-service';
import type { ProviderResolver, AlternateProvidersFn } from '../ai-types';

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('../ai-helpers', () => ({
  getDefaultImageModel: vi.fn((type: string) => (type === 'openai' ? 'dall-e-3' : undefined)),
  validateCapability: vi.fn(),
  extractRetryAfter: vi.fn(() => 60),
}));

import { performImageGeneration } from '../image';

// ============================================================================
// Fixtures
// ============================================================================

const mockProvider: ProviderConfig = {
  id: 'openai-1',
  displayName: 'OpenAI',
  type: 'openai',
  status: 'connected',
  capabilities: [ProviderCapability.IMAGE_GENERATION],
};

const mockUsageService: IUsageService = {
  recordUsage: vi.fn().mockResolvedValue(undefined),
  getUsageStats: vi.fn().mockResolvedValue({ totalRequests: 0 }),
  clearUsage: vi.fn().mockResolvedValue(undefined),
};

const createResolver = (provider = mockProvider, apiKey = 'sk-test'): ProviderResolver =>
  vi.fn().mockResolvedValue({ provider, apiKey });

const createAlternates = (): AlternateProvidersFn => vi.fn().mockResolvedValue([]);

// ============================================================================
// Tests
// ============================================================================

describe('performImageGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global fetch mock
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ url: 'https://example.com/img.png' }] }),
      })
    );
  });

  it('should generate an image with a prompt', async () => {
    const result = await performImageGeneration(
      { prompt: 'A sunset' },
      createResolver(),
      mockUsageService,
      createAlternates()
    );

    expect(result.imageUrl).toBe('https://example.com/img.png');
    expect(result.modelId).toBe('dall-e-3');
  });

  it('should throw CapabilityNotSupportedError for non-OpenAI providers', async () => {
    const anthropicProvider: ProviderConfig = {
      ...mockProvider,
      id: 'anthropic-1',
      type: 'anthropic',
    };

    await expect(
      performImageGeneration(
        { prompt: 'Test' },
        createResolver(anthropicProvider),
        mockUsageService,
        createAlternates()
      )
    ).rejects.toThrow(CapabilityNotSupportedError);
  });

  it('should pass size, quality, and style parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ url: 'https://example.com/img.png' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await performImageGeneration(
      { prompt: 'A cat', size: '512x512', quality: 'hd', style: 'natural' },
      createResolver(),
      mockUsageService,
      createAlternates()
    );

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(callBody.size).toBe('512x512');
    expect(callBody.quality).toBe('hd');
    expect(callBody.style).toBe('natural');
  });

  it('should use default values for optional parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ url: 'https://example.com/img.png' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await performImageGeneration(
      { prompt: 'A cat' },
      createResolver(),
      mockUsageService,
      createAlternates()
    );

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(callBody.size).toBe('1024x1024');
    expect(callBody.quality).toBe('standard');
    expect(callBody.style).toBe('vivid');
  });

  it('should record usage on success', async () => {
    await performImageGeneration(
      { prompt: 'Test' },
      createResolver(),
      mockUsageService,
      createAlternates()
    );

    expect(mockUsageService.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'openai-1',
        operationType: 'image-generation',
        success: true,
      })
    );
  });

  it('should not fail successful image generation when usage persistence fails', async () => {
    vi.mocked(mockUsageService.recordUsage).mockRejectedValueOnce(new Error('Usage store unavailable'));

    const result = await performImageGeneration(
      { prompt: 'Test' },
      createResolver(),
      mockUsageService,
      createAlternates()
    );

    expect(result.imageUrl).toBe('https://example.com/img.png');
  });

  it('should throw RateLimitError on 429 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '30' }),
        json: () => Promise.resolve({}),
      })
    );

    await expect(
      performImageGeneration(
        { prompt: 'Test' },
        createResolver(),
        mockUsageService,
        createAlternates()
      )
    ).rejects.toThrow(RateLimitError);
  });

  it('should retry once on transient 5xx transport failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { message: 'Temporary error' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ url: 'https://example.com/retried.png' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await performImageGeneration(
      { prompt: 'Retry me' },
      createResolver(),
      mockUsageService,
      createAlternates()
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.imageUrl).toBe('https://example.com/retried.png');
  });

  it('should retry once on retryable network transport errors', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ url: 'https://example.com/retry-network.png' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await performImageGeneration(
      { prompt: 'Retry me' },
      createResolver(),
      mockUsageService,
      createAlternates()
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.imageUrl).toBe('https://example.com/retry-network.png');
  });

  it('should preserve provider failure when failure-usage persistence fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { message: 'Server error' } }),
      })
    );
    vi.mocked(mockUsageService.recordUsage).mockRejectedValueOnce(new Error('Usage store unavailable'));

    await expect(
      performImageGeneration(
        { prompt: 'Test' },
        createResolver(),
        mockUsageService,
        createAlternates()
      )
    ).rejects.toThrow('Server error');
  });

  it('should throw AIProviderError on non-429 error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { message: 'Server error' } }),
      })
    );

    await expect(
      performImageGeneration(
        { prompt: 'Test' },
        createResolver(),
        mockUsageService,
        createAlternates()
      )
    ).rejects.toThrow(AIProviderError);
  });

  it('should handle base64 image responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ b64_json: 'base64data' }] }),
      })
    );

    const result = await performImageGeneration(
      { prompt: 'Test' },
      createResolver(),
      mockUsageService,
      createAlternates()
    );

    expect(result.imageBase64).toBe('base64data');
  });

  it('should ignore provider baseUrl overrides and pin OpenAI host', async () => {
    const customProvider: ProviderConfig = {
      ...mockProvider,
      baseUrl: 'https://custom-api.example.com',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ url: 'https://example.com/img.png' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await performImageGeneration(
      { prompt: 'Test' },
      createResolver(customProvider),
      mockUsageService,
      createAlternates()
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/images/generations',
      expect.any(Object)
    );
  });
});
