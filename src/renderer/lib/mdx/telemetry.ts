/**
 * MDX Compiler Telemetry
 *
 * Collects and aggregates performance metrics for MDX compilations.
 * Provides statistics on compilation duration, success rate, and retries.
 *
 * @module renderer/lib/mdx/telemetry
 */

import type { RequestId } from '@shared/types/preview-worker';

// ============================================================================
// Constants
// ============================================================================

/** Maximum telemetry history entries to retain */
export const MAX_TELEMETRY_HISTORY = 1000;

// ============================================================================
// Types
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
// Telemetry Recording
// ============================================================================

/**
 * Record a compilation telemetry event.
 *
 * @param telemetry - Telemetry data to record
 * @param history - Telemetry history array
 * @param callbacks - Registered callbacks
 */
export function recordTelemetry(
  telemetry: CompileTelemetry,
  history: CompileTelemetry[],
  callbacks: Set<TelemetryCallback>
): void {
  // Invoke callbacks
  for (const callback of callbacks) {
    try {
      callback(telemetry);
    } catch (e) {
      console.error('[MDX Compiler] Telemetry callback error:', e);
    }
  }

  // Add to history
  history.push(telemetry);

  // Keep only last entries
  if (history.length > MAX_TELEMETRY_HISTORY) {
    history.shift();
  }
}

/**
 * Create a telemetry entry for a compilation.
 *
 * @param requestId - Request ID
 * @param startTime - Compilation start timestamp
 * @param success - Whether compilation succeeded
 * @param retryCount - Number of retries
 * @param workerIndex - Worker that handled the request
 * @param queueDepth - Current queue depth
 * @returns Telemetry entry
 */
export function createTelemetry(
  requestId: RequestId,
  startTime: number,
  success: boolean,
  retryCount: number,
  workerIndex: number,
  queueDepth: number
): CompileTelemetry {
  const endTime = performance.now();
  return {
    requestId,
    startTime,
    endTime,
    durationMs: endTime - startTime,
    success,
    retryCount,
    workerIndex,
    queueDepth,
  };
}

// ============================================================================
// Statistics Calculation
// ============================================================================

/**
 * Calculate telemetry statistics.
 *
 * @param history - Telemetry history
 * @param workerRestarts - Total worker restarts
 * @param queueOverflows - Total queue overflows
 * @returns Aggregated telemetry stats
 */
export function calculateTelemetryStats(
  history: readonly CompileTelemetry[],
  workerRestarts: number,
  queueOverflows: number
): TelemetryStats {
  if (history.length === 0) {
    return {
      totalCompilations: 0,
      successfulCompilations: 0,
      failedCompilations: 0,
      averageDurationMs: 0,
      p95DurationMs: 0,
      totalRetries: 0,
      workerRestarts,
      queueOverflows,
    };
  }

  let successCount = 0;
  let totalRetries = 0;
  const durations: number[] = [];
  for (const entry of history) {
    if (entry.success) successCount++;
    totalRetries += entry.retryCount;
    durations.push(entry.durationMs);
  }
  durations.sort((a, b) => a - b);

  const p95Index = Math.floor(durations.length * 0.95);
  const p95Duration = durations[p95Index] ?? 0;

  return {
    totalCompilations: history.length,
    successfulCompilations: successCount,
    failedCompilations: history.length - successCount,
    averageDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
    p95DurationMs: p95Duration,
    totalRetries,
    workerRestarts,
    queueOverflows,
  };
}

/**
 * Register a telemetry callback.
 *
 * @param callback - Callback function to register
 * @param callbacks - Set of registered callbacks
 * @returns Cleanup function to unregister the callback
 */
export function registerTelemetryCallback(
  callback: TelemetryCallback,
  callbacks: Set<TelemetryCallback>
): () => void {
  callbacks.add(callback);
  return () => {
    callbacks.delete(callback);
  };
}
