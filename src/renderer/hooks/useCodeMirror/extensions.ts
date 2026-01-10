/**
 * CodeMirror Extension Composition
 *
 * Builds the complete set of CodeMirror extensions from editor configuration.
 * Composes language support, themes, visual features, and keymaps into
 * a single extension array for EditorState creation.
 *
 * @see plan.md Phase 2
 * @see contracts/editor-api.ts MDXEditorConfig
 * @module
 */

import { Extension } from '@codemirror/state';
import {
  EditorView,
  lineNumbers as lineNumbersExt,
  highlightActiveLine,
  keymap,
  highlightSpecialChars,
  drawSelection,
  rectangularSelection,
  crosshairCursor,
  dropCursor,
} from '@codemirror/view';
import { bracketMatching, indentUnit } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { indentationMarkers } from '@replit/codemirror-indentation-markers';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { search, searchKeymap } from '@codemirror/search';

import { Compartment } from '@codemirror/state';

// DIRECT imports (not barrel) per task spec
import { mdxLanguage } from '../../lib/editor/mdx-language';
import { createThemeCompartment, getThemeExtension, type EditorTheme } from './themes';
import type { EditorConfig } from '@shared/types/editor';

/**
 * Extended configuration for MDX editor, building on shared EditorConfig.
 *
 * ## Configuration Hierarchy
 *
 * `EditorConfig` (from @shared/types/editor):
 *   Base configuration with core editor settings like tabSize, lineNumbers,
 *   lineWrapping - shared across all editor implementations.
 *
 * `MDXEditorConfig` (this interface):
 *   Extends EditorConfig with MDX-specific settings like theme, bracket
 *   matching, active line highlighting - specific to the CodeMirror implementation.
 *
 * ## Usage
 *
 * - Use `EditorConfig` when working with cross-platform editor abstractions
 * - Use `MDXEditorConfig` when configuring the CodeMirror-based MDX editor
 *
 * @see EditorConfig - Base configuration in @shared/types/editor
 * @see contracts/editor-api.ts MDXEditorConfig
 */
export interface MDXEditorConfig extends EditorConfig {
  /** Theme mode (default: 'system') */
  readonly theme?: EditorTheme;
  /** Debounce delay for onChange in ms (default: 150) */
  readonly debounceMs?: number;
  /** Enable active line highlighting (default: true) */
  readonly highlightActiveLine?: boolean;
  /** Enable bracket matching (default: true) */
  readonly bracketMatching?: boolean;
  /** Enable auto-close brackets (default: true) */
  readonly closeBrackets?: boolean;
  /** Enable indentation guides (default: true) */
  readonly indentationGuides?: boolean;
  /**
   * Custom CodeMirror extensions to add to the editor.
   *
   * These extensions are appended after all built-in extensions, allowing them
   * to override or extend built-in behavior when extension precedence matters.
   *
   * @example
   * ```typescript
   * import { EditorView } from '@codemirror/view';
   *
   * const customExtensions = [
   *   EditorView.theme({ '&': { fontSize: '16px' } }),
   * ];
   * ```
   */
  readonly extensions?: Extension[];
}

/** Default configuration values */
const DEFAULTS: Required<Omit<MDXEditorConfig, 'debounceMs' | 'extensions' | 'initialDoc' | 'readonly'>> & {
  debounceMs: number;
  extensions: Extension[];
} = {
  theme: 'system',
  debounceMs: 150,
  lineNumbers: true,
  lineWrapping: false,
  tabSize: 2,
  indentWithTabs: false,
  highlightActiveLine: true,
  bracketMatching: true,
  closeBrackets: true,
  indentationGuides: true,
  extensions: [],
} as const;

/**
 * Result of building editor extensions.
 *
 * Contains both the extension array and the theme compartment
 * for independent theme switching per editor instance.
 */
