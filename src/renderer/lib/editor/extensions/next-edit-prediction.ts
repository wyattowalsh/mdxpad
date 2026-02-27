/**
 * Next-Edit Prediction Extension for CodeMirror
 *
 * Shows AI-generated ghost text completions after a typing pause.
 * Tab to accept, Escape to dismiss. Debounced requests (500ms pause).
 * Cancel on new keystroke.
 *
 * @module renderer/lib/editor/extensions/next-edit-prediction
 */

import { type Extension, StateField, StateEffect, type EditorState } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType, keymap } from '@codemirror/view';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Debounce delay before requesting a prediction */
const DEBOUNCE_MS = 500;

/** CSS class for the ghost text widget */
const GHOST_TEXT_CLASS = 'cm-ghost-text';

// =============================================================================
// STATE EFFECTS
// =============================================================================

const setPrediction = StateEffect.define<string | null>();

// =============================================================================
// GHOST TEXT WIDGET
// =============================================================================

class GhostTextWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  toDOM(): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = GHOST_TEXT_CLASS;
    span.textContent = this.text;
    return span;
  }

  eq(other: GhostTextWidget): boolean {
    return this.text === other.text;
  }
}

// =============================================================================
// STATE FIELD
// =============================================================================

const predictionField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },

  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setPrediction)) {
        if (effect.value === null) {
          return Decoration.none;
        }

        const pos = tr.state.selection.main.head;
        const widget = Decoration.widget({
          widget: new GhostTextWidget(effect.value),
          side: 1,
        });
        return Decoration.set([widget.range(pos)]);
      }
    }

    // Clear predictions on document changes (new keystrokes)
    if (tr.docChanged) {
      return Decoration.none;
    }

    return decorations;
  },

  provide: (field) => EditorView.decorations.from(field),
});

// =============================================================================
// PREDICTION PROVIDER TYPE
// =============================================================================

/**
 * Function that provides completion predictions.
 * Receives document text, cursor position, and AbortSignal.
 * Returns the suggested completion text or null.
 */
export type PredictionProvider = (
  text: string,
  cursorPos: number,
  signal: AbortSignal
) => Promise<string | null>;

// =============================================================================
// THEME
// =============================================================================

const predictionTheme = EditorView.baseTheme({
  [`.${GHOST_TEXT_CLASS}`]: {
    color: '#9ca3af',
    fontStyle: 'italic',
    opacity: '0.6',
  },
});

// =============================================================================
// KEYMAP
// =============================================================================

function createPredictionKeymap(getPredictionFn: () => string | null) {
  return keymap.of([
    {
      key: 'Tab',
      run(view) {
        const prediction = getPredictionFn();
        if (prediction === null) return false;

        // Accept: insert the prediction text
        const pos = view.state.selection.main.head;
        view.dispatch({
          changes: { from: pos, insert: prediction },
          selection: { anchor: pos + prediction.length },
          effects: [setPrediction.of(null)],
        });
        return true;
      },
    },
    {
      key: 'Escape',
      run(view) {
        const prediction = getPredictionFn();
        if (prediction === null) return false;

        // Dismiss the prediction
        view.dispatch({ effects: [setPrediction.of(null)] });
        return true;
      },
    },
  ]);
}

// =============================================================================
// CURRENT PREDICTION TRACKER
// =============================================================================

function getCurrentPrediction(state: EditorState): string | null {
  const decoSet = state.field(predictionField);
  let text: string | null = null;

  const cursor = decoSet.iter();
  while (cursor.value !== null) {
    const spec = cursor.value.spec as { widget?: unknown };
    if (spec.widget instanceof GhostTextWidget) {
      text = spec.widget.text;
      break;
    }
    cursor.next();
  }

  return text;
}

// =============================================================================
// EXTENSION
// =============================================================================

/**
 * Next-edit prediction extension.
 *
 * Shows AI-generated ghost text completions after a typing pause.
 * Tab to accept, Escape to dismiss.
 *
 * @param provider - Function that generates completion predictions
 * @returns CodeMirror Extension for next-edit prediction
 *
 * @example
 * ```typescript
 * import { nextEditPrediction } from './next-edit-prediction';
 *
 * const provider = async (text, pos, signal) => {
 *   const response = await fetch('/predict', { signal, body: text });
 *   return response.text();
 * };
 *
 * const view = new EditorView({
 *   extensions: [nextEditPrediction(provider)],
 * });
 * ```
 */
export function nextEditPrediction(provider: PredictionProvider): Extension {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  // Track current prediction for keymap
  let currentPrediction: string | null = null;

  const updateListener = EditorView.updateListener.of((update) => {
    // Track current prediction from state
    currentPrediction = getCurrentPrediction(update.state);

    if (!update.docChanged) return;

    // Cancel any pending request
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (abortController) {
      abortController.abort();
      abortController = null;
    }

    // Schedule a new prediction request
    debounceTimer = setTimeout(() => {
      abortController = new AbortController();
      const { state } = update.view;
      const text = state.doc.toString();
      const pos = state.selection.main.head;

      void provider(text, pos, abortController.signal).then(
        (prediction) => {
          if (prediction && !abortController?.signal.aborted) {
            update.view.dispatch({
              effects: [setPrediction.of(prediction)],
            });
          }
        },
        () => {
          // Request was aborted or failed, ignore
        }
      );
    }, DEBOUNCE_MS);
  });

  return [
    predictionField,
    predictionTheme,
    createPredictionKeymap(() => currentPrediction),
    updateListener,
  ];
}
