/**
 * MDX Compilation Logic
 *
 * Core compilation functions extracted for testability.
 * Used by the MDX compilation Web Worker.
 *
 * @module renderer/lib/mdx/compile
 */

import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import rehypeHighlight from 'rehype-highlight';
import { matter } from 'vfile-matter';
import { VFile } from 'vfile';
import type {
  CompileResponse,
  CompileResponseSuccess,
  CompileResponseFailure,
  RequestId,
} from '@shared/types/preview-worker';
import type { CompileError } from '@shared/types/preview';

/** Maximum source size in characters (500KB) */
export const MAX_SOURCE_SIZE = 500_000;

/**
 * Minimal interface for VFile message diagnostics.
 * Avoids direct dependency on vfile-message types.
 */
export interface VFileDiagnostic {
  readonly message: string;
  readonly line?: number | null | undefined;
  readonly column?: number | null | undefined;
  readonly source?: string | null | undefined;
  readonly fatal?: boolean | null | undefined;
}

/**
 * Extract CompileError from VFile diagnostic message.
 *
 * @param diagnostic - VFile diagnostic message containing error details
 * @returns Normalized CompileError with message and optional position
 */
export function extractError(diagnostic: VFileDiagnostic): CompileError {
  const error: CompileError = { message: diagnostic.message };
  if (diagnostic.line != null) (error as { line: number }).line = diagnostic.line;
  if (diagnostic.column != null) (error as { column: number }).column = diagnostic.column;
  if (diagnostic.source != null) (error as { source: string }).source = diagnostic.source;
  return error;
}

/**
 * Ensures frontmatter is serializable for postMessage.
 * Removes non-serializable values (functions, symbols, etc.) via JSON round-trip.
 *
 * @param frontmatter - Raw frontmatter object from YAML parsing
 * @returns Sanitized frontmatter safe for structured clone transfer
 */
export function sanitizeFrontmatter(
  frontmatter: Record<string, unknown>
): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(frontmatter)) as Record<string, unknown>;
  } catch (error) {
    console.warn('[MDX Worker] Frontmatter contains non-serializable values:', error);
    return {};
  }
}

/**
 * Extract CompileError from unknown error.
 * Handles both Error instances and non-Error values.
 *
 * @param error - Unknown error value from catch block
 * @returns Normalized CompileError with message and optional position
 */
export function extractUnknownError(error: unknown): CompileError {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const vfileError = error as Error & {
    line?: number | null;
    column?: number | null;
    source?: string | null;
  };

  const compileError: CompileError = { message: error.message };
  if (vfileError.line != null) (compileError as { line: number }).line = vfileError.line;
  if (vfileError.column != null) (compileError as { column: number }).column = vfileError.column;
  if (vfileError.source != null) (compileError as { source: string }).source = vfileError.source;
  return compileError;
}

/**
 * Create empty source result for empty MDX input.
 *
 * @param id - Request ID for correlation
 * @returns Success response with empty code and frontmatter
 */
function createEmptyResult(id: RequestId): CompileResponseSuccess {
  return { id, ok: true, code: '', frontmatter: {} };
}

/**
 * Create error result for source exceeding size limit.
 *
 * @param id - Request ID for correlation
 * @param sourceLength - Actual source length in characters
 * @returns Failure response with size limit error
 */
function createSizeLimitError(id: RequestId, sourceLength: number): CompileResponseFailure {
  return {
    id,
    ok: false,
    errors: [{
      message: `Document too large: ${sourceLength.toLocaleString()} characters exceeds limit of ${MAX_SOURCE_SIZE.toLocaleString()} characters`,
    }],
  };
}

/**
 * Perform the actual MDX compilation using @mdx-js/mdx.
 * Extracts frontmatter, applies remark/rehype plugins, and compiles to JS.
 *
 * @param id - Request ID for correlation
 * @param source - MDX source string to compile
 * @returns Compilation response (success with code or failure with errors)
 */
async function performCompilation(
  id: RequestId,
  source: string
): Promise<CompileResponse> {
  const vfile = new VFile({ value: source });
  matter(vfile, { strip: true });

  const rawFrontmatter = (vfile.data.matter ?? {}) as Record<string, unknown>;
  const frontmatter = sanitizeFrontmatter(rawFrontmatter);

  const result = await compile(vfile, {
    outputFormat: 'function-body',
    remarkPlugins: [remarkGfm, remarkFrontmatter],
    rehypePlugins: [rehypeHighlight],
  });

  const fatalMessages = result.messages.filter((msg) => msg.fatal === true);
  if (fatalMessages.length > 0) {
    return { id, ok: false, errors: fatalMessages.map(extractError) };
  }

  return { id, ok: true, code: String(result), frontmatter };
}

/**
 * Compile MDX source to JavaScript function body.
 * Main entry point for MDX compilation, handling empty source and size limits.
 *
 * @param id - Request ID for correlation
 * @param source - MDX source string to compile
 * @returns Compilation response (success with code or failure with errors)
 */
export async function compileMdx(
  id: RequestId,
  source: string
): Promise<CompileResponse> {
  if (source === '') return createEmptyResult(id);
  if (source.length > MAX_SOURCE_SIZE) return createSizeLimitError(id, source.length);

  try {
    return await performCompilation(id, source);
  } catch (error: unknown) {
    return { id, ok: false, errors: [extractUnknownError(error)] };
  }
}

/**
 * Prewarm the MDX compiler by performing a minimal compilation.
 * This initializes the remark/rehype plugin pipeline and JIT compiles
 * frequently-used code paths, reducing latency for the first real compilation.
 */
export async function prewarmCompiler(): Promise<void> {
  const minimalMdx = '# Prewarm\n\nInitializing compiler pipeline.';
  const vfile = new VFile({ value: minimalMdx });
  matter(vfile, { strip: true });

  await compile(vfile, {
    outputFormat: 'function-body',
    remarkPlugins: [remarkGfm, remarkFrontmatter],
    rehypePlugins: [rehypeHighlight],
  });
}
