/**
 * Editor Error Handling Utilities
 *
 * Provides structured error creation, logging, and type guards for the editor.
 * Errors are logged to console immediately and returned as structured events
 * for external consumption per research.md Decision 7.
 *
 * @module editor/errors
 */

/**
 * Structured error event for logging and external consumption.
 * Immutable by design - all properties are readonly.
 */
export interface EditorError {
  /** Category of error */
  readonly type: 'syntax' | 'command' | 'extension';
  /** Human-readable error description */
  readonly message: string;
  /** Unix timestamp (ms) when error occurred */
  readonly timestamp: number;
  /** Optional additional data for debugging */
  readonly context?: Record<string, unknown>;
}

/**
 * Union type of all possible error types.
 * Extracted from EditorError['type'] for type safety.
 */
export type EditorErrorType = EditorError['type'];

/**
 * Create a structured editor error with console logging.
 *
 * Creates an immutable EditorError object and logs it to the console
 * for immediate debugging visibility. The structured format enables
 * future telemetry integration while maintaining development ergonomics.
 *
 * @param type - The category of error ('syntax' | 'command' | 'extension')
 * @param message - Human-readable error description
 * @param context - Optional additional data for debugging
 * @returns Immutable EditorError object
 *
 * @example
 * ```typescript
 * const error = createEditorError('syntax', 'Invalid JSX expression', {
 *   line: 42,
 *   column: 15,
 *   source: '<Component {invalid} />'
 * });
 * ```
 */
export function createEditorError(
  type: EditorErrorType,
  message: string,
  context?: Record<string, unknown>
): EditorError {
  const error: EditorError = {
    type,
    message,
    timestamp: Date.now(),
    ...(context !== undefined && { context }),
  };

  // Console logging per research.md Decision 7
  console.error(`[EditorError:${type}] ${message}`, context ?? '');

  return error;
}

/**
 * Type guard to check if an EditorError is a syntax error.
 *
 * @param error - The EditorError to check
 * @returns True if the error type is 'syntax', narrowing the type
 *
 * @example
 * ```typescript
 * if (isSyntaxError(error)) {
 *   // Handle syntax-specific recovery
 *   highlightErrorLine(error.context?.line);
 * }
 * ```
 */
export function isSyntaxError(error: EditorError): error is EditorError & { type: 'syntax' } {
  return error.type === 'syntax';
}

/**
 * Type guard to check if an EditorError is a command error.
 *
 * @param error - The EditorError to check
 * @returns True if the error type is 'command', narrowing the type
 *
 * @example
 * ```typescript
 * if (isCommandError(error)) {
 *   // Handle command execution failure
 *   showCommandFeedback(error.message);
 * }
 * ```
 */
export function isCommandError(error: EditorError): error is EditorError & { type: 'command' } {
  return error.type === 'command';
}

/**
 * Type guard to check if an EditorError is an extension error.
 *
 * @param error - The EditorError to check
 * @returns True if the error type is 'extension', narrowing the type
 *
 * @example
 * ```typescript
 * if (isExtensionError(error)) {
 *   // Handle extension failure gracefully
 *   disableExtension(error.context?.extensionId);
 * }
 * ```
 */
export function isExtensionError(error: EditorError): error is EditorError & { type: 'extension' } {
  return error.type === 'extension';
}
