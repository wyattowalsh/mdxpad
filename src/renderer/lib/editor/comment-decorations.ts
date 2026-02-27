/**
 * Comment Decorations for CodeMirror 6
 *
 * Provides decorations to highlight document ranges that have active comments.
 * Uses StateField and Decoration.mark for persistent visual indicators.
 *
 * @module renderer/lib/editor/comment-decorations
 */

import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';

// ============================================================================
// Types
// ============================================================================

/** A comment range to highlight in the editor */
export interface CommentRange {
  readonly threadId: string;
  readonly from: number;
  readonly to: number;
  readonly resolved: boolean;
}

// ============================================================================
// State Effects
// ============================================================================

/**
 * Effect to update comment decorations with new ranges.
 */
export const setCommentRanges = StateEffect.define<readonly CommentRange[]>();

/**
 * Effect to clear all comment decorations.
 */
export const clearCommentRanges = StateEffect.define<void>();

/**
 * Effect to highlight a specific thread (make it active).
 */
export const setActiveCommentThread = StateEffect.define<string | null>();

// ============================================================================
// Decoration Builders
// ============================================================================

/**
 * Creates a decoration for an unresolved comment range.
 */
const unresolvedCommentMark = Decoration.mark({
  attributes: {
    class: 'cm-comment-highlight',
  },
});

/**
 * Creates a decoration for a resolved comment range.
 */
const resolvedCommentMark = Decoration.mark({
  attributes: {
    class: 'cm-comment-highlight-resolved',
  },
});

/**
 * Creates a decoration for the active (focused) comment range.
 */
const activeCommentMark = Decoration.mark({
  attributes: {
    class: 'cm-comment-highlight-active',
  },
});

// ============================================================================
// State Field
// ============================================================================

/**
 * Internal state tracking comment ranges and active thread.
 */
interface CommentDecorationState {
  readonly ranges: readonly CommentRange[];
  readonly activeThreadId: string | null;
  readonly decorations: DecorationSet;
}

/**
 * Build decorations from comment ranges and active thread.
 */
function buildDecorations(
  ranges: readonly CommentRange[],
  activeThreadId: string | null,
  docLength: number
): DecorationSet {
  if (ranges.length === 0) {
    return Decoration.none;
  }

  // Filter out ranges that exceed doc bounds and sort by from position
  const validRanges = ranges
    .filter((r) => r.from >= 0 && r.to <= docLength && r.from < r.to)
    .sort((a, b) => a.from - b.from || a.to - b.to);

  if (validRanges.length === 0) {
    return Decoration.none;
  }

  const decorations = validRanges.map((range) => {
    let mark = range.resolved ? resolvedCommentMark : unresolvedCommentMark;
    if (range.threadId === activeThreadId) {
      mark = activeCommentMark;
    }
    return mark.range(range.from, range.to);
  });

  return Decoration.set(decorations, true);
}

/**
 * StateField that tracks comment decoration state.
 */
const commentDecorationsField = StateField.define<CommentDecorationState>({
  create() {
    return {
      ranges: [],
      activeThreadId: null,
      decorations: Decoration.none,
    };
  },

  update(state, transaction) {
    let ranges = state.ranges;
    let activeThreadId = state.activeThreadId;
    let changed = false;

    for (const effect of transaction.effects) {
      if (effect.is(setCommentRanges)) {
        ranges = effect.value;
        changed = true;
      }
      if (effect.is(clearCommentRanges)) {
        ranges = [];
        activeThreadId = null;
        changed = true;
      }
      if (effect.is(setActiveCommentThread)) {
        activeThreadId = effect.value;
        changed = true;
      }
    }

    if (changed || transaction.docChanged) {
      // Remap positions through document changes
      if (transaction.docChanged && !changed) {
        ranges = ranges.map((r) => ({
          ...r,
          from: transaction.changes.mapPos(r.from),
          to: transaction.changes.mapPos(r.to),
        }));
      }

      const docLength = transaction.state.doc.length;
      return {
        ranges,
        activeThreadId,
        decorations: buildDecorations(ranges, activeThreadId, docLength),
      };
    }

    return state;
  },

  provide: (field) =>
    EditorView.decorations.from(field, (state) => state.decorations),
});

// ============================================================================
// Theme
// ============================================================================

const commentDecorationTheme = EditorView.baseTheme({
  '.cm-comment-highlight': {
    backgroundColor: 'rgba(255, 220, 100, 0.25)',
    borderBottom: '2px solid rgba(255, 193, 7, 0.6)',
  },
  '.cm-comment-highlight-resolved': {
    backgroundColor: 'rgba(100, 200, 100, 0.15)',
    borderBottom: '2px dashed rgba(100, 200, 100, 0.4)',
  },
  '.cm-comment-highlight-active': {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderBottom: '2px solid rgba(99, 102, 241, 0.8)',
  },
  '&dark .cm-comment-highlight': {
    backgroundColor: 'rgba(255, 220, 100, 0.15)',
    borderBottom: '2px solid rgba(255, 193, 7, 0.4)',
  },
  '&dark .cm-comment-highlight-resolved': {
    backgroundColor: 'rgba(100, 200, 100, 0.1)',
    borderBottom: '2px dashed rgba(100, 200, 100, 0.3)',
  },
  '&dark .cm-comment-highlight-active': {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderBottom: '2px solid rgba(99, 102, 241, 0.6)',
  },
});

// ============================================================================
// Extension
// ============================================================================

/**
 * Complete comment decoration extension.
 * Include this in your CodeMirror setup to enable comment highlighting.
 *
 * @returns CodeMirror Extension for comment decorations
 *
 * @example
 * ```typescript
 * import { commentDecorationExtension, setCommentRanges } from './comment-decorations';
 *
 * const editor = new EditorView({
 *   extensions: [commentDecorationExtension()],
 * });
 *
 * // Update comment ranges
 * editor.dispatch({
 *   effects: setCommentRanges.of([
 *     { threadId: 't1', from: 0, to: 50, resolved: false },
 *   ]),
 * });
 * ```
 */
export function commentDecorationExtension(): Extension {
  return [commentDecorationsField, commentDecorationTheme];
}
