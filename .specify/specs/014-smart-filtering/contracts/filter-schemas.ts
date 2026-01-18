/**
 * Smart Filtering Zod Schemas
 *
 * Runtime validation schemas for the file tree filtering system.
 * These schemas validate filter state at system boundaries (localStorage, etc.)
 *
 * Feature: 014-smart-filtering
 * @module contracts/filter-schemas
 */

import { z } from 'zod';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum allowed length for filter queries */
export const FILTER_QUERY_MAX_LENGTH = 256;

/** Storage key prefix for filter persistence */
export const FILTER_STORAGE_KEY_PREFIX = 'mdxpad:filter:query:' as const;

/** Debounce delay for filter input in milliseconds (FR-010) */
export const FILTER_DEBOUNCE_MS = 50;

// =============================================================================
// FILTER QUERY SCHEMA
// =============================================================================

/**
 * Filter query schema.
 * String with max length constraint for performance and storage.
 */
export const FilterQuerySchema = z
  .string()
  .max(FILTER_QUERY_MAX_LENGTH, `Filter query must not exceed ${FILTER_QUERY_MAX_LENGTH} characters`);

export type FilterQuery = z.infer<typeof FilterQuerySchema>;

// =============================================================================
// MATCH RESULT SCHEMAS
// =============================================================================

/**
 * Match positions schema.
 * Array of indices where characters matched in the item name.
 * Uses array for serialization (fzf returns Set<number>).
 */
export const MatchPositionsSchema = z.array(z.number().int().nonnegative());

export type MatchPositions = z.infer<typeof MatchPositionsSchema>;

/**
 * Match score schema.
 * Higher scores indicate better matches.
 * fzf returns negative scores (closer to 0 = better).
 */
export const MatchScoreSchema = z.number();

export type MatchScore = z.infer<typeof MatchScoreSchema>;

/**
 * Match result for a single file or folder.
 * Contains the matched item path, character positions, and match score.
 *
 * @typeParam T - Type of matched item (file/folder entry)
 */
export const MatchResultSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    /** The matched file or folder entry */
    item: itemSchema,
    /** Character indices that matched in the item name */
    positions: MatchPositionsSchema,
    /** Match score (higher = better match) */
    score: MatchScoreSchema,
  });

/**
 * Generic match result type.
 *
 * @typeParam T - Type of matched item
 */
export interface MatchResult<T> {
  /** The matched file or folder entry */
  readonly item: T;
  /** Character indices that matched in the item name (from fzf's Set<number>) */
  readonly positions: readonly number[];
  /** Match score (higher = better match) */
  readonly score: number;
}

// =============================================================================
// FILTER STATE SCHEMAS
// =============================================================================

/**
 * Filter state schema.
 * Represents the current state of the file tree filter.
 */
export const FilterStateSchema = z.object({
  /** Current filter query string */
  query: FilterQuerySchema,
  /** Whether filtering is currently in progress */
  isFiltering: z.boolean(),
  /** Number of items matching the current query */
  matchCount: z.number().int().nonnegative(),
  /** Error message if filtering failed */
  error: z.string().nullable(),
});

export type FilterState = z.infer<typeof FilterStateSchema>;

/**
 * Default filter state for initialization.
 */
export const DEFAULT_FILTER_STATE: FilterState = {
  query: '',
  isFiltering: false,
  matchCount: 0,
  error: null,
};

// =============================================================================
// PERSISTENCE SCHEMAS
// =============================================================================

/**
 * Persisted filter data schema.
 * Minimal data stored in localStorage per project.
 */
export const PersistedFilterDataSchema = z.object({
  /** The filter query string */
  query: FilterQuerySchema,
  /** Timestamp when filter was last updated */
  updatedAt: z.number().int().positive(),
});

export type PersistedFilterData = z.infer<typeof PersistedFilterDataSchema>;

// =============================================================================
// STORAGE KEY GENERATION
// =============================================================================

