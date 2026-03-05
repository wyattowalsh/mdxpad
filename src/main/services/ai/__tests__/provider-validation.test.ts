/**
 * Provider Validation Tests
 *
 * Tests for performValidation and related response parsing.
 *
 * @module tests/unit/ai/provider-validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ProviderConfig } from '@shared/ai/types';

import { performValidation, createErrorResult } from '../provider-validation';

// ============================================================================
// Fixtures
// ============================================================================

function makeProvider(type: ProviderConfig['type'], baseUrl?: string): ProviderConfig {
  return {
    id: `${type}-1`,
    displayName: type.toUpperCase(),
    type,
    status: 'disconnected',
    ...(baseUrl ? { baseUrl } : {}),
  } as unknown as ProviderConfig;
}

// ============================================================================
// Tests
// ============================================================================

describe('performValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // OpenAI Validation
  // --------------------------------------------------------------------------

  describe('OpenAI', () => {
    it('should return missing key result when no API key', async () => {
      const result = await performValidation(makeProvider('openai'), null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('MISSING_API_KEY');
    });

    it('should validate successfully with valid API key', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4' }] }),
        })
      );

      const result = await performValidation(makeProvider('openai'), 'sk-valid');

      expect(result.valid).toBe(true);
      expect(result.status).toBe('connected');
      expect(result.models).toContain('gpt-4o');
    });

    it('should return error for invalid API key (401)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
        })
      );

      const result = await performValidation(makeProvider('openai'), 'sk-invalid');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_API_KEY');
    });

    it('should return rate limited error (429)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '30' }),
        })
      );

      const result = await performValidation(makeProvider('openai'), 'sk-test');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMITED');
      expect(result.error?.retryAfterSeconds).toBe(30);
    });
  });

  // --------------------------------------------------------------------------
  // Anthropic Validation
  // --------------------------------------------------------------------------

  describe('Anthropic', () => {
    it('should return missing key result when no API key', async () => {
      const result = await performValidation(makeProvider('anthropic'), null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('MISSING_API_KEY');
    });

    it('should validate successfully with 200 response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

      const result = await performValidation(makeProvider('anthropic'), 'sk-ant-valid');

      expect(result.valid).toBe(true);
      expect(result.status).toBe('connected');
    });

    it('should treat 400 as valid (valid key, invalid request)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));

      const result = await performValidation(makeProvider('anthropic'), 'sk-ant-valid');

      expect(result.valid).toBe(true);
    });

    it('should return error for 401', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

      const result = await performValidation(makeProvider('anthropic'), 'sk-ant-bad');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_API_KEY');
    });
  });

  // --------------------------------------------------------------------------
  // Ollama Validation
  // --------------------------------------------------------------------------

  describe('Ollama', () => {
    it('should return missing URL result when no baseUrl', async () => {
      const result = await performValidation(makeProvider('ollama'), null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('MISSING_BASE_URL');
    });

    it('should validate successfully with running Ollama', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3' }] }),
        })
      );

      const result = await performValidation(
        makeProvider('ollama', 'http://localhost:11434'),
        null
      );

      expect(result.valid).toBe(true);
      expect(result.models).toContain('llama3');
    });

    it('should return error when Ollama is not running', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

      const result = await performValidation(
        makeProvider('ollama', 'http://localhost:11434'),
        null
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('CONNECTION_ERROR');
    });
  });

  // --------------------------------------------------------------------------
  // LM Studio Validation
  // --------------------------------------------------------------------------

  describe('LM Studio', () => {
    it('should return missing URL result when no baseUrl', async () => {
      const result = await performValidation(makeProvider('lmstudio'), null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('MISSING_BASE_URL');
    });

    it('should validate with OpenAI-compatible format', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: 'local-model' }] }),
        })
      );

      const result = await performValidation(
        makeProvider('lmstudio', 'http://localhost:1234'),
        null
      );

      expect(result.valid).toBe(true);
      expect(result.models).toContain('local-model');
    });
  });

  // --------------------------------------------------------------------------
  // OpenAI-Compatible Validation
  // --------------------------------------------------------------------------

  describe('OpenAI-Compatible', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalRendererUrl = process.env.ELECTRON_RENDERER_URL;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalRendererUrl === undefined) {
        delete process.env.ELECTRON_RENDERER_URL;
      } else {
        process.env.ELECTRON_RENDERER_URL = originalRendererUrl;
      }
    });

    it('should return missing URL result when no baseUrl', async () => {
      const result = await performValidation(makeProvider('openai-compatible'), null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('MISSING_BASE_URL');
    });

    it('should validate with API key', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: 'model-1' }] }),
        })
      );

      const result = await performValidation(
        makeProvider('openai-compatible', 'https://api.custom.com'),
        'key-123'
      );

      expect(result.valid).toBe(true);
    });

    it('should work without API key', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
      );

      const result = await performValidation(
        makeProvider('openai-compatible', 'https://api.custom.com'),
        null
      );

      expect(result.valid).toBe(true);
    });

    it('should reject non-HTTPS remote base URLs', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const result = await performValidation(
        makeProvider('openai-compatible', 'http://api.custom.com'),
        'key-123'
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_BASE_URL');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should reject localhost base URLs when local dev opt-in is not enabled', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.ELECTRON_RENDERER_URL;

      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const result = await performValidation(
        makeProvider('openai-compatible', 'https://localhost:1234'),
        'key-123'
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_BASE_URL');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should reject private network base URLs', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const result = await performValidation(
        makeProvider('openai-compatible', 'https://192.168.1.20'),
        'key-123'
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_BASE_URL');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should allow localhost base URLs when local dev opt-in is enabled', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173';

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
      );

      const result = await performValidation(
        makeProvider('openai-compatible', 'http://localhost:1234'),
        'key-123'
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('Sidecar', () => {
    it('should return missing URL result when no sidecar baseUrl', async () => {
      const result = await performValidation(makeProvider('sidecar'), null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('MISSING_BASE_URL');
    });

    it('should validate sidecar endpoint with OpenAI-compatible model response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [{ id: 'llama-3.2' }] }),
        })
      );

      const result = await performValidation(
        makeProvider('sidecar', 'http://127.0.0.1:11470'),
        null
      );

      expect(result.valid).toBe(true);
      expect(result.status).toBe('connected');
      expect(result.models).toContain('llama-3.2');
    });

    it('should surface sidecar connection failures', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

      const result = await performValidation(
        makeProvider('sidecar', 'http://127.0.0.1:11470'),
        null
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('CONNECTION_ERROR');
      expect(result.error?.message).toBe('Connection error: 503');
    });
  });
});

// ============================================================================
// createErrorResult Tests
// ============================================================================

describe('createErrorResult', () => {
  it('should create timeout result for AbortError', () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    const result = createErrorResult(abortError);

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('TIMEOUT');
  });

  it('should create unknown error result for generic errors', () => {
    const result = createErrorResult(new Error('Something broke'));

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('UNKNOWN_ERROR');
    expect(result.error?.message).toBe('Something broke');
  });

  it('should handle non-Error values', () => {
    const result = createErrorResult('string error');

    expect(result.valid).toBe(false);
    expect(result.error?.message).toBe('string error');
  });
});
