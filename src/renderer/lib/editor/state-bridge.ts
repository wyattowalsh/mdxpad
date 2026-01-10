/**
 * State conversion utilities for bridging CodeMirror and shared editor types.
 *
 * @module state-bridge
 */

import type { EditorState as CMEditorState } from '@codemirror/state';
import type { EditorState, SelectionInfo } from '../../../shared/types/editor';

/**
 * Convert CodeMirror EditorState to shared EditorState type.
 *
 * Extracts the document content and primary selection from the CodeMirror
 * state and returns a plain object conforming to the shared EditorState interface.
 *
 * @param cmState - CodeMirror EditorState instance
 * @returns Shared EditorState snapshot with doc and selection
 */
export function toEditorState(cmState: CMEditorState): EditorState {
  const { main } = cmState.selection;
  return {
    doc: cmState.doc.toString(),
    selection: {
      anchor: main.anchor,
      head: main.head,
    },
  };
}

/**
 * Create SelectionInfo from anchor/head positions.
 *
 * Computes the normalized selection range (from/to) and emptiness flag
 * from the raw anchor and head positions.
 *
 * @param anchor - Selection anchor position (where selection started)
 * @param head - Selection head position (where cursor is)
 * @returns Computed selection info with from, to, and empty properties
 */
export function toSelectionInfo(anchor: number, head: number): SelectionInfo {
  return {
    from: Math.min(anchor, head),
    to: Math.max(anchor, head),
    empty: anchor === head,
  };
}

/**
 * Interface for a debounced function with cancel capability.
 *
 * @typeParam T - Function type extending a void-returning function
 */
export interface DebouncedFunction<T extends (...args: Parameters<T>) => void> {
  /** Call the debounced function with the given arguments. */
  readonly call: (...args: Parameters<T>) => void;
  /** Cancel any pending debounced call. */
  readonly cancel: () => void;
}

/**
 * Debounce utility function.
 *
 * Creates a debounced version of the provided function that delays execution
 * until after the specified delay has elapsed since the last invocation.
 * The delay is clamped to the range [0, 2000] milliseconds.
 *
 * @typeParam T - Function type extending a void-returning function
 * @param fn - Function to debounce
 * @param ms - Debounce delay in milliseconds (clamped to 0-2000)
 * @returns Debounced function object with call and cancel methods
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): DebouncedFunction<T> {
  const clampedMs = Math.max(0, Math.min(2000, ms));
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const call = (...args: Parameters<T>): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, clampedMs);
  };

  const cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return { call, cancel };
}
