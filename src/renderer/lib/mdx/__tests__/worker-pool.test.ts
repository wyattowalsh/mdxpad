/**
 * Tests for worker-pool.ts
 *
 * Tests worker instance management, heartbeat monitoring,
 * worker selection, and prewarming.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createWorkerInstance,
  restartWorker,
  selectWorker,
  startHeartbeatMonitoring,
  stopHeartbeatMonitoring,
  handleHeartbeatPong,
  prewarmAllWorkers,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  MEMORY_CRITICAL_THRESHOLD,
  MEMORY_WARNING_THRESHOLD,
  WORKER_POOL_SIZE,
  type WorkerInstance,
} from '../worker-pool';

// Mock Worker class
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

vi.stubGlobal('Worker', MockWorker);

describe('worker-pool', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constants', () => {
    it('should export expected constant values', () => {
      expect(HEARTBEAT_INTERVAL_MS).toBe(5_000);
      expect(HEARTBEAT_TIMEOUT_MS).toBe(10_000);
      expect(MEMORY_WARNING_THRESHOLD).toBe(0.8);
      expect(MEMORY_CRITICAL_THRESHOLD).toBe(0.95);
      expect(WORKER_POOL_SIZE).toBe(2);
    });
  });

  describe('createWorkerInstance', () => {
    it('should create a healthy worker instance', () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      const instance = createWorkerInstance(0, 1, onMessage, onError);

      expect(instance.healthy).toBe(true);
      expect(instance.pendingCount).toBe(0);
      expect(instance.heartbeatTimeoutId).toBeNull();
      expect(instance.prewarmed).toBe(false);
      expect(instance.generation).toBe(1);
    });

    it('should wire onmessage handler to delegate with index', () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      const instance = createWorkerInstance(2, 0, onMessage, onError);

      // Trigger the worker's onmessage
      const event = { data: 'test' } as MessageEvent;
      instance.worker.onmessage!(event);

      expect(onMessage).toHaveBeenCalledWith(2, event);
    });

    it('should wire onerror handler to delegate with index', () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      const instance = createWorkerInstance(1, 0, onMessage, onError);

      const event = { message: 'error' } as ErrorEvent;
      instance.worker.onerror!(event);

      expect(onError).toHaveBeenCalledWith(1, event);
    });
  });

  describe('restartWorker', () => {
    it('should terminate old worker and create new one', () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      const workers: WorkerInstance[] = [createWorkerInstance(0, 1, onMessage, onError)];

      const oldWorker = workers[0]!.worker;
      const nextGen = restartWorker(workers, 0, 1, onMessage, onError);

      expect(oldWorker.terminate).toHaveBeenCalled();
      expect(nextGen).toBe(2);
      expect(workers[0]!.generation).toBe(2);
      expect(workers[0]!.healthy).toBe(true);
    });

    it('should clear existing heartbeat timeout on restart', () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      const workers: WorkerInstance[] = [createWorkerInstance(0, 1, onMessage, onError)];
      workers[0]!.heartbeatTimeoutId = setTimeout(() => {}, 10000) as unknown as number;

      restartWorker(workers, 0, 1, onMessage, onError);

      // Old timeout should be cleared (worker replaced)
      expect(workers[0]!.heartbeatTimeoutId).toBeNull();
    });

    it('should return generation unchanged for invalid index', () => {
      const workers: WorkerInstance[] = [];
      const gen = restartWorker(workers, 5, 1, vi.fn(), vi.fn());
      expect(gen).toBe(1);
    });
  });

  describe('selectWorker', () => {
    it('should select healthy worker with lowest pending count', () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      const workers: WorkerInstance[] = [
        createWorkerInstance(0, 0, onMessage, onError),
        createWorkerInstance(1, 0, onMessage, onError),
      ];
      workers[0]!.pendingCount = 5;
      workers[1]!.pendingCount = 2;

      const result = selectWorker(workers, 0);
      expect(result.workerIndex).toBe(1);
    });

    it('should skip unhealthy workers', () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      const workers: WorkerInstance[] = [
        createWorkerInstance(0, 0, onMessage, onError),
        createWorkerInstance(1, 0, onMessage, onError),
      ];
      workers[0]!.healthy = false;

      const result = selectWorker(workers, 0);
      expect(result.workerIndex).toBe(1);
    });

    it('should use round-robin starting point', () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      const workers: WorkerInstance[] = [
        createWorkerInstance(0, 0, onMessage, onError),
        createWorkerInstance(1, 0, onMessage, onError),
      ];

      const result = selectWorker(workers, 1);
      // Both have 0 pending, so starting from index 1 it should pick 1
      expect(result.workerIndex).toBe(1);
      expect(result.nextIndex).toBe(0);
    });

    it('should return correct next index for round-robin', () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      const workers: WorkerInstance[] = [
        createWorkerInstance(0, 0, onMessage, onError),
        createWorkerInstance(1, 0, onMessage, onError),
      ];

      const result = selectWorker(workers, 0);
      expect(result.nextIndex).toBe((result.workerIndex + 1) % workers.length);
    });
  });

  describe('handleHeartbeatPong', () => {
    it('should update lastHeartbeat and clear timeout', () => {
      const instance: WorkerInstance = {
        worker: new MockWorker() as unknown as Worker,
        healthy: true,
        pendingCount: 0,
        lastHeartbeat: 0,
        heartbeatTimeoutId: setTimeout(() => {}, 10000) as unknown as number,
        prewarmed: false,
        generation: 0,
      };

      const onMemoryCritical = vi.fn();
      const pong = { type: 'heartbeat-pong' as const, timestamp: Date.now() };

      handleHeartbeatPong(instance, pong, 0, onMemoryCritical);

      expect(instance.lastHeartbeat).toBeGreaterThan(0);
      expect(instance.heartbeatTimeoutId).toBeNull();
    });

    it('should detect critical memory usage', () => {
      const instance: WorkerInstance = {
        worker: new MockWorker() as unknown as Worker,
        healthy: true,
        pendingCount: 0,
        lastHeartbeat: 0,
        heartbeatTimeoutId: null,
        prewarmed: false,
        generation: 0,
      };

      const onMemoryCritical = vi.fn();
      const pong = {
        type: 'heartbeat-pong' as const,
        timestamp: Date.now(),
        memoryUsage: {
          usedJSHeapSize: 96,
          totalJSHeapSize: 100,
          jsHeapSizeLimit: 100,
        },
      };

      const isCritical = handleHeartbeatPong(instance, pong, 0, onMemoryCritical);

      expect(isCritical).toBe(true);
      expect(onMemoryCritical).toHaveBeenCalledWith(0, 0.96);
    });

    it('should not trigger critical for normal memory usage', () => {
      const instance: WorkerInstance = {
        worker: new MockWorker() as unknown as Worker,
        healthy: true,
        pendingCount: 0,
        lastHeartbeat: 0,
        heartbeatTimeoutId: null,
        prewarmed: false,
        generation: 0,
      };

      const onMemoryCritical = vi.fn();
      const pong = {
        type: 'heartbeat-pong' as const,
        timestamp: Date.now(),
        memoryUsage: {
          usedJSHeapSize: 50,
          totalJSHeapSize: 100,
          jsHeapSizeLimit: 100,
        },
      };

      const isCritical = handleHeartbeatPong(instance, pong, 0, onMemoryCritical);

      expect(isCritical).toBe(false);
      expect(onMemoryCritical).not.toHaveBeenCalled();
    });

    it('should update memoryUsage on instance', () => {
      const instance: WorkerInstance = {
        worker: new MockWorker() as unknown as Worker,
        healthy: true,
        pendingCount: 0,
        lastHeartbeat: 0,
        heartbeatTimeoutId: null,
        prewarmed: false,
        generation: 0,
      };

      const memoryUsage = {
        usedJSHeapSize: 50,
        totalJSHeapSize: 100,
        jsHeapSizeLimit: 100,
      };
      const pong = {
        type: 'heartbeat-pong' as const,
        timestamp: Date.now(),
        memoryUsage,
      };

      handleHeartbeatPong(instance, pong, 0, vi.fn());

      expect(instance.memoryUsage).toEqual(memoryUsage);
    });
  });

  describe('startHeartbeatMonitoring / stopHeartbeatMonitoring', () => {
    it('should send heartbeat pings at interval', () => {
      const workers: WorkerInstance[] = [
        {
          worker: new MockWorker() as unknown as Worker,
          healthy: true,
          pendingCount: 0,
          lastHeartbeat: Date.now(),
          heartbeatTimeoutId: null,
          prewarmed: false,
          generation: 0,
        },
      ];

      const intervalId = startHeartbeatMonitoring(workers, vi.fn(), vi.fn());

      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

      expect((workers[0]!.worker as unknown as MockWorker).postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'heartbeat-ping' })
      );

      stopHeartbeatMonitoring(workers, intervalId);
    });

    it('should mark worker unhealthy on timeout', () => {
      const onUnhealthy = vi.fn();

      const workers: WorkerInstance[] = [
        {
          worker: new MockWorker() as unknown as Worker,
          healthy: true,
          pendingCount: 0,
          lastHeartbeat: Date.now(),
          heartbeatTimeoutId: null,
          prewarmed: false,
          generation: 0,
        },
      ];

      const intervalId = startHeartbeatMonitoring(workers, onUnhealthy, vi.fn());

      // Trigger heartbeat ping + wait for timeout in a single advance
      // (interval fires at HEARTBEAT_INTERVAL_MS, then timeout fires HEARTBEAT_TIMEOUT_MS later)
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS);

      expect(onUnhealthy).toHaveBeenCalledWith(0);
      expect(workers[0]!.healthy).toBe(false);

      stopHeartbeatMonitoring(workers, intervalId);
    });

    it('should skip unhealthy workers during monitoring', () => {
      const workers: WorkerInstance[] = [
        {
          worker: new MockWorker() as unknown as Worker,
          healthy: false,
          pendingCount: 0,
          lastHeartbeat: Date.now(),
          heartbeatTimeoutId: null,
          prewarmed: false,
          generation: 0,
        },
      ];

      const intervalId = startHeartbeatMonitoring(workers, vi.fn(), vi.fn());

      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

      expect((workers[0]!.worker as unknown as MockWorker).postMessage).not.toHaveBeenCalled();

      stopHeartbeatMonitoring(workers, intervalId);
    });

    it('should clear all heartbeat timeouts on stop', () => {
      const workers: WorkerInstance[] = [
        {
          worker: new MockWorker() as unknown as Worker,
          healthy: true,
          pendingCount: 0,
          lastHeartbeat: Date.now(),
          heartbeatTimeoutId: setTimeout(() => {}, 10000) as unknown as number,
          prewarmed: false,
          generation: 0,
        },
      ];

      stopHeartbeatMonitoring(workers, null);

      expect(workers[0]!.heartbeatTimeoutId).toBeNull();
    });
  });

  describe('prewarmAllWorkers', () => {
    it('should skip already prewarmed workers', async () => {
      const workers: WorkerInstance[] = [
        {
          worker: new MockWorker() as unknown as Worker,
          healthy: true,
          pendingCount: 0,
          lastHeartbeat: Date.now(),
          heartbeatTimeoutId: null,
          prewarmed: true,
          generation: 0,
        },
      ];

      await prewarmAllWorkers(workers);

      expect((workers[0]!.worker as unknown as MockWorker).postMessage).not.toHaveBeenCalled();
    });

    it('should send prewarm request to non-prewarmed workers', async () => {
      const mockWorker = new MockWorker();
      // Simulate prewarm response - call handler synchronously via addEventListener
      mockWorker.addEventListener.mockImplementation(
        (_event: string, handler: (e: MessageEvent) => void) => {
          // Schedule the response after a brief delay
          setTimeout(() => {
            handler({ data: { type: 'prewarm-response' } } as MessageEvent);
          }, 10);
        }
      );

      const workers: WorkerInstance[] = [
        {
          worker: mockWorker as unknown as Worker,
          healthy: true,
          pendingCount: 0,
          lastHeartbeat: Date.now(),
          heartbeatTimeoutId: null,
          prewarmed: false,
          generation: 0,
        },
      ];

      const promise = prewarmAllWorkers(workers);
      // Use advanceTimersByTimeAsync to properly flush both timers and microtasks
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'prewarm' });
    });
  });
});
