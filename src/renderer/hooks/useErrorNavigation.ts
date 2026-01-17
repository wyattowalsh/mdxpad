/**
 * Error Navigation Hook
 *
 * Provides functionality to navigate to error locations in the CodeMirror editor.
 * Coordinates jumping to error positions from the StatusBar error list.
 *
 * @module renderer/hooks/useErrorNavigation
 */

import { useCallback } from 'react';
import { EditorView } from '@codemirror/view';

// =============================================================================
// Types
// =============================================================================

/**
 * Error location with line and column information.
 * Line and column are 1-indexed (matching CompilationError from shell-schemas).
 */
export interface ErrorLocation {
  /** Line number (1-indexed) */
  readonly line: number;
  /** Column number (1-indexed) */
  readonly column: number;
}

/**
 * Options for the useErrorNavigation hook.
 */
export interface UseErrorNavigationOptions {
  /** Ref to the CodeMirror EditorView */
  readonly editorRef: React.RefObject<EditorView | null>;
}

/**
 * Result from the useErrorNavigation hook.
 */
export interface UseErrorNavigationResult {
  /** Navigate to a specific error location in the editor */
  readonly navigateToError: (error: ErrorLocation) => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for navigating to error locations in the CodeMirror editor.
 *
 * Provides a function to navigate to a specific line/column position,
 * scrolling the editor to show the error and placing the cursor at
 * the error position.
 *
 * @param options - Configuration options including the editor ref
 * @returns Object containing the navigateToError function
 *
 * @example
 * ```tsx
 * const editorRef = useRef<EditorView | null>(null);
 * const { navigateToError } = useErrorNavigation({ editorRef });
 *
 * // Navigate to line 10, column 5
 * navigateToError({ line: 10, column: 5 });
 * ```
 */
export function useErrorNavigation(
  options: UseErrorNavigationOptions
): UseErrorNavigationResult {
  const { editorRef } = options;

  /**
   * Navigate to a specific error location in the editor.
   *
   * - Clamps line number to valid range [1, doc.lines]
   * - Clamps column to valid range [1, line.length]
   * - Sets cursor position at the error location
   * - Scrolls the editor to center the error in view
   * - Focuses the editor
   *
   * @param error - Error location with line and column (1-indexed)
   */
  const navigateToError = useCallback(
    (error: ErrorLocation): void => {
      const view = editorRef.current;
      if (!view) return;

      const doc = view.state.doc;

      // Clamp line number to valid range [1, doc.lines]
      const clampedLine = Math.max(1, Math.min(error.line, doc.lines));

      // Get line info for the clamped line
      const line = doc.line(clampedLine);

      // Clamp column to valid range [1, line.length + 1]
      // Column is 1-indexed, so column 1 is at line.from
      // Maximum valid column is line.length + 1 (after last character)
      const maxColumn = line.length + 1;
      const clampedColumn = Math.max(1, Math.min(error.column, maxColumn));

      // Calculate absolute position
      // line.from is the start of the line, add (column - 1) to get position
      const pos = line.from + clampedColumn - 1;

      // Dispatch transaction to set selection and scroll into view
      view.dispatch({
        selection: { anchor: pos, head: pos },
        scrollIntoView: true,
        effects: EditorView.scrollIntoView(pos, { y: 'center' }),
      });

      // Focus the editor
      view.focus();
    },
    [editorRef]
  );

  return { navigateToError };
}

export default useErrorNavigation;
