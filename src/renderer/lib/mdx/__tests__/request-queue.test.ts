/**
 * Tests for request-queue.ts
 *
 * Tests compilation request queue, retry logic, timeout handling,
 * stale response detection, and queue overflow.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isTransientError,
  calculateBackoffDelay,
  delay,
  handleEmptySource,
  setupTimeout,
  handleCompileResponse,
  compileWithRetry,
  failAllPendingRequests,
  cancelRequest,
  COMPILE_TIMEOUT_MS,
  MAX_PENDING_REQUESTS,
  TRANSIENT_ERROR_PATTERNS,
  DEFAULT_RETRY_CONFIG,
  type PendingRequest,
  type RetryConfig,
} from '../request-queue';
import type { WorkerInstance } from '../worker-pool';
import type { RequestId } from '@shared/types/preview-worker';

describe('request-queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constants', () => {
    it('should export expected constants', () => {
      expect(COMPILE_TIMEOUT_MS).toBe(30_000);
      expect(MAX_PENDING_REQUESTS).toBe(100);
      expect(TRANSIENT_ERROR_PATTERNS).toContain('Worker crashed');
      expect(TRANSIENT_ERROR_PATTERNS).toContain('timed out');
    });

    it('should have sensible default retry config', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(100);
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(2000);
    });
  });

  describe('isTransientError', () => {
    it('should return true for worker crash errors', () => {
      expect(isTransientError([{ message: 'Worker crashed unexpectedly' }])).toBe(true);
    });

    it('should return true for timeout errors', () => {
      expect(isTransientError([{ message: 'Request timed out' }])).toBe(true);
    });

    it('should return true for unhealthy worker errors', () => {
      expect(isTransientError([{ message: 'Worker is unhealthy' }])).toBe(true);
    });

    it('should return true for queue overflow errors', () => {
      expect(isTransientError([{ message: 'Queue overflow: too many pending' }])).toBe(true);
    });

    it('should return true for stale response errors', () => {
      expect(
        isTransientError([{ message: 'Stale response from previous worker generation' }])
      ).toBe(true);
    });

    it('should return false for syntax errors', () => {
      expect(isTransientError([{ message: 'Unexpected token at line 5' }])).toBe(false);
    });

    it('should return false for empty errors array', () => {
      expect(isTransientError([])).toBe(false);
    });

    it('should check only the first error message', () => {
      expect(isTransientError([{ message: 'Regular error' }, { message: 'Worker crashed' }])).toBe(
        false
      );
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff', () => {
      const config: RetryConfig = { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 2000 };

      // attempt 0: 100 * 2^0 + jitter = ~100-200
      const delay0 = calculateBackoffDelay(0, config);
      expect(delay0).toBeGreaterThanOrEqual(100);
      expect(delay0).toBeLessThanOrEqual(200 + 100); // base + jitter

      // attempt 1: 100 * 2^1 + jitter = ~200-300
      const delay1 = calculateBackoffDelay(1, config);
      expect(delay1).toBeGreaterThanOrEqual(200);
    });

    it('should not exceed maxDelayMs', () => {
      const config: RetryConfig = { maxRetries: 10, baseDelayMs: 1000, maxDelayMs: 2000 };

      const result = calculateBackoffDelay(10, config);
      expect(result).toBeLessThanOrEqual(2000);
    });
  });

  describe('delay', () => {
    it('should resolve after specified time', async () => {
      const callback = vi.fn();
      const promise = delay(1000).then(callback);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      await promise;

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('handleEmptySource', () => {
    it('should call onSuccess with empty result asynchronously', async () => {
      const onSuccess = vi.fn();
      const id = handleEmptySource({ onSuccess });

      expect(onSuccess).not.toHaveBeenCalled();

      // Flush microtasks
      await vi.advanceTimersByTimeAsync(0);

      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          code: '',
          frontmatter: {},
        })
      );
      expect(id).toBeDefined();
    });

    it('should generate an ID when none provided', () => {
      const id = handleEmptySource(undefined);
      expect(id).toBeDefined();
    });

    it('should use provided requestId', () => {
      const customId = 'custom-id' as RequestId;
      const id = handleEmptySource({ requestId: customId });
      expect(id).toBe(customId);
    });
  });

  describe('setupTimeout', () => {
    it('should remove pending request and call userOnError on timeout', () => {
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const mockWorker = { pendingCount: 1 } as WorkerInstance;
      const workers: WorkerInstance[] = [mockWorker];

      const userOnError = vi.fn();
      const reject = vi.fn();

      const id = 'req-1' as RequestId;
      pendingRequests.set(id, {
        resolve: vi.fn(),
        reject,
        userOnError,
        timeoutId: 0,
        startTime: performance.now(),
        workerIndex: 0,
        generation: 0,
      });

      setupTimeout(id, pendingRequests, workers);

      vi.advanceTimersByTime(COMPILE_TIMEOUT_MS);

      expect(pendingRequests.has(id)).toBe(false);
      expect(userOnError).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining('timed out') }),
        ])
      );
      expect(reject).toHaveBeenCalled();
      expect(mockWorker.pendingCount).toBe(0);
    });

    it('should not error if pending request already removed', () => {
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const workers: WorkerInstance[] = [];

      const id = 'req-2' as RequestId;
      setupTimeout(id, pendingRequests, workers);

      // Should not throw
      vi.advanceTimersByTime(COMPILE_TIMEOUT_MS);
    });
  });

  describe('handleCompileResponse', () => {
    it('should resolve pending request on success', () => {
      const resolve = vi.fn();
      const userOnSuccess = vi.fn();
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const id = 'req-1' as RequestId;

      const mockWorker = { pendingCount: 1, generation: 0 } as WorkerInstance;
      const workers: WorkerInstance[] = [mockWorker];

      const pending: PendingRequest = {
        resolve,
        reject: vi.fn(),
        userOnSuccess,
        timeoutId: 0,
        startTime: performance.now(),
        workerIndex: 0,
        generation: 0,
      };
      pendingRequests.set(id, pending);

      const response = { id, ok: true as const, code: 'compiled', frontmatter: {} };
      const handled = handleCompileResponse(response, pending, workers, pendingRequests);

      expect(handled).toBe(true);
      expect(userOnSuccess).toHaveBeenCalledWith(response);
      expect(resolve).toHaveBeenCalledWith(response);
      expect(pendingRequests.has(id)).toBe(false);
      expect(mockWorker.pendingCount).toBe(0);
    });

    it('should reject pending request on error', () => {
      const reject = vi.fn();
      const userOnError = vi.fn();
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const id = 'req-1' as RequestId;

      const mockWorker = { pendingCount: 1, generation: 0 } as WorkerInstance;
      const workers: WorkerInstance[] = [mockWorker];

      const pending: PendingRequest = {
        resolve: vi.fn(),
        reject,
        userOnError,
        timeoutId: 0,
        startTime: performance.now(),
        workerIndex: 0,
        generation: 0,
      };
      pendingRequests.set(id, pending);

      const errors = [{ message: 'Syntax error' }];
      const response = { id, ok: false as const, errors };
      const handled = handleCompileResponse(response, pending, workers, pendingRequests);

      expect(handled).toBe(true);
      expect(userOnError).toHaveBeenCalledWith(errors);
      expect(reject).toHaveBeenCalledWith(errors);
    });

    it('should reject stale responses from wrong generation', () => {
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const id = 'req-1' as RequestId;

      // Worker generation is 2, but request was from generation 1
      const mockWorker = { pendingCount: 1, generation: 2 } as WorkerInstance;
      const workers: WorkerInstance[] = [mockWorker];

      const pending: PendingRequest = {
        resolve: vi.fn(),
        reject: vi.fn(),
        timeoutId: 0,
        startTime: performance.now(),
        workerIndex: 0,
        generation: 1,
      };
      pendingRequests.set(id, pending);

      const response = { id, ok: true as const, code: 'stale', frontmatter: {} };
      const handled = handleCompileResponse(response, pending, workers, pendingRequests);

      expect(handled).toBe(false);
      expect(pending.resolve).not.toHaveBeenCalled();
      expect(pendingRequests.has(id)).toBe(false);
      expect(mockWorker.pendingCount).toBe(0);
    });

    it('should reject stale responses to settle pending request once', () => {
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const id = 'req-1' as RequestId;
      const reject = vi.fn();
      const userOnError = vi.fn();

      const mockWorker = { pendingCount: 1, generation: 2 } as WorkerInstance;
      const workers: WorkerInstance[] = [mockWorker];

      const pending: PendingRequest = {
        resolve: vi.fn(),
        reject,
        userOnError,
        timeoutId: 0,
        startTime: performance.now(),
        workerIndex: 0,
        generation: 1,
      };
      pendingRequests.set(id, pending);

      const response = { id, ok: true as const, code: 'stale', frontmatter: {} };
      const handled = handleCompileResponse(response, pending, workers, pendingRequests);

      expect(handled).toBe(false);
      expect(reject).toHaveBeenCalledTimes(1);
      expect(reject).toHaveBeenCalledWith([
        expect.objectContaining({
          message: expect.stringContaining('Stale response'),
        }),
      ]);
      expect(userOnError).not.toHaveBeenCalled();
      expect(pendingRequests.has(id)).toBe(false);
    });
  });

  describe('failAllPendingRequests', () => {
    it('should reject all pending requests with error', () => {
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const mockWorker = { pendingCount: 3, generation: 0 } as WorkerInstance;
      const workers: WorkerInstance[] = [mockWorker];

      const rejects = [vi.fn(), vi.fn()];
      const userOnErrors = [vi.fn(), vi.fn()];

      pendingRequests.set('req-1' as RequestId, {
        resolve: vi.fn(),
        reject: rejects[0]!,
        userOnError: userOnErrors[0],
        timeoutId: 0,
        startTime: 0,
        workerIndex: 0,
        generation: 0,
      });
      pendingRequests.set('req-2' as RequestId, {
        resolve: vi.fn(),
        reject: rejects[1]!,
        userOnError: userOnErrors[1],
        timeoutId: 0,
        startTime: 0,
        workerIndex: 0,
        generation: 0,
      });

      failAllPendingRequests(pendingRequests, workers, 'Compiler shutting down');

      expect(rejects[0]).toHaveBeenCalled();
      expect(rejects[1]).toHaveBeenCalled();
      expect(userOnErrors[0]).toHaveBeenCalledWith([{ message: 'Compiler shutting down' }]);
      expect(pendingRequests.size).toBe(0);
      expect(mockWorker.pendingCount).toBe(0);
    });
  });

  describe('compileWithRetry', () => {
    const createWorker = (): WorkerInstance =>
      ({
        worker: { postMessage: vi.fn() },
        healthy: true,
        pendingCount: 0,
        generation: 0,
      }) as unknown as WorkerInstance;

    it('should invoke terminal onError exactly once when queue overflow retries are exhausted', async () => {
      const pendingRequests = new Map<RequestId, PendingRequest>();
      for (let i = 0; i < MAX_PENDING_REQUESTS; i++) {
        pendingRequests.set(`existing-${i}` as RequestId, {
          resolve: vi.fn(),
          reject: vi.fn(),
          timeoutId: 0,
          startTime: 0,
          workerIndex: 0,
          generation: 0,
        });
      }
      const queueOverflows = { count: 0 };
      const onError = vi.fn();

      const compilePromise = compileWithRetry(
        [createWorker()],
        pendingRequests,
        queueOverflows,
        false,
        '# test',
        undefined,
        'overflow-test' as RequestId,
        { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 1 },
        () => 0,
        vi.fn(),
        undefined,
        onError
      );

      await vi.advanceTimersByTimeAsync(20);
      await compilePromise;

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith([
        expect.objectContaining({
          message: 'Queue overflow: too many pending requests',
        }),
      ]);
      expect(queueOverflows.count).toBe(3);
    });

    it('should preserve cancellation semantics without user onError callback', async () => {
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const workers = [createWorker()];
      const queueOverflows = { count: 0 };
      const onError = vi.fn();
      const requestId = 'cancel-test' as RequestId;

      const compilePromise = compileWithRetry(
        workers,
        pendingRequests,
        queueOverflows,
        false,
        '# test',
        undefined,
        requestId,
        { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 1 },
        () => 0,
        vi.fn(),
        undefined,
        onError
      );

      cancelRequest(requestId, pendingRequests, workers);
      await compilePromise;

      expect(onError).not.toHaveBeenCalled();
    });

    it('should not add duplicate terminal onError after timed-out retries', async () => {
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const queueOverflows = { count: 0 };
      const onError = vi.fn();

      const compilePromise = compileWithRetry(
        [createWorker()],
        pendingRequests,
        queueOverflows,
        false,
        '# test',
        undefined,
        'timeout-test' as RequestId,
        { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1 },
        () => 0,
        vi.fn(),
        undefined,
        onError
      );

      await vi.advanceTimersByTimeAsync(COMPILE_TIMEOUT_MS * 2 + 20);
      await compilePromise;

      expect(onError).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancelRequest', () => {
    it('should remove pending request and decrement count', () => {
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const mockWorker = { pendingCount: 2, generation: 0 } as WorkerInstance;
      const workers: WorkerInstance[] = [mockWorker];

      const id = 'req-1' as RequestId;
      pendingRequests.set(id, {
        resolve: vi.fn(),
        reject: vi.fn(),
        timeoutId: 0,
        startTime: 0,
        workerIndex: 0,
        generation: 0,
      });

      cancelRequest(id, pendingRequests, workers);

      expect(pendingRequests.has(id)).toBe(false);
      expect(mockWorker.pendingCount).toBe(1);
    });

    it('should handle cancellation of non-existent request', () => {
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const workers: WorkerInstance[] = [];

      // Should not throw
      cancelRequest('nonexistent' as RequestId, pendingRequests, workers);
    });

    it('should reject cancelled request once without user onError callback', () => {
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const mockWorker = { pendingCount: 1, generation: 0 } as WorkerInstance;
      const workers: WorkerInstance[] = [mockWorker];

      const reject = vi.fn();
      const userOnError = vi.fn();
      const id = 'req-cancel' as RequestId;

      pendingRequests.set(id, {
        resolve: vi.fn(),
        reject,
        userOnError,
        timeoutId: 0,
        startTime: 0,
        workerIndex: 0,
        generation: 0,
      });

      cancelRequest(id, pendingRequests, workers);
      cancelRequest(id, pendingRequests, workers);

      expect(reject).toHaveBeenCalledTimes(1);
      expect(reject).toHaveBeenCalledWith([
        expect.objectContaining({
          message: expect.stringContaining('cancel'),
        }),
      ]);
      expect(userOnError).not.toHaveBeenCalled();
      expect(pendingRequests.has(id)).toBe(false);
      expect(mockWorker.pendingCount).toBe(0);
    });

    it('should not let pending count go below zero', () => {
      const pendingRequests = new Map<RequestId, PendingRequest>();
      const mockWorker = { pendingCount: 0, generation: 0 } as WorkerInstance;
      const workers: WorkerInstance[] = [mockWorker];

      const id = 'req-1' as RequestId;
      pendingRequests.set(id, {
        resolve: vi.fn(),
        reject: vi.fn(),
        timeoutId: 0,
        startTime: 0,
        workerIndex: 0,
        generation: 0,
      });

      cancelRequest(id, pendingRequests, workers);

      expect(mockWorker.pendingCount).toBe(0);
    });
  });
});
