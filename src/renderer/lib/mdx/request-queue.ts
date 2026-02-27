/**
 * MDX Compiler Request Queue
 *
 * Manages compilation request queue with timeout, retry, and error handling.
 * Handles request/response correlation and stale response detection.
 *
 * @module renderer/lib/mdx/request-queue
 */

import type {
  CompileRequest,
  CompileResponse,
  CompileResponseSuccess,
  MdxPluginPipelineConfig,
  RequestId,
} from '@shared/types/preview-worker';
import { createRequestId } from '@shared/types/preview-worker';
import type { CompileError } from '@shared/types/preview';
import type { WorkerInstance } from './worker-pool';

// ============================================================================
// Constants
// ============================================================================

/** Compilation timeout in milliseconds (30 seconds) */
export const COMPILE_TIMEOUT_MS = 30_000;

/** Maximum jitter added to backoff delay in milliseconds */
export const BACKOFF_JITTER_MS = 100;

/** Maximum pending requests before queue overflow protection kicks in */
export const MAX_PENDING_REQUESTS = 100;

/** Error messages that indicate transient (retryable) failures */
export const TRANSIENT_ERROR_PATTERNS = [
  'Worker crashed',
  'Worker is unhealthy',
  'Worker terminated',
  'timed out',
  'Queue overflow',
  'Stale response',
] as const;

const STALE_RESPONSE_ERROR_MESSAGE = 'Stale response from previous worker generation';
const REQUEST_CANCELLED_ERROR_MESSAGE = 'Compilation request cancelled';

// ============================================================================
// Types
// ============================================================================

/** Configuration for retry behavior */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
}

/** Default retry configuration */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 2000,
};

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
  /** Optional per-request plugin pipeline configuration */
  pluginConfig?: MdxPluginPipelineConfig | undefined;
}

