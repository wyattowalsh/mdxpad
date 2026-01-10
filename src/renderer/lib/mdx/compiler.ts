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

import type {
  CompileRequest,
  CompileResponse,
  CompileResponseSuccess,
  RequestId,
  HeartbeatPing,
  HeartbeatPong,
  PrewarmRequest,
  PrewarmResponse,
  WorkerMemoryUsage,
} from '@shared/types/preview-worker';
import { createRequestId, isHeartbeatPong, isPrewarmResponse } from '@shared/types/preview-worker';
import type { CompileError } from '@shared/types/preview';

// ============================================================================
// Constants and Configuration
// ============================================================================

/** Compilation timeout in milliseconds (30 seconds) */
const COMPILE_TIMEOUT_MS = 30_000;

/** Maximum jitter added to backoff delay in milliseconds */
const BACKOFF_JITTER_MS = 100;

/** Heartbeat interval in milliseconds (5 seconds) */
const HEARTBEAT_INTERVAL_MS = 5_000;

/** Heartbeat timeout - if no response within this time, worker is considered unhealthy */
const HEARTBEAT_TIMEOUT_MS = 2_000;

/** Maximum pending requests before queue overflow protection kicks in */
const MAX_PENDING_REQUESTS = 100;

/** Memory usage threshold (80% of heap limit) - triggers cleanup warning */
const MEMORY_WARNING_THRESHOLD = 0.8;

/** Memory usage threshold (95% of heap limit) - triggers worker restart */
const MEMORY_CRITICAL_THRESHOLD = 0.95;

/** Worker pool size - number of workers for parallel compilation */
const WORKER_POOL_SIZE = 2;

/** Maximum telemetry history entries to retain */
const MAX_TELEMETRY_HISTORY = 1000;

/** Prewarm timeout in milliseconds */
const PREWARM_TIMEOUT_MS = 10_000;

/** Memory usage fetch timeout in milliseconds */
const MEMORY_FETCH_TIMEOUT_MS = 1000;

/** Configuration for retry behavior */
interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
}

/** Default retry configuration */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 2000,
};

/** Error messages that indicate transient (retryable) failures */
const TRANSIENT_ERROR_PATTERNS = [
  'Worker crashed',
  'Worker is unhealthy',
  'Worker terminated',
  'timed out',
  'Queue overflow',
] as const;

// ============================================================================
// Telemetry Types
// ============================================================================

/** Performance metrics for a single compilation */
export interface CompileTelemetry {
  readonly requestId: RequestId;
  readonly startTime: number;
  readonly endTime: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly retryCount: number;
  readonly workerIndex: number;
  readonly queueDepth: number;
}

/** Aggregated telemetry metrics */
export interface TelemetryStats {
  readonly totalCompilations: number;
  readonly successfulCompilations: number;
  readonly failedCompilations: number;
  readonly averageDurationMs: number;
  readonly p95DurationMs: number;
  readonly totalRetries: number;
  readonly workerRestarts: number;
  readonly queueOverflows: number;
}

/** Telemetry callback type */
export type TelemetryCallback = (telemetry: CompileTelemetry) => void;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine if an error is transient and should be retried.
 * Compilation errors (syntax errors, MDX errors) should not be retried.
 *
 * @param errors - Array of compilation errors to check
 * @returns True if the error is transient (e.g., worker crash), false otherwise
 */
function isTransientError(errors: readonly CompileError[]): boolean {
  if (errors.length === 0) return false;
  const message = errors[0]?.message ?? '';
  return TRANSIENT_ERROR_PATTERNS.some(pattern => message.includes(pattern));
}

