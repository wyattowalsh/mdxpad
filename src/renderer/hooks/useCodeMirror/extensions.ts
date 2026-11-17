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
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { indentationMarkers } from '@replit/codemirror-indentation-markers';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';

import { Compartment } from '@codemirror/state';

// DIRECT imports (not barrel) per task spec
import { mdxLanguage } from '../../lib/editor/mdx-language';
import {
  createMarkdownIntelligenceExtension,
  anchorCompletionSource,
} from '../../lib/editor/markdown-intelligence';
import { createThemeCompartment, getThemeExtension, type EditorTheme } from './themes';
import type { EditorConfig } from '@shared/types/editor';

// Wave 2 extensions
import { multiCursorExtension } from '../../lib/editor/extensions/multi-cursor';
import { codeFoldingExtension } from '../../lib/editor/extensions/code-folding';
import { regexSearchExtension } from '../../lib/editor/extensions/find-replace-regex';
import { createWordWrapExtension } from '../../lib/editor/extensions/word-wrap';
import { createSnippetCompletionSource } from '../../lib/editor/extensions/snippets-engine';
import { minimapExtension } from '../../lib/editor/extensions/minimap';
import { focusModeExtension } from '../../lib/editor/extensions/focus-mode';
import { distractionFreeExtension } from '../../lib/editor/extensions/distraction-free';
import { spellcheckExtension } from '../../lib/editor/extensions/spellcheck';
import { createFontSettingsExtension } from '../../lib/editor/extensions/font-settings';
import { createKeymapExtension, type KeymapMode } from '../../lib/editor/keymaps';
import { codeExecutionExtension } from '../../lib/editor/extensions/code-execution';
import { createSlashCommandCompletionSource } from '../../lib/editor/extensions/slash-commands';
import { goToDefinitionExtension } from '../../lib/editor/extensions/go-to-definition';
import { commentDecorationExtension } from '../../lib/editor/comment-decorations';
import { importPathCandidates, openFirstExistingFile } from '@renderer/lib/open-file-from-path';
import { joinRelativePath } from '@renderer/lib/resolve-beside-file';
import { useDocumentStore } from '@renderer/stores/document-store';
import { predictNextEdit } from '../../lib/editor/next-edit-provider';
import { nextEditPrediction } from '../../lib/editor/extensions/next-edit-prediction';

function openImportedFile(specifier: string): void {
  if (!specifier.startsWith('.')) {
    return;
  }
  const current = useDocumentStore.getState().filePath;
  if (current?.includes('/') !== true) {
    return;
  }
  let decoded = specifier;
  try {
    decoded = decodeURIComponent(specifier);
  } catch {
    return;
  }
  const directory = current.slice(0, current.lastIndexOf('/'));
  const resolved = joinRelativePath(directory, decoded);
  if (resolved) {
    void openFirstExistingFile(importPathCandidates(resolved));
  }
}

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
  /** Enable markdown diagnostics and anchor completions (default: true) */
  readonly markdownIntelligence?: boolean;
  /** Keymap mode: 'default' | 'vim' | 'emacs' (default: 'default') */
  readonly keymapMode?: KeymapMode;
  /** Enable minimap overview (default: false) */
  readonly enableMinimap?: boolean;
  /** Enable focus/typewriter mode (default: false) */
  readonly enableFocusMode?: boolean;
  /** Enable spellcheck (default: false) */
  readonly enableSpellcheck?: boolean;
  /** Enable snippet autocompletion (default: true) */
  readonly enableSnippets?: boolean;
  /** Font family CSS value (default: 'monospace') */
  readonly fontFamily?: string;
  /** Font size in pixels (default: 14) */
  readonly fontSize?: number;
  /** Line height multiplier (default: 1.6) */
  readonly fontLineHeight?: number;
  /**
   * Custom CodeMirror extensions to add to the editor.
   *
   * These extensions are appended after all built-in extensions, allowing them
   * to override or extend built-in behavior when extension precedence matters.
   */
  readonly extensions?: Extension[];
}

/** Default configuration values */
const DEFAULTS: Required<
  Omit<MDXEditorConfig, 'debounceMs' | 'extensions' | 'initialDoc' | 'readonly'>
