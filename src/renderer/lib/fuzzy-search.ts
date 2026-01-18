/**
 * Fuzzy search utilities for command palette.
 * Provides keyboard shortcut normalization, fuzzy text matching, and match highlighting.
 *
 * @module renderer/lib/fuzzy-search
 */

import type {
  NormalizedShortcut,
  FuzzyMatchResult,
} from '@shared/types/commands';
import { NormalizedShortcutSchema } from '@shared/types/commands';

// =============================================================================
// SHORTCUT NORMALIZATION
// =============================================================================

/**
 * Normalizes a keyboard shortcut string to a consistent format.
 * Handles platform-specific modifiers (Cmd on Mac, Ctrl on Windows/Linux).
 *
 * @param shortcut - Raw shortcut string (e.g., "Cmd+Shift+P", "Ctrl+K")
 * @returns Normalized shortcut string with modifiers in canonical order
 */
export function normalizeShortcut(shortcut: string): NormalizedShortcut {
  // Split by + and process each part
  const parts = shortcut.split('+').map((p) => p.trim());
  const modifiers: string[] = [];
  let key = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'mod' || lower === 'cmd' || lower === 'command') {
      modifiers.push('Mod');
    } else if (lower === 'ctrl' || lower === 'control') {
      modifiers.push('Ctrl');
    } else if (lower === 'alt' || lower === 'option') {
      modifiers.push('Alt');
    } else if (lower === 'shift') {
      modifiers.push('Shift');
    } else if (lower === 'meta' || lower === 'win' || lower === 'super') {
      modifiers.push('Meta');
    } else {
      // This is the key
      key = part.length === 1 ? part.toUpperCase() : part;
    }
  }

  // Sort modifiers in canonical order: Mod, Ctrl, Alt, Shift, Meta
  const order = ['Mod', 'Ctrl', 'Alt', 'Shift', 'Meta'];
  modifiers.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  // Build normalized shortcut
  const normalized = [...modifiers, key].join('+');

  // Validate and brand
  const result = NormalizedShortcutSchema.safeParse(normalized);
  if (result.success) {
    return result.data;
  }

  // Fallback: return as-is branded (may not be valid but allows graceful degradation)
  return normalized as NormalizedShortcut;
}

// =============================================================================
// FUZZY SEARCH
// =============================================================================

/**
 * Simple fuzzy matching algorithm.
 * Returns match indices and score based on consecutive matches and position.
 */
function fuzzyMatch(text: string, query: string): { score: number; matches: number[] } | null {
  if (!query) {
    return { score: 1, matches: [] };
  }

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const matches: number[] = [];
  let textIndex = 0;
  let consecutiveBonus = 0;
  let score = 0;

  for (let i = 0; i < queryLower.length; i++) {
    const queryChar = queryLower[i];
    const foundIndex = textLower.indexOf(queryChar, textIndex);

    if (foundIndex === -1) {
      return null; // No match
    }

    matches.push(foundIndex);

    // Score based on position (earlier matches score higher)
    const positionScore = 1 - foundIndex / text.length;

    // Bonus for consecutive matches
    if (foundIndex === textIndex) {
      consecutiveBonus += 0.5;
    } else {
      consecutiveBonus = 0;
    }

    // Bonus for matching at word boundaries
    const wordBoundaryBonus =
      foundIndex === 0 ||
      text[foundIndex - 1] === ' ' ||
      text[foundIndex - 1] === ':' ||
      text[foundIndex - 1] === '-'
        ? 0.3
        : 0;

    score += positionScore + consecutiveBonus + wordBoundaryBonus;
    textIndex = foundIndex + 1;
  }

  // Normalize score by query length
  score = score / queryLower.length;

  return { score, matches };
}

/**
 * Performs fuzzy search on a list of items.
 *
 * @typeParam T - Type of items being searched
 * @param items - Array of items to search
 * @param query - Search query string
 * @param getSearchText - Function to extract searchable text from an item
 * @returns Array of matched items with scores, sorted by score (highest first)
 */
export function fuzzySearch<T>(
  items: readonly T[],
  query: string,
  getSearchText: (item: T) => string
): FuzzyMatchResult<T>[] {
  if (!query.trim()) {
    // Return all items with default score when no query
    return items.map((item) => ({
      item,
      score: 1,
      matches: [],
    }));
  }

  const results: FuzzyMatchResult<T>[] = [];

  for (const item of items) {
    const text = getSearchText(item);
    const match = fuzzyMatch(text, query);

    if (match) {
      results.push({
        item,
        score: match.score,
        matches: match.matches,
      });
    }
  }

  // Sort by score (highest first)
  results.sort((a, b) => b.score - a.score);

  return results;
}

// =============================================================================
// MATCH HIGHLIGHTING
// =============================================================================

export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

/**
 * Splits text into segments for highlighting matched characters.
 *
 * @param text - Original text
 * @param matches - Array of character indices that matched
 * @returns Array of segments with match indicators
 */
export function highlightMatches(text: string, matches: readonly number[]): HighlightSegment[] {
  if (!matches.length) {
    return [{ text, isMatch: false }];
  }

  const matchSet = new Set(matches);
  const segments: HighlightSegment[] = [];
  let currentSegment = '';
  let currentIsMatch = matchSet.has(0);

  for (let i = 0; i < text.length; i++) {
    const isMatch = matchSet.has(i);

    if (isMatch !== currentIsMatch) {
      if (currentSegment) {
        segments.push({ text: currentSegment, isMatch: currentIsMatch });
      }
      currentSegment = text[i];
      currentIsMatch = isMatch;
    } else {
      currentSegment += text[i];
    }
  }

  if (currentSegment) {
    segments.push({ text: currentSegment, isMatch: currentIsMatch });
  }

  return segments;
}
