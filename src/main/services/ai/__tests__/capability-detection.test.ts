/**
 * Capability Detection Tests
 *
 * Tests for CapabilityCache, probeOllamaModel, fetchOllamaModels,
 * fetchOpenAICompatibleModels, and conversion utilities.
 *
 * @module tests/unit/ai/capability-detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ProviderCapability } from '@shared/ai/types';

import {
  CapabilityCache,
  probeOllamaModel,
  fetchOllamaModels,
  fetchOpenAICompatibleModels,
  createEmptyCapabilities,
  createBasicTextCapabilities,
  registryEntryToCapabilities,
  registryEntryToModelInfo,
  capabilitiesToModelInfo,
} from '../capability-detection';

// ============================================================================
// Tests
// ============================================================================

describe('CapabilityCache', () => {
  let cache: CapabilityCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new CapabilityCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null for missing provider', () => {
    expect(cache.get('unknown', 'model-1')).toBeNull();
  });

  it('should store and retrieve capabilities', () => {
    const caps = {
      modelId: 'gpt-4',
      capabilities: new Set<ProviderCapability>([ProviderCapability.TEXT_GENERATION]),
    };
    cache.set('openai', 'gpt-4', caps);

    const result = cache.get('openai', 'gpt-4');
    expect(result).toEqual(caps);
  });

  it('should return null for missing model within provider', () => {
    cache.set('openai', 'gpt-4', {
      modelId: 'gpt-4',
      capabilities: new Set(),
    });

    expect(cache.get('openai', 'gpt-3.5')).toBeNull();
  });

  it('should expire entries after TTL', () => {
    cache.set('openai', 'gpt-4', {
      modelId: 'gpt-4',
      capabilities: new Set(),
    });

    // Advance past 5-minute TTL
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(cache.get('openai', 'gpt-4')).toBeNull();
  });

  it('should delete provider entries', () => {
    cache.set('openai', 'gpt-4', {
      modelId: 'gpt-4',
      capabilities: new Set(),
    });

    cache.delete('openai');
    expect(cache.get('openai', 'gpt-4')).toBeNull();
  });

  it('should evict expired entries every 10 writes', () => {
    // Set entry that will expire
    cache.set('old-provider', 'model', {
      modelId: 'model',
      capabilities: new Set(),
    });

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    // Do 10 writes to trigger eviction
    for (let i = 0; i < 10; i++) {
      cache.set('new-provider', `model-${i}`, {
        modelId: `model-${i}`,
        capabilities: new Set(),
      });
    }

    // Old provider should be evicted
    expect(cache.get('old-provider', 'model')).toBeNull();
  });
});

describe('probeOllamaModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse capabilities from Ollama show response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            capabilities: ['completion', 'vision', 'embedding', 'tools'],
            model_info: { context_length: 4096 },
          }),
      })
    );

    const result = await probeOllamaModel('http://localhost:11434', 'llama3');

    expect(result.modelId).toBe('llama3');
    expect(result.capabilities.has(ProviderCapability.TEXT_GENERATION)).toBe(true);
    expect(result.capabilities.has(ProviderCapability.VISION)).toBe(true);
    expect(result.capabilities.has(ProviderCapability.EMBEDDINGS)).toBe(true);
    expect(result.capabilities.has(ProviderCapability.TOOL_USE)).toBe(true);
    expect(result.contextWindow).toBe(4096);
  });

  it('should return basic text capabilities on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await probeOllamaModel('http://localhost:11434', 'unknown');

    expect(result.modelId).toBe('unknown');
    expect(result.capabilities.has(ProviderCapability.TEXT_GENERATION)).toBe(true);
    expect(result.capabilities.has(ProviderCapability.STREAMING)).toBe(true);
  });

  it('should return basic text capabilities on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    const result = await probeOllamaModel('http://localhost:11434', 'model');

    expect(result.capabilities.has(ProviderCapability.TEXT_GENERATION)).toBe(true);
  });

  it('should default to text-generation when no capabilities returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })
    );

    const result = await probeOllamaModel('http://localhost:11434', 'basic-model');

    expect(result.capabilities.has(ProviderCapability.TEXT_GENERATION)).toBe(true);
    expect(result.capabilities.has(ProviderCapability.STREAMING)).toBe(true);
  });
});

describe('fetchOllamaModels', () => {
  it('should return model names from tags response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            models: [{ name: 'llama3' }, { name: 'mistral' }],
          }),
      })
    );

    const models = await fetchOllamaModels('http://localhost:11434');

    expect(models).toEqual(['llama3', 'mistral']);
  });

  it('should return empty array on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const models = await fetchOllamaModels('http://localhost:11434');

    expect(models).toEqual([]);
  });
});

describe('fetchOpenAICompatibleModels', () => {
  it('should return model IDs from OpenAI-format response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ id: 'model-a' }, { id: 'model-b' }],
          }),
      })
    );

    const models = await fetchOpenAICompatibleModels('http://localhost:1234');

    expect(models).toEqual(['model-a', 'model-b']);
  });

  it('should return empty array on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const models = await fetchOpenAICompatibleModels('http://localhost:1234');

    expect(models).toEqual([]);
  });
});

describe('capability factories', () => {
  it('createEmptyCapabilities should return empty set', () => {
    const caps = createEmptyCapabilities('test-model');

    expect(caps.modelId).toBe('test-model');
    expect(caps.capabilities.size).toBe(0);
  });

  it('createBasicTextCapabilities should include text-generation and streaming', () => {
    const caps = createBasicTextCapabilities('test-model');

    expect(caps.modelId).toBe('test-model');
    expect(caps.capabilities.has(ProviderCapability.TEXT_GENERATION)).toBe(true);
    expect(caps.capabilities.has(ProviderCapability.STREAMING)).toBe(true);
    expect(caps.detectedAt).toBeDefined();
  });
});

describe('conversion utilities', () => {
  describe('registryEntryToCapabilities', () => {
    it('should convert registry entry to ModelCapabilities', () => {
      const entry = {
        id: 'gpt-4o',
        name: 'GPT-4o',
        capabilities: ['text-generation' as const, 'vision' as const],
        contextWindow: 128000,
        maxOutputTokens: 16384,
      };

      const result = registryEntryToCapabilities(entry);

      expect(result.modelId).toBe('gpt-4o');
      expect(result.capabilities.has(ProviderCapability.TEXT_GENERATION)).toBe(true);
      expect(result.capabilities.has(ProviderCapability.VISION)).toBe(true);
      expect(result.contextWindow).toBe(128000);
      expect(result.maxOutputTokens).toBe(16384);
    });

    it('should handle embedding dimensions', () => {
      const entry = {
        id: 'text-embedding-3-small',
        name: 'Embedding Small',
        capabilities: ['embeddings' as const],
        embeddingDimensions: 1536,
      };

      const result = registryEntryToCapabilities(entry);

      expect(result.constraints?.embeddingDimensions).toBe(1536);
    });
  });

  describe('registryEntryToModelInfo', () => {
    it('should convert registry entry to ModelInfo', () => {
      const entry = {
        id: 'gpt-4o',
        name: 'GPT-4o',
        capabilities: ['text-generation' as const],
        contextWindow: 128000,
        maxOutputTokens: 16384,
      };

      const result = registryEntryToModelInfo(entry);

      expect(result.id).toBe('gpt-4o');
      expect(result.name).toBe('GPT-4o');
      expect(result.capabilities).toEqual(['text-generation']);
      expect(result.contextWindow).toBe(128000);
    });
  });

  describe('capabilitiesToModelInfo', () => {
    it('should convert ModelCapabilities to ModelInfo', () => {
      const caps = {
        modelId: 'llama3',
        capabilities: new Set<ProviderCapability>([ProviderCapability.TEXT_GENERATION]),
        contextWindow: 8192,
      };

      const result = capabilitiesToModelInfo(caps, 'Llama 3');

      expect(result.id).toBe('llama3');
      expect(result.name).toBe('Llama 3');
      expect(result.capabilities).toEqual(['text-generation']);
      expect(result.contextWindow).toBe(8192);
    });
  });
});
