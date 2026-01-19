/**
 * Fuzzy search utilities for command palette.
 * Provides keyboard shortcut normalization, fuzzy text matching, and match highlighting.
 *
 * @module renderer/lib/fuzzy-search
 */

import type {
  NormalizedShortcut,
  FuzzyMatchResult,
  ShortcutBinding,
} from '@shared/types/commands';

// =============================================================================
// SHORTCUT NORMALIZATION
// =============================================================================

/**
 * Normalizes a keyboard shortcut binding to a consistent format.
 * Format: "Mod+Shift+Key" (modifiers sorted alphabetically + key)
 *
 * @param binding - Shortcut binding object with modifiers and key
 * @returns Normalized shortcut string
 */
export function normalizeShortcut(binding: ShortcutBinding): NormalizedShortcut {
  // Sort modifiers alphabetically for consistent ordering
  const sortedModifiers = [...binding.modifiers].sort();
  const parts = [...sortedModifiers, binding.key];
  return parts.join('+') as NormalizedShortcut;
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
    const queryChar = queryLower[i]!;
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
    const prevChar = text[foundIndex - 1];
    const wordBoundaryBonus =
      foundIndex === 0 ||
      prevChar === ' ' ||
      prevChar === ':' ||
      prevChar === '-'
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
 * @param query - Search query string
 * @param items - Array of items to search
 * @param accessor - Optional function to extract searchable text from an item
 * @returns Array of matched items with scores, sorted by score (highest first)
 */
export function fuzzySearch<T>(
  query: string,
  items: readonly T[],
  accessor?: (item: T) => string
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
    const text = accessor ? accessor(item) : String(item);
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
