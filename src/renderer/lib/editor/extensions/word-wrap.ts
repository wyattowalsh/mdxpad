/**
 * Word Wrap Extension for CodeMirror
 *
 * Provides toggleable word wrapping via a Compartment for dynamic
 * reconfiguration without editor recreation.
 *
 * @module renderer/lib/editor/extensions/word-wrap
 */

import { Compartment, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of creating a word wrap extension.
 */
export interface WordWrapExtensionResult {
  /** The extension to add to the editor */
  readonly extension: Extension;
  /** Toggle word wrap on or off */
  readonly toggle: (view: EditorView, wrap: boolean) => void;
  /** The compartment for external reconfiguration */
  readonly compartment: Compartment;
}

// =============================================================================
// Extension Factory
// =============================================================================

/**
 * Creates a toggleable word wrap extension.
 *
 * Uses a CodeMirror Compartment to allow dynamic toggling of line wrapping
 * without recreating the editor state.
 *
 * @param initialWrap - Whether word wrap is initially enabled (default: false)
 * @returns Object with the extension, toggle function, and compartment
 *
 * @example
 * ```typescript
 * const { extension, toggle, compartment } = createWordWrapExtension(true);
 *
 * const view = new EditorView({
 *   state: EditorState.create({ extensions: [extension] }),
 *   parent: container,
 * });
 *
 * // Toggle wrap off
 * toggle(view, false);
 * ```
 */
export function createWordWrapExtension(initialWrap = false): WordWrapExtensionResult {
  const compartment = new Compartment();

  const getWrapExtension = (wrap: boolean): Extension => (wrap ? EditorView.lineWrapping : []);

  const extension = compartment.of(getWrapExtension(initialWrap));

  const toggle = (view: EditorView, wrap: boolean): void => {
    view.dispatch({
      effects: compartment.reconfigure(getWrapExtension(wrap)),
    });
  };

  return { extension, toggle, compartment };
}
