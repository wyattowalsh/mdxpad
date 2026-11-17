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
export {
  createSnippetCompletionSource,
  createSnippetSource,
  MDX_SNIPPETS,
} from './snippets-engine';
export type { Snippet } from './snippets-engine';
export { minimapExtension } from './minimap';
export { focusModeExtension } from './focus-mode';
export { distractionFreeExtension, createDistractionFreeState } from './distraction-free';
export type { DistractionFreeState } from './distraction-free';
export { spellcheckExtension } from './spellcheck';
export type { SpellcheckOptions } from './spellcheck';
export { createFontSettingsExtension } from './font-settings';
export type { FontSettings, FontSettingsExtensionResult } from './font-settings';
export { codeExecutionExtension } from './code-execution';
export { goToDefinitionExtension } from './go-to-definition';
export type { GoToDefinitionHandler, ImportDefinition } from './go-to-definition';
export { createSlashCommandCompletionSource } from './slash-commands';
export type { SlashCommand } from './slash-commands';
export { nextEditPrediction } from './next-edit-prediction';
export type { PredictionProvider } from './next-edit-prediction';
