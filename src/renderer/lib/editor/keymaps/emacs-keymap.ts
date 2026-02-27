/**
 * Emacs Keymap Extension for CodeMirror
 *
 * Wraps @replit/codemirror-emacs in a Compartment for enable/disable toggling.
 *
 * @module renderer/lib/editor/keymaps/emacs-keymap
 */

import { Compartment, type Extension } from '@codemirror/state';
import { emacs } from '@replit/codemirror-emacs';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of creating an Emacs keymap extension.
 */
export interface EmacsKeymapExtensionResult {
  /** The extension to add to the editor */
  readonly extension: Extension;
  /** The compartment for reconfiguring (enable/disable) */
  readonly compartment: Compartment;
}

// =============================================================================
// Extension Factory
// =============================================================================

/**
 * Creates an Emacs keymap extension wrapped in a Compartment.
 *
 * The Compartment allows enabling/disabling Emacs mode at runtime
 * without recreating the editor.
 *
 * @param enabled - Whether Emacs mode is initially enabled (default: true)
 * @returns Object with the extension and compartment
 *
 * @example
 * ```typescript
 * const { extension, compartment } = createEmacsKeymapExtension();
 *
 * // Disable emacs mode
 * view.dispatch({
 *   effects: compartment.reconfigure([]),
 * });
 *
 * // Re-enable emacs mode
 * view.dispatch({
 *   effects: compartment.reconfigure(emacs()),
 * });
 * ```
 */
export function createEmacsKeymapExtension(enabled = true): EmacsKeymapExtensionResult {
  const compartment = new Compartment();
  const extension = compartment.of(enabled ? emacs() : []);

  return { extension, compartment };
}
