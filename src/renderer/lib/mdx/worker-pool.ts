/**
 * MDX Compiler Worker Pool
 *
 * Manages a pool of Web Workers for parallel MDX compilation.
 * Handles worker lifecycle, health monitoring, and load balancing.
 *
 * @module renderer/lib/mdx/worker-pool
 */

import type {
  HeartbeatPing,
  HeartbeatPong,
  PrewarmRequest,
  WorkerMemoryUsage,
} from '@shared/types/preview-worker';
import { isHeartbeatPong, isPrewarmResponse } from '@shared/types/preview-worker';

// ============================================================================
// Constants
// ============================================================================

/** Heartbeat interval in milliseconds (5 seconds) */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/** Heartbeat timeout - if no response within this time, worker is considered unhealthy (P1-9: increased to 10s) */
export const HEARTBEAT_TIMEOUT_MS = 10_000;

/** Memory usage threshold (80% of heap limit) - triggers cleanup warning */
export const MEMORY_WARNING_THRESHOLD = 0.8;

/** Memory usage threshold (95% of heap limit) - triggers worker restart */
export const MEMORY_CRITICAL_THRESHOLD = 0.95;

/** Worker pool size - number of workers for parallel compilation */
export const WORKER_POOL_SIZE = 2;

/** Prewarm timeout in milliseconds */
export const PREWARM_TIMEOUT_MS = 10_000;

/** Memory usage fetch timeout in milliseconds */
export const MEMORY_FETCH_TIMEOUT_MS = 1000;

// ============================================================================
// Types
// ============================================================================

/** Individual worker instance state (P0-5: added generation counter) */
export interface WorkerInstance {
  worker: Worker;
  healthy: boolean;
  pendingCount: number;
  lastHeartbeat: number;
  heartbeatTimeoutId: number | null;
  memoryUsage?: WorkerMemoryUsage | undefined;
  prewarmed: boolean;
  generation: number; // P0-5: Track worker restart generation
}

/** Worker URL for spawning */
const WORKER_URL = new URL('../../workers/mdx-compiler.worker.ts', import.meta.url);

// ============================================================================
// Worker Instance Management
// ============================================================================

/**
 * Create a new worker instance.
 *
 * @param index - Worker pool index
 * @param generation - Worker generation counter (P0-5)
 * @param onMessage - Message handler callback
 * @param onError - Error handler callback
 * @returns New WorkerInstance
 */
export function createWorkerInstance(
  index: number,
  generation: number,
  onMessage: (index: number, event: MessageEvent) => void,
  onError: (index: number, event: ErrorEvent) => void
): WorkerInstance {
  const worker = new Worker(WORKER_URL, { type: 'module' });

  worker.onmessage = (event: MessageEvent) => onMessage(index, event);
  worker.onerror = (event: ErrorEvent) => onError(index, event);

  return {
    worker,
    healthy: true,
    pendingCount: 0,
    lastHeartbeat: Date.now(),
    heartbeatTimeoutId: null,
    prewarmed: false,
    generation, // P0-5: Store generation
  };
}

/**
 * Restart a specific worker.
 *
 * @param workers - Worker pool array
 * @param workerIndex - Index of worker to restart
 * @param generation - Next generation counter (P0-5)
 * @param handleMessage - Message handler function
 * @param handleError - Error handler function
 * @returns Updated generation counter
 */
export function restartWorker(
  workers: WorkerInstance[],
  workerIndex: number,
  generation: number,
  handleMessage: (idx: number, event: MessageEvent) => void,
  handleError: (idx: number, event: ErrorEvent) => void
): number {
  const oldInstance = workers[workerIndex];
  if (!oldInstance) return generation;

  // Terminate old worker
  oldInstance.worker.terminate();
  if (oldInstance.heartbeatTimeoutId !== null) {
    clearTimeout(oldInstance.heartbeatTimeoutId);
  }

  // Create new worker with incremented generation (P0-5)
  const nextGeneration = generation + 1;
  workers[workerIndex] = createWorkerInstance(
    workerIndex,
    nextGeneration,
    handleMessage,
    handleError
  );

  console.info(`[MDX Compiler] Worker ${workerIndex} restarted (generation ${nextGeneration})`);
  return nextGeneration;
}

/**
 * Select the best worker for the next compilation.
 * Uses round-robin with health and load balancing.
 *
 * @param workers - Worker pool array
 * @param nextWorkerIndex - Current round-robin index
 * @returns Selected worker index and updated round-robin index
 */
export function selectWorker(
  workers: WorkerInstance[],
  nextWorkerIndex: number
): { workerIndex: number; nextIndex: number } {
  let bestIndex = nextWorkerIndex;
  let bestLoad = Infinity;

  for (let i = 0; i < workers.length; i++) {
    const idx = (nextWorkerIndex + i) % workers.length;
    const worker = workers[idx];
    if (worker && worker.healthy && worker.pendingCount < bestLoad) {
      bestIndex = idx;
      bestLoad = worker.pendingCount;
    }
  }

  const nextIndex = (bestIndex + 1) % workers.length;
  return { workerIndex: bestIndex, nextIndex };
}

// ============================================================================
// Heartbeat Monitoring
// ============================================================================

/**
 * Start heartbeat monitoring for all workers.
 *
 * @param workers - Worker pool array
 * @param onUnhealthy - Callback when a worker becomes unhealthy
 * @param onMemoryCritical - Callback when memory threshold is exceeded
 * @returns Interval ID for cleanup
 */
