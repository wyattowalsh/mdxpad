/**
 * MDX Compiler Interface
 *
 * Provides a clean async API for MDX compilation via Web Worker.
 * Handles request/response correlation and stale response detection.
 * Includes automatic retry with exponential backoff for transient failures.
 *
 * Features:
 * - Worker health monitoring with heartbeat
 * - Worker pool for parallel compilation
 * - Memory usage monitoring and cleanup
 * - Graceful shutdown on page unload
 * - Worker prewarming for faster first compile
 * - Message queue overflow protection
 * - Performance telemetry
 *
 * @module renderer/lib/mdx/compiler
 */

import type { CompileResponse, RequestId } from '@shared/types/preview-worker';
import {
  createRequestId,
  isCompileResponse,
  isHeartbeatPong,
  isPrewarmResponse,
} from '@shared/types/preview-worker';

// Import worker pool utilities
import {
  createWorkerInstance,
  restartWorker,
  selectWorker,
  startHeartbeatMonitoring,
  stopHeartbeatMonitoring,
  handleHeartbeatPong,
  prewarmAllWorkers,
  getAllMemoryUsage,
  WORKER_POOL_SIZE,
  type WorkerInstance,
} from './worker-pool';

// Import request queue utilities
import {
  handleEmptySource,
  compileWithRetry,
  handleCompileResponse,
  failAllPendingRequests,
  cancelRequest,
  DEFAULT_RETRY_CONFIG,
  type CompileOptions,
  type PendingRequest,
  type RetryConfig,
} from './request-queue';

// Import telemetry utilities
import {
  recordTelemetry,
  createTelemetry,
  calculateTelemetryStats,
  registerTelemetryCallback,
  type CompileTelemetry,
  type TelemetryStats,
  type TelemetryCallback,
} from './telemetry';

// Re-export public types
export type { CompileOptions, CompileTelemetry, TelemetryStats, TelemetryCallback };

// ============================================================================
// Compiler State
// ============================================================================

/** Full compiler state for managing worker pool */
interface CompilerState {
  workers: WorkerInstance[];
  pendingRequests: Map<RequestId, PendingRequest>;
  nextWorkerIndex: number;
  heartbeatIntervalId: number | null;
  telemetryCallbacks: Set<TelemetryCallback>;
  telemetryHistory: CompileTelemetry[];
  workerRestarts: number;
  queueOverflows: number;
  isShuttingDown: boolean;
  generation: number; // P0-5: Global generation counter
}

// ============================================================================
// MDX Compiler Interface
// ============================================================================

/** MDX compiler interface */
export interface MDXCompiler {
  /** Compile MDX source, returns request ID for cancellation */
  compile(source: string, options?: CompileOptions): RequestId;
  /** Cancel a pending compilation request */
  cancel(requestId: RequestId): void;
  /** Terminate the compiler and all workers */
  terminate(): void;
  /** Prewarm all workers for faster first compile */
  prewarm(): Promise<void>;
  /** Get current telemetry statistics */
  getTelemetryStats(): TelemetryStats;
  /** Register a telemetry callback */
  onTelemetry(callback: TelemetryCallback): () => void;
  /** Check if all workers are healthy */
  isHealthy(): boolean;
  /** Get memory usage from all workers */
  getMemoryUsage(): Promise<import('@shared/types/preview-worker').WorkerMemoryUsage[]>;
}

// ============================================================================
// Worker Message Handling
// ============================================================================

/**
 * Handle worker message response.
 *
 * @param state - Compiler state
 * @param workerIndex - Index of worker that sent the message
 * @param event - Message event
 * @param restartFn - Function to restart a worker
 */
function handleHeartbeat(
  workerInstance: unknown,
  data: unknown,
  workerIndex: number,
  restartFn: (index: number) => void
): void {
  if (workerInstance) {
    handleHeartbeatPong(
      workerInstance as WorkerInstance,
      data as import('@shared/types/preview-worker').HeartbeatPong,
      workerIndex,
      (index, _usageRatio) => {
        restartFn(index);
      }
    );
  }
}

