/**
 * Line Highlight Extension for CodeMirror
 *
 * Provides flash highlighting functionality for navigation.
 * When navigating to an outline item, the target line is briefly
 * highlighted (FR-022: 500ms flash).
 *
 * @module renderer/lib/editor/line-highlight
 */

import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';

// =============================================================================
// Constants
// =============================================================================

/** Duration in milliseconds for the line highlight flash (FR-022) */
export const HIGHLIGHT_DURATION_MS = 500;

// =============================================================================
// State Effects
// =============================================================================

/**
 * Effect to add a line highlight at a specific position.
 * The position should be within the line to highlight.
 */
export const addLineHighlight = StateEffect.define<number>();

/**
 * Effect to clear any active line highlight.
 */
export const clearLineHighlight = StateEffect.define<void>();

// =============================================================================
// Decoration
// =============================================================================

/**
 * Creates the line highlight decoration.
 * Uses a golden/amber background for visibility without being too intrusive.
 */
const lineHighlightMark = Decoration.line({
  attributes: {
    class: 'cm-line-highlight-flash',
  },
});

// =============================================================================
// State Field
// =============================================================================

/**
 * StateField that tracks the current line highlight decoration.
 * Handles adding and clearing highlights via effects.
 */
export const lineHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },

  update(decorations, transaction) {
    // Process effects in order
    for (const effect of transaction.effects) {
      if (effect.is(addLineHighlight)) {
        // Clear any existing highlight and add new one
        const pos = effect.value;
        const doc = transaction.state.doc;

        // Validate position is within document bounds
        if (pos < 0 || pos > doc.length) {
          return Decoration.none;
        }

        // Get the line at this position
        const line = doc.lineAt(pos);

        // Create decoration for this line
        return Decoration.set([lineHighlightMark.range(line.from)]);
      }

      if (effect.is(clearLineHighlight)) {
        return Decoration.none;
      }
    }

    // Map decorations through document changes
    return decorations.map(transaction.changes);
  },

  provide: (field) => EditorView.decorations.from(field),
});

// =============================================================================
// Theme
// =============================================================================

/**
 * Theme extension for the line highlight styling.
 * Provides both light and dark mode styles.
 */
const lineHighlightTheme = EditorView.baseTheme({
  '.cm-line-highlight-flash': {
    backgroundColor: 'rgba(255, 193, 7, 0.3)', // Amber with transparency
    transition: 'background-color 150ms ease-out',
  },
  '&dark .cm-line-highlight-flash': {
    backgroundColor: 'rgba(255, 193, 7, 0.25)', // Slightly less intense for dark mode
  },
});

// =============================================================================
// Extension
// =============================================================================

/**
 * Complete line highlight extension.
 * Include this in your CodeMirror setup to enable flash highlighting.
 *
 * @example
 * ```typescript
 * import { lineHighlightExtension } from './line-highlight';
 *
 * const editor = new EditorView({
 *   extensions: [lineHighlightExtension, ...otherExtensions],
 * });
 * ```
 */
export const lineHighlightExtension: Extension = [
  lineHighlightField,
  lineHighlightTheme,
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Highlights a line at the given position with automatic clearing after duration.
 *
 * @param view - The EditorView instance
 * @param pos - Position within the line to highlight (document offset)
 * @param duration - Duration in milliseconds before clearing (default: 500ms)
 * @returns Cleanup function to cancel the timeout if needed
 *
 * @example
 * ```typescript
 * // Highlight line at position 100 for 500ms
 * const cancel = highlightLineTemporary(view, 100);
 *
 * // Optionally cancel early
 * cancel();
 * ```
 */
export function highlightLineTemporary(
  view: EditorView,
  pos: number,
  duration: number = HIGHLIGHT_DURATION_MS
): () => void {
  // Add the highlight
  view.dispatch({
    effects: addLineHighlight.of(pos),
  });

  // Set up automatic clearing
  const timeoutId = setTimeout(() => {
    view.dispatch({
      effects: clearLineHighlight.of(undefined),
    });
  }, duration);

  // Return cleanup function
  return () => {
    clearTimeout(timeoutId);
    view.dispatch({
      effects: clearLineHighlight.of(undefined),
    });
  };
}

/**
 * Manually clear any active line highlight.
 *
 * @param view - The EditorView instance
 */
export function clearHighlight(view: EditorView): void {
  view.dispatch({
    effects: clearLineHighlight.of(undefined),
  });
}
