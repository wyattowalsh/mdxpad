/**
 * Focus mode for the visual editor.
 *
 * Dims every top-level block that does not contain the selection and keeps
 * the active block at full strength, matching the source editor's focus mode.
 */

import type { EditorState, Transaction } from 'prosemirror-state';
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

const DIMMED_CLASS = 'wysiwyg-focus-dimmed';
const DIMMED_STYLE = 'opacity: 0.3; transition: opacity 200ms ease';

export interface FocusModeFlag {
  current: boolean;
}

function blockIsActive(start: number, end: number, state: EditorState): boolean {
  const { from, to } = state.selection;
  return start < to && end > from;
}

function dimmedBlocks(state: EditorState): DecorationSet | null {
  const decorations: Decoration[] = [];
  state.doc.forEach((node, offset) => {
    const start = offset;
    const end = offset + node.nodeSize;
    if (blockIsActive(start, end, state)) {
      return;
    }
    decorations.push(Decoration.node(start, end, { class: DIMMED_CLASS, style: DIMMED_STYLE }));
  });
  if (decorations.length === 0) {
    return null;
  }
  return DecorationSet.create(state.doc, decorations);
}

function centerCaret(view: EditorView): void {
  const coords = view.coordsAtPos(view.state.selection.head);
  const scroller = view.dom.parentElement ?? view.dom;
  const rect = scroller.getBoundingClientRect();
  const offset = coords.top - (rect.top + rect.height / 2);
  if (Math.abs(offset) <= 10) {
    return;
  }
  scroller.scrollBy({ top: offset });
}

/**
 * Decorate inactive blocks while `enabled.current` is true.
 * A transaction after the flag flips refreshes the decorations.
 */
export function wysiwygFocusPlugin(enabled: FocusModeFlag): Plugin {
  let wasEnabled = enabled.current;
  return new Plugin({
    props: {
      decorations(state) {
        if (!enabled.current) {
          return null;
        }
        return dimmedBlocks(state);
      },
    },
    view() {
      return {
        update(view, prev) {
          const now = enabled.current;
          const turnedOn = now && !wasEnabled;
          wasEnabled = now;
          if (!now) {
            return;
          }
          const moved =
            turnedOn || !prev.selection.eq(view.state.selection) || !prev.doc.eq(view.state.doc);
          if (moved) {
            centerCaret(view);
          }
        },
      };
    },
  });
}

export function refreshFocusMode(view: EditorView): Transaction {
  return view.state.tr;
}
