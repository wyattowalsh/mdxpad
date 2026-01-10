/**
 * Tests for MDX Compiler Interface
 *
 * Tests the createMDXCompiler function which provides an async API
 * for MDX compilation via Web Worker.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import type {
  CompileResponse,
  CompileResponseSuccess,
  CompileResponseFailure,
  RequestId,
} from '@shared/types/preview-worker';
import type { CompileError } from '@shared/types/preview';

// Store reference to mock worker instances for test manipulation
let mockWorkerInstance: MockWorker | null = null;
const mockWorkerInstances: MockWorker[] = [];

/** Mock Worker class for testing */
class MockWorker {
  onmessage: ((e: MessageEvent<CompileResponse>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage: Mock;
  terminate: Mock;

  constructor() {
    this.postMessage = vi.fn();
    this.terminate = vi.fn();
    mockWorkerInstance = this;
    mockWorkerInstances.push(this);
  }

  /** Simulate a successful response from the worker */
  simulateSuccess(id: RequestId, code: string, frontmatter: Record<string, unknown> = {}): void {
    const response: CompileResponseSuccess = {
      id,
      ok: true,
      code,
      frontmatter,
    };
    this.onmessage?.({ data: response } as MessageEvent<CompileResponse>);
  }

  /** Simulate an error response from the worker */
  simulateError(id: RequestId, errors: readonly CompileError[]): void {
    const response: CompileResponseFailure = {
      id,
      ok: false,
      errors,
    };
    this.onmessage?.({ data: response } as MessageEvent<CompileResponse>);
  }

  /** Simulate a worker crash via onerror */
  simulateCrash(message: string): void {
    const errorEvent = new ErrorEvent('error', { message });
    this.onerror?.(errorEvent);
  }
}

// Mock the Worker constructor globally
vi.stubGlobal('Worker', MockWorker);

// Mock crypto.randomUUID with valid UUID v4 format (required by branded RequestId type)
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => {
    const count = (++uuidCounter).toString(16).padStart(12, '0');
    return `550e8400-e29b-41d4-a716-${count}`;
  }),
});

// Now import the module under test (after mocks are set up)
import { createMDXCompiler, type MDXCompiler } from '../lib/mdx/compiler';

