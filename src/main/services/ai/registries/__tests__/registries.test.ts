/**
 * AI Model Registry Tests
 *
 * Tests for Anthropic and OpenAI model registries.
 *
 * @module tests/unit/ai/registries
 */

import { describe, it, expect } from 'vitest';
import { ProviderCapability } from '@shared/ai/types';

import {
  getAnthropicModels,
  getAnthropicModel,
  isAnthropicModel,
  getAnthropicModelsByCapability,
  getAnthropicChatModels,
  getAnthropicVisionModels,
  getAnthropicToolUseModels,
} from '../anthropic-registry';

import {
  getOpenAIModels,
  getOpenAIModel,
  isOpenAIModel,
  getOpenAIModelsByCapability,
  getOpenAIChatModels,
  getOpenAIEmbeddingModels,
  getOpenAIImageModels,
} from '../openai-registry';

// ============================================================================
// Anthropic Registry Tests
// ============================================================================

describe('Anthropic Registry', () => {
  describe('getAnthropicModels', () => {
    it('should return all registered models', () => {
      const models = getAnthropicModels();
      expect(models.length).toBeGreaterThan(0);
    });

    it('should return a copy (not the original array)', () => {
      const models1 = getAnthropicModels();
      const models2 = getAnthropicModels();
      expect(models1).not.toBe(models2);
      expect(models1).toEqual(models2);
    });

    it('should include Claude 4.5 models', () => {
      const models = getAnthropicModels();
      const names = models.map((m) => m.name);
      expect(names).toContain('Claude Opus 4.5');
      expect(names).toContain('Claude Sonnet 4.5');
    });
  });

  describe('getAnthropicModel', () => {
    it('should return model by ID', () => {
      const model = getAnthropicModel('claude-opus-4-5-20251101');
      expect(model).toBeDefined();
      expect(model?.name).toBe('Claude Opus 4.5');
    });

    it('should return undefined for unknown model ID', () => {
      const model = getAnthropicModel('nonexistent-model');
      expect(model).toBeUndefined();
    });
  });

  describe('isAnthropicModel', () => {
    it('should return true for known models', () => {
      expect(isAnthropicModel('claude-3-5-sonnet-20241022')).toBe(true);
    });

    it('should return false for unknown models', () => {
      expect(isAnthropicModel('gpt-4o')).toBe(false);
    });
  });

  describe('getAnthropicModelsByCapability', () => {
    it('should filter models by text generation capability', () => {
      const models = getAnthropicModelsByCapability(ProviderCapability.TEXT_GENERATION);
      expect(models.length).toBeGreaterThan(0);
      for (const model of models) {
        expect(model.capabilities).toContain(ProviderCapability.TEXT_GENERATION);
      }
    });

    it('should filter models by vision capability', () => {
      const models = getAnthropicModelsByCapability(ProviderCapability.VISION);
      expect(models.length).toBeGreaterThan(0);
      for (const model of models) {
        expect(model.capabilities).toContain(ProviderCapability.VISION);
      }
    });
  });

  describe('getAnthropicChatModels', () => {
    it('should return models with both text generation and streaming', () => {
      const chatModels = getAnthropicChatModels();
      for (const model of chatModels) {
        expect(model.capabilities).toContain(ProviderCapability.TEXT_GENERATION);
        expect(model.capabilities).toContain(ProviderCapability.STREAMING);
      }
    });
  });

  describe('getAnthropicVisionModels', () => {
    it('should not include Haiku 3.5 (no vision support)', () => {
      const visionModels = getAnthropicVisionModels();
      const ids = visionModels.map((m) => m.id);
      expect(ids).not.toContain('claude-3-5-haiku-20241022');
    });
  });

  describe('getAnthropicToolUseModels', () => {
    it('should return models supporting tool use', () => {
      const toolModels = getAnthropicToolUseModels();
      expect(toolModels.length).toBeGreaterThan(0);
      for (const model of toolModels) {
        expect(model.capabilities).toContain(ProviderCapability.TOOL_USE);
      }
    });
  });

  describe('model metadata', () => {
    it('should have 200K context window for all models', () => {
      const models = getAnthropicModels();
      for (const model of models) {
        expect(model.contextWindow).toBe(200000);
      }
    });

    it('should have maxOutputTokens defined', () => {
      const models = getAnthropicModels();
      for (const model of models) {
        expect(model.maxOutputTokens).toBeGreaterThan(0);
      }
    });
  });
});

