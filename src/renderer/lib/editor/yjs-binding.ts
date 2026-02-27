/**
 * Yjs Binding for CodeMirror 6
 *
 * Creates a CodeMirror extension that synchronizes editor state with
 * a Yjs document and displays remote cursors/selections.
 *
 * @module renderer/lib/editor/yjs-binding
 */

import { StateEffect, StateField, type ChangeSpec, type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';

// ============================================================================
// Types
// ============================================================================

/** Represents a Yjs Text type (minimal interface for loose coupling) */
export interface YTextLike {
  readonly length: number;
  toString(): string;
  insert(index: number, text: string): void;
  delete(index: number, length: number): void;
  observe(callback: (event: YTextEvent) => void): void;
  unobserve(callback: (event: YTextEvent) => void): void;
}

/** Minimal Yjs text event interface */
export interface YTextEvent {
  readonly delta: readonly YDeltaItem[];
}

/** Yjs delta operation */
export interface YDeltaItem {
  readonly insert?: string;
  readonly delete?: number;
  readonly retain?: number;
}

/** Minimal Yjs Doc interface */
export interface YDocLike {
  transact(fn: () => void): void;
}

/** Remote cursor information */
export interface RemoteCursor {
  readonly clientId: number;
  readonly username: string;
  readonly color: string;
  readonly head: number;
  readonly anchor: number;
}

/** Awareness state change interface */
export interface AwarenessLike {
  getStates(): Map<number, Record<string, unknown>>;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
}

// ============================================================================
// State Effects
// ============================================================================

/** Effect to apply remote changes from Yjs */
const applyYjsUpdate = StateEffect.define<readonly ChangeSpec[]>();

/** Effect to update remote cursors */
const updateRemoteCursors = StateEffect.define<readonly RemoteCursor[]>();

// ============================================================================
// Cursor Widget
// ============================================================================

/**
 * Widget that renders a remote cursor label.
 */
class CursorWidget extends WidgetType {
  constructor(
    private readonly username: string,
    private readonly color: string
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-yjs-cursor';
    wrapper.style.borderLeft = `2px solid ${this.color}`;
    wrapper.style.position = 'relative';

    const label = document.createElement('span');
    label.className = 'cm-yjs-cursor-label';
    label.textContent = this.username;
    label.style.backgroundColor = this.color;
    label.style.color = '#ffffff';
    label.style.position = 'absolute';
    label.style.bottom = '100%';
    label.style.left = '-1px';
    label.style.padding = '1px 4px';
    label.style.borderRadius = '3px 3px 3px 0';
    label.style.fontSize = '11px';
    label.style.lineHeight = '1.4';
    label.style.whiteSpace = 'nowrap';
    label.style.pointerEvents = 'none';

    wrapper.appendChild(label);
    return wrapper;
  }

  eq(other: CursorWidget): boolean {
    return this.username === other.username && this.color === other.color;
  }
}

// ============================================================================
// Decoration Builder
// ============================================================================

interface DecoEntry {
  readonly from: number;
  readonly to: number;
  readonly deco: Decoration;
}

function buildCursorDecorations(
  cursors: readonly RemoteCursor[],
  docLength: number
): DecorationSet {
  const decos: DecoEntry[] = [];

  for (const cursor of cursors) {
    const head = Math.min(cursor.head, docLength);
    const anchor = Math.min(cursor.anchor, docLength);

    decos.push({
      from: head,
      to: head,
      deco: Decoration.widget({
        widget: new CursorWidget(cursor.username, cursor.color),
        side: 1,
      }),
    });

    if (head !== anchor) {
      const from = Math.min(head, anchor);
      const to = Math.max(head, anchor);
      if (from < to) {
        decos.push({
          from,
          to,
          deco: Decoration.mark({
            attributes: { style: `background-color: ${cursor.color}33;` },
          }),
        });
      }
    }
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(
    decos.map((d) => d.deco.range(d.from, d.to)),
    true
  );
}

// ============================================================================
// Remote Cursors Field
// ============================================================================

/**
 * StateField that tracks remote cursor decorations.
 */
const remoteCursorsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },

  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(updateRemoteCursors)) {
        const cursors = effect.value;
        if (cursors.length === 0) {
          return Decoration.none;
        }
        return buildCursorDecorations(cursors, transaction.state.doc.length);
      }
    }

    return decorations.map(transaction.changes);
  },

  provide: (field) => EditorView.decorations.from(field),
});

// ============================================================================
// Theme
// ============================================================================

const yjsCursorTheme = EditorView.baseTheme({
  '.cm-yjs-cursor': {
    position: 'relative',
    display: 'inline-block',
    width: '0',
    marginLeft: '-1px',
  },
  '.cm-yjs-cursor-label': {
    opacity: '1',
    transition: 'opacity 2s ease-out',
  },
});

