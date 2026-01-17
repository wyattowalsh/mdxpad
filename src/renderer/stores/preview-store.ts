/**
 * Preview store for managing MDX preview state.
 * Uses Zustand with Immer middleware for immutable state updates.
 * Implements state machine: idle -> compiling -> success | error
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { castDraft } from 'immer';
import type {
  PreviewState,
  CompileSuccess,
  CompileError,
} from '@shared/types/preview';
import type { OutlineAST } from '@shared/types/outline';

/**
 * Preview store state interface.
 */
export interface PreviewStoreState {
  /** Current preview state */
  readonly state: PreviewState;
  /** Cached last successful render for error recovery */
  readonly lastSuccessfulRender: CompileSuccess | null;
  /** Current scroll ratio (0-1) */
  readonly scrollRatio: number;
}

/**
 * Preview store actions interface.
 */
export interface PreviewStoreActions {
  /** Transition to compiling state */
  startCompiling: () => void;
  /** Transition to success state */
  setSuccess: (result: CompileSuccess) => void;
  /** Transition to error state */
  setError: (errors: readonly CompileError[]) => void;
  /** Reset to idle state */
  reset: () => void;
  /** Update scroll position */
  setScrollRatio: (ratio: number) => void;
}

/**
 * Combined preview store type.
 */
export type PreviewStore = PreviewStoreState & PreviewStoreActions;

/**
 * Initial state for the preview store.
 */
const initialState: PreviewStoreState = {
  state: { status: 'idle' },
  lastSuccessfulRender: null,
  scrollRatio: 0,
};

/**
 * Preview store hook.
 * Manages MDX preview compilation state with error recovery support.
 *
 * @example
 * ```tsx
 * const { state, startCompiling, setSuccess, setError } = usePreviewStore();
 *
 * // Start compilation
 * startCompiling();
 *
 * // On success
 * setSuccess({ ok: true, code: '...', frontmatter: {} });
 *
 * // On error - lastSuccessfulRender is preserved for error recovery
 * setError([{ message: 'Syntax error', line: 5 }]);
 * ```
 */
export const usePreviewStore = create<PreviewStore>()(
  immer((set) => ({
    ...initialState,

    startCompiling: () =>
      set((draft) => {
        draft.state = { status: 'compiling' };
      }),

    setSuccess: (result) =>
      set((draft) => {
        // Use castDraft for readonly OutlineAST compatibility with Immer
        draft.state = { status: 'success', result: castDraft(result) };
        draft.lastSuccessfulRender = castDraft(result);
      }),

    setError: (errors) =>
      set((draft) => {
        // Spread to create mutable copy for Immer draft
        draft.state = { status: 'error', errors: [...errors] };
        // Note: lastSuccessfulRender is preserved for error recovery
      }),

    reset: () =>
      set((draft) => {
        draft.state = { status: 'idle' };
        draft.lastSuccessfulRender = null;
        draft.scrollRatio = 0;
      }),

    setScrollRatio: (ratio) =>
      set((draft) => {
        // Clamp ratio to [0, 1]
        draft.scrollRatio = Math.max(0, Math.min(1, ratio));
      }),
  }))
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Selector for current preview status.
 *
 * @param state - Preview store state
 * @returns Current status: 'idle' | 'compiling' | 'success' | 'error'
 */
export const selectStatus = (state: PreviewStore): PreviewState['status'] =>
  state.state.status;

/**
 * Selector for checking if currently compiling.
 *
 * @param state - Preview store state
 * @returns True if status is 'compiling'
 */
export const selectIsCompiling = (state: PreviewStore): boolean =>
  state.state.status === 'compiling';

/**
 * Selector for checking if in error state.
 *
 * @param state - Preview store state
 * @returns True if status is 'error'
 */
export const selectIsError = (state: PreviewStore): boolean =>
  state.state.status === 'error';

/**
 * Selector for checking if in success state.
 *
 * @param state - Preview store state
 * @returns True if status is 'success'
 */
export const selectIsSuccess = (state: PreviewStore): boolean =>
  state.state.status === 'success';

/**
 * Selector for current errors (empty array if not in error state).
 *
 * @param state - Preview store state
 * @returns Array of compile errors if in error state, otherwise empty array
 */
export const selectErrors = (state: PreviewStore): readonly CompileError[] =>
  state.state.status === 'error' ? state.state.errors : [];

/**
 * Selector for current success result (null if not in success state).
 *
 * @param state - Preview store state
 * @returns Current success result if in success state, otherwise null
 */
export const selectSuccessResult = (
  state: PreviewStore
): CompileSuccess | null =>
  state.state.status === 'success' ? state.state.result : null;

/**
 * Selector for renderable content.
 * Returns current success result or falls back to last successful render for error recovery.
 *
 * @param state - Preview store state
 * @returns Current success result if available, otherwise last successful render (for error recovery)
 */
export const selectRenderableContent = (
  state: PreviewStore
): CompileSuccess | null => {
  if (state.state.status === 'success') {
    return state.state.result;
  }
  return state.lastSuccessfulRender;
};

/**
 * Selector for last successful render.
 *
 * @param state - Preview store state
 * @returns Last successful compile result, or null if none exists
 */
export const selectLastSuccessfulRender = (
  state: PreviewStore
): CompileSuccess | null => state.lastSuccessfulRender;

/**
 * Selector for scroll ratio.
 *
 * @param state - Preview store state
 * @returns Current scroll ratio between 0 and 1
 */
export const selectScrollRatio = (state: PreviewStore): number =>
  state.scrollRatio;

/**
 * Selector for outline AST from renderable content.
 * Returns outline from current success result or falls back to last successful render.
 * Used by outline panel for graceful degradation during compilation errors.
 *
 * @param state - Preview store state
 * @returns OutlineAST if available, otherwise null
 */
export const selectOutlineAST = (
  state: PreviewStore
): OutlineAST | null => {
  const content = selectRenderableContent(state);
  return content?.outline ?? null;
};
