/**
 * Comment Gutter Extension for CodeMirror 6
 *
 * Provides a gutter column showing comment indicators for lines
 * that have associated comment threads. Clicking opens/focuses the thread.
 *
 * @module renderer/components/comments/CommentGutter
 */

import {
  StateEffect,
  StateField,
  RangeSet,
  type Extension,
} from '@codemirror/state';
import {
  GutterMarker,
  gutter,
  EditorView,
} from '@codemirror/view';

// ============================================================================
// Types
// ============================================================================

/** Gutter marker data for a comment on a specific line */
export interface CommentGutterItem {
  readonly line: number;
  readonly threadId: string;
  readonly threadCount: number;
  readonly hasUnresolved: boolean;
}

// ============================================================================
// State Effects
// ============================================================================

/**
 * Effect to update comment gutter markers.
 */
export const setCommentGutterItems = StateEffect.define<readonly CommentGutterItem[]>();

// ============================================================================
// Gutter Marker
// ============================================================================

/**
 * Custom gutter marker for comment indicators.
 */
class CommentMarker extends GutterMarker {
  constructor(
    private readonly threadId: string,
    private readonly count: number,
    private readonly hasUnresolved: boolean
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cm-comment-gutter-marker';
    el.setAttribute('data-thread-id', this.threadId);
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${this.count} comment${this.count !== 1 ? 's' : ''}`);
    el.setAttribute('tabindex', '0');

    // Comment bubble icon
    el.textContent = this.hasUnresolved ? '\u{1F4AC}' : '\u{2714}';
    el.style.cursor = 'pointer';
    el.style.fontSize = '12px';
    el.style.lineHeight = '1';
    el.style.textAlign = 'center';
    el.style.width = '16px';
    el.style.opacity = this.hasUnresolved ? '1' : '0.5';

    return el;
  }

  eq(other: CommentMarker): boolean {
    return (
      this.threadId === other.threadId &&
      this.count === other.count &&
      this.hasUnresolved === other.hasUnresolved
    );
  }
}

// ============================================================================
// State Field
// ============================================================================

interface GutterState {
  readonly items: readonly CommentGutterItem[];
  readonly markers: RangeSet<GutterMarker>;
}

/**
 * Build gutter markers from items.
 */
function buildGutterMarkers(
  items: readonly CommentGutterItem[],
  docLines: number
): RangeSet<GutterMarker> {
  if (items.length === 0) {
    return RangeSet.empty as RangeSet<GutterMarker>;
  }

  const validItems = items.filter((item) => item.line >= 1 && item.line <= docLines);
  const sorted = [...validItems].sort((a, b) => a.line - b.line);

  const ranges = sorted.map((item) => {
    const marker = new CommentMarker(item.threadId, item.threadCount, item.hasUnresolved);
    return marker.range(item.line);
  });

  return RangeSet.of(ranges) as RangeSet<GutterMarker>;
}

const commentGutterField = StateField.define<GutterState>({
  create() {
    return {
      items: [],
      markers: RangeSet.empty as RangeSet<GutterMarker>,
    };
  },

  update(state, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setCommentGutterItems)) {
        const items = effect.value;
        const docLines = transaction.state.doc.lines;
        return {
          items,
          markers: buildGutterMarkers(items, docLines),
        };
      }
    }

    if (transaction.docChanged) {
      const docLines = transaction.state.doc.lines;
      return {
        items: state.items,
        markers: buildGutterMarkers(state.items, docLines),
      };
    }

    return state;
  },
});

// ============================================================================
// Gutter Extension
// ============================================================================

const commentGutterTheme = EditorView.baseTheme({
  '.cm-comment-gutter': {
    width: '20px',
    minWidth: '20px',
  },
  '.cm-comment-gutter-marker': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
});

/**
 * Creates a CodeMirror gutter extension for comment indicators.
 * Shows comment markers in the gutter next to lines with threads.
 *
 * @param onClickThread - Callback when a gutter marker is clicked
 * @returns CodeMirror Extension
 *
 * @example
 * ```typescript
 * import { commentGutterExtension, setCommentGutterItems } from './CommentGutter';
 *
 * const ext = commentGutterExtension((threadId) => {
 *   focusThread(threadId);
 * });
 * ```
 */
export function commentGutterExtension(
  onClickThread?: (threadId: string) => void
): Extension {
  return [
    commentGutterField,
    gutter({
      class: 'cm-comment-gutter',
      markers: (view) => {
        const state = view.state.field(commentGutterField);
        return state.markers;
      },
      domEventHandlers: {
        click: (view, line) => {
          const state = view.state.field(commentGutterField);
          const lineNumber = view.state.doc.lineAt(line.from).number;
          const item = state.items.find((i) => i.line === lineNumber);
          if (item && onClickThread) {
            onClickThread(item.threadId);
            return true;
          }
          return false;
        },
      },
    }),
    commentGutterTheme,
  ];
}
