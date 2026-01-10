/// <reference lib="webworker" />

/**
 * MDX Compilation Web Worker
 *
 * Handles MDX compilation off the main thread for responsive UI.
 * Receives CompileRequest messages and returns CompileResponse with
 * compiled code or structured error information.
 *
 * Features:
 * - Heartbeat health monitoring with memory usage reporting
 * - Prewarm initialization for faster first compile
 * - Graceful error handling and recovery
 *
 * @module renderer/workers/mdx-compiler
 */

import { compileMdx, prewarmCompiler } from '@renderer/lib/mdx/compile';
import type { CompileRequest, HeartbeatPong, PrewarmResponse, WorkerMemoryUsage } from '@shared/types/preview-worker';
import { isCompileRequest, isHeartbeatPing, isPrewarmRequest } from '@shared/types/preview-worker';

/** Web Worker global scope type assertion */
const workerSelf = self as unknown as DedicatedWorkerGlobalScope;

/** Track if the worker has been prewarmed */
let isPrewarmed = false;

/**
 * Get memory usage if performance.memory is available.
 * This is a Chrome-specific API and may not be available in all browsers.
 */
function getMemoryUsage(): WorkerMemoryUsage | undefined {
  const perf = performance as Performance & {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  };

  if (perf.memory) {
    return {
      usedJSHeapSize: perf.memory.usedJSHeapSize,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
    };
  }

  return undefined;
}

/**
 * Handle heartbeat ping - respond with pong and memory stats.
 */
function handleHeartbeatPing(timestamp: number): void {
  const response: HeartbeatPong = {
    type: 'heartbeat-pong',
    timestamp,
    memoryUsage: getMemoryUsage(),
  };
  workerSelf.postMessage(response);
}

/**
 * Handle prewarm request - initialize the compilation pipeline.
 */
async function handlePrewarmRequest(): Promise<void> {
  if (isPrewarmed) {
    const response: PrewarmResponse = {
      type: 'prewarm-complete',
      initDurationMs: 0,
    };
    workerSelf.postMessage(response);
    return;
  }

  const startTime = performance.now();
  await prewarmCompiler();
  const initDurationMs = performance.now() - startTime;
  isPrewarmed = true;

  const response: PrewarmResponse = {
    type: 'prewarm-complete',
    initDurationMs,
  };
  workerSelf.postMessage(response);
}

/**
 * Handle message deserialization errors.
 * These occur when the message cannot be properly deserialized from the structured clone algorithm.
 */
workerSelf.onmessageerror = (event: MessageEvent): void => {
  console.error('[MDX Worker] Message deserialization error:', event);
};

/**
 * Handle unhandled promise rejections within the worker.
 * Prevents silent failures and provides visibility into async errors.
 */
workerSelf.addEventListener(
  'unhandledrejection',
  (event: PromiseRejectionEvent): void => {
    console.error('[MDX Worker] Unhandled promise rejection:', event.reason);
    event.preventDefault();
  }
);

/**
 * Handle incoming messages.
 * Supports compilation requests, heartbeat pings, and prewarm requests.
 */
workerSelf.onmessage = async (event: MessageEvent): Promise<void> => {
  const data = event.data;

  // Handle heartbeat ping
  if (isHeartbeatPing(data)) {
    handleHeartbeatPing(data.timestamp);
    return;
  }

  // Handle prewarm request
  if (isPrewarmRequest(data)) {
    await handlePrewarmRequest();
    return;
  }

  // Handle compilation request
  if (!isCompileRequest(data)) {
    console.warn('[MDX Worker] Invalid message format received:', data);
    return;
  }

  const { id, source } = data as CompileRequest;
  const response = await compileMdx(id, source);
  workerSelf.postMessage(response);
};
