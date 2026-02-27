/**
 * Enhanced Find & Replace with Regex Support for CodeMirror
 *
 * Extends the built-in @codemirror/search with regex toggling,
 * capture group references in replace, and case sensitivity toggling.
 *
 * @module renderer/lib/editor/extensions/find-replace-regex
 */

import { type Extension, StateEffect, StateField } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { openSearchPanel, search } from '@codemirror/search';

// =============================================================================
// Types
// =============================================================================

/**
 * Search configuration state.
 */
export interface RegexSearchState {
  /** Whether regex mode is enabled */
  readonly regexEnabled: boolean;
  /** Whether case-sensitive matching is enabled */
  readonly caseSensitive: boolean;
}

// =============================================================================
// State Effects
// =============================================================================

/** Toggle regex mode on/off */
export const toggleRegexEffect = StateEffect.define<boolean>();

/** Toggle case sensitivity on/off */
export const toggleCaseSensitiveEffect = StateEffect.define<boolean>();

// =============================================================================
// State Field
// =============================================================================

const DEFAULT_STATE: RegexSearchState = {
  regexEnabled: false,
  caseSensitive: false,
};

/**
 * StateField tracking regex search configuration.
 */
export const regexSearchField = StateField.define<RegexSearchState>({
  create() {
    return DEFAULT_STATE;
  },

  update(state, transaction) {
    let updated = state;

    for (const effect of transaction.effects) {
      if (effect.is(toggleRegexEffect)) {
        updated = { ...updated, regexEnabled: effect.value };
      }
      if (effect.is(toggleCaseSensitiveEffect)) {
        updated = { ...updated, caseSensitive: effect.value };
      }
    }

    return updated;
  },
});

// =============================================================================
// Commands
// =============================================================================

/**
 * Open the search panel with regex search capabilities.
 */
function openRegexSearch(view: EditorView): boolean {
  return openSearchPanel(view);
}

/**
 * Toggle regex mode in the search state.
 */
export function toggleRegex(view: EditorView): boolean {
  const current = view.state.field(regexSearchField);
  view.dispatch({
    effects: toggleRegexEffect.of(!current.regexEnabled),
  });
  return true;
}

/**
 * Toggle case sensitivity in the search state.
 */
export function toggleCaseSensitive(view: EditorView): boolean {
  const current = view.state.field(regexSearchField);
  view.dispatch({
    effects: toggleCaseSensitiveEffect.of(!current.caseSensitive),
  });
  return true;
}

// =============================================================================
// Replace with Capture Groups
// =============================================================================

/**
 * Apply capture group references ($1, $2, etc.) in a replacement string
 * given a regex match.
 *
 * @param replacePattern - Replacement string with $1, $2, etc.
 * @param match - RegExp match result
 * @returns Expanded replacement string
 */
export function expandCaptureGroups(replacePattern: string, match: RegExpMatchArray): string {
  return replacePattern.replace(/\$(\d+)/g, (_, groupIndex: string) => {
    const idx = parseInt(groupIndex, 10);
    return match[idx] ?? '';
  });
}

// =============================================================================
// Keymap
// =============================================================================

const regexSearchKeymap = keymap.of([
  {
    key: 'Mod-Shift-h',
    run: openRegexSearch,
  },
]);

// =============================================================================
// Extension
// =============================================================================

/**
 * Enhanced find & replace extension with regex support.
 *
 * Builds on `@codemirror/search` and adds:
 * - Regex toggle (on/off) via state field
 * - Case sensitivity toggle
 * - Capture group references in replace ($1, $2, etc.)
 *
 * @returns CodeMirror Extension
 *
 * @example
 * ```typescript
 * import { regexSearchExtension } from './find-replace-regex';
 *
 * const view = new EditorView({
 *   extensions: [regexSearchExtension()],
 * });
 * ```
 */
export function regexSearchExtension(): Extension {
  return [
    search({
      literal: false,
    }),
    regexSearchField,
    regexSearchKeymap,
  ];
}
