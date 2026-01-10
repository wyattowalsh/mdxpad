/**
 * Preview Worker Message Types
 *
 * Defines the interface between the renderer process and the MDX compilation Web Worker.
 * @module shared/types/preview-worker
 */

import type { CompileError } from './preview';

// ============================================================================
// Worker Control Message Types
// ============================================================================

/** Heartbeat ping from main thread to worker */
export interface HeartbeatPing {
  readonly type: 'heartbeat-ping';
  readonly timestamp: number;
}

/** Heartbeat pong response from worker */
export interface HeartbeatPong {
  readonly type: 'heartbeat-pong';
  readonly timestamp: number;
  readonly memoryUsage?: WorkerMemoryUsage | undefined;
}

/** Worker memory usage information */
export interface WorkerMemoryUsage {
  readonly usedJSHeapSize: number;
  readonly totalJSHeapSize: number;
  readonly jsHeapSizeLimit: number;
}

/** Prewarm request to initialize worker compilation pipeline */
export interface PrewarmRequest {
  readonly type: 'prewarm';
}

/** Prewarm response indicating worker is ready */
export interface PrewarmResponse {
  readonly type: 'prewarm-complete';
  readonly initDurationMs: number;
}

/** Worker message types union */
export type WorkerControlMessage = HeartbeatPing | PrewarmRequest;

/** Worker response types union */
export type WorkerControlResponse = HeartbeatPong | PrewarmResponse;

/**
 * Type guard for heartbeat ping message.
 */
export function isHeartbeatPing(message: unknown): message is HeartbeatPing {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'heartbeat-ping'
  );
}

/**
 * Type guard for heartbeat pong message.
 */
export function isHeartbeatPong(message: unknown): message is HeartbeatPong {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'heartbeat-pong'
  );
}

/**
 * Type guard for prewarm request message.
 */
export function isPrewarmRequest(message: unknown): message is PrewarmRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'prewarm'
  );
}

/**
 * Type guard for prewarm response message.
 */
export function isPrewarmResponse(message: unknown): message is PrewarmResponse {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'prewarm-complete'
  );
}

// ============================================================================
// Branded RequestId Type
// ============================================================================

/** Brand symbol for RequestId type safety */
declare const RequestIdBrand: unique symbol;

/**
 * Branded type for request correlation IDs.
 * Prevents accidental mixing of arbitrary strings with request IDs.
 */
export type RequestId = string & { readonly [RequestIdBrand]: never };

/**
 * Creates a new unique RequestId using crypto.randomUUID().
 *
 * @returns A new branded RequestId
 */
export function createRequestId(): RequestId {
  return crypto.randomUUID() as RequestId;
}

/**
 * Type guard to validate if a value is a valid RequestId (UUID v4 format).
 *
 * @param value - Unknown value to validate
 * @returns True if value is a valid UUID v4 string
 */
export function isRequestId(value: unknown): value is RequestId {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

// ============================================================================
// Compile Request/Response Types
// ============================================================================

/** Request sent from renderer to MDX compilation worker */
export interface CompileRequest {
  /** UUID for request correlation and stale response detection */
  readonly id: RequestId;
  /** MDX source text to compile */
  readonly source: string;
}

/** Response sent from worker to renderer */
export type CompileResponse = CompileResponseSuccess | CompileResponseFailure;

/** Successful compilation result */
export interface CompileResponseSuccess {
  /** Correlation ID matching the request */
  readonly id: RequestId;
  /** Discriminant for success */
  readonly ok: true;
  /** Compiled JavaScript code (function body for new Function()) */
  readonly code: string;
  /** Parsed YAML frontmatter */
  readonly frontmatter: Readonly<Record<string, unknown>>;
}

/** Failed compilation result */
export interface CompileResponseFailure {
  /** Correlation ID matching the request */
  readonly id: RequestId;
  /** Discriminant for failure */
  readonly ok: false;
  /** Compilation errors with position information */
  readonly errors: readonly CompileError[];
}

/**
 * Type guard for successful compilation response.
 *
 * @param response - Compile response to check
 * @returns True if response indicates successful compilation
 */
export function isCompileSuccess(
  response: CompileResponse
): response is CompileResponseSuccess {
  return response.ok === true;
}

/**
 * Type guard for failed compilation response.
 *
 * @param response - Compile response to check
 * @returns True if response indicates failed compilation
 */
export function isCompileFailure(
  response: CompileResponse
): response is CompileResponseFailure {
  return response.ok === false;
}

/**
 * Type guard for compile request from unknown input.
 *
 * @param message - Unknown message to validate
 * @returns True if message is a valid CompileRequest
 */
export function isCompileRequest(message: unknown): message is CompileRequest {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as { id?: unknown; source?: unknown };
  return isRequestId(msg.id) && typeof msg.source === 'string';
}

/**
 * Type guard for compile response from unknown input.
 *
 * @param message - Unknown message to validate
 * @returns True if message is a valid CompileResponse
 */
export function isCompileResponse(message: unknown): message is CompileResponse {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as { id?: unknown; ok?: unknown };
  return isRequestId(msg.id) && typeof msg.ok === 'boolean';
}

/**
 * Helper for exhaustive discriminated union checking on CompileResponse.
 * Use in switch/if-else default cases to ensure all union members are handled.
 *
 * @param value - Value that should be of type never (compile-time check)
 * @param message - Optional custom error message
 * @returns Never (always throws)
 * @throws TypeError if called with a non-never value (indicates unhandled case)
 */
export function assertNeverResponse(value: never, message?: string): never {
  throw new TypeError(
    message ?? `Unhandled CompileResponse variant: ${JSON.stringify(value)}`
  );
}
