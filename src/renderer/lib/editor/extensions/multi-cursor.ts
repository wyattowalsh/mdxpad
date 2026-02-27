/**
 * Multi-Cursor Extension for CodeMirror
 *
 * Adds "select next occurrence" (Cmd+D / Ctrl+D) and
 * "select all occurrences" (Cmd+Shift+L) commands.
 *
 * @module renderer/lib/editor/extensions/multi-cursor
 */

import { EditorSelection, EditorState, type Extension, type SelectionRange } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the currently selected text from the primary selection.
 * If nothing is selected, select the word under the cursor first.
 */
function getSelectedTextOrWord(view: EditorView): { text: string; wordSelected: boolean } {
  const { state } = view;
  const { from, to } = state.selection.main;

  if (from !== to) {
    return { text: state.sliceDoc(from, to), wordSelected: false };
  }

  // No selection: select word at cursor
  const word = state.wordAt(from);
  if (!word) return { text: '', wordSelected: false };

  // Select the word under cursor
  view.dispatch({
    selection: EditorSelection.single(word.from, word.to),
  });

  return { text: state.sliceDoc(word.from, word.to), wordSelected: true };
}

/**
 * Find the next occurrence of `text` in the document after `startPos`,
 * wrapping around if necessary. Returns null if not found or if the
 * position is already selected.
 */
function findNextOccurrence(
  doc: string,
  text: string,
  startPos: number,
  existingRanges: readonly SelectionRange[]
): { from: number; to: number } | null {
  const lowerDoc = doc;
  const searchText = text;

  // Search forward from startPos
  let idx = lowerDoc.indexOf(searchText, startPos);

  // Wrap around
  if (idx === -1) {
    idx = lowerDoc.indexOf(searchText);
  }

  if (idx === -1) return null;

  // Check if already selected; if so try next
  const isAlreadySelected = existingRanges.some(
    (r) => r.from === idx && r.to === idx + text.length
  );

  if (isAlreadySelected) {
    // Try the occurrence after this one
    const nextIdx = lowerDoc.indexOf(searchText, idx + 1);
    if (nextIdx === -1 || nextIdx === idx) return null;

    const nextAlreadySelected = existingRanges.some(
      (r) => r.from === nextIdx && r.to === nextIdx + text.length
    );
    if (nextAlreadySelected) return null;

    return { from: nextIdx, to: nextIdx + text.length };
  }

  return { from: idx, to: idx + text.length };
}

// =============================================================================
// Commands
// =============================================================================

/**
 * Select the next occurrence of the current selection.
 * If nothing is selected, selects the word under the cursor.
 */
function selectNextOccurrence(view: EditorView): boolean {
  const { text, wordSelected } = getSelectedTextOrWord(view);
  if (!text) return false;

  // If we just selected a word, that counts as the action
  if (wordSelected) return true;

  const doc = view.state.doc.toString();
  const ranges = view.state.selection.ranges;
  const lastRange = ranges[ranges.length - 1];
  if (!lastRange) return false;

  const next = findNextOccurrence(doc, text, lastRange.to, ranges);
  if (!next) return false;

  // Add the new range to existing selections
  const newRanges = [...ranges, EditorSelection.range(next.from, next.to)];

  view.dispatch({
    selection: EditorSelection.create(newRanges, newRanges.length - 1),
    scrollIntoView: true,
  });

  return true;
}

/**
 * Select all occurrences of the current selection.
 */
function selectAllOccurrences(view: EditorView): boolean {
  const { text } = getSelectedTextOrWord(view);
  if (!text) return false;

  const doc = view.state.doc.toString();
  const ranges: SelectionRange[] = [];

  let idx = 0;
  while (true) {
    const found = doc.indexOf(text, idx);
    if (found === -1) break;
    ranges.push(EditorSelection.range(found, found + text.length));
    idx = found + 1;
  }

  if (ranges.length === 0) return false;

  view.dispatch({
    selection: EditorSelection.create(ranges),
    scrollIntoView: true,
  });

  return true;
}

// =============================================================================
// Keymap
// =============================================================================

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

const multiCursorKeymap = keymap.of([
  {
    key: isMac ? 'Mod-d' : 'Ctrl-d',
    run: selectNextOccurrence,
  },
  {
    key: isMac ? 'Mod-Shift-l' : 'Ctrl-Shift-l',
    run: selectAllOccurrences,
  },
]);

// =============================================================================
// Extension
// =============================================================================

/**
 * Multi-cursor extension for CodeMirror.
 *
 * Provides:
 * - `Cmd+D` / `Ctrl+D`: Select next occurrence of current selection
 * - `Cmd+Shift+L` / `Ctrl+Shift+L`: Select all occurrences
 *
 * @returns CodeMirror Extension
 *
 * @example
 * ```typescript
 * import { multiCursorExtension } from './multi-cursor';
 *
 * const view = new EditorView({
 *   extensions: [multiCursorExtension()],
 * });
 * ```
 */
export function multiCursorExtension(): Extension {
  return [EditorState.allowMultipleSelections.of(true), multiCursorKeymap];
}

// Export commands for testing
export { selectNextOccurrence, selectAllOccurrences };