/**
 * Calculate delay with exponential backoff and jitter.
 *
 * @param attempt - Current retry attempt number (0-based)
 * @param config - Retry configuration with base delay and max delay
 * @returns Calculated delay in milliseconds
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * BACKOFF_JITTER_MS;
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Wait for a specified delay.
 *
 * @param ms - Delay duration in milliseconds
 * @returns Promise that resolves after the delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Types
// ============================================================================

/** Options for MDX compilation */
export interface CompileOptions {
  /** Callback when compilation succeeds */
  onSuccess?: (result: CompileResponseSuccess) => void;
  /** Callback when compilation fails */
  onError?: (errors: readonly CompileError[]) => void;
  /** Optional pre-generated request ID (defaults to createRequestId()) */
  requestId?: RequestId;
  /** Optional retry configuration override */
  retryConfig?: Partial<RetryConfig>;
}

/** Stored callback for pending compilation requests */
interface PendingRequest {
  readonly onSuccess?: ((result: CompileResponseSuccess) => void) | undefined;
  readonly onError?: ((errors: readonly CompileError[]) => void) | undefined;
  readonly timeoutId: number;
  readonly startTime: number;
  readonly workerIndex: number;
}

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
  getMemoryUsage(): Promise<WorkerMemoryUsage[]>;
}

// ============================================================================
// Worker Instance Management
// ============================================================================

/** Individual worker instance state */
interface WorkerInstance {
  worker: Worker;
  healthy: boolean;
  pendingCount: number;
  lastHeartbeat: number;
  heartbeatTimeoutId: number | null;
  memoryUsage?: WorkerMemoryUsage | undefined;
  prewarmed: boolean;
}

/** Worker URL for spawning */
const WORKER_URL = new URL('../../workers/mdx-compiler.worker.ts', import.meta.url);

/**
 * Create a new worker instance.
 *
 * @param index - Worker pool index
 * @param onMessage - Message handler callback
 * @param onError - Error handler callback
 * @returns New WorkerInstance
 */
function createWorkerInstance(
  index: number,
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
  };
}

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
}

// ============================================================================
// Worker Management Functions
// ============================================================================

/**
 * Restart a specific worker.
 *
 * @param state - Compiler state
 * @param workerIndex - Index of worker to restart
 * @param handleMessage - Message handler function
 * @param handleError - Error handler function
 */
function restartWorker(
  state: CompilerState,
  workerIndex: number,
  handleMessage: (idx: number, event: MessageEvent) => void,
  handleError: (idx: number, event: ErrorEvent) => void
): void {
  const oldInstance = state.workers[workerIndex];
  if (!oldInstance) return;

  // Terminate old worker
  oldInstance.worker.terminate();
  if (oldInstance.heartbeatTimeoutId !== null) {
    clearTimeout(oldInstance.heartbeatTimeoutId);
  }

  // Create new worker
  state.workers[workerIndex] = createWorkerInstance(
    workerIndex,
    handleMessage,
    handleError
  );

  state.workerRestarts++;
  console.info(`[MDX Compiler] Worker ${workerIndex} restarted (total restarts: ${state.workerRestarts})`);
}

/**
 * Handle worker message response.
 *
 * @param state - Compiler state
 * @param workerIndex - Index of worker that sent the message
 * @param event - Message event
 * @param restartFn - Function to restart a worker
 */