// ============================================================================
// OpenAI Registry Tests
// ============================================================================

describe('OpenAI Registry', () => {
  describe('getOpenAIModels', () => {
    it('should return all registered models', () => {
      const models = getOpenAIModels();
      expect(models.length).toBeGreaterThan(0);
    });

    it('should return a copy (not the original array)', () => {
      const models1 = getOpenAIModels();
      const models2 = getOpenAIModels();
      expect(models1).not.toBe(models2);
    });

    it('should include GPT-4o models', () => {
      const models = getOpenAIModels();
      const ids = models.map((m) => m.id);
      expect(ids).toContain('gpt-4o');
      expect(ids).toContain('gpt-4o-mini');
    });
  });

  describe('getOpenAIModel', () => {
    it('should return model by ID', () => {
      const model = getOpenAIModel('gpt-4o');
      expect(model).toBeDefined();
      expect(model?.name).toBe('GPT-4o');
    });

    it('should return undefined for unknown model ID', () => {
      expect(getOpenAIModel('nonexistent')).toBeUndefined();
    });
  });

  describe('isOpenAIModel', () => {
    it('should return true for known models', () => {
      expect(isOpenAIModel('gpt-4o')).toBe(true);
      expect(isOpenAIModel('dall-e-3')).toBe(true);
    });

    it('should return false for unknown models', () => {
      expect(isOpenAIModel('claude-3')).toBe(false);
    });
  });

  describe('getOpenAIModelsByCapability', () => {
    it('should filter models by capability', () => {
      const embeddingModels = getOpenAIModelsByCapability(ProviderCapability.EMBEDDINGS);
      expect(embeddingModels.length).toBeGreaterThan(0);
      for (const model of embeddingModels) {
        expect(model.capabilities).toContain(ProviderCapability.EMBEDDINGS);
      }
    });
  });

  describe('getOpenAIChatModels', () => {
    it('should return chat models (not embeddings or image)', () => {
      const chatModels = getOpenAIChatModels();
      for (const model of chatModels) {
        expect(model.capabilities).toContain(ProviderCapability.TEXT_GENERATION);
        expect(model.capabilities).toContain(ProviderCapability.STREAMING);
        expect(model.capabilities).not.toContain(ProviderCapability.EMBEDDINGS);
        expect(model.capabilities).not.toContain(ProviderCapability.IMAGE_GENERATION);
      }
    });

    it('should include GPT-4 and o1 models', () => {
      const chatModels = getOpenAIChatModels();
      const ids = chatModels.map((m) => m.id);
      expect(ids).toContain('gpt-4o');
      expect(ids).toContain('o1');
    });
  });

  describe('getOpenAIEmbeddingModels', () => {
    it('should return embedding models', () => {
      const models = getOpenAIEmbeddingModels();
      expect(models.length).toBeGreaterThan(0);

      const ids = models.map((m) => m.id);
      expect(ids).toContain('text-embedding-3-small');
      expect(ids).toContain('text-embedding-3-large');
    });

    it('should have embedding dimensions set', () => {
      const models = getOpenAIEmbeddingModels();
      for (const model of models) {
        expect(model.embeddingDimensions).toBeGreaterThan(0);
      }
    });
  });

  describe('getOpenAIImageModels', () => {
    it('should return image generation models', () => {
      const models = getOpenAIImageModels();
      expect(models.length).toBeGreaterThan(0);

      const ids = models.map((m) => m.id);
      expect(ids).toContain('dall-e-3');
    });
  });

  describe('model metadata', () => {
    it('o1 models should not have vision or tool-use', () => {
      const o1 = getOpenAIModel('o1');
      expect(o1?.capabilities).not.toContain(ProviderCapability.VISION);
      expect(o1?.capabilities).not.toContain(ProviderCapability.TOOL_USE);
    });

    it('GPT-4 (base) should not have vision', () => {
      const gpt4 = getOpenAIModel('gpt-4');
      expect(gpt4?.capabilities).not.toContain(ProviderCapability.VISION);
    });
  });
});
