/**
 * Preview Worker Contract
 *
 * Defines the interface between the renderer process and the MDX compilation Web Worker.
 * The worker is stateless - it receives compilation requests and returns results.
 *
 * @module contracts/preview-worker
 */

import type { CompileError } from '../../../src/shared/types/preview';

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request sent from renderer to MDX compilation worker.
 *
 * The `id` field is used to correlate responses with requests,
 * enabling debouncing (stale responses can be discarded).
 */
export interface CompileRequest {
  /** UUID for request correlation and stale response detection */
  readonly id: string;

  /** MDX source text to compile */
  readonly source: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response sent from worker to renderer.
 * Discriminated union on `ok` field.
 */
export type CompileResponse = CompileResponseSuccess | CompileResponseFailure;

/**
 * Successful compilation result.
 */
export interface CompileResponseSuccess {
  /** Correlation ID matching the request */
  readonly id: string;

  /** Discriminant for success */
  readonly ok: true;

  /**
   * Compiled JavaScript code.
   * Format: function body suitable for `new Function()` instantiation.
   * Exports `default` as the MDX component.
   */
  readonly code: string;

  /**
   * Parsed YAML frontmatter.
   * Empty object if no frontmatter present.
   */
  readonly frontmatter: Record<string, unknown>;
}

/**
 * Failed compilation result.
 */
export interface CompileResponseFailure {
  /** Correlation ID matching the request */
  readonly id: string;

  /** Discriminant for failure */
  readonly ok: false;

  /**
   * Compilation errors with position information.
   * Multiple errors possible (e.g., multiple syntax errors).
   */
  readonly errors: CompileError[];
}

// ============================================================================
// Worker API Contract
// ============================================================================

/**
 * Contract for the MDX compilation Web Worker.
 *
 * @example
 * ```typescript
 * // Creating and using the worker
 * const worker = new Worker(
 *   new URL('../workers/mdx-compiler.worker.ts', import.meta.url),
 *   { type: 'module' }
 * );
 *
 * // Sending a compilation request
 * const request: CompileRequest = {
 *   id: crypto.randomUUID(),
 *   source: '# Hello World',
 * };
 * worker.postMessage(request);
 *
 * // Handling the response
 * worker.onmessage = (event: MessageEvent<CompileResponse>) => {
 *   if (event.data.ok) {
 *     console.log('Compiled:', event.data.code);
 *   } else {
 *     console.error('Errors:', event.data.errors);
 *   }
 * };
 * ```
 */
export interface MDXCompilerWorkerContract {
  /**
   * Post a compilation request to the worker.
   * @param request The MDX source and correlation ID
   */
  postMessage(request: CompileRequest): void;

  /**
   * Handle compilation responses from the worker.
   */
  onmessage: ((event: MessageEvent<CompileResponse>) => void) | null;

  /**
   * Handle worker errors (e.g., worker crash, syntax error in worker code).
   */
  onerror: ((event: ErrorEvent) => void) | null;

  /**
   * Terminate the worker.
   * Should be called when the preview pane is unmounted.
   */
  terminate(): void;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for successful compilation response.
 */
export function isCompileSuccess(
  response: CompileResponse
): response is CompileResponseSuccess {
  return response.ok === true;
}

/**
 * Type guard for failed compilation response.
 */
export function isCompileFailure(
  response: CompileResponse
): response is CompileResponseFailure {
  return response.ok === false;
}