function handleWorkerMessage(
  state: CompilerState,
  workerIndex: number,
  event: MessageEvent,
  restartFn: (index: number) => void
): void {
  const data = event.data;

  // Handle heartbeat pong
  if (isHeartbeatPong(data)) {
    const pong = data as HeartbeatPong;
    const workerInstance = state.workers[workerIndex];
    if (workerInstance) {
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
          console.warn(`[MDX Compiler] Worker ${workerIndex} memory critical (${(usageRatio * 100).toFixed(1)}%), restarting...`);
          restartFn(workerIndex);
        } else if (usageRatio >= MEMORY_WARNING_THRESHOLD) {
          console.warn(`[MDX Compiler] Worker ${workerIndex} memory warning (${(usageRatio * 100).toFixed(1)}%)`);
        }
      }
    }
    return;
  }

  // Handle prewarm response
  if (isPrewarmResponse(data)) {
    const response = data as PrewarmResponse;
    const workerInstance = state.workers[workerIndex];
    if (workerInstance) {
      workerInstance.prewarmed = true;
      console.debug(`[MDX Compiler] Worker ${workerIndex} prewarmed in ${response.initDurationMs.toFixed(1)}ms`);
    }
    return;
  }

  // Handle compile response
  const response = data as CompileResponse;
  const pending = state.pendingRequests.get(response.id);
  if (pending === undefined) return;

  clearTimeout(pending.timeoutId);
  state.pendingRequests.delete(response.id);

  const workerInstance = state.workers[pending.workerIndex];
  if (workerInstance) {
    workerInstance.pendingCount = Math.max(0, workerInstance.pendingCount - 1);
  }

  // Record telemetry
  const endTime = performance.now();
  const telemetry: CompileTelemetry = {
    requestId: response.id,
    startTime: pending.startTime,
    endTime,
    durationMs: endTime - pending.startTime,
    success: response.ok,
    retryCount: 0,
    workerIndex: pending.workerIndex,
    queueDepth: state.pendingRequests.size,
  };

  for (const callback of state.telemetryCallbacks) {
    try {
      callback(telemetry);
    } catch (e) {
      console.error('[MDX Compiler] Telemetry callback error:', e);
    }
  }

  state.telemetryHistory.push(telemetry);
  // Keep only last entries
  if (state.telemetryHistory.length > MAX_TELEMETRY_HISTORY) {
    state.telemetryHistory.shift();
  }

  if (response.ok) {
    pending.onSuccess?.(response);
  } else {
    pending.onError?.(response.errors);
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
  for (const [id, pending] of state.pendingRequests) {
    if (pending.workerIndex === workerIndex) {
      clearTimeout(pending.timeoutId);
      state.pendingRequests.delete(id);
      pending.onError?.([{ message: `Worker crashed: ${event.message}` }]);
    }
  }

  // Restart the worker
  restartFn(workerIndex);
}

/**
 * Fail all pending requests with an error message.
 *
 * @param state - Compiler state
 * @param errorMessage - Error message to send to all pending requests
 */
function failAllPendingRequests(
  state: CompilerState,
  errorMessage: string
): void {
  for (const [, pending] of state.pendingRequests) {
    clearTimeout(pending.timeoutId);
    pending.onError?.([{ message: errorMessage }]);
  }
  state.pendingRequests.clear();

  // Reset pending counts
  for (const workerInstance of state.workers) {
    workerInstance.pendingCount = 0;
  }
}

/**
 * Handle empty source compilation efficiently.
 *
 * @param options - Compile options
 * @returns Request ID
 */
function handleEmptySource(options: CompileOptions | undefined): RequestId {
  const id = options?.requestId ?? createRequestId();
  queueMicrotask(() => {
    options?.onSuccess?.({ id, ok: true, code: '', frontmatter: {} });
  });
  return id;
}

/**
 * Set up compilation timeout.
 *
 * @param id - Request ID
 * @param state - Compiler state
 * @returns Timeout ID
 */
function setupTimeout(
  id: RequestId,
  state: CompilerState
): number {
  return window.setTimeout(() => {
    const pending = state.pendingRequests.get(id);
    if (pending !== undefined) {
      state.pendingRequests.delete(id);
      const workerInstance = state.workers[pending.workerIndex];
      if (workerInstance) {
        workerInstance.pendingCount = Math.max(0, workerInstance.pendingCount - 1);
      }
      pending.onError?.([{
        message: `Compilation timed out after ${COMPILE_TIMEOUT_MS / 1000} seconds`,
      }]);
    }
  }, COMPILE_TIMEOUT_MS);
}

/**
 * Select the best worker for the next compilation.
 * Uses round-robin with health and load balancing.
 *
 * @param state - Compiler state
 * @returns Index of selected worker
 */
function selectWorker(state: CompilerState): number {
  let bestIndex = state.nextWorkerIndex;
  let bestLoad = Infinity;

  for (let i = 0; i < state.workers.length; i++) {
    const idx = (state.nextWorkerIndex + i) % state.workers.length;
    const worker = state.workers[idx];
    if (worker && worker.healthy && worker.pendingCount < bestLoad) {
      bestIndex = idx;
      bestLoad = worker.pendingCount;
    }
  }

  state.nextWorkerIndex = (bestIndex + 1) % state.workers.length;
  return bestIndex;
}

