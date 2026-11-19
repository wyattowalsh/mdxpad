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
  type Text,
  type Transaction,
} from '@codemirror/state';
import {
  GutterMarker,
  gutter,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { useCommentsStore, type CommentThread } from '@renderer/stores/comments-store';
import { useUtilityPanelStore } from '@renderer/stores/utility-panel-store';

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

function collapseByLine(items: readonly CommentGutterItem[]): CommentGutterItem[] {
  const byLine = new Map<number, CommentGutterItem>();
  for (const item of items) {
    const current = byLine.get(item.line);
    if (!current) {
      byLine.set(item.line, item);
      continue;
    }
    byLine.set(item.line, {
      line: item.line,
      threadId: item.hasUnresolved ? item.threadId : current.threadId,
      threadCount: current.threadCount + item.threadCount,
      hasUnresolved: current.hasUnresolved || item.hasUnresolved,
    });
  }
  return [...byLine.values()].sort((left, right) => left.line - right.line);
}

/** One gutter marker per line that has a comment thread. */
export function gutterItemsFromThreads(
  doc: Text,
  threads: readonly CommentThread[]
): CommentGutterItem[] {
  const items: CommentGutterItem[] = [];
  for (const thread of threads) {
    if (thread.anchorFrom < 0 || thread.anchorFrom > doc.length) {
      continue;
    }
    const line = doc.lineAt(Math.min(thread.anchorFrom, doc.length)).number;
    items.push({
      line,
      threadId: thread.id,
      threadCount: 1,
      hasUnresolved: !thread.resolved,
    });
  }
  return collapseByLine(items);
}

function markersFor(items: readonly CommentGutterItem[], doc: Text): RangeSet<GutterMarker> {
  const ranges = items
    .filter((item) => item.line >= 1 && item.line <= doc.lines)
    .map((item) => {
      const marker = new CommentMarker(item.threadId, item.threadCount, item.hasUnresolved);
      return marker.range(doc.line(item.line).from);
    });
  return ranges.length === 0
    ? (RangeSet.empty as RangeSet<GutterMarker>)
    : (RangeSet.of(ranges) as RangeSet<GutterMarker>);
}

function gutterState(items: readonly CommentGutterItem[], doc: Text): GutterState {
  const collapsed = collapseByLine(items.filter((item) => item.line >= 1 && item.line <= doc.lines));
  return { items: collapsed, markers: markersFor(collapsed, doc) };
}

function mapGutterItems(
  items: readonly CommentGutterItem[],
  transaction: Transaction
): CommentGutterItem[] {
  const start = transaction.startState.doc;
  const next = transaction.state.doc;
  const mapped: CommentGutterItem[] = [];
  for (const item of items) {
    if (item.line < 1 || item.line > start.lines) {
      continue;
    }
    const pos = transaction.changes.mapPos(start.line(item.line).from);
    mapped.push({ ...item, line: next.lineAt(Math.min(pos, next.length)).number });
  }
  return mapped;
}

/** Open the comments panel on the thread a gutter marker names. */
export function focusCommentThread(threadId: string): void {
  useCommentsStore.getState().setActiveThread(threadId);
  useUtilityPanelStore.getState().setActiveUtilityPanel('comments');
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
        return gutterState(effect.value, transaction.state.doc);
      }
    }

    if (transaction.docChanged) {
      return gutterState(mapGutterItems(state.items, transaction), transaction.state.doc);
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
          if (!item) {
            return false;
          }
          focusCommentThread(item.threadId);
          onClickThread?.(item.threadId);
          return true;
        },
      },
    }),
    commentGutterTheme,
    ViewPlugin.fromClass(CommentGutterSync),
  ];
}

class CommentGutterSync {
  private destroyed = false;
  private pending = false;
  private readonly unsubscribe: () => void;

  constructor(private readonly view: EditorView) {
    this.unsubscribe = useCommentsStore.subscribe(() => {
      this.schedule();
    });
    this.schedule();
  }

  update(update: ViewUpdate): void {
    if (update.docChanged) {
      this.schedule();
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.unsubscribe();
  }

  private schedule(): void {
    if (this.destroyed || this.pending) {
      return;
    }
    this.pending = true;
    queueMicrotask(() => {
      this.flush();
    });
  }

  private flush(): void {
    this.pending = false;
    const closed = this.view as unknown as { readonly destroyed?: boolean };
    if (this.destroyed || closed.destroyed === true) {
      return;
    }
    const items = gutterItemsFromThreads(this.view.state.doc, useCommentsStore.getState().threads);
    this.view.dispatch({ effects: setCommentGutterItems.of(items) });
  }
}