function handlePrewarm(
  data: unknown,
  workerInstance: WorkerInstance | undefined,
  workerIndex: number
): void {
  const response = data as import('@shared/types/preview-worker').PrewarmResponse;
  if (workerInstance) {
    workerInstance.prewarmed = true;
    console.debug(
      `[MDX Compiler] Worker ${workerIndex} prewarmed in ${response.initDurationMs.toFixed(1)}ms`
    );
  }
}

function handleCompile(
  response: CompileResponse,
  state: CompilerState,
  pending: PendingRequest
): void {
  const handled = handleCompileResponse(response, pending, state.workers, state.pendingRequests);

  if (handled) {
    const telemetry = createTelemetry(
      response.id,
      pending.startTime,
      response.ok,
      0,
      pending.workerIndex,
      state.pendingRequests.size
    );
    recordTelemetry(telemetry, state.telemetryHistory, state.telemetryCallbacks);
  }
}

function handleWorkerMessage(
  state: CompilerState,
  workerIndex: number,
  event: MessageEvent,
  restartFn: (index: number) => void
): void {
  const data: unknown = event.data;

  if (isHeartbeatPong(data)) {
    handleHeartbeat(state.workers[workerIndex], data, workerIndex, restartFn);
    return;
  }

  if (isPrewarmResponse(data)) {
    handlePrewarm(data, state.workers[workerIndex], workerIndex);
    return;
  }

  if (!isCompileResponse(data)) {
    console.warn('[MDX Compiler] Received unknown message from worker:', data);
    return;
  }
  const response = data;
  const pending = state.pendingRequests.get(response.id);
  if (pending !== undefined) {
    handleCompile(response, state, pending);
  }
}

/**
 * Handle worker error event.
 *
 * @param state - Compiler state
 * @param workerIndex - Index of worker that errored
 * @param event - Error event
 * @param restartFn - Function to restart a worker
 */
function handleWorkerError(
  state: CompilerState,
  workerIndex: number,
  event: ErrorEvent,
  restartFn: (index: number) => void
): void {
  console.error(`[MDX Compiler] Worker ${workerIndex} error:`, event.message);

  const workerInstance = state.workers[workerIndex];
  if (workerInstance) {
    workerInstance.healthy = false;
  }

  // Fail pending requests for this worker
  const errors = [{ message: `Worker crashed: ${event.message}` }];
  for (const [id, pending] of state.pendingRequests) {
    if (pending.workerIndex === workerIndex) {
      clearTimeout(pending.timeoutId);
      state.pendingRequests.delete(id);
      pending.userOnError?.(errors);
      pending.reject(errors);
    }
  }

  // Restart the worker
  restartFn(workerIndex);
}

/**
 * Handle compile request with health check, recovery, and retry logic.
 *
 * @param state - Compiler state
 * @param source - MDX source to compile
 * @param restartFn - Function to restart workers
 * @param options - Compile options
 * @returns Request ID
 */
function doCompile(
  state: CompilerState,
  source: string,
  restartFn: (index: number) => void,
  options?: CompileOptions
): RequestId {
  if (source === '') return handleEmptySource(options);

  const id = options?.requestId ?? createRequestId();
  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...options?.retryConfig,
  };

  const queueOverflowRef = {
    get count() {
      return state.queueOverflows;
    },
    set count(v: number) {
      state.queueOverflows = v;
    },
  };

  void compileWithRetry({
    workers: state.workers,
    pendingRequests: state.pendingRequests,
    queueOverflows: queueOverflowRef,
    shutdownRef: {
      get isShuttingDown() {
        return state.isShuttingDown;
      },
    },
    source,
    pluginConfig: options?.pluginConfig,
    id,
    config,
    selectWorkerFn: () => {
      const result = selectWorker(state.workers, state.nextWorkerIndex);
      state.nextWorkerIndex = result.nextIndex;
      return result.workerIndex;
    },
    onRestart: restartFn,
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });

  return id;
}

/**
 * Set up graceful shutdown on page unload.
 *
 * @param state - Compiler state
 * @returns Cleanup function to remove event listener
 */