describe('createMDXCompiler', () => {
  let compiler: MDXCompiler;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWorkerInstance = null;
    mockWorkerInstances.length = 0;
    uuidCounter = 0; // Reset UUID counter for deterministic test IDs
    compiler = createMDXCompiler();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('createMDXCompiler() returns valid compiler interface', () => {
    it('should return an object with compile, cancel, and terminate methods', () => {
      expect(compiler).toBeDefined();
      expect(typeof compiler.compile).toBe('function');
      expect(typeof compiler.cancel).toBe('function');
      expect(typeof compiler.terminate).toBe('function');
    });

    it('should create a Worker instance', () => {
      expect(mockWorkerInstance).not.toBeNull();
    });
  });

  describe('compile() returns request ID (UUID format)', () => {
    it('should return a string request ID', () => {
      const requestId = compiler.compile('# Hello');
      expect(typeof requestId).toBe('string');
      expect(requestId.length).toBeGreaterThan(0);
    });

    it('should return unique request IDs for multiple calls', () => {
      const id1 = compiler.compile('# Hello');
      const id2 = compiler.compile('# World');
      expect(id1).not.toBe(id2);
    });

    it('should post message to worker with correct request structure', () => {
      const requestId = compiler.compile('# Hello MDX');
      expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith({
        id: requestId,
        source: '# Hello MDX',
      });
    });
  });

  describe('compile() with onSuccess callback - receives valid response', () => {
    it('should call onSuccess with CompileResponseSuccess when worker succeeds', async () => {
      const onSuccess = vi.fn();
      const requestId = compiler.compile('# Hello', { onSuccess });

      mockWorkerInstance?.simulateSuccess(requestId, 'compiled code', { title: 'Test' });

      // Flush async operations (compileWithRetry uses promises internally)
      await vi.runAllTimersAsync();

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith({
        id: requestId,
        ok: true,
        code: 'compiled code',
        frontmatter: { title: 'Test' },
      });
    });

    it('should handle empty source efficiently without worker', async () => {
      const onSuccess = vi.fn();
      const requestId = compiler.compile('', { onSuccess });

      // Empty source should NOT call worker
      expect(mockWorkerInstance?.postMessage).not.toHaveBeenCalled();

      // Callback is scheduled via queueMicrotask, so we need to flush it
      await vi.runAllTimersAsync();

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith({
        id: requestId,
        ok: true,
        code: '',
        frontmatter: {},
      });
    });

    it('should not call onSuccess for stale responses (cancelled requests)', () => {
      const onSuccess = vi.fn();
      const requestId = compiler.compile('# Hello', { onSuccess });

      // Cancel the request
      compiler.cancel(requestId);

      // Worker still sends response (simulating async behavior)
      mockWorkerInstance?.simulateSuccess(requestId, 'compiled code');

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('compile() with onError callback - receives error array', () => {
    it('should call onError with error array when worker fails', async () => {
      const onError = vi.fn();
      const requestId = compiler.compile('# Invalid', { onError });

      const errors: CompileError[] = [
        { message: 'Syntax error', line: 1, column: 5 },
      ];
      mockWorkerInstance?.simulateError(requestId, errors);

      // Flush async operations
      await vi.runAllTimersAsync();

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(errors);
    });

    it('should receive multiple errors in array', async () => {
      const onError = vi.fn();
      const requestId = compiler.compile('# Invalid', { onError });

      const errors: CompileError[] = [
        { message: 'Error 1', line: 1 },
        { message: 'Error 2', line: 2, column: 3 },
        { message: 'Error 3' },
      ];
      mockWorkerInstance?.simulateError(requestId, errors);

      // Flush async operations
      await vi.runAllTimersAsync();

      expect(onError).toHaveBeenCalledWith(errors);
    });
  });

  describe('cancel() prevents callback from being called', () => {
    it('should prevent onSuccess callback when request is cancelled', () => {
      const onSuccess = vi.fn();
      const requestId = compiler.compile('# Hello', { onSuccess });

      compiler.cancel(requestId);
      mockWorkerInstance?.simulateSuccess(requestId, 'code');

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('should prevent onError callback when request is cancelled', () => {
      const onError = vi.fn();
      const requestId = compiler.compile('# Hello', { onError });

      compiler.cancel(requestId);
      mockWorkerInstance?.simulateError(requestId, [{ message: 'Error' }]);

      expect(onError).not.toHaveBeenCalled();
    });

    it('should be safe to cancel non-existent request ID', () => {
      expect(() => {
        compiler.cancel('non-existent-id' as RequestId);
      }).not.toThrow();
    });

    it('should be safe to cancel same request multiple times', () => {
      const requestId = compiler.compile('# Hello');
      expect(() => {
        compiler.cancel(requestId);
        compiler.cancel(requestId);
        compiler.cancel(requestId);
      }).not.toThrow();
    });

    it('should clear timeout when cancelled', () => {
      const onError = vi.fn();
      const requestId = compiler.compile('# Hello', { onError });

      compiler.cancel(requestId);

      // Advance past timeout
      vi.advanceTimersByTime(35_000);

      // Timeout error should NOT be triggered since request was cancelled
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('terminate() fails pending requests with "Worker terminated"', () => {
    it('should call onError for all pending requests with "Worker terminated" message', async () => {
      const onError1 = vi.fn();
      const onError2 = vi.fn();
      const onError3 = vi.fn();

      // Disable retries to test immediate termination behavior
      const noRetry = { retryConfig: { maxRetries: 0 } };
      compiler.compile('# Request 1', { onError: onError1, ...noRetry });
      compiler.compile('# Request 2', { onError: onError2, ...noRetry });
      compiler.compile('# Request 3', { onError: onError3, ...noRetry });

      compiler.terminate();

      // Flush async operations
      await vi.runAllTimersAsync();

      expect(onError1).toHaveBeenCalledWith([{ message: 'Worker terminated' }]);
      expect(onError2).toHaveBeenCalledWith([{ message: 'Worker terminated' }]);
      expect(onError3).toHaveBeenCalledWith([{ message: 'Worker terminated' }]);
    });

    it('should call worker.terminate()', () => {
      compiler.terminate();
      expect(mockWorkerInstance?.terminate).toHaveBeenCalled();
    });

    it('should prevent callbacks after terminate', () => {
      const onSuccess = vi.fn();
      const requestId = compiler.compile('# Hello', { onSuccess });

      compiler.terminate();

      // Simulate late response from worker (should be ignored)
      mockWorkerInstance?.simulateSuccess(requestId, 'code');

      // onError was already called with "Worker terminated"
      // onSuccess should never be called
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('should handle terminate with no pending requests', () => {
      expect(() => {
        compiler.terminate();
      }).not.toThrow();
    });
  });

  describe('Timeout handling - 30 second timeout', () => {
    it('should call onError after 30 seconds with timeout message', async () => {
      const onError = vi.fn();
      // Disable retries to test timeout behavior directly
      compiler.compile('# Slow compile', { onError, retryConfig: { maxRetries: 0 } });

      // Advance time by 29 seconds - should not timeout yet
      await vi.advanceTimersByTimeAsync(29_000);
      expect(onError).not.toHaveBeenCalled();

      // Advance past 30 second threshold
      await vi.advanceTimersByTimeAsync(1_001);
      expect(onError).toHaveBeenCalledWith([
        { message: 'Compilation timed out after 30 seconds' },
      ]);
    });

    it('should not trigger timeout if response arrives in time', async () => {
      const onError = vi.fn();
      const onSuccess = vi.fn();
      const requestId = compiler.compile('# Hello', { onSuccess, onError });

      // Advance time but within timeout
      await vi.advanceTimersByTimeAsync(15_000);

      // Worker responds
      mockWorkerInstance?.simulateSuccess(requestId, 'code');

      // Flush async operations
      await vi.runAllTimersAsync();

      expect(onSuccess).toHaveBeenCalled();

      // Advance past original timeout
      await vi.advanceTimersByTimeAsync(20_000);

      // Should not trigger timeout error
      expect(onError).not.toHaveBeenCalled();
    });

    it('should timeout each request independently', async () => {
      const onError1 = vi.fn();
      const onError2 = vi.fn();

      // Disable retries to test timeout behavior directly
      const noRetry = { retryConfig: { maxRetries: 0 } };
      compiler.compile('# Request 1', { onError: onError1, ...noRetry });

      // Wait 20 seconds then submit second request
      await vi.advanceTimersByTimeAsync(20_000);
      compiler.compile('# Request 2', { onError: onError2, ...noRetry });

      // First request times out at 30s (10s more from here)
      await vi.advanceTimersByTimeAsync(10_001);
      expect(onError1).toHaveBeenCalled();
      expect(onError2).not.toHaveBeenCalled();

      // Second request times out at 20s more
      await vi.advanceTimersByTimeAsync(20_000);
      expect(onError2).toHaveBeenCalled();
    });
  });

  describe('Worker recovery after crash (onerror)', () => {
    it('should fail all pending requests when worker crashes', async () => {
      const onError1 = vi.fn();
      const onError2 = vi.fn();

      // Disable retries to test immediate crash behavior
      const noRetry = { retryConfig: { maxRetries: 0 } };
      compiler.compile('# Request 1', { onError: onError1, ...noRetry });
      compiler.compile('# Request 2', { onError: onError2, ...noRetry });

      mockWorkerInstance?.simulateCrash('Worker died unexpectedly');

      // Flush async operations
      await vi.runAllTimersAsync();

      expect(onError1).toHaveBeenCalledWith([
        { message: 'Worker crashed: Worker died unexpectedly' },
      ]);
      expect(onError2).toHaveBeenCalledWith([
        { message: 'Worker crashed: Worker died unexpectedly' },
      ]);
    });

    it('should create a new worker after crash', () => {
      const initialWorkerCount = mockWorkerInstances.length;

      mockWorkerInstance?.simulateCrash('Worker died');

      // A new worker should have been created
      expect(mockWorkerInstances.length).toBe(initialWorkerCount + 1);
    });

    it('should be able to compile after worker recovery', async () => {
      const onError = vi.fn();
      const onSuccess = vi.fn();

      // Crash the worker
      mockWorkerInstance?.simulateCrash('Worker died');

      // Submit new request after crash
      const requestId = compiler.compile('# New request', { onSuccess, onError });

      // New worker should receive the request
      const newWorker = mockWorkerInstances[mockWorkerInstances.length - 1];
      expect(newWorker).toBeDefined();
      expect(newWorker!.postMessage).toHaveBeenCalledWith({
        id: requestId,
        source: '# New request',
      });

      // Simulate success from new worker
      newWorker!.simulateSuccess(requestId, 'new code');

      // Flush async operations
      await vi.runAllTimersAsync();

      expect(onSuccess).toHaveBeenCalled();
    });

    it('should terminate old worker during recovery', () => {
      const oldWorker = mockWorkerInstance;
      mockWorkerInstance?.simulateCrash('Worker died');

      expect(oldWorker?.terminate).toHaveBeenCalled();
    });
  });

  describe('Optional requestId parameter is used when provided', () => {
    it('should use provided requestId instead of generating one', () => {
      const customId = 'my-custom-request-id-12345' as RequestId;
      const requestId = compiler.compile('# Hello', { requestId: customId });

      expect(requestId).toBe(customId);
    });

    it('should send provided requestId to worker', () => {
      const customId = 'custom-id-xyz' as RequestId;
      compiler.compile('# Hello', { requestId: customId });

      expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith({
        id: customId,
        source: '# Hello',
      });
    });

    it('should use provided requestId for cancellation', () => {
      const onSuccess = vi.fn();
      const customId = 'cancellable-request' as RequestId;

      compiler.compile('# Hello', { requestId: customId, onSuccess });
      compiler.cancel(customId);

      mockWorkerInstance?.simulateSuccess(customId, 'code');

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('should use provided requestId for empty source optimization', async () => {
      const onSuccess = vi.fn();
      const customId = 'empty-source-id' as RequestId;

      const requestId = compiler.compile('', { requestId: customId, onSuccess });

      expect(requestId).toBe(customId);

      await vi.runAllTimersAsync();

      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: customId })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle response for unknown request ID (stale response)', () => {
      // This tests that stale responses are silently ignored
      mockWorkerInstance?.simulateSuccess('unknown-id' as RequestId, 'code');
      // Should not throw
    });

    it('should support multiple concurrent requests', async () => {
      const results: string[] = [];
      const onSuccess1 = vi.fn((r: CompileResponseSuccess) => results.push(r.id));
      const onSuccess2 = vi.fn((r: CompileResponseSuccess) => results.push(r.id));
      const onSuccess3 = vi.fn((r: CompileResponseSuccess) => results.push(r.id));

      const id1 = compiler.compile('# One', { onSuccess: onSuccess1 });
      const id2 = compiler.compile('# Two', { onSuccess: onSuccess2 });
      const id3 = compiler.compile('# Three', { onSuccess: onSuccess3 });

      // Respond out of order
      mockWorkerInstance?.simulateSuccess(id2, 'two');
      mockWorkerInstance?.simulateSuccess(id3, 'three');
      mockWorkerInstance?.simulateSuccess(id1, 'one');

      // Flush async operations
      await vi.runAllTimersAsync();

      expect(results).toEqual([id2, id3, id1]);
    });

    it('should work without callbacks', () => {
      const requestId = compiler.compile('# No callbacks');
      expect(requestId).toBeDefined();

      // Should not throw when response comes back
      mockWorkerInstance?.simulateSuccess(requestId, 'code');
    });

    it('should work with only onSuccess callback', async () => {
      const onSuccess = vi.fn();
      const requestId = compiler.compile('# Hello', { onSuccess });

      mockWorkerInstance?.simulateSuccess(requestId, 'code');

      // Flush async operations
      await vi.runAllTimersAsync();

      expect(onSuccess).toHaveBeenCalled();
    });

    it('should work with only onError callback', async () => {
      const onError = vi.fn();
      const requestId = compiler.compile('# Hello', { onError });

      mockWorkerInstance?.simulateError(requestId, [{ message: 'Error' }]);

      // Flush async operations
      await vi.runAllTimersAsync();

      expect(onError).toHaveBeenCalled();
    });
  });
});