/**
 * Send a single compile request and wait for the result.
 *
 * @param state - Compiler state
 * @param source - MDX source to compile
 * @param id - Request ID
 * @param restartFn - Function to restart workers
 * @returns Promise resolving to compile result
 */
function sendCompileRequest(
  state: CompilerState,
  source: string,
  id: RequestId,
  restartFn: (index: number) => void
): Promise<CompileResponseSuccess> {
  return new Promise((resolve, reject) => {
    // Check for queue overflow
    if (state.pendingRequests.size >= MAX_PENDING_REQUESTS) {
      state.queueOverflows++;
      console.warn(`[MDX Compiler] Queue overflow (${state.pendingRequests.size} pending)`);
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      reject([{ message: 'Queue overflow: too many pending requests' }]);
      return;
    }

    const workerIndex = selectWorker(state);
    const workerInstance = state.workers[workerIndex];

    if (!workerInstance || !workerInstance.healthy) {
      try {
        restartFn(workerIndex);
      } catch (e) {
        console.error('[MDX Compiler] Failed to restart worker:', e);
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject([{ message: 'Worker is unhealthy and could not be recovered' }]);
        return;
      }
    }

    const timeoutId = setupTimeout(id, state);
    const startTime = performance.now();

    const pendingRequest: PendingRequest = {
      onSuccess: resolve,
      onError: reject,
      timeoutId,
      startTime,
      workerIndex,
    };

    state.pendingRequests.set(id, pendingRequest);
    state.workers[workerIndex]!.pendingCount++;

    const request: CompileRequest = { id, source };
    state.workers[workerIndex]!.worker.postMessage(request);
  });
}

/**
 * Compile with retry logic for transient failures.
 *
 * @param state - Compiler state
 * @param source - MDX source to compile
 * @param id - Request ID
 * @param config - Retry configuration
 * @param restartFn - Function to restart workers
 * @param onSuccess - Success callback
 * @param onError - Error callback
 */
async function compileWithRetry(
  state: CompilerState,
  source: string,
  id: RequestId,
  config: RetryConfig,
  restartFn: (index: number) => void,
  onSuccess?: (result: CompileResponseSuccess) => void,
  onError?: (errors: readonly CompileError[]) => void
): Promise<void> {
  let lastErrors: readonly CompileError[] = [];

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    if (state.isShuttingDown) {
      onError?.([{ message: 'Compiler is shutting down' }]);
      return;
    }

    try {
      const result = await sendCompileRequest(state, source, id, restartFn);
      onSuccess?.(result);
      return;
    } catch (errors) {
      const compileErrors = errors as readonly CompileError[];
      lastErrors = compileErrors;

      if (!isTransientError(compileErrors)) {
        console.debug('[MDX Compiler] Non-transient error, not retrying:', compileErrors);
        onError?.(compileErrors);
        return;
      }

      if (attempt < config.maxRetries) {
        const backoffDelay = calculateBackoffDelay(attempt, config);
        console.debug(
          `[MDX Compiler] Retry attempt ${attempt + 1}/${config.maxRetries} after ${Math.round(backoffDelay)}ms`,
          compileErrors
        );
        await delay(backoffDelay);
      }
    }
  }

  console.error('[MDX Compiler] All retry attempts exhausted:', lastErrors);
  onError?.(lastErrors);
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

  void compileWithRetry(
    state,
    source,
    id,
    config,
    restartFn,
    options?.onSuccess,
    options?.onError
  );

  return id;
}

/**
 * Start heartbeat monitoring for all workers.
 *
 * @param state - Compiler state
 * @param restartFn - Function to restart workers
 */
