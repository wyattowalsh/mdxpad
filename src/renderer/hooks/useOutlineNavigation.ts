/**
 * Outline Navigation Hook
 *
 * Provides functionality to navigate to outline item locations in the CodeMirror editor.
 * Includes line highlighting for visual feedback (FR-022: 500ms flash).
 *
 * @module renderer/hooks/useOutlineNavigation
 */

import { useCallback, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import type { OutlineItem } from '@shared/types/outline';
import { highlightLineTemporary, HIGHLIGHT_DURATION_MS } from '@renderer/lib/editor/line-highlight';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the useOutlineNavigation hook.
 */
export interface UseOutlineNavigationOptions {
  /** Ref to the CodeMirror EditorView */
  readonly editorRef: React.RefObject<EditorView | null>;
  /** Duration for line highlight flash in ms (default: 500ms per FR-022) */
  readonly highlightDuration?: number;
}

/**
 * Result from the useOutlineNavigation hook.
 */
export interface UseOutlineNavigationResult {
  /** Navigate to a specific outline item location in the editor */
  readonly navigateToItem: (item: OutlineItem) => void;
  /** Navigate to a specific line/column position in the editor */
  readonly navigateToPosition: (line: number, column: number) => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for navigating to outline item locations in the CodeMirror editor.
 *
 * Provides functions to navigate to outline items or specific line/column positions,
 * scrolling the editor to show the target and placing the cursor at the position.
 *
 * @param options - Configuration options including the editor ref
 * @returns Object containing navigation functions
 *
 * @example
 * ```tsx
 * const editorRef = useRef<EditorView | null>(null);
 * const { navigateToItem, navigateToPosition } = useOutlineNavigation({ editorRef });
 *
 * // Navigate to an outline item
 * navigateToItem(headingItem);
 *
 * // Navigate to line 10, column 1
 * navigateToPosition(10, 1);
 * ```
 */
export function useOutlineNavigation(
  options: UseOutlineNavigationOptions
): UseOutlineNavigationResult {
  const { editorRef, highlightDuration = HIGHLIGHT_DURATION_MS } = options;

  // Track cleanup function for previous highlight
  const cleanupRef = useRef<(() => void) | null>(null);

  /**
   * Navigate to a specific line/column position in the editor.
   *
   * - Clamps line number to valid range [1, doc.lines]
   * - Clamps column to valid range [1, line.length]
   * - Sets cursor position at the target location
   * - Scrolls the editor to center the target in view
   * - Applies temporary line highlight (FR-022: 500ms flash)
   * - Focuses the editor
   *
   * @param line - Line number (1-indexed)
   * @param column - Column number (1-indexed)
   */
  const navigateToPosition = useCallback(
    (line: number, column: number): void => {
      const view = editorRef.current;
      if (!view) return;

      // Cancel any previous highlight
      cleanupRef.current?.();

      const doc = view.state.doc;

      // Clamp line number to valid range [1, doc.lines]
      const clampedLine = Math.max(1, Math.min(line, doc.lines));

      // Get line info for the clamped line
      const lineInfo = doc.line(clampedLine);

      // Clamp column to valid range [1, line.length + 1]
      // Column is 1-indexed, so column 1 is at lineInfo.from
      // Maximum valid column is line.length + 1 (after last character)
      const maxColumn = lineInfo.length + 1;
      const clampedColumn = Math.max(1, Math.min(column, maxColumn));

      // Calculate absolute position
      // lineInfo.from is the start of the line, add (column - 1) to get position
      const pos = lineInfo.from + clampedColumn - 1;

      // Dispatch transaction to set selection and scroll into view
      view.dispatch({
        selection: { anchor: pos, head: pos },
        scrollIntoView: true,
        effects: EditorView.scrollIntoView(pos, { y: 'center' }),
      });

      // Apply temporary line highlight (FR-022)
      cleanupRef.current = highlightLineTemporary(view, pos, highlightDuration);

      // Focus the editor
      view.focus();
    },
    [editorRef, highlightDuration]
  );

  /**
   * Navigate to a specific outline item location in the editor.
   *
   * Extracts line and column from the outline item and navigates to that position.
   *
   * @param item - Outline item with line and column properties
   */
  const navigateToItem = useCallback(
    (item: OutlineItem): void => {
      navigateToPosition(item.line, item.column);
    },
    [navigateToPosition]
  );

  return { navigateToItem, navigateToPosition };
}

export default useOutlineNavigation;
