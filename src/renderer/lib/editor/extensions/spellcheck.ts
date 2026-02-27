/**
 * Spellcheck Extension for CodeMirror
 *
 * Provides spell checking via the CodeMirror lint extension.
 * Uses a dictionary-based approach with custom whitelist support.
 *
 * @module renderer/lib/editor/extensions/spellcheck
 */

import { linter, type Diagnostic } from '@codemirror/lint';
import { type Extension } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';
import { COMMON_WORDS } from './spellcheck-dictionary';

// =============================================================================
// Types
// =============================================================================

/**
 * Spellcheck configuration options.
 */
export interface SpellcheckOptions {
  /** Additional words to accept as correct */
  readonly whitelist?: readonly string[];
  /** Minimum word length to check (default: 3) */
  readonly minWordLength?: number;
  /** Delay in ms before checking (default: 500) */
  readonly delay?: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MIN_WORD_LENGTH = 3;
const DEFAULT_DELAY = 500;

// =============================================================================
// Patterns to Skip
// =============================================================================

/** Regex patterns for content that should not be spell-checked */
const SKIP_PATTERNS = [
  /^```[\s\S]*?```$/gm, // Code fences
  /`[^`]+`/g, // Inline code
  /^---[\s\S]*?---$/gm, // Frontmatter
  /<[A-Z][a-zA-Z0-9.]*[\s>]/g, // JSX tags
  /https?:\/\/\S+/g, // URLs
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Emails
];

/**
 * Build a set of character positions to skip (inside code, URLs, etc.)
 */
function buildSkipRanges(text: string): Set<number> {
  const skip = new Set<number>();

  for (const pattern of SKIP_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      for (let i = match.index; i < match.index + match[0].length; i++) {
        skip.add(i);
      }
    }
  }

  return skip;
}

// =============================================================================
// Word Checking
// =============================================================================

/**
 * Check if a word is correctly spelled.
 */
function isCorrectWord(word: string, whitelist: Set<string>): boolean {
  const lower = word.toLowerCase();

  // Single characters are fine
  if (word.length <= 1) return true;

  // Numbers or mixed alphanumeric
  if (/\d/.test(word)) return true;

  // All caps (acronyms)
  if (word === word.toUpperCase() && word.length <= 6) return true;

  // CamelCase or PascalCase (likely identifiers)
  if (/^[a-z]+[A-Z]/.test(word) || /^[A-Z][a-z]+[A-Z]/.test(word)) return true;

  // Check dictionaries
  return COMMON_WORDS.has(lower) || whitelist.has(lower);
}

// =============================================================================
// Linter
// =============================================================================

/**
 * Create the spellcheck linter function.
 */
function createSpellcheckLinter(options: SpellcheckOptions) {
  const minLen = options.minWordLength ?? DEFAULT_MIN_WORD_LENGTH;
  const whitelist = new Set((options.whitelist ?? []).map((w) => w.toLowerCase()));

  return (view: EditorView): Diagnostic[] => {
    const diagnostics: Diagnostic[] = [];
    const text = view.state.doc.toString();
    const skipRanges = buildSkipRanges(text);

    const wordPattern = /[a-zA-Z']+/g;
    let match: RegExpExecArray | null;

    while ((match = wordPattern.exec(text)) !== null) {
      const word = match[0];
      const from = match.index;

      if (word.length < minLen) continue;
      if (skipRanges.has(from)) continue;

      const cleaned = word.replace(/^'+|'+$/g, '');
      if (cleaned.length < minLen) continue;

      if (!isCorrectWord(cleaned, whitelist)) {
        diagnostics.push({
          from,
          to: from + word.length,
          severity: 'info',
          message: `Possible misspelling: "${cleaned}"`,
          source: 'spellcheck',
        });
      }
    }

    return diagnostics;
  };
}

// =============================================================================
// Extension
// =============================================================================

/**
 * Spellcheck extension for CodeMirror.
 *
 * Uses the lint extension to highlight potential spelling errors.
 * Skips code blocks, inline code, URLs, frontmatter, and JSX tags.
 *
 * @param options - Spellcheck configuration
 * @returns CodeMirror Extension
 *
 * @example
 * ```typescript
 * import { spellcheckExtension } from './spellcheck';
 *
 * const view = new EditorView({
 *   extensions: [
 *     spellcheckExtension({
 *       whitelist: ['MDXPad', 'CodeMirror'],
 *       minWordLength: 4,
 *     }),
 *   ],
 * });
 * ```
 */
export function spellcheckExtension(options: SpellcheckOptions = {}): Extension {
  const delay = options.delay ?? DEFAULT_DELAY;

  return linter(createSpellcheckLinter(options), {
    delay,
  });
}

// Export for testing
export { isCorrectWord, buildSkipRanges };
