/**
 * Keymap Factory
 *
 * Provides a unified factory for creating keymap extensions
 * based on the selected mode (default, vim, emacs).
 *
 * @module renderer/lib/editor/keymaps
 */

import { type Extension } from '@codemirror/state';
import { createVimKeymapExtension } from './vim-keymap';
import { createEmacsKeymapExtension } from './emacs-keymap';

// =============================================================================
// Types
// =============================================================================

/** Available keymap modes */
export type KeymapMode = 'default' | 'vim' | 'emacs';

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a keymap extension for the specified mode.
 *
 * - `'default'`: No additional keybindings (uses CM defaults)
 * - `'vim'`: Vim keybindings via @replit/codemirror-vim
 * - `'emacs'`: Emacs keybindings via @replit/codemirror-emacs
 *
 * @param mode - The keymap mode to use
 * @returns CodeMirror Extension for the selected mode
 *
 * @example
 * ```typescript
 * import { createKeymapExtension } from './keymaps';
 *
 * const ext = createKeymapExtension('vim');
 * ```
 */
export function createKeymapExtension(mode: KeymapMode): Extension {
  switch (mode) {
    case 'vim':
      return createVimKeymapExtension().extension;
    case 'emacs':
      return createEmacsKeymapExtension().extension;
    case 'default':
      return [];
  }
}

// Re-export types and factories
export { createVimKeymapExtension } from './vim-keymap';
export type { VimKeymapExtensionResult } from './vim-keymap';
export { createEmacsKeymapExtension } from './emacs-keymap';
export type { EmacsKeymapExtensionResult } from './emacs-keymap';
