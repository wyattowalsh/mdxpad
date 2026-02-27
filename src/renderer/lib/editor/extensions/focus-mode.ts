/**
 * Focus / Typewriter Mode Extension for CodeMirror
 *
 * Centers the current line vertically and dims non-active paragraphs
 * to minimize visual distraction while writing.
 *
 * @module renderer/lib/editor/extensions/focus-mode
 */

import { type Extension } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';

// =============================================================================
// Constants
// =============================================================================

/** CSS class applied to dimmed (non-active) lines */
const DIMMED_CLASS = 'cm-focus-mode-dimmed';

/** CSS class applied to the active line in focus mode */
const ACTIVE_CLASS = 'cm-focus-mode-active';

// =============================================================================
// Decorations
// =============================================================================

const dimmedDecoration = Decoration.line({ attributes: { class: DIMMED_CLASS } });
const activeDecoration = Decoration.line({ attributes: { class: ACTIVE_CLASS } });

// =============================================================================
// Theme
// =============================================================================

const focusModeTheme = EditorView.baseTheme({
  [`&.cm-editor .${DIMMED_CLASS}`]: {
    opacity: '0.3',
    transition: 'opacity 200ms ease',
  },
  [`&.cm-editor .${ACTIVE_CLASS}`]: {
    opacity: '1',
    transition: 'opacity 200ms ease',
  },
});

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the range of lines belonging to the paragraph containing the cursor.
 * A paragraph is delimited by blank lines.
 */
function getActiveParagraphLines(
  doc: {
    lineAt(pos: number): { number: number };
    lines: number;
    line(n: number): { text: string; from: number };
  },
  cursorPos: number
): Set<number> {
  const cursorLine = doc.lineAt(cursorPos).number;
  const active = new Set<number>();
  active.add(cursorLine);

  // Expand upward
  for (let n = cursorLine - 1; n >= 1; n--) {
    if (doc.line(n).text.trim() === '') break;
    active.add(n);
  }

  // Expand downward
  for (let n = cursorLine + 1; n <= doc.lines; n++) {
    if (doc.line(n).text.trim() === '') break;
    active.add(n);
  }

  return active;
}

/**
 * Build decorations for focus mode: dim all lines except the active paragraph.
 */
function buildFocusDecorations(view: EditorView): DecorationSet {
  const { doc, selection } = view.state;
  const cursorPos = selection.main.head;
  const activeLines = getActiveParagraphLines(doc, cursorPos);

  const decorations: { from: number; decoration: Decoration }[] = [];

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (activeLines.has(i)) {
      decorations.push({ from: line.from, decoration: activeDecoration });
    } else {
      decorations.push({ from: line.from, decoration: dimmedDecoration });
    }
  }

  return Decoration.set(
    decorations.map((d) => d.decoration.range(d.from)),
    true
  );
}

// =============================================================================
// View Plugin
// =============================================================================

const focusModePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildFocusDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.selectionSet || update.docChanged || update.viewportChanged) {
        this.decorations = buildFocusDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// =============================================================================
// Scroll Centering
// =============================================================================

/**
 * Extension that scrolls the cursor line to the vertical center of the viewport.
 */
const typewriterScroll = EditorView.updateListener.of((update) => {
  if (update.selectionSet || update.docChanged) {
    const { view } = update;
    const head = view.state.selection.main.head;
    const coords = view.coordsAtPos(head);
    if (!coords) return;

    const editorRect = view.dom.getBoundingClientRect();
    const midY = editorRect.top + editorRect.height / 2;
    const offset = coords.top - midY;

    if (Math.abs(offset) > 10) {
      view.scrollDOM.scrollBy({ top: offset, behavior: 'smooth' });
    }
  }
});

// =============================================================================
// Extension
// =============================================================================

/**
 * Focus / typewriter mode extension.
 *
 * Centers the current line vertically and dims non-active paragraphs.
 *
 * @returns CodeMirror Extension for focus mode
 *
 * @example
 * ```typescript
 * import { focusModeExtension } from './focus-mode';
 *
 * const view = new EditorView({
 *   extensions: [focusModeExtension()],
 * });
 * ```
 */
export function focusModeExtension(): Extension {
  return [focusModePlugin, focusModeTheme, typewriterScroll];
}
