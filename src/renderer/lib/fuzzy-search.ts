/**
 * VS Code-style fuzzy search algorithm.
 *
 * Provides fuzzy matching with scoring based on:
 * - Consecutive character matches (+5 per char in streak)
 * - Word boundary matches (+10)
 * - CamelCase boundary matches (+8)
 * - Base character matches (+1)
 * - Gap penalties (-0.5 per skipped char)
 *
 * @module renderer/lib/fuzzy-search
 */

import type {
  HighlightSegment,
  ShortcutBinding,
  NormalizedShortcut,
} from '@shared/types/commands';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Fuzzy match result from matching a query against a target.
 */
export interface FuzzyMatchResult<T = string> {
  readonly item: T;
  readonly score: number;
  readonly matches: readonly number[];
}

// =============================================================================
// SCORING CONSTANTS
// =============================================================================

const SCORE_CONSECUTIVE = 5;
const SCORE_WORD_BOUNDARY = 10;
const SCORE_CAMEL_CASE = 8;
const SCORE_BASE_MATCH = 1;
const PENALTY_GAP = -0.5;
const PENALTY_TRAILING = -0.1;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a character is uppercase.
 */
function isUpperCase(char: string): boolean {
  return char >= 'A' && char <= 'Z';
}

/**
 * Check if position is at a word boundary.
 * Word boundaries: start of string, after space/hyphen/underscore, or camelCase transition.
 */
function isWordBoundary(target: string, index: number): boolean {
  if (index === 0) return true;
  const prev = target[index - 1]!;
  const curr = target[index]!;
  // After separator
  if (prev === ' ' || prev === '-' || prev === '_') return true;
  // CamelCase: lowercase followed by uppercase
  if (!isUpperCase(prev) && isUpperCase(curr)) return true;
  return false;
}

/**
 * Check if position is at a camelCase boundary (lowercase -> uppercase).
 */
function isCamelCaseBoundary(target: string, index: number): boolean {
  if (index === 0) return false;
  const prev = target[index - 1]!;
  const curr = target[index]!;
  return !isUpperCase(prev) && isUpperCase(curr);
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Match a query against a target string using VS Code-style fuzzy matching.
 * Returns null if no match found.
 *
 * @param query - The search query (user input)
 * @param target - The target string to match against
 * @returns FuzzyMatchResult or null if no match
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatchResult | null {
  if (!query) {
    return { item: target, score: 0, matches: [] };
  }

  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();
  const matches: number[] = [];
  let score = 0;
  let queryIndex = 0;
  let lastMatchIndex = -1;
  let consecutiveCount = 0;

  for (let targetIndex = 0; targetIndex < target.length && queryIndex < query.length; targetIndex++) {
    if (targetLower[targetIndex] === queryLower[queryIndex]) {
      matches.push(targetIndex);

      // Base match score
      score += SCORE_BASE_MATCH;

      // Consecutive match bonus
      if (lastMatchIndex === targetIndex - 1) {
        consecutiveCount++;
        score += SCORE_CONSECUTIVE * consecutiveCount;
      } else {
        consecutiveCount = 1;
        // Gap penalty for non-consecutive matches
        if (lastMatchIndex >= 0) {
          const gap = targetIndex - lastMatchIndex - 1;
          score += gap * PENALTY_GAP;
        }
      }

      // Word boundary bonus (includes first character)
      if (isWordBoundary(target, targetIndex)) {
        score += SCORE_WORD_BOUNDARY;
      } else if (isCamelCaseBoundary(target, targetIndex)) {
        // CamelCase boundary (only if not already counted as word boundary)
        score += SCORE_CAMEL_CASE;
      }

      lastMatchIndex = targetIndex;
      queryIndex++;
    }
  }

  // All query characters must be found
  if (queryIndex !== query.length) {
    return null;
  }

  // Penalty for unmatched trailing characters (favor exact matches)
  const trailingChars = target.length - (lastMatchIndex + 1);
  if (trailingChars > 0) {
    score += trailingChars * PENALTY_TRAILING;
  }

  return { item: target, score, matches };
}

/**
 * Search an array of items using fuzzy matching.
 * Returns matches sorted by score (highest first).
 *
 * @param query - The search query
 * @param items - Array of items to search
 * @param accessor - Optional function to extract searchable string from item
 * @returns Array of FuzzyMatchResult sorted by score descending
 */
export function fuzzySearch<T>(
  query: string,
  items: readonly T[],
  accessor?: (item: T) => string
): FuzzyMatchResult<T>[] {
  const results: FuzzyMatchResult<T>[] = [];

  for (const item of items) {
    const target = accessor ? accessor(item) : String(item);
    const match = fuzzyMatch(query, target);

    if (match) {
      results.push({
        item,
        score: match.score,
        matches: match.matches,
      });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Convert match indices to highlight segments for rendering.
 *
 * @param text - The full text that was matched
 * @param matches - Array of matched character indices
 * @returns Array of HighlightSegment with text and isMatch flag
 */
export function highlightMatches(text: string, matches: readonly number[]): HighlightSegment[] {
  if (!text) return [];
  if (matches.length === 0) {
    return [{ text, isMatch: false }];
  }

  const segments: HighlightSegment[] = [];
  const matchSet = new Set(matches);
  let currentSegment = '';
  let currentIsMatch = matchSet.has(0);

  for (let i = 0; i < text.length; i++) {
    const isMatch = matchSet.has(i);
    const char = text[i]!;

    if (isMatch !== currentIsMatch) {
      if (currentSegment) {
        segments.push({ text: currentSegment, isMatch: currentIsMatch });
      }
      currentSegment = char;
      currentIsMatch = isMatch;
    } else {
      currentSegment += char;
    }
  }

  if (currentSegment) {
    segments.push({ text: currentSegment, isMatch: currentIsMatch });
  }

  return segments;
}

/**
 * Normalize a shortcut binding to a canonical string format.
 * Format: "Mod+Shift+Key" (modifiers sorted alphabetically + key)
 *
 * @param binding - The shortcut binding to normalize
 * @returns Normalized shortcut string
 */
export function normalizeShortcut(binding: ShortcutBinding): NormalizedShortcut {
  // Sort modifiers alphabetically for consistent ordering
  const sortedModifiers = [...binding.modifiers].sort();
  const parts = [...sortedModifiers, binding.key];
  return parts.join('+') as NormalizedShortcut;
}
