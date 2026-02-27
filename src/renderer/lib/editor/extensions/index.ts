/**
 * Editor Extensions Barrel Export
 *
 * Re-exports all CodeMirror extension modules for convenient importing.
 *
 * @module renderer/lib/editor/extensions
 */

export { multiCursorExtension, selectNextOccurrence, selectAllOccurrences } from './multi-cursor';
export { codeFoldingExtension, foldFrontmatter, foldCodeFence, foldJsxBlock } from './code-folding';
export {
  regexSearchExtension,
  regexSearchField,
  toggleRegex,
  toggleCaseSensitive,
  toggleRegexEffect,
  toggleCaseSensitiveEffect,
  expandCaptureGroups,
} from './find-replace-regex';
export type { RegexSearchState } from './find-replace-regex';
export { createWordWrapExtension } from './word-wrap';
export type { WordWrapExtensionResult } from './word-wrap';
export { snippetExtension, MDX_SNIPPETS } from './snippets-engine';
export type { Snippet } from './snippets-engine';
export { minimapExtension } from './minimap';
export { focusModeExtension } from './focus-mode';
export { distractionFreeExtension, createDistractionFreeState } from './distraction-free';
export type { DistractionFreeState } from './distraction-free';
export { spellcheckExtension } from './spellcheck';
export type { SpellcheckOptions } from './spellcheck';
export { createFontSettingsExtension } from './font-settings';
export type { FontSettings, FontSettingsExtensionResult } from './font-settings';
