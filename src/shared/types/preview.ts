/**
 * Preview type definitions.
 * Defines types for MDX compilation and preview state.
 */

/** MDX compilation result */
export type CompileResult = CompileSuccess | CompileFailure;

export interface CompileSuccess {
  readonly ok: true;
  readonly code: string; // Compiled JavaScript
  readonly frontmatter: Record<string, unknown>;
}

export interface CompileFailure {
  readonly ok: false;
  readonly errors: CompileError[];
}

export interface CompileError {
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly source?: string;
}

/** Preview configuration */
export interface PreviewConfig {
  readonly debounceMs: number;
  readonly components: Record<string, unknown>; // Component overrides
}

/** Preview state */
export type PreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'compiling' }
  | { readonly status: 'success'; readonly result: CompileSuccess }
  | { readonly status: 'error'; readonly errors: CompileError[] };