> & {
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
  markdownIntelligence: true,
  keymapMode: 'default',
  enableMinimap: false,
  enableFocusMode: false,
  enableSpellcheck: false,
  enableSnippets: true,
  fontFamily: 'monospace',
  fontSize: 14,
  fontLineHeight: 1.6,
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
  /** Compartment for toggling minimap on/off */
  readonly minimapCompartment: Compartment;
  /** Compartment for toggling focus mode on/off */
  readonly focusModeCompartment: Compartment;
  /** Compartment for toggling spellcheck on/off */
  readonly spellcheckCompartment: Compartment;
  /** Compartment for toggling snippets on/off */
  readonly snippetCompartment: Compartment;
  /** Word wrap result with toggle and compartment */
  readonly wordWrapCompartment: Compartment;
  /** Font settings result with update and compartment */
  readonly fontSettingsCompartment: Compartment;
  /** Compartment for keymap mode switching */
  readonly keymapCompartment: Compartment;
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

  // Create compartments for toggleable features
  const minimapCompartment = new Compartment();
  const focusModeCompartment = new Compartment();
  const spellcheckCompartment = new Compartment();
  const snippetCompartment = new Compartment();
  const keymapCompartment = new Compartment();

  // Core editing features (always enabled)
  extensions.push(highlightSpecialChars());
  extensions.push(history());
  extensions.push(drawSelection());
  extensions.push(dropCursor());
  extensions.push(crosshairCursor());
  extensions.push(rectangularSelection());

  // Multi-cursor support (always enabled)
  extensions.push(multiCursorExtension());

  // Code folding (always enabled)
  extensions.push(codeFoldingExtension());

  // Enhanced find & replace with regex
  extensions.push(regexSearchExtension());
  extensions.push(codeExecutionExtension());
  extensions.push(goToDefinitionExtension(openImportedFile));
  extensions.push(commentDecorationExtension());
  extensions.push(nextEditPrediction(predictNextEdit));

  // MDX language support
  extensions.push(mdxLanguage());

  // Markdown diagnostics and link-anchor intelligence
  if (opts.markdownIntelligence) {
    extensions.push(...createMarkdownIntelligenceExtension());
  }

  // Theme (compartment for dynamic switching)
  extensions.push(themeCompartment.of(getThemeExtension(opts.theme)));

  // Line numbers
  if (opts.lineNumbers) {
    extensions.push(lineNumbersExt());
  }

  // Word wrap (compartment-based for dynamic toggling)
  const wordWrap = createWordWrapExtension(opts.lineWrapping);
  extensions.push(wordWrap.extension);

  // Font settings (compartment-based for dynamic updates)
  const fontSettings = createFontSettingsExtension({
    fontFamily: opts.fontFamily,
    fontSize: opts.fontSize,
    lineHeight: opts.fontLineHeight,
  });
  extensions.push(fontSettings.extension);

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

  // Distraction-free mode theme (always loaded, toggled via CSS class)
  extensions.push(distractionFreeExtension());

  // Minimap (compartment for dynamic toggling)
  extensions.push(minimapCompartment.of(opts.enableMinimap ? minimapExtension() : []));

  // Focus mode (compartment for dynamic toggling)
  extensions.push(focusModeCompartment.of(opts.enableFocusMode ? focusModeExtension() : []));

  // Spellcheck (compartment for dynamic toggling)
  extensions.push(spellcheckCompartment.of(opts.enableSpellcheck ? spellcheckExtension() : []));

  // Autocompletion — single call combining all completion sources to avoid
  // combineConfig conflicts on the 'override' field.
  {
    const completionSources = [];
    if (opts.markdownIntelligence) {
      completionSources.push(anchorCompletionSource);
    }
    if (opts.enableSnippets) {
      completionSources.push(createSnippetCompletionSource());
    }
    completionSources.push(createSlashCommandCompletionSource());
    extensions.push(
      snippetCompartment.of(
        autocompletion(completionSources.length > 0 ? { override: completionSources } : {})
      )
    );
  }

  // Keymap mode (compartment for dynamic switching)
  extensions.push(keymapCompartment.of(createKeymapExtension(opts.keymapMode)));

  // Default keymaps (combined for proper precedence)
  extensions.push(keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]));

  // Custom extensions (appended last so they can override built-in behavior)
  if (opts.extensions.length > 0) {
    extensions.push(...opts.extensions);
  }

  return {
    extensions,
    themeCompartment,
    minimapCompartment,
    focusModeCompartment,
    spellcheckCompartment,
    snippetCompartment,
    wordWrapCompartment: wordWrap.compartment,
    fontSettingsCompartment: fontSettings.compartment,
    keymapCompartment,
  };
}

// Re-export types needed by consumers
export type { EditorTheme };
export type { KeymapMode };
export { Compartment };