/**
 * FNV-1a hash implementation for consistent, collision-resistant key generation.
 * Produces an 8-character hexadecimal string.
 *
 * @param str - String to hash (typically project path)
 * @returns 8-character hex hash
 */
export function fnv1aHash(str: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Generate a storage key for filter persistence.
 * Uses project path hash to create unique key per project.
 *
 * @param projectPath - Absolute path to the project root
 * @returns Storage key in format 'mdxpad:filter:query:<8-char-hash>'
 *
 * @example
 * ```ts
 * const key = getFilterStorageKey('/Users/dev/my-project');
 * // Returns: 'mdxpad:filter:query:a1b2c3d4'
 * ```
 */
export function getFilterStorageKey(projectPath: string): string {
  return `${FILTER_STORAGE_KEY_PREFIX}${fnv1aHash(projectPath)}`;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Parse and validate a filter query string.
 * Truncates if too long, returns empty string for invalid input.
 *
 * @param value - Raw value to validate
 * @returns Validated filter query (possibly truncated)
 */
export function parseFilterQuery(value: unknown): FilterQuery {
  if (typeof value !== 'string') {
    return '';
  }
  // Truncate if too long rather than rejecting
  return value.slice(0, FILTER_QUERY_MAX_LENGTH);
}

/**
 * Parse and validate persisted filter data from localStorage.
 * Returns null for invalid or missing data.
 *
 * @param data - Raw data from localStorage
 * @returns Validated persisted data or null
 */
export function parsePersistedFilterData(data: unknown): PersistedFilterData | null {
  const result = PersistedFilterDataSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Parse and validate filter state.
 * Returns default state for invalid input.
 *
 * @param data - Raw state data
 * @returns Validated filter state
 */
export function parseFilterState(data: unknown): FilterState {
  const result = FilterStateSchema.safeParse(data);
  return result.success ? result.data : DEFAULT_FILTER_STATE;
}

// =============================================================================
// HIGHLIGHT UTILITIES
// =============================================================================

/**
 * Highlight segment for rendering matched text.
 * Reuses pattern from command-schemas for consistency.
 */
export const FilterHighlightSegmentSchema = z.object({
  /** Text content of this segment */
  text: z.string(),
  /** Whether this segment is a matched portion */
  isMatch: z.boolean(),
});

export type FilterHighlightSegment = z.infer<typeof FilterHighlightSegmentSchema>;

/**
 * Convert match positions to highlight segments for rendering.
 * Splits text into matched and unmatched portions.
 *
 * @param text - Original text to segment
 * @param positions - Set or array of matched character indices
 * @returns Array of highlight segments
 *
 * @example
 * ```ts
 * const segments = positionsToSegments('MyComponent', new Set([0, 1, 4, 5, 6, 7]));
 * // Returns: [
 * //   { text: 'My', isMatch: true },
 * //   { text: 'Co', isMatch: false },
 * //   { text: 'mpon', isMatch: true },
 * //   { text: 'ent', isMatch: false }
 * // ]
 * ```
 */
export function positionsToSegments(
  text: string,
  positions: Set<number> | readonly number[]
): FilterHighlightSegment[] {
  if (text.length === 0) {
    return [];
  }

  const posSet = positions instanceof Set ? positions : new Set(positions);

  if (posSet.size === 0) {
    return [{ text, isMatch: false }];
  }

  const segments: FilterHighlightSegment[] = [];
  let currentSegment = '';
  let currentIsMatch = posSet.has(0);

  for (let i = 0; i < text.length; i++) {
    const charIsMatch = posSet.has(i);

    if (charIsMatch === currentIsMatch) {
      currentSegment += text[i];
    } else {
      if (currentSegment) {
        segments.push({ text: currentSegment, isMatch: currentIsMatch });
      }
      currentSegment = text[i];
      currentIsMatch = charIsMatch;
    }
  }

  if (currentSegment) {
    segments.push({ text: currentSegment, isMatch: currentIsMatch });
  }

  return segments;
}