export function startHeartbeatMonitoring(
  workers: WorkerInstance[],
  onUnhealthy: (index: number) => void,
  _onMemoryCritical: (index: number, usageRatio: number) => void
): number {
  return window.setInterval(() => {
    const now = Date.now();

    for (let i = 0; i < workers.length; i++) {
      const workerInstance = workers[i];
      if (!workerInstance?.healthy) continue;

      const ping: HeartbeatPing = { type: 'heartbeat-ping', timestamp: now };
      workerInstance.worker.postMessage(ping);

      if (workerInstance.heartbeatTimeoutId === null) {
        const workerIndex = i;
        workerInstance.heartbeatTimeoutId = window.setTimeout(() => {
          const instance = workers[workerIndex];
          if (instance) {
            console.warn(
              `[MDX Compiler] Worker ${workerIndex} heartbeat timeout, marking unhealthy`
            );
            instance.healthy = false;
            onUnhealthy(workerIndex);
          }
        }, HEARTBEAT_TIMEOUT_MS);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop heartbeat monitoring.
 *
 * @param workers - Worker pool array
 * @param intervalId - Heartbeat interval ID
 */
export function stopHeartbeatMonitoring(
  workers: WorkerInstance[],
  intervalId: number | null
): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }

  for (const workerInstance of workers) {
    if (workerInstance.heartbeatTimeoutId !== null) {
      clearTimeout(workerInstance.heartbeatTimeoutId);
      workerInstance.heartbeatTimeoutId = null;
    }
  }
}

/**
 * Handle heartbeat pong response.
 *
 * @param workerInstance - Worker instance
 * @param pong - Heartbeat pong message
 * @param workerIndex - Worker pool index
 * @param onMemoryCritical - Callback when memory threshold is exceeded
 * @returns True if memory is critical
 */
export function handleHeartbeatPong(
  workerInstance: WorkerInstance,
  pong: HeartbeatPong,
  workerIndex: number,
  _onMemoryCritical: (index: number, usageRatio: number) => void
): boolean {
  workerInstance.lastHeartbeat = Date.now();
  workerInstance.memoryUsage = pong.memoryUsage;

  if (workerInstance.heartbeatTimeoutId !== null) {
    clearTimeout(workerInstance.heartbeatTimeoutId);
    workerInstance.heartbeatTimeoutId = null;
  }

  // Check memory usage thresholds
  if (pong.memoryUsage) {
    const usageRatio = pong.memoryUsage.usedJSHeapSize / pong.memoryUsage.jsHeapSizeLimit;
    if (usageRatio >= MEMORY_CRITICAL_THRESHOLD) {
      console.warn(
        `[MDX Compiler] Worker ${workerIndex} memory critical (${(usageRatio * 100).toFixed(1)}%), restarting...`
      );
      _onMemoryCritical(workerIndex, usageRatio);
      return true;
    } else if (usageRatio >= MEMORY_WARNING_THRESHOLD) {
      console.warn(
        `[MDX Compiler] Worker ${workerIndex} memory warning (${(usageRatio * 100).toFixed(1)}%)`
      );
    }
  }

  return false;
}

// ============================================================================
// Worker Prewarming
// ============================================================================

/**
 * Prewarm all workers for faster first compile.
 *
 * @param workers - Worker pool array
 */
export async function prewarmAllWorkers(workers: WorkerInstance[]): Promise<void> {
  const prewarmPromises = workers.map((workerInstance, index) => {
    return new Promise<void>((resolve) => {
      if (workerInstance.prewarmed) {
        resolve();
        return;
      }

      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn(`[MDX Compiler] Worker ${index} prewarm timeout`);
          workerInstance.worker.removeEventListener('message', handler);
          resolve();
        }
      }, PREWARM_TIMEOUT_MS);

      const handler = (event: MessageEvent): void => {
        if (isPrewarmResponse(event.data) && !resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          workerInstance.worker.removeEventListener('message', handler);
          workerInstance.prewarmed = true;
          resolve();
        }
      };

      workerInstance.worker.addEventListener('message', handler);

      const request: PrewarmRequest = { type: 'prewarm' };
      workerInstance.worker.postMessage(request);
    });
  });

  await Promise.all(prewarmPromises);
}

// ============================================================================
// Memory Usage
// ============================================================================

/**
 * Get memory usage from all workers.
 *
 * @param workers - Worker pool array
 * @returns Array of memory usage from all healthy workers
 */
export async function getAllMemoryUsage(workers: WorkerInstance[]): Promise<WorkerMemoryUsage[]> {
  const usagePromises = workers.map((workerInstance) => {
    return new Promise<WorkerMemoryUsage | undefined>((resolve) => {
      if (!workerInstance.healthy) {
        resolve(undefined);
        return;
      }

      if (workerInstance.memoryUsage) {
        resolve(workerInstance.memoryUsage);
        return;
      }

      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          workerInstance.worker.removeEventListener('message', handler);
          resolve(undefined);
        }
      }, MEMORY_FETCH_TIMEOUT_MS);

      const handler = (event: MessageEvent): void => {
        if (isHeartbeatPong(event.data) && !resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          workerInstance.worker.removeEventListener('message', handler);
          resolve(event.data.memoryUsage);
        }
      };

      workerInstance.worker.addEventListener('message', handler);

      const ping: HeartbeatPing = { type: 'heartbeat-ping', timestamp: Date.now() };
      workerInstance.worker.postMessage(ping);
    });
  });

  const results = await Promise.all(usagePromises);
  return results.filter((usage): usage is WorkerMemoryUsage => usage !== undefined);
}
