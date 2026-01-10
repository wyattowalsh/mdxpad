/**
 * Preview Type Definitions
 *
 * Defines types for MDX compilation results and preview state management.
 * These types are shared between the renderer process and workers.
 *
 * @module shared/types/preview
 */

// ============================================================================
// Compilation Results
// ============================================================================

/**
 * MDX compilation result - either success or failure.
 * Use the `ok` discriminant to narrow the type.
 */
export type CompileResult = CompileSuccess | CompileFailure;

/**
 * Successful MDX compilation result.
 * Contains the compiled JavaScript code and parsed frontmatter.
 */
export interface CompileSuccess {
  /** Discriminant indicating successful compilation */
  readonly ok: true;
  /** Compiled JavaScript code ready for execution */
  readonly code: string;
  /** Parsed YAML frontmatter as key-value pairs */
  readonly frontmatter: Readonly<Record<string, unknown>>;
}

/**
 * Failed MDX compilation result.
 * Contains an array of structured error information.
 */
export interface CompileFailure {
  /** Discriminant indicating failed compilation */
  readonly ok: false;
  /** Array of compilation errors with position information */
  readonly errors: readonly CompileError[];
}

/**
 * Structured compilation error with optional source location.
 * Line and column are 1-indexed when present.
 */
export interface CompileError {
  /** Human-readable error message */
  readonly message: string;
  /** Line number where the error occurred (1-indexed) */
  readonly line?: number;
  /** Column number where the error occurred (1-indexed) */
  readonly column?: number;
  /** Source identifier (e.g., plugin name) */
  readonly source?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Preview configuration options.
 * Controls compilation behavior and component overrides.
 */
export interface PreviewConfig {
  /** Debounce delay in milliseconds before triggering compilation */
  readonly debounceMs: number;
  /** Custom component overrides for MDX rendering */
  readonly components: Readonly<Record<string, unknown>>;
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Preview state machine.
 * Represents the current state of MDX compilation and rendering.
 *
 * States:
 * - `idle`: Initial state, no compilation in progress
 * - `compiling`: MDX compilation is in progress
 * - `success`: Compilation completed successfully
 * - `error`: Compilation failed with errors
 */
export type PreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'compiling' }
  | { readonly status: 'success'; readonly result: CompileSuccess }
  | { readonly status: 'error'; readonly errors: readonly CompileError[] };