// ============================================================================
// Sync State
// ============================================================================

interface SyncState {
  isApplyingRemote: boolean;
  isApplyingLocal: boolean;
  pendingRemoteChanges: ChangeSpec[] | null;
}

// ============================================================================
// Yjs Observer Helper
// ============================================================================

function createYjsObserver(syncState: SyncState) {
  return (event: YTextEvent): void => {
    if (syncState.isApplyingLocal) {
      return;
    }

    syncState.isApplyingRemote = true;
    try {
      const changes: ChangeSpec[] = [];
      let pos = 0;

      for (const delta of event.delta) {
        if (delta.retain !== undefined) {
          pos += delta.retain;
        } else if (delta.insert !== undefined) {
          changes.push({ from: pos, insert: delta.insert });
          pos += delta.insert.length;
        } else if (delta.delete !== undefined) {
          changes.push({ from: pos, to: pos + delta.delete });
        }
      }

      if (changes.length > 0) {
        syncState.pendingRemoteChanges = changes;
      }
    } finally {
      syncState.isApplyingRemote = false;
    }
  };
}

// ============================================================================
// CM Update Listener Helper
// ============================================================================

function createUpdateListener(syncState: SyncState, yDoc: YDocLike, yText: YTextLike): Extension {
  return EditorView.updateListener.of((update) => {
    if (syncState.pendingRemoteChanges) {
      const changes = syncState.pendingRemoteChanges;
      syncState.pendingRemoteChanges = null;
      update.view.dispatch({
        effects: applyYjsUpdate.of(changes),
        changes,
      });
      return;
    }

    if (syncState.isApplyingRemote || !update.docChanged) {
      return;
    }

    syncState.isApplyingLocal = true;
    try {
      yDoc.transact(() => {
        update.changes.iterChanges(
          (
            fromA: number,
            toA: number,
            _fromB: number,
            _toB: number,
            inserted: { toString(): string }
          ) => {
            if (fromA !== toA) {
              yText.delete(fromA, toA - fromA);
            }
            const text = inserted.toString();
            if (text.length > 0) {
              yText.insert(fromA, text);
            }
          }
        );
      });
    } finally {
      syncState.isApplyingLocal = false;
    }
  });
}

// ============================================================================
// Awareness Helper
// ============================================================================

function extractCursorsFromStates(states: Map<number, Record<string, unknown>>): RemoteCursor[] {
  const cursors: RemoteCursor[] = [];

  for (const [clientId, state] of states) {
    const username = state.username;
    const color = state.color;
    const head = state.cursorHead;
    const anchor = state.cursorAnchor;

    if (typeof username === 'string' && typeof color === 'string' && typeof head === 'number') {
      cursors.push({
        clientId,
        username,
        color,
        head,
        anchor: typeof anchor === 'number' ? anchor : head,
      });
    }
  }

  return cursors;
}

function createAwarenessExtension(awareness: AwarenessLike): Extension {
  let pendingCursorUpdate: RemoteCursor[] | null = null;

  const awarenessListener = (): void => {
    const states = awareness.getStates();
    const cursors = extractCursorsFromStates(states);
    requestAnimationFrame(() => {
      pendingCursorUpdate = cursors;
    });
  };

  awareness.on('change', awarenessListener);

  return EditorView.updateListener.of((update) => {
    if (pendingCursorUpdate) {
      const cursors = pendingCursorUpdate;
      pendingCursorUpdate = null;
      update.view.dispatch({
        effects: updateRemoteCursors.of(cursors),
      });
    }
  });
}

// ============================================================================
// Binding Factory
// ============================================================================

/**
 * Creates a CodeMirror 6 extension that syncs with a Yjs Text type
 * and displays remote cursors.
 *
 * @param yDoc - Yjs document instance
 * @param yText - Yjs Text type to sync with
 * @param awareness - Optional awareness instance for remote cursors
 * @returns CodeMirror Extension array
 *
 * @example
 * ```typescript
 * import * as Y from 'yjs';
 * import { createYjsBinding } from './yjs-binding';
 *
 * const yDoc = new Y.Doc();
 * const yText = yDoc.getText('content');
 * const extensions = createYjsBinding(yDoc, yText);
 * ```
 */
export function createYjsBinding(
  yDoc: YDocLike,
  yText: YTextLike,
  awareness?: AwarenessLike
): Extension {
  const syncState: SyncState = {
    isApplyingRemote: false,
    isApplyingLocal: false,
    pendingRemoteChanges: null,
  };

  const yTextObserver = createYjsObserver(syncState);
  yText.observe(yTextObserver);

  const extensions: Extension[] = [
    createUpdateListener(syncState, yDoc, yText),
    remoteCursorsField,
    yjsCursorTheme,
  ];

  if (awareness) {
    extensions.push(createAwarenessExtension(awareness));
  }

  return extensions;
}