/** Stored callback for pending compilation requests (P0-5: added generation) */
export interface PendingRequest {
  readonly resolve: (result: CompileResponseSuccess) => void;
  readonly reject: (errors: readonly CompileError[]) => void;
  readonly userOnSuccess?: ((result: CompileResponseSuccess) => void) | undefined;
  readonly userOnError?: ((errors: readonly CompileError[]) => void) | undefined;
  readonly timeoutId: number;
  readonly startTime: number;
  readonly workerIndex: number;
  readonly generation: number; // P0-5: Track worker generation
}

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
export function isTransientError(errors: readonly CompileError[]): boolean {
  if (errors.length === 0) return false;
  const message = errors[0]?.message ?? '';
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Calculate delay with exponential backoff and jitter.
 *
 * @param attempt - Current retry attempt number (0-based)
 * @param config - Retry configuration with base delay and max delay
 * @returns Calculated delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
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
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Handle empty source compilation efficiently.
 *
 * @param options - Compile options
 * @returns Request ID
 */
export function handleEmptySource(options: CompileOptions | undefined): RequestId {
  const id = options?.requestId ?? createRequestId();
  queueMicrotask(() => {
    options?.onSuccess?.({ id, ok: true, code: '', frontmatter: {} });
  });
  return id;
}

// ============================================================================
// Request Queue Operations
// ============================================================================

/**
 * Set up compilation timeout.
 *
 * @param id - Request ID
 * @param pendingRequests - Map of pending requests
 * @param workers - Worker pool array
 * @returns Timeout ID
 */
export function setupTimeout(
  id: RequestId,
  pendingRequests: Map<RequestId, PendingRequest>,
  workers: WorkerInstance[]
): number {
  return window.setTimeout(() => {
    const pending = pendingRequests.get(id);
    if (pending !== undefined) {
      pendingRequests.delete(id);
      const workerInstance = workers[pending.workerIndex];
      if (workerInstance) {
        workerInstance.pendingCount = Math.max(0, workerInstance.pendingCount - 1);
      }
      const errors = [
        {
          message: `Compilation timed out after ${COMPILE_TIMEOUT_MS / 1000} seconds`,
        },
      ];
      pending.userOnError?.(errors);
      pending.reject(errors);
    }
  }, COMPILE_TIMEOUT_MS);
}

function createCompileRequest(
  id: RequestId,
  source: string,
  pluginConfig: MdxPluginPipelineConfig | undefined
): CompileRequest {
  return pluginConfig === undefined ? { id, source } : { id, source, pluginConfig };
}

/**
 * Send a single compile request and wait for the result.
 *
 * @param workers - Worker pool array
 * @param pendingRequests - Map of pending requests
 * @param queueOverflows - Counter for queue overflows
 * @param source - MDX source to compile
 * @param id - Request ID
 * @param workerIndex - Selected worker index
 * @param generation - Worker generation (P0-5)
 * @param userOnSuccess - User's success callback (called synchronously on response)
 * @param userOnError - User's error callback (called synchronously on response)
 * @param onRestart - Callback to restart a worker
 * @returns Promise resolving to compile result
 */
export function sendCompileRequest(
  workers: WorkerInstance[],
  pendingRequests: Map<RequestId, PendingRequest>,
  queueOverflows: { count: number },
  source: string,
  pluginConfig: MdxPluginPipelineConfig | undefined,
  id: RequestId,
  workerIndex: number,
  generation: number, // P0-5: Accept generation
  userOnSuccess: ((result: CompileResponseSuccess) => void) | undefined,
  userOnError: ((errors: readonly CompileError[]) => void) | undefined,
  onRestart: (index: number) => void
): Promise<CompileResponseSuccess> {
  return new Promise((resolve, reject) => {
    // Check for queue overflow
    if (pendingRequests.size >= MAX_PENDING_REQUESTS) {
      queueOverflows.count++;
      console.warn(`[MDX Compiler] Queue overflow (${pendingRequests.size} pending)`);
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      reject([{ message: 'Queue overflow: too many pending requests' }]);
      return;
    }

    const workerInstance = workers[workerIndex];

    if (!workerInstance?.healthy) {
      try {
        onRestart(workerIndex);
      } catch (e) {
        console.error('[MDX Compiler] Failed to restart worker:', e);
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject([{ message: 'Worker is unhealthy and could not be recovered' }]);
        return;
      }
    }

    const timeoutId = setupTimeout(id, pendingRequests, workers);
    const startTime = performance.now();

    const pendingRequest: PendingRequest = {
      resolve,
      reject,
      userOnSuccess,
      userOnError,
      timeoutId,
      startTime,
      workerIndex,
      generation, // P0-5: Store generation
    };

    pendingRequests.set(id, pendingRequest);
    const selectedWorker = workers[workerIndex];
    if (selectedWorker) {
      selectedWorker.pendingCount++;
      selectedWorker.worker.postMessage(createCompileRequest(id, source, pluginConfig));
    }
  });
}

/**
 * Attempt a single compilation with error handling.
 */
async function attemptCompilation(
  workers: WorkerInstance[],
  pendingRequests: Map<RequestId, PendingRequest>,
  queueOverflows: { count: number },
  source: string,
  pluginConfig: MdxPluginPipelineConfig | undefined,
  id: RequestId,
  selectWorkerFn: () => number,
  userOnSuccess: ((result: CompileResponseSuccess) => void) | undefined,
  userOnError: ((errors: readonly CompileError[]) => void) | undefined,
  onRestart: (index: number) => void
): Promise<CompileResponseSuccess> {
  const workerIndex = selectWorkerFn();
  const workerInstance = workers[workerIndex];
  const generation = workerInstance?.generation ?? 0; // P0-5: Get generation

  return sendCompileRequest(
    workers,
    pendingRequests,
    queueOverflows,
    source,
    pluginConfig,
    id,
    workerIndex,
    generation, // P0-5: Pass generation
    userOnSuccess,
    userOnError,
    onRestart
  );
}

/**
 * Handle retry after compilation failure.
 */
async function handleRetry(
  attempt: number,
  config: RetryConfig,
  errors: readonly CompileError[]
): Promise<boolean> {
  if (attempt >= config.maxRetries) return false;

  const backoffDelay = calculateBackoffDelay(attempt, config);
  console.debug(
    `[MDX Compiler] Retry attempt ${attempt + 1}/${config.maxRetries} after ${Math.round(backoffDelay)}ms`,
    errors
  );
  await delay(backoffDelay);
  return true;
}

function emitTerminalError(
  errors: readonly CompileError[],
  alreadyReported: boolean,
  onError: ((errors: readonly CompileError[]) => void) | undefined
): void {
  if (alreadyReported || errors[0]?.message === REQUEST_CANCELLED_ERROR_MESSAGE) return;
  onError?.(errors);
}

function createTrackedOnError(
  onError: ((errors: readonly CompileError[]) => void) | undefined,
  onReported: () => void
): ((errors: readonly CompileError[]) => void) | undefined {
  if (onError === undefined) return undefined;
  return (errors: readonly CompileError[]) => {
    onReported();
    onError(errors);
  };
}

/**
 * Compile with retry logic for transient failures.
 * User callbacks are invoked synchronously on response to preserve ordering.
 */
export async function compileWithRetry(
  workers: WorkerInstance[],
  pendingRequests: Map<RequestId, PendingRequest>,
  queueOverflows: { count: number },
  isShuttingDown: boolean,
  source: string,
  pluginConfig: MdxPluginPipelineConfig | undefined,
  id: RequestId,
  config: RetryConfig,
  selectWorkerFn: () => number,
  onRestart: (index: number) => void,
  onSuccess?: (result: CompileResponseSuccess) => void,
  onError?: (errors: readonly CompileError[]) => void
): Promise<void> {
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    if (isShuttingDown) {
      onError?.([{ message: 'Compiler is shutting down' }]);
      return;
    }

    let attemptErrorReported = false;
    const trackedOnError = createTrackedOnError(onError, () => {
      attemptErrorReported = true;
    });

    try {
      await attemptCompilation(
        workers,
        pendingRequests,
        queueOverflows,
        source,
        pluginConfig,
        id,
        selectWorkerFn,
        onSuccess,
        trackedOnError,
        onRestart
      );
      return;
    } catch (errors) {
      const compileErrors = errors as readonly CompileError[];

      if (!isTransientError(compileErrors)) {
        console.debug('[MDX Compiler] Non-transient error, not retrying:', compileErrors);
        emitTerminalError(compileErrors, attemptErrorReported, onError);
        return;
      }

      const shouldRetry = await handleRetry(attempt, config, compileErrors);
      if (!shouldRetry) {
        console.error('[MDX Compiler] All retry attempts exhausted:', compileErrors);
        emitTerminalError(compileErrors, attemptErrorReported, onError);
        return;
      }
    }
  }
}

