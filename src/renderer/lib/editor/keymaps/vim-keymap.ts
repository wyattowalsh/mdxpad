/**
 * Vim Keymap Extension for CodeMirror
 *
 * Wraps @replit/codemirror-vim in a Compartment for enable/disable toggling.
 *
 * @module renderer/lib/editor/keymaps/vim-keymap
 */

import { Compartment, type Extension } from '@codemirror/state';
import { vim } from '@replit/codemirror-vim';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of creating a vim keymap extension.
 */
export interface VimKeymapExtensionResult {
  /** The extension to add to the editor */
  readonly extension: Extension;
  /** The compartment for reconfiguring (enable/disable) */
  readonly compartment: Compartment;
}

// =============================================================================
// Extension Factory
// =============================================================================

/**
 * Creates a Vim keymap extension wrapped in a Compartment.
 *
 * The Compartment allows enabling/disabling Vim mode at runtime
 * without recreating the editor.
 *
 * @param enabled - Whether Vim mode is initially enabled (default: true)
 * @returns Object with the extension and compartment
 *
 * @example
 * ```typescript
 * const { extension, compartment } = createVimKeymapExtension();
 *
 * // Disable vim mode
 * view.dispatch({
 *   effects: compartment.reconfigure([]),
 * });
 *
 * // Re-enable vim mode
 * view.dispatch({
 *   effects: compartment.reconfigure(vim()),
 * });
 * ```
 */
export function createVimKeymapExtension(enabled = true): VimKeymapExtensionResult {
  const compartment = new Compartment();
  const extension = compartment.of(enabled ? vim() : []);

  return { extension, compartment };
}
