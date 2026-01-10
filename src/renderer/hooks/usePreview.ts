/**
 * usePreview Hook
 *
 * Manages debounced MDX compilation via Web Worker with integrated state management.
 * Tracks request IDs for stale response cancellation and provides error recovery
 * through preserved last successful renders.
 *
 * @module renderer/hooks/usePreview
 */

import { useEffect, useRef, useCallback } from 'react';
import type { CompileSuccess, PreviewState } from '@shared/types/preview';
import type { CompileResponseSuccess, RequestId } from '@shared/types/preview-worker';
import { createRequestId } from '@shared/types/preview-worker';
import { createMDXCompiler, type MDXCompiler } from '@renderer/lib/mdx/compiler';
import { usePreviewStore } from '@renderer/stores/preview-store';

/** Default debounce delay in milliseconds per FR-004 */
const DEFAULT_DEBOUNCE_MS = 300;

/** Options for the usePreview hook. */
export interface UsePreviewOptions {
  /** Debounce delay in milliseconds. Defaults to 300ms. */
  debounceMs?: number | undefined;
  /** Whether to enable compilation. When false, compilation is paused. Defaults to true. */
  enabled?: boolean | undefined;
}

/** Result returned by the usePreview hook. */
export interface UsePreviewResult {
  state: PreviewState;
  lastSuccessfulRender: CompileSuccess | null;
  scrollRatio: number;
  setScrollRatio: (ratio: number) => void;
}

/** Convert worker response to CompileSuccess type. */
function toCompileSuccess(response: CompileResponseSuccess): CompileSuccess {
  return { ok: true, code: response.code, frontmatter: response.frontmatter };
}

/** Trigger compilation after debounce timeout */
function triggerCompilation(
  source: string,
  getCompiler: () => MDXCompiler,
  currentRequestIdRef: React.RefObject<RequestId | null>,
  startCompiling: () => void,
  setSuccess: (r: CompileSuccess) => void,
  setError: (e: readonly import('@shared/types/preview').CompileError[]) => void
): void {
  if (source === '') { setSuccess({ ok: true, code: '', frontmatter: {} }); return; }

  startCompiling();
  const compiler = getCompiler();
  const requestId = createRequestId();
  (currentRequestIdRef as { current: RequestId | null }).current = requestId;

  compiler.compile(source, {
    requestId,
    onSuccess: (response) => {
      if (currentRequestIdRef.current === requestId) {
        (currentRequestIdRef as { current: RequestId | null }).current = null;
        setSuccess(toCompileSuccess(response));
      }
    },
    onError: (errors) => {
      if (currentRequestIdRef.current === requestId) {
        (currentRequestIdRef as { current: RequestId | null }).current = null;
        setError(errors);
      }
    },
  });
}

/**
 * Hook for managing MDX preview compilation with debouncing.
 * @param source - MDX source string to compile
 * @param options - Optional configuration
 * @returns Preview state and scroll handling
 */
export function usePreview(source: string, options?: UsePreviewOptions): UsePreviewResult {
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const enabled = options?.enabled ?? true;

  const state = usePreviewStore((s) => s.state);
  const lastSuccessfulRender = usePreviewStore((s) => s.lastSuccessfulRender);
  const scrollRatio = usePreviewStore((s) => s.scrollRatio);
  const setScrollRatio = usePreviewStore((s) => s.setScrollRatio);
  const startCompiling = usePreviewStore((s) => s.startCompiling);
  const setSuccess = usePreviewStore((s) => s.setSuccess);
  const setError = usePreviewStore((s) => s.setError);

  const compilerRef = useRef<MDXCompiler | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRequestIdRef = useRef<RequestId | null>(null);

  const getCompiler = useCallback((): MDXCompiler => {
    compilerRef.current ??= createMDXCompiler();
    return compilerRef.current;
  }, []);

  useEffect(() => {
    // Skip compilation when disabled - maintain last state (don't clear)
    if (!enabled) {
      return;
    }

    if (debounceTimeoutRef.current !== null) { clearTimeout(debounceTimeoutRef.current); debounceTimeoutRef.current = null; }
    if (currentRequestIdRef.current !== null && compilerRef.current !== null) {
      compilerRef.current.cancel(currentRequestIdRef.current);
      currentRequestIdRef.current = null;
    }
    debounceTimeoutRef.current = setTimeout(() => {
      debounceTimeoutRef.current = null;
      triggerCompilation(source, getCompiler, currentRequestIdRef, startCompiling, setSuccess, setError);
    }, debounceMs);
  }, [source, debounceMs, enabled, getCompiler, startCompiling, setSuccess, setError]);

  useEffect(() => () => {
    if (debounceTimeoutRef.current !== null) clearTimeout(debounceTimeoutRef.current);
    if (currentRequestIdRef.current !== null && compilerRef.current !== null) compilerRef.current.cancel(currentRequestIdRef.current);
    if (compilerRef.current !== null) compilerRef.current.terminate();
  }, []);

  return { state, lastSuccessfulRender, scrollRatio, setScrollRatio };
}

/**
 * Convenience hook for checking preview compilation status.
 * @returns Current status: 'idle' | 'compiling' | 'success' | 'error'
 */
export function usePreviewStatus(): PreviewState['status'] {
  return usePreviewStore((state) => state.state.status);
}
