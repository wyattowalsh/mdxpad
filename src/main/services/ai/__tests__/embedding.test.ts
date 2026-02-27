/**
 * Embedding Module Tests
 *
 * Tests for performEmbedding function.
 *
 * @module tests/unit/ai/embedding
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProviderConfig } from '@shared/ai/types';
import { ProviderCapability } from '@shared/ai/types';
import { CapabilityNotSupportedError, AIProviderError } from '@shared/ai/errors';
import type { IUsageService } from '../usage-service';
import type { ProviderResolver } from '../ai-types';
import type { EmbeddingModelFactory } from '../embedding';

// ============================================================================
// Mock Setup
// ============================================================================

const mockEmbedMany = vi.fn();

vi.mock('ai', () => ({
  embedMany: (...args: unknown[]) => mockEmbedMany(...args),
}));

vi.mock('../ai-helpers', () => ({
  getDefaultEmbeddingModel: vi.fn((type: string) =>
    type === 'openai' ? 'text-embedding-3-small' : undefined
  ),
  validateCapability: vi.fn(),
  wrapError: vi.fn(
    (error: unknown, provider: ProviderConfig) =>
      new AIProviderError(
        error instanceof Error ? error.message : String(error),
        'GENERATION_ERROR',
        provider.id
      )
  ),
}));

import { performEmbedding } from '../embedding';

// ============================================================================
// Fixtures
// ============================================================================

const mockProvider = {
  id: 'test-provider',
  displayName: 'Test',
  type: 'openai',
  status: 'connected',
} as unknown as ProviderConfig;

const mockUsageService = {
  recordUsage: vi.fn().mockResolvedValue(undefined),
  getUsageStats: vi.fn().mockResolvedValue({ totalRequests: 0 }),
  clearUsage: vi.fn().mockResolvedValue(undefined),
} as unknown as IUsageService;

const createResolver = (provider = mockProvider, apiKey = 'sk-test'): ProviderResolver =>
  vi.fn().mockResolvedValue({ provider, apiKey });

const createModelFactory = (): EmbeddingModelFactory =>
  vi.fn().mockReturnValue({ modelId: 'text-embedding-3-small' });

// ============================================================================
// Tests
// ============================================================================

describe('performEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate embeddings for input texts', async () => {
    mockEmbedMany.mockResolvedValue({
      embeddings: [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ],
    });

    const result = await performEmbedding(
      { texts: ['Hello', 'World'] },
      createResolver(),
      createModelFactory(),
      mockUsageService
    );

    expect(result.embeddings).toHaveLength(2);
    expect(result.dimensions).toBe(3);
    expect(result.modelId).toBe('text-embedding-3-small');
  });

  it('should use specified modelId over default', async () => {
    mockEmbedMany.mockResolvedValue({
      embeddings: [[0.1, 0.2]],
    });

    const result = await performEmbedding(
      { texts: ['Test'], modelId: 'text-embedding-3-large' },
      createResolver(),
      createModelFactory(),
      mockUsageService
    );

    expect(result.modelId).toBe('text-embedding-3-large');
  });

  it('should throw CapabilityNotSupportedError when provider has no embedding model', async () => {
    const anthropicProvider: ProviderConfig = {
      ...mockProvider,
      id: 'anthropic-1',
      type: 'anthropic',
    };

    await expect(
      performEmbedding(
        { texts: ['Test'] },
        createResolver(anthropicProvider),
        createModelFactory(),
        mockUsageService
      )
    ).rejects.toThrow(CapabilityNotSupportedError);
  });

  it('should record usage on success', async () => {
    mockEmbedMany.mockResolvedValue({
      embeddings: [[0.1, 0.2, 0.3]],
    });

    await performEmbedding(
      { texts: ['Test'] },
      createResolver(),
      createModelFactory(),
      mockUsageService
    );

    expect(mockUsageService.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'test-provider',
        operationType: 'embedding',
        success: true,
      })
    );
  });

  it('should not fail successful embedding when usage persistence fails', async () => {
    mockEmbedMany.mockResolvedValue({
      embeddings: [[0.1, 0.2, 0.3]],
    });
    vi.mocked(mockUsageService.recordUsage).mockRejectedValueOnce(
      new Error('Usage store unavailable')
    );

    const result = await performEmbedding(
      { texts: ['Test'] },
      createResolver(),
      createModelFactory(),
      mockUsageService
    );

    expect(result.embeddings).toEqual([[0.1, 0.2, 0.3]]);
  });

  it('should record usage on failure and rethrow', async () => {
    mockEmbedMany.mockRejectedValue(new Error('API error'));

    await expect(
      performEmbedding(
        { texts: ['Test'] },
        createResolver(),
        createModelFactory(),
        mockUsageService
      )
    ).rejects.toThrow(AIProviderError);

    expect(mockUsageService.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
      })
    );
  });

  it('should preserve original embedding failure when usage persistence fails', async () => {
    mockEmbedMany.mockRejectedValue(new Error('API error'));
    vi.mocked(mockUsageService.recordUsage).mockRejectedValueOnce(
      new Error('Usage store unavailable')
    );

    await expect(
      performEmbedding(
        { texts: ['Test'] },
        createResolver(),
        createModelFactory(),
        mockUsageService
      )
    ).rejects.toThrow('API error');
  });

  it('should handle empty embeddings result', async () => {
    mockEmbedMany.mockResolvedValue({
      embeddings: [],
    });

    const result = await performEmbedding(
      { texts: [] },
      createResolver(),
      createModelFactory(),
      mockUsageService
    );

    expect(result.embeddings).toHaveLength(0);
    expect(result.dimensions).toBe(0);
  });
});