/**
 * Handle compile response (P0-5: reject stale responses from wrong generation).
 *
 * @param response - Compile response from worker
 * @param pending - Pending request metadata
 * @param workers - Worker pool array
 * @param pendingRequests - Map of pending requests
 * @returns True if response was handled, false if rejected as stale
 */
export function handleCompileResponse(
  response: CompileResponse,
  pending: PendingRequest,
  workers: WorkerInstance[],
  pendingRequests: Map<RequestId, PendingRequest>
): boolean {
  const workerInstance = workers[pending.workerIndex];

  // P0-5: Reject stale responses from wrong generation
  if (workerInstance && workerInstance.generation !== pending.generation) {
    console.debug(
      `[MDX Compiler] Rejecting stale response from worker ${pending.workerIndex} (request gen ${pending.generation}, worker gen ${workerInstance.generation})`
    );
    clearTimeout(pending.timeoutId);
    pendingRequests.delete(response.id);
    workerInstance.pendingCount = Math.max(0, workerInstance.pendingCount - 1);
    pending.reject([{ message: STALE_RESPONSE_ERROR_MESSAGE }]);
    return false;
  }

  clearTimeout(pending.timeoutId);
  pendingRequests.delete(response.id);

  if (workerInstance) {
    workerInstance.pendingCount = Math.max(0, workerInstance.pendingCount - 1);
  }

  // Call user callbacks synchronously to preserve response order
  if (response.ok) {
    pending.userOnSuccess?.(response);
    pending.resolve(response);
  } else {
    pending.userOnError?.(response.errors);
    pending.reject(response.errors);
  }

  return true;
}

/**
 * Fail all pending requests with an error message.
 *
 * @param pendingRequests - Map of pending requests
 * @param workers - Worker pool array
 * @param errorMessage - Error message to send to all pending requests
 */
export function failAllPendingRequests(
  pendingRequests: Map<RequestId, PendingRequest>,
  workers: WorkerInstance[],
  errorMessage: string
): void {
  const errors = [{ message: errorMessage }];
  for (const [, pending] of pendingRequests) {
    clearTimeout(pending.timeoutId);
    pending.userOnError?.(errors);
    pending.reject(errors);
  }
  pendingRequests.clear();

  // Reset pending counts
  for (const workerInstance of workers) {
    workerInstance.pendingCount = 0;
  }
}

/**
 * Cancel a pending compilation request.
 *
 * @param requestId - Request ID to cancel
 * @param pendingRequests - Map of pending requests
 * @param workers - Worker pool array
 */
export function cancelRequest(
  requestId: RequestId,
  pendingRequests: Map<RequestId, PendingRequest>,
  workers: WorkerInstance[]
): void {
  const pending = pendingRequests.get(requestId);
  if (pending !== undefined) {
    clearTimeout(pending.timeoutId);
    pendingRequests.delete(requestId);
    const workerInstance = workers[pending.workerIndex];
    if (workerInstance) {
      workerInstance.pendingCount = Math.max(0, workerInstance.pendingCount - 1);
    }
    pending.reject([{ message: REQUEST_CANCELLED_ERROR_MESSAGE }]);
  }
}
