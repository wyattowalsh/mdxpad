/**
 * AI Helpers Tests
 *
 * Tests for shared AI utility functions.
 *
 * @module tests/unit/ai/ai-helpers
 */

import { describe, it, expect } from 'vitest';
import type { ProviderConfig, ProviderType } from '@shared/ai/types';
import { ProviderCapability } from '@shared/ai/types';
import { AIProviderError, CapabilityNotSupportedError } from '@shared/ai/errors';

import {
  getDefaultModel,
  getDefaultEmbeddingModel,
  getDefaultImageModel,
  isRateLimitError,
  extractRetryAfter,
  wrapError,
  getModelEntry,
  modelHasCapability,
  validateCapability,
  requiresApiKey,
} from '../ai-helpers';

// ============================================================================
// Fixtures
// ============================================================================

const mockProvider: ProviderConfig = {
  id: 'test-1',
  displayName: 'Test',
  type: 'openai',
  status: 'connected',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// ============================================================================
// Tests
// ============================================================================

describe('Default Model Getters', () => {
  describe('getDefaultModel', () => {
    it('should return gpt-4o for openai', () => {
      expect(getDefaultModel('openai')).toBe('gpt-4o');
    });

    it('should return claude model for anthropic', () => {
      expect(getDefaultModel('anthropic')).toBe('claude-3-5-sonnet-20241022');
    });

    it('should return llama3 for ollama', () => {
      expect(getDefaultModel('ollama')).toBe('llama3');
    });

    it('should return default for lmstudio', () => {
      expect(getDefaultModel('lmstudio')).toBe('default');
    });

    it('should return gpt-3.5-turbo for openai-compatible', () => {
      expect(getDefaultModel('openai-compatible')).toBe('gpt-3.5-turbo');
    });
  });

  describe('getDefaultEmbeddingModel', () => {
    it('should return text-embedding-3-small for openai', () => {
      expect(getDefaultEmbeddingModel('openai')).toBe('text-embedding-3-small');
    });

    it('should return undefined for anthropic', () => {
      expect(getDefaultEmbeddingModel('anthropic')).toBeUndefined();
    });

    it('should return undefined for ollama', () => {
      expect(getDefaultEmbeddingModel('ollama')).toBeUndefined();
    });
  });

  describe('getDefaultImageModel', () => {
    it('should return dall-e-3 for openai', () => {
      expect(getDefaultImageModel('openai')).toBe('dall-e-3');
    });

    it('should return undefined for anthropic', () => {
      expect(getDefaultImageModel('anthropic')).toBeUndefined();
    });
  });
});

describe('Error Helpers', () => {
  describe('isRateLimitError', () => {
    it('should return true for rate limit error messages', () => {
      expect(isRateLimitError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isRateLimitError(new Error('429 Too Many Requests'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isRateLimitError(new Error('Server error'))).toBe(false);
      expect(isRateLimitError(new Error('Network timeout'))).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isRateLimitError('rate limit')).toBe(false);
      expect(isRateLimitError(null)).toBe(false);
      expect(isRateLimitError(undefined)).toBe(false);
      expect(isRateLimitError(429)).toBe(false);
    });
  });

  describe('extractRetryAfter', () => {
    it('should extract retry-after from Response headers', () => {
      const response = new Response(null, {
        status: 429,
        headers: { 'Retry-After': '30' },
      });
      expect(extractRetryAfter(response)).toBe(30);
    });

    it('should return fallback for Response without header', () => {
      const response = new Response(null, { status: 429 });
      expect(extractRetryAfter(response)).toBe(60);
    });

    it('should use custom fallback value', () => {
      expect(extractRetryAfter(null, 120)).toBe(120);
    });

    it('should return fallback for non-Response, non-Error values', () => {
      expect(extractRetryAfter('string')).toBe(60);
    });

    it('should extract retry-after from Error with headers property', () => {
      const error = new Error('Rate limited');
      Object.assign(error, { headers: { 'retry-after': '45' } });
      expect(extractRetryAfter(error)).toBe(45);
    });
  });

  describe('wrapError', () => {
    it('should return existing AIProviderError unchanged', () => {
      const existing = new AIProviderError('test', 'TEST', 'provider-1');
      const result = wrapError(existing, mockProvider);
      expect(result).toBe(existing);
    });

    it('should wrap Error in AIProviderError', () => {
      const error = new Error('Something went wrong');
      const result = wrapError(error, mockProvider);
      expect(result).toBeInstanceOf(AIProviderError);
      expect(result.message).toBe('Something went wrong');
      expect(result.code).toBe('GENERATION_ERROR');
      expect(result.providerId).toBe('test-1');
    });

    it('should wrap non-Error values', () => {
      const result = wrapError('string error', mockProvider);
      expect(result).toBeInstanceOf(AIProviderError);
      expect(result.message).toBe('string error');
    });
  });
});

describe('Capability Helpers', () => {
  describe('getModelEntry', () => {
    it('should return OpenAI model entry', () => {
      const entry = getModelEntry('openai', 'gpt-4o');
      expect(entry).toBeDefined();
      expect(entry?.name).toBe('GPT-4o');
    });

    it('should return Anthropic model entry', () => {
      const entry = getModelEntry('anthropic', 'claude-3-5-sonnet-20241022');
      expect(entry).toBeDefined();
    });

    it('should return undefined for unknown model', () => {
      const entry = getModelEntry('openai', 'nonexistent');
      expect(entry).toBeUndefined();
    });

    it('should return undefined for ollama provider type', () => {
      const entry = getModelEntry('ollama', 'llama3');
      expect(entry).toBeUndefined();
    });

    it('should look up openai-compatible in OpenAI registry', () => {
      const entry = getModelEntry('openai-compatible', 'gpt-4o');
      expect(entry).toBeDefined();
    });
  });

  describe('modelHasCapability', () => {
    it('should return true when model has capability', () => {
      expect(modelHasCapability('openai', 'gpt-4o', ProviderCapability.TEXT_GENERATION)).toBe(true);
      expect(modelHasCapability('openai', 'gpt-4o', ProviderCapability.VISION)).toBe(true);
    });

    it('should return false when model lacks capability', () => {
      expect(modelHasCapability('openai', 'gpt-4', ProviderCapability.VISION)).toBe(false);
    });

    it('should assume basic capabilities for unknown models', () => {
      expect(modelHasCapability('ollama', 'custom-model', ProviderCapability.TEXT_GENERATION)).toBe(
        true
      );
      expect(modelHasCapability('ollama', 'custom-model', ProviderCapability.STREAMING)).toBe(true);
      expect(modelHasCapability('ollama', 'custom-model', ProviderCapability.VISION)).toBe(false);
    });
  });

  describe('validateCapability', () => {
    it('should not throw when model has capability', () => {
      expect(() =>
        validateCapability(mockProvider, 'gpt-4o', ProviderCapability.TEXT_GENERATION)
      ).not.toThrow();
    });

    it('should throw CapabilityNotSupportedError when missing', () => {
      expect(() => validateCapability(mockProvider, 'gpt-4', ProviderCapability.VISION)).toThrow(
        CapabilityNotSupportedError
      );
    });
  });

  describe('requiresApiKey', () => {
    it('should return true for openai and anthropic', () => {
      expect(requiresApiKey('openai')).toBe(true);
      expect(requiresApiKey('anthropic')).toBe(true);
    });

    it('should return false for local providers', () => {
      expect(requiresApiKey('ollama')).toBe(false);
      expect(requiresApiKey('lmstudio')).toBe(false);
      expect(requiresApiKey('openai-compatible' as ProviderType)).toBe(false);
    });
  });
});
