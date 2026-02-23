/**
 * Text Generation Module Tests
 *
 * Tests for performTextGeneration and performStreamText functions.
 *
 * @module tests/unit/ai/text-generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProviderConfig } from '@shared/ai/types';
import { ProviderCapability } from '@shared/ai/types';
import { RateLimitError, AIProviderError } from '@shared/ai/errors';
import type { IUsageService } from '../usage-service';
import type {
  TextGenerationRequest,
  ProviderResolver,
  ModelFactory,
  AlternateProvidersFn,
} from '../ai-types';

// ============================================================================
// Mock Setup
// ============================================================================

const mockGenerateText = vi.fn();
const mockStreamText = vi.fn();

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  streamText: (...args: unknown[]) => mockStreamText(...args),
}));

vi.mock('../ai-helpers', () => ({
  getDefaultModel: vi.fn(() => 'gpt-4o'),
  validateCapability: vi.fn(),
  isRateLimitError: vi.fn(() => false),
  extractRetryAfter: vi.fn(() => 60),
  wrapError: vi.fn(
    (error: unknown, provider: ProviderConfig) =>
      new AIProviderError(
        error instanceof Error ? error.message : String(error),
        'GENERATION_ERROR',
        provider.id
      )
  ),
}));

import { performTextGeneration, performStreamText } from '../text-generation';
import { isRateLimitError } from '../ai-helpers';

// ============================================================================
// Fixtures
// ============================================================================

const mockProvider: ProviderConfig = {
  id: 'test-provider',
  displayName: 'Test',
  type: 'openai',
  status: 'connected',
  capabilities: [ProviderCapability.TEXT_GENERATION, ProviderCapability.STREAMING],
};

const mockUsageService: IUsageService = {
  recordUsage: vi.fn().mockResolvedValue(undefined),
  getUsageStats: vi.fn().mockResolvedValue({ totalRequests: 0 }),
  clearUsage: vi.fn().mockResolvedValue(undefined),
};

const createResolver = (provider = mockProvider, apiKey = 'sk-test'): ProviderResolver =>
  vi.fn().mockResolvedValue({ provider, apiKey });

const createModelFactory = (): ModelFactory => vi.fn().mockReturnValue({ modelId: 'gpt-4o' });

const createAlternates = (): AlternateProvidersFn => vi.fn().mockResolvedValue(['alt-provider']);

// ============================================================================
// Tests
// ============================================================================

describe('performTextGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate text with a prompt', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Generated response',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });

    const request: TextGenerationRequest = { prompt: 'Hello' };
    const result = await performTextGeneration(
      request,
      createResolver(),
      createModelFactory(),
      mockUsageService,
      createAlternates()
    );

    expect(result.text).toBe('Generated response');
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(20);
    expect(result.modelId).toBe('gpt-4o');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should pass optional parameters to generateText', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Result',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
    });

    const request: TextGenerationRequest = {
      prompt: 'Test',
      maxTokens: 1000,
      temperature: 0.7,
      systemPrompt: 'Be helpful',
    };

    await performTextGeneration(
      request,
      createResolver(),
      createModelFactory(),
      mockUsageService,
      createAlternates()
    );

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Test',
        maxOutputTokens: 1000,
        temperature: 0.7,
        system: 'Be helpful',
      })
    );
  });

  it('should use specified modelId instead of default', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Result',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
    });

    const request: TextGenerationRequest = { prompt: 'Test', modelId: 'gpt-4' };
    const result = await performTextGeneration(
      request,
      createResolver(),
      createModelFactory(),
      mockUsageService,
      createAlternates()
    );

    expect(result.modelId).toBe('gpt-4');
  });

  it('should record usage on success', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Result',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
    });

    await performTextGeneration(
      { prompt: 'Test' },
      createResolver(),
      createModelFactory(),
      mockUsageService,
      createAlternates()
    );

    expect(mockUsageService.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'test-provider',
        operationType: 'text-generation',
        success: true,
      })
    );
  });

  it('should not fail successful generation when usage persistence fails', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Result',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
    });
    vi.mocked(mockUsageService.recordUsage).mockRejectedValueOnce(new Error('Usage store unavailable'));

    const result = await performTextGeneration(
      { prompt: 'Test' },
      createResolver(),
      createModelFactory(),
      mockUsageService,
      createAlternates()
    );

    expect(result.text).toBe('Result');
  });

  it('should record usage on failure and throw wrapped error', async () => {
    mockGenerateText.mockRejectedValue(new Error('API error'));

    await expect(
      performTextGeneration(
        { prompt: 'Test' },
        createResolver(),
        createModelFactory(),
        mockUsageService,
        createAlternates()
      )
    ).rejects.toThrow(AIProviderError);

    expect(mockUsageService.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
      })
    );
  });

  it('should throw RateLimitError when rate limited', async () => {
    const rateLimitErr = new Error('Rate limit exceeded: 429');
    mockGenerateText.mockRejectedValue(rateLimitErr);
    vi.mocked(isRateLimitError).mockReturnValueOnce(true);

    await expect(
      performTextGeneration(
        { prompt: 'Test' },
        createResolver(),
        createModelFactory(),
        mockUsageService,
        createAlternates()
      )
    ).rejects.toThrow(RateLimitError);
  });

  it('should handle null usage fields gracefully', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Result',
      usage: { inputTokens: null, outputTokens: null, totalTokens: null },
    });

    const result = await performTextGeneration(
      { prompt: 'Test' },
      createResolver(),
      createModelFactory(),
      mockUsageService,
      createAlternates()
    );

    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
    expect(result.usage.totalTokens).toBe(0);
  });
});

describe('performStreamText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a stream controller with abort and completion', async () => {
    const chunks = ['Hello', ' ', 'world'];
    const mockTextStream = (async function* () {
      for (const chunk of chunks) yield chunk;
    })();

    mockStreamText.mockReturnValue({
      textStream: mockTextStream,
      usage: Promise.resolve({ inputTokens: 5, outputTokens: 10, totalTokens: 15 }),
    });

    const onChunk = vi.fn();
    const controller = await performStreamText(
      { prompt: 'Test' },
      onChunk,
      createResolver(),
      createModelFactory(),
      mockUsageService,
      createAlternates()
    );

    expect(controller.abort).toBeInstanceOf(Function);
    expect(controller.completion).toBeInstanceOf(Promise);

    const result = await controller.completion;
    expect(result.text).toBe('Hello world');
    expect(onChunk).toHaveBeenCalledTimes(3);
  });

  it('should pass chunks to the onChunk callback', async () => {
    const chunks = ['a', 'b', 'c'];
    const mockTextStream = (async function* () {
      for (const chunk of chunks) yield chunk;
    })();

    mockStreamText.mockReturnValue({
      textStream: mockTextStream,
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 3, totalTokens: 4 }),
    });

    const onChunk = vi.fn();
    const controller = await performStreamText(
      { prompt: 'Test' },
      onChunk,
      createResolver(),
      createModelFactory(),
      mockUsageService,
      createAlternates()
    );

    await controller.completion;

    expect(onChunk).toHaveBeenCalledWith('a');
    expect(onChunk).toHaveBeenCalledWith('b');
    expect(onChunk).toHaveBeenCalledWith('c');
  });

  it('should not fail stream completion when usage persistence fails', async () => {
    const mockTextStream = (async function* () {
      yield 'chunk';
    })();

    mockStreamText.mockReturnValue({
      textStream: mockTextStream,
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 1, totalTokens: 2 }),
    });
    vi.mocked(mockUsageService.recordUsage).mockRejectedValueOnce(new Error('Usage store unavailable'));

    const controller = await performStreamText(
      { prompt: 'Test' },
      vi.fn(),
      createResolver(),
      createModelFactory(),
      mockUsageService,
      createAlternates()
    );

    await expect(controller.completion).resolves.toEqual(
      expect.objectContaining({
        text: 'chunk',
      })
    );
  });
});