export interface EditorExtensionsResult {
  /** Array of CodeMirror extensions ready for EditorState.create() */
  readonly extensions: Extension[];
  /** Theme compartment for this editor instance (use for dynamic theme switching) */
  readonly themeCompartment: Compartment;
}

/**
 * Build CodeMirror extensions from configuration.
 *
 * Composes all editor extensions based on the provided configuration,
 * including language support, theme, visual features, and keymaps.
 * Extensions are ordered to ensure proper precedence.
 *
 * Each call creates a new theme compartment to ensure independent
 * theme switching when multiple editor instances exist.
 *
 * **Extension Order:**
 * 1. Core editing features (history, selection, etc.)
 * 2. MDX language support
 * 3. Theme (in compartment for dynamic switching)
 * 4. Visual features (line numbers, wrapping, etc.)
 * 5. Keymaps (default, history, search)
 * 6. **Custom extensions (appended last)**
 *
 * Custom extensions are added after built-in extensions, allowing them to:
 * - Override built-in styling with custom themes
 * - Add additional keymaps that take precedence
 * - Extend or replace built-in behaviors
 *
 * @param config - Editor configuration options (all optional with sensible defaults)
 * @returns Object containing extensions array and theme compartment for the instance
 *
 * @example
 * ```typescript
 * import { EditorState } from '@codemirror/state';
 * import { EditorView } from '@codemirror/view';
 * import { buildExtensions } from './extensions';
 *
 * // Basic usage
 * const { extensions, themeCompartment } = buildExtensions({ theme: 'dark', lineNumbers: true });
 *
 * // With custom extensions
 * const { extensions: customExts } = buildExtensions({
 *   theme: 'dark',
 *   extensions: [
 *     EditorView.theme({ '&': { fontSize: '18px' } }),
 *   ],
 * });
 *
 * const state = EditorState.create({
 *   doc: '# Hello MDX',
 *   extensions,
 * });
 * // Use themeCompartment for dynamic theme switching
 * ```
 */
export function buildExtensions(config: Partial<MDXEditorConfig> = {}): EditorExtensionsResult {
  const opts = { ...DEFAULTS, ...config };
  const extensions: Extension[] = [];

  // Create per-instance theme compartment (fixes singleton issue with multiple editors)
  const themeCompartment = createThemeCompartment();

  // Core editing features (always enabled)
  extensions.push(highlightSpecialChars());
  extensions.push(history());
  extensions.push(drawSelection());
  extensions.push(dropCursor());
  extensions.push(crosshairCursor());
  extensions.push(rectangularSelection());

  // MDX language support
  extensions.push(mdxLanguage());

  // Theme (compartment for dynamic switching)
  extensions.push(themeCompartment.of(getThemeExtension(opts.theme)));

  // Line numbers
  if (opts.lineNumbers) {
    extensions.push(lineNumbersExt());
  }

  // Line wrapping
  if (opts.lineWrapping) {
    extensions.push(EditorView.lineWrapping);
  }

  // Active line highlighting
  if (opts.highlightActiveLine) {
    extensions.push(highlightActiveLine());
  }

  // Bracket matching
  if (opts.bracketMatching) {
    extensions.push(bracketMatching());
  }

  // Auto-close brackets (including JSX)
  if (opts.closeBrackets) {
    extensions.push(closeBrackets());
  }

  // Indentation guides (vertical lines at indent levels)
  if (opts.indentationGuides) {
    extensions.push(indentationMarkers());
  }

  // Indentation configuration
  extensions.push(indentUnit.of(opts.indentWithTabs ? '\t' : ' '.repeat(opts.tabSize)));

  // Search functionality
  extensions.push(search());

  // Keymaps (combined for proper precedence)
  extensions.push(keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]));

  // Custom extensions (appended last so they can override built-in behavior)
  if (opts.extensions.length > 0) {
    extensions.push(...opts.extensions);
  }

  return { extensions, themeCompartment };
}

// Re-export types needed by consumers
export type { EditorTheme };
export { Compartment };
