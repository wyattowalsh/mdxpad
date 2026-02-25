/**
 * Validated IPC Invoke Tests (SECURITY BOUNDARY)
 *
 * Tests for the validated-invoke utility that forms the security boundary
 * between renderer and main processes. All IPC payloads are validated
 * with Zod schemas on both ends.
 *
 * @module tests/unit/preload/validated-invoke
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ============================================================================
// Mock Setup
// ============================================================================

const mockInvoke = vi.fn();

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
  },
}));

import { validatedInvoke } from '../validated-invoke';

// ============================================================================
// Test Schemas
// ============================================================================

const TestRequestSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

const TestResponseSchema = z.object({
  greeting: z.string(),
  success: z.boolean(),
});

const VoidResponseSchema = z.object({
  ok: z.boolean(),
});

// ============================================================================
// Tests
// ============================================================================

describe('validatedInvoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Successful Invocations
  // --------------------------------------------------------------------------

  describe('successful invocations', () => {
    it('should validate request and response, returning parsed data', async () => {
      mockInvoke.mockResolvedValue({ greeting: 'Hello Alice', success: true });

      const result = await validatedInvoke('test:channel', TestRequestSchema, TestResponseSchema, {
        name: 'Alice',
        age: 30,
      });

      expect(result).toEqual({ greeting: 'Hello Alice', success: true });
      expect(mockInvoke).toHaveBeenCalledWith('test:channel', { name: 'Alice', age: 30 });
    });

    it('should allow null request schema for void requests', async () => {
      mockInvoke.mockResolvedValue({ ok: true });

      const result = await validatedInvoke('test:void', null, VoidResponseSchema);

      expect(result).toEqual({ ok: true });
      expect(mockInvoke).toHaveBeenCalledWith('test:void', undefined);
    });

    it('should pass args even when requestSchema is null', async () => {
      mockInvoke.mockResolvedValue({ ok: true });

      const result = await validatedInvoke('test:channel', null, VoidResponseSchema, {
        extra: 'data',
      });

      expect(result).toEqual({ ok: true });
      expect(mockInvoke).toHaveBeenCalledWith('test:channel', { extra: 'data' });
    });

    it('should strip extra properties from response via Zod parsing', async () => {
      mockInvoke.mockResolvedValue({
        greeting: 'Hello',
        success: true,
        extraField: 'should-be-stripped',
      });

      const result = await validatedInvoke('test:channel', null, TestResponseSchema);

      expect(result).toEqual({ greeting: 'Hello', success: true });
      expect(result).not.toHaveProperty('extraField');
    });
  });

  // --------------------------------------------------------------------------
  // Request Validation Failures (SECURITY)
  // --------------------------------------------------------------------------

  describe('request validation (sender-side security)', () => {
    it('should throw when request fails schema validation', async () => {
      await expect(
        validatedInvoke(
          'test:channel',
          TestRequestSchema,
          TestResponseSchema,
          { name: '', age: 30 } // name min length is 1
        )
      ).rejects.toThrow('Request validation failed');

      // Should NOT call ipcRenderer.invoke
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should throw for missing required fields', async () => {
      await expect(
        validatedInvoke(
          'test:channel',
          TestRequestSchema,
          TestResponseSchema,
          { name: 'Alice' } // missing age
        )
      ).rejects.toThrow('Request validation failed');

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should throw for wrong types', async () => {
      await expect(
        validatedInvoke(
          'test:channel',
          TestRequestSchema,
          TestResponseSchema,
          { name: 'Alice', age: 'thirty' } // age should be number
        )
      ).rejects.toThrow('Request validation failed');

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should throw for negative age (positive constraint)', async () => {
      await expect(
        validatedInvoke('test:channel', TestRequestSchema, TestResponseSchema, {
          name: 'Alice',
          age: -5,
        })
      ).rejects.toThrow('Request validation failed');

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should skip request validation when args is undefined', async () => {
      mockInvoke.mockResolvedValue({ greeting: 'Hi', success: true });

      // requestSchema provided but args is undefined - should skip validation
      const result = await validatedInvoke('test:channel', TestRequestSchema, TestResponseSchema);

      expect(result).toEqual({ greeting: 'Hi', success: true });
      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Response Validation Failures (SECURITY)
  // --------------------------------------------------------------------------

  describe('response validation (receiver-side security)', () => {
    it('should throw when response fails schema validation', async () => {
      mockInvoke.mockResolvedValue({ greeting: 123, success: 'not-a-boolean' });

      await expect(validatedInvoke('test:channel', null, TestResponseSchema)).rejects.toThrow(
        'Response validation failed'
      );
    });

    it('should throw for missing response fields', async () => {
      mockInvoke.mockResolvedValue({ greeting: 'Hello' }); // missing success

      await expect(validatedInvoke('test:channel', null, TestResponseSchema)).rejects.toThrow(
        'Response validation failed'
      );
    });

    it('should throw for null response', async () => {
      mockInvoke.mockResolvedValue(null);

      await expect(validatedInvoke('test:channel', null, TestResponseSchema)).rejects.toThrow(
        'Response validation failed'
      );
    });

    it('should throw for undefined response', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await expect(validatedInvoke('test:channel', null, TestResponseSchema)).rejects.toThrow(
        'Response validation failed'
      );
    });

    it('should throw for completely wrong response type', async () => {
      mockInvoke.mockResolvedValue('just a string');

      await expect(validatedInvoke('test:channel', null, TestResponseSchema)).rejects.toThrow(
        'Response validation failed'
      );
    });
  });

  // --------------------------------------------------------------------------
  // IPC Error Propagation
  // --------------------------------------------------------------------------

  describe('IPC error propagation', () => {
    it('should propagate ipcRenderer.invoke errors', async () => {
      mockInvoke.mockRejectedValue(new Error('IPC channel not found'));

      await expect(
        validatedInvoke('nonexistent:channel', null, VoidResponseSchema)
      ).rejects.toThrow('IPC channel not found');
    });

    it('should propagate network/timeout errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Request timeout'));

      await expect(validatedInvoke('test:channel', null, VoidResponseSchema)).rejects.toThrow(
        'Request timeout'
      );
    });

    it('should reject when invoke exceeds timeout', async () => {
      mockInvoke.mockImplementation(() => new Promise(() => {}));

      await expect(
        validatedInvoke('test:channel', null, VoidResponseSchema, undefined, { timeoutMs: 5 })
      ).rejects.toThrow('IPC invoke timed out');
    });

    it('should reject when invoke is aborted', async () => {
      mockInvoke.mockImplementation(() => new Promise(() => {}));
      const controller = new AbortController();

      const request = validatedInvoke('test:channel', null, VoidResponseSchema, undefined, {
        signal: controller.signal,
        timeoutMs: 1000,
      });

      controller.abort();

      await expect(request).rejects.toThrow('IPC invoke aborted');
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle empty object response when schema allows it', async () => {
      const EmptySchema = z.object({});
      mockInvoke.mockResolvedValue({});

      const result = await validatedInvoke('test:channel', null, EmptySchema);
      expect(result).toEqual({});
    });

    it('should handle nested object validation', async () => {
      const NestedSchema = z.object({
        user: z.object({
          name: z.string(),
          settings: z.object({ theme: z.string() }),
        }),
      });

      mockInvoke.mockResolvedValue({
        user: { name: 'Alice', settings: { theme: 'dark' } },
      });

      const result = await validatedInvoke('test:channel', null, NestedSchema);
      expect(result.user.settings.theme).toBe('dark');
    });

    it('should validate array responses', async () => {
      const ArraySchema = z.object({ items: z.array(z.string()) });
      mockInvoke.mockResolvedValue({ items: ['a', 'b', 'c'] });

      const result = await validatedInvoke('test:channel', null, ArraySchema);
      expect(result.items).toEqual(['a', 'b', 'c']);
    });
  });
});