function startHeartbeatMonitoring(
  state: CompilerState,
  restartFn: (index: number) => void
): void {
  if (state.heartbeatIntervalId !== null) return;

  state.heartbeatIntervalId = window.setInterval(() => {
    const now = Date.now();

    for (let i = 0; i < state.workers.length; i++) {
      const workerInstance = state.workers[i];
      if (!workerInstance || !workerInstance.healthy) continue;

      const ping: HeartbeatPing = { type: 'heartbeat-ping', timestamp: now };
      workerInstance.worker.postMessage(ping);

      if (workerInstance.heartbeatTimeoutId !== null) {
        clearTimeout(workerInstance.heartbeatTimeoutId);
      }

      const workerIndex = i;
      workerInstance.heartbeatTimeoutId = window.setTimeout(() => {
        const instance = state.workers[workerIndex];
        if (instance) {
          console.warn(`[MDX Compiler] Worker ${workerIndex} heartbeat timeout, marking unhealthy`);
          instance.healthy = false;
          restartFn(workerIndex);
        }
      }, HEARTBEAT_TIMEOUT_MS);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop heartbeat monitoring.
 *
 * @param state - Compiler state
 */
function stopHeartbeatMonitoring(state: CompilerState): void {
  if (state.heartbeatIntervalId !== null) {
    clearInterval(state.heartbeatIntervalId);
    state.heartbeatIntervalId = null;
  }

  for (const workerInstance of state.workers) {
    if (workerInstance.heartbeatTimeoutId !== null) {
      clearTimeout(workerInstance.heartbeatTimeoutId);
      workerInstance.heartbeatTimeoutId = null;
    }
  }
}

/**
 * Prewarm all workers.
 *
 * @param state - Compiler state
 */
async function prewarmAllWorkers(state: CompilerState): Promise<void> {
  const prewarmPromises = state.workers.map((workerInstance, index) => {
    return new Promise<void>((resolve) => {
      if (workerInstance.prewarmed) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        console.warn(`[MDX Compiler] Worker ${index} prewarm timeout`);
        resolve();
      }, PREWARM_TIMEOUT_MS);

      const originalOnMessage = workerInstance.worker.onmessage;
      workerInstance.worker.onmessage = (event: MessageEvent) => {
        if (isPrewarmResponse(event.data)) {
          clearTimeout(timeoutId);
          workerInstance.prewarmed = true;
          workerInstance.worker.onmessage = originalOnMessage;
          resolve();
        } else if (originalOnMessage) {
          originalOnMessage.call(workerInstance.worker, event);
        }
      };

      const request: PrewarmRequest = { type: 'prewarm' };
      workerInstance.worker.postMessage(request);
    });
  });

  await Promise.all(prewarmPromises);
}

/**
 * Calculate telemetry statistics.
 *
 * @param state - Compiler state
 * @returns Aggregated telemetry stats
 */
function calculateTelemetryStats(state: CompilerState): TelemetryStats {
  const history = state.telemetryHistory;

  if (history.length === 0) {
    return {
      totalCompilations: 0,
      successfulCompilations: 0,
      failedCompilations: 0,
      averageDurationMs: 0,
      p95DurationMs: 0,
      totalRetries: 0,
      workerRestarts: state.workerRestarts,
      queueOverflows: state.queueOverflows,
    };
  }

  const successful = history.filter(t => t.success);
  const failed = history.filter(t => !t.success);
  const durations = history.map(t => t.durationMs).sort((a, b) => a - b);
  const totalRetries = history.reduce((sum, t) => sum + t.retryCount, 0);

  const p95Index = Math.floor(durations.length * 0.95);
  const p95Duration = durations[p95Index] ?? 0;

  return {
    totalCompilations: history.length,
    successfulCompilations: successful.length,
    failedCompilations: failed.length,
    averageDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
    p95DurationMs: p95Duration,
    totalRetries,
    workerRestarts: state.workerRestarts,
    queueOverflows: state.queueOverflows,
  };
}

/**
 * Get memory usage from all workers.
 *
 * @param state - Compiler state
 * @returns Array of memory usage from all healthy workers
 */
async function getAllMemoryUsage(state: CompilerState): Promise<WorkerMemoryUsage[]> {
  const usagePromises = state.workers.map((workerInstance) => {
    return new Promise<WorkerMemoryUsage | undefined>((resolve) => {
      if (!workerInstance.healthy) {
        resolve(undefined);
        return;
      }

      if (workerInstance.memoryUsage) {
        resolve(workerInstance.memoryUsage);
        return;
      }

      const timeoutId = setTimeout(() => {
        resolve(undefined);
      }, MEMORY_FETCH_TIMEOUT_MS);

      const originalOnMessage = workerInstance.worker.onmessage;
      workerInstance.worker.onmessage = (event: MessageEvent) => {
        if (isHeartbeatPong(event.data)) {
          clearTimeout(timeoutId);
          workerInstance.worker.onmessage = originalOnMessage;
          resolve((event.data as HeartbeatPong).memoryUsage);
        } else if (originalOnMessage) {
          originalOnMessage.call(workerInstance.worker, event);
        }
      };

      const ping: HeartbeatPing = { type: 'heartbeat-ping', timestamp: Date.now() };
      workerInstance.worker.postMessage(ping);
    });
  });

  const results = await Promise.all(usagePromises);
  return results.filter((usage): usage is WorkerMemoryUsage => usage !== undefined);
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
    stopHeartbeatMonitoring(state);
    failAllPendingRequests(state, 'Page is unloading');

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
export function createMDXCompiler(options?: CreateCompilerOptions): MDXCompiler {
  const state: CompilerState = {
    workers: [],
    pendingRequests: new Map(),
    nextWorkerIndex: 0,
    heartbeatIntervalId: null,
    telemetryCallbacks: new Set(),
    telemetryHistory: [],
    workerRestarts: 0,
    queueOverflows: 0,
    isShuttingDown: false,
  };

  // Create restart function with closure over state
  const doRestart = (index: number): void => {
    restartWorker(state, index, handleMessage, handleError);
  };

  // Create message handler with closure
  const handleMessage = (idx: number, event: MessageEvent): void => {
    handleWorkerMessage(state, idx, event, doRestart);
  };

  // Create error handler with closure
  const handleError = (idx: number, event: ErrorEvent): void => {
    handleWorkerError(state, idx, event, doRestart);
  };

  // Create worker pool
  for (let i = 0; i < WORKER_POOL_SIZE; i++) {
    state.workers.push(
      createWorkerInstance(i, handleMessage, handleError)
    );
  }

  // Start heartbeat monitoring (unless disabled for testing)
  if (!options?.disableHeartbeat) {
    startHeartbeatMonitoring(state, doRestart);
  }

  // Set up graceful shutdown
  const cleanupShutdown = setupGracefulShutdown(state);

  return {
    compile: (source, options) => doCompile(state, source, doRestart, options),

    cancel(requestId: RequestId): void {
      const pending = state.pendingRequests.get(requestId);
      if (pending !== undefined) {
        clearTimeout(pending.timeoutId);
        state.pendingRequests.delete(requestId);
        const workerInstance = state.workers[pending.workerIndex];
        if (workerInstance) {
          workerInstance.pendingCount = Math.max(0, workerInstance.pendingCount - 1);
        }
      }
    },

    terminate(): void {
      state.isShuttingDown = true;
      cleanupShutdown();
      stopHeartbeatMonitoring(state);
      failAllPendingRequests(state, 'Worker terminated');

      for (const workerInstance of state.workers) {
        workerInstance.worker.terminate();
      }
      state.workers.length = 0;
    },

    async prewarm(): Promise<void> {
      await prewarmAllWorkers(state);
    },

    getTelemetryStats(): TelemetryStats {
      return calculateTelemetryStats(state);
    },

    onTelemetry(callback: TelemetryCallback): () => void {
      state.telemetryCallbacks.add(callback);
      return () => {
        state.telemetryCallbacks.delete(callback);
      };
    },

    isHealthy(): boolean {
      return state.workers.some(w => w.healthy);
    },

    async getMemoryUsage(): Promise<WorkerMemoryUsage[]> {
      return getAllMemoryUsage(state);
    },
  };
}