function setupGracefulShutdown(state: CompilerState): () => void {
  const handleBeforeUnload = (): void => {
    state.isShuttingDown = true;
    stopHeartbeatMonitoring(state.workers, state.heartbeatIntervalId);
    state.heartbeatIntervalId = null;
    failAllPendingRequests(state.pendingRequests, state.workers, 'Page is unloading');

    for (const workerInstance of state.workers) {
      workerInstance.worker.terminate();
    }
    state.workers.length = 0;
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}

// ============================================================================
// Public API
// ============================================================================

/** Options for creating a compiler instance */
export interface CreateCompilerOptions {
  /** Disable heartbeat monitoring (useful for tests with fake timers) */
  disableHeartbeat?: boolean;
}

/**
 * Create a new MDX compiler instance with worker pool.
 *
 * @param options - Optional configuration for the compiler
 * @returns MDXCompiler instance with full resilience features
 */
function initializeCompilerState(): CompilerState {
  return {
    workers: [],
    pendingRequests: new Map(),
    nextWorkerIndex: 0,
    heartbeatIntervalId: null,
    telemetryCallbacks: new Set(),
    telemetryHistory: [],
    workerRestarts: 0,
    queueOverflows: 0,
    isShuttingDown: false,
    generation: 0, // P0-5: Initialize generation counter
  };
}

function createHandlers(state: CompilerState) {
  const doRestart = (index: number): void => {
    state.generation = restartWorker(
      state.workers,
      index,
      state.generation,
      handleMessage,
      handleError
    );
    state.workerRestarts++;
  };

  const handleMessage = (idx: number, event: MessageEvent): void => {
    handleWorkerMessage(state, idx, event, doRestart);
  };

  const handleError = (idx: number, event: ErrorEvent): void => {
    handleWorkerError(state, idx, event, doRestart);
  };

  return { doRestart, handleMessage, handleError };
}

function buildCompilerAPI(
  state: CompilerState,
  doRestart: (index: number) => void,
  cleanupShutdown: () => void
): MDXCompiler {
  return {
    compile: (source, options) => doCompile(state, source, doRestart, options),

    cancel(requestId: RequestId): void {
      cancelRequest(requestId, state.pendingRequests, state.workers);
    },

    terminate(): void {
      state.isShuttingDown = true;
      cleanupShutdown();
      stopHeartbeatMonitoring(state.workers, state.heartbeatIntervalId);
      state.heartbeatIntervalId = null;
      failAllPendingRequests(state.pendingRequests, state.workers, 'Worker terminated');
      for (const workerInstance of state.workers) {
        workerInstance.worker.terminate();
      }
      state.workers.length = 0;
    },

    async prewarm(): Promise<void> {
      await prewarmAllWorkers(state.workers);
    },

    getTelemetryStats(): TelemetryStats {
      return calculateTelemetryStats(
        state.telemetryHistory,
        state.workerRestarts,
        state.queueOverflows
      );
    },

    onTelemetry(callback: TelemetryCallback): () => void {
      return registerTelemetryCallback(callback, state.telemetryCallbacks);
    },

    isHealthy(): boolean {
      return state.workers.some((w) => w.healthy);
    },

    async getMemoryUsage(): Promise<import('@shared/types/preview-worker').WorkerMemoryUsage[]> {
      return getAllMemoryUsage(state.workers);
    },
  };
}

export function createMDXCompiler(options?: CreateCompilerOptions): MDXCompiler {
  const state = initializeCompilerState();
  const { doRestart, handleMessage, handleError } = createHandlers(state);

  // Create worker pool
  for (let i = 0; i < WORKER_POOL_SIZE; i++) {
    state.workers.push(createWorkerInstance(i, state.generation, handleMessage, handleError));
  }

  // Start heartbeat monitoring (unless disabled for testing)
  if (!options?.disableHeartbeat) {
    state.heartbeatIntervalId = startHeartbeatMonitoring(
      state.workers,
      (index) => doRestart(index),
      (index, _usageRatio) => doRestart(index)
    );
  }

  const cleanupShutdown = setupGracefulShutdown(state);
  return buildCompilerAPI(state, doRestart, cleanupShutdown);
}
