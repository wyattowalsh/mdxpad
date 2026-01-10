/**
 * Theme configuration for CodeMirror editor.
 *
 * Implements dynamic theme switching via CodeMirror Compartments,
 * supporting light, dark, and system-preference themes.
 *
 * @see Decision 6 in research.md
 * @see Constitution Article VII Section 7.1
 * @module
 */

import { Compartment, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

/**
 * Theme configuration type.
 *
 * - `'light'`: Force light theme
 * - `'dark'`: Force dark theme
 * - `'system'`: Follow system preference via `prefers-color-scheme`
 */
export type EditorTheme = 'light' | 'dark' | 'system';

/**
 * Create a new compartment for dynamic theme switching.
 *
 * Each editor instance should have its own compartment to enable
 * independent theme switching. Use with `compartment.reconfigure()`
 * to switch themes at runtime.
 *
 * @returns A new Compartment instance for theme management
 */
export function createThemeCompartment(): Compartment {
  return new Compartment();
}

/**
 * Light theme extension.
 *
 * Provides a clean, minimal light theme based on CodeMirror defaults
 * with explicit styling for background and cursor.
 */
export const lightTheme: Extension = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
  },
  '.cm-content': {
    caretColor: '#000000',
  },
  '.cm-cursor': {
    borderLeftColor: '#000000',
  },
});

/**
 * Dark theme extension using One Dark.
 *
 * Atom's iconic One Dark theme ported to CodeMirror 6.
 * @see https://github.com/codemirror/theme-one-dark
 */
export const darkTheme: Extension = oneDark;

/**
 * Detect system color scheme preference.
 *
 * Uses the `prefers-color-scheme` media query to determine
 * whether the user's system is configured for dark mode.
 *
 * @returns `'dark'` if system prefers dark mode, `'light'` otherwise.
 *          Defaults to `'light'` in non-browser environments.
 */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get the appropriate theme extension based on theme setting.
 *
 * Resolves the `EditorTheme` setting to a concrete CodeMirror extension.
 * For `'system'` theme, queries the current system preference.
 *
 * @param theme - The desired theme setting
 * @returns The corresponding CodeMirror theme extension
 */
export function getThemeExtension(theme: EditorTheme): Extension {
  if (theme === 'system') {
    return getSystemTheme() === 'dark' ? darkTheme : lightTheme;
  }
  return theme === 'dark' ? darkTheme : lightTheme;
}

/**
 * Create a media query listener for system theme changes.
 *
 * When `currentTheme` is `'system'`, this sets up a listener on the
 * `prefers-color-scheme` media query that automatically updates the
 * editor theme when the system preference changes.
 *
 * @param view - The CodeMirror EditorView instance
 * @param compartment - The theme compartment for reconfiguration
 * @param currentTheme - The current theme setting
 * @returns Cleanup function to remove the listener.
 *          Returns no-op function if theme is not `'system'` or
 *          running in non-browser environment.
 *
 * @example
 * ```typescript
 * const cleanup = createThemeListener(view, themeCompartment, 'system');
 * // Later, when unmounting:
 * cleanup();
 * ```
 */
export function createThemeListener(
  view: EditorView,
  compartment: Compartment,
  currentTheme: EditorTheme
): () => void {
  if (currentTheme !== 'system' || typeof window === 'undefined') {
    // Return no-op cleanup function when not using system theme
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return (): void => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = (e: MediaQueryListEvent): void => {
    view.dispatch({
      effects: compartment.reconfigure(e.matches ? darkTheme : lightTheme),
    });
  };

  mediaQuery.addEventListener('change', handler);

  return () => {
    mediaQuery.removeEventListener('change', handler);
  };
}
