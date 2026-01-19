/**
 * @fileoverview Fuzzy matching wrapper for file tree filtering.
 * Uses fzf-for-js library to provide fzf-style sequential fuzzy matching
 * with match position indices for highlighting.
 *
 * @module fuzzy-match/matcher
 * @see {@link https://github.com/ajitid/fzf-for-js} fzf-for-js library
 */

import { Fzf, type FzfResultItem } from 'fzf';

import type { MatchResult, MatchPositions } from './types';

/**
 * Represents a file or folder entry in the file tree.
 * Used as input to the fuzzy matcher.
 */
export interface FileEntry {
  /** Unique identifier for the file tree node (normalized absolute path) */
  readonly id: string;
  /** Full path to the file/folder (used for matching) */
  readonly path: string;
  /** Display name (filename or folder name) */
  readonly name: string;
}

/**
 * File matcher instance returned by createFileMatcher.
 * Encapsulates the fzf instance and provides filtering methods.
 */
export interface FileMatcher {
  /**
   * Filter files using the given query.
   *
   * @param query - The filter query string
   * @returns Array of fzf result items, sorted by match quality (best first)
   */
  readonly filter: (query: string) => FzfResultItem<FileEntry>[];

  /**
   * Update the file list for matching.
   * Call this when files are added, removed, or renamed.
   *
   * @param files - New array of file entries
   */
  readonly updateFiles: (files: readonly FileEntry[]) => void;
}

/**
 * Tiebreaker function that prefers shorter paths.
 * When two items have the same match score, the one with the shorter
 * path is ranked higher, improving relevance for deeply nested files.
 *
 * @param a - First fzf result item
 * @param b - Second fzf result item
 * @param selector - Function to extract the string being matched
 * @returns Negative if a should rank higher, positive if b should rank higher
 */
function shorterPathTiebreaker(
  a: FzfResultItem<FileEntry>,
  b: FzfResultItem<FileEntry>,
  selector: (item: FileEntry) => string
): number {
  return selector(a.item).length - selector(b.item).length;
}

/**
 * Creates a file matcher instance configured for file tree filtering.
 *
 * The matcher uses fzf-style sequential matching where query characters
 * must appear in order within the path, but not contiguously.
 * For example, "mcp" matches "MyComponent.tsx".
 *
 * @param files - Initial array of file entries to match against
 * @returns A FileMatcher instance with filter and updateFiles methods
 *
 * @example
 * ```typescript
 * const files: FileEntry[] = [
 *   { id: '/src/MyComponent.tsx', path: 'src/MyComponent.tsx', name: 'MyComponent.tsx' },
 *   { id: '/src/utils/helpers.ts', path: 'src/utils/helpers.ts', name: 'helpers.ts' },
 * ];
 *
 * const matcher = createFileMatcher(files);
 * const results = matcher.filter('mcp');
 * // results[0].item.name === 'MyComponent.tsx'
 * ```
 */
export function createFileMatcher(files: readonly FileEntry[]): FileMatcher {
  /**
   * Selector function that extracts the path for matching.
   * Matching is performed against the full path to allow
   * queries like "src/comp" to work.
   */
  const selector = (item: FileEntry): string => item.path;

  // Mutable reference to allow file list updates
  let currentFiles: readonly FileEntry[] = files;

  /**
   * Create fzf instance with options:
   * - case-insensitive matching (FR-003)
   * - shorter path preference in tiebreakers
   */
  let fzf = new Fzf([...currentFiles], {
    selector,
    casing: 'case-insensitive',
    tiebreakers: [shorterPathTiebreaker],
  });

  return {
    filter(query: string): FzfResultItem<FileEntry>[] {
      if (!query.trim()) {
        return [];
      }
      return fzf.find(query);
    },

    updateFiles(newFiles: readonly FileEntry[]): void {
      currentFiles = newFiles;
      // Create new fzf instance with updated file list
      fzf = new Fzf([...currentFiles], {
        selector,
        casing: 'case-insensitive',
        tiebreakers: [shorterPathTiebreaker],
      });
    },
  };
}

/**
 * Filters a list of files using fuzzy matching.
 *
 * This is a convenience function that creates a temporary matcher
 * and performs a single filter operation. For repeated filtering
 * with the same file list, use {@link createFileMatcher} instead.
 *
 * @param files - Array of file entries to filter
 * @param query - The filter query string
 * @returns Array of fzf result items, sorted by match quality (best first)
 *
 * @example
 * ```typescript
 * const results = filterFiles(files, 'component');
 * // results[0].positions contains matched character indices
 * // results[0].score indicates match quality
 * ```
 */
export function filterFiles(
  files: readonly FileEntry[],
  query: string
): FzfResultItem<FileEntry>[] {
  if (!query.trim()) {
    return [];
  }

  const matcher = createFileMatcher(files);
  return matcher.filter(query);
}

/**
 * Converts fzf positions to our MatchPositions type.
 * fzf returns positions relative to the matched string (path),
 * but we may need positions relative to the display name.
 *
 * @param positions - Set of matched character positions from fzf
 * @returns ReadonlySet of matched positions
 */
export function convertPositions(positions: Set<number>): MatchPositions {
  // fzf already returns a Set<number>, but we want a ReadonlySet
  return positions as MatchPositions;
}

/**
 * Remaps match positions from path-relative to name-relative.
 *
 * When matching is performed against the full path (e.g., "src/MyComponent.tsx"),
 * but highlighting should be shown on just the name (e.g., "MyComponent.tsx"),
 * this function remaps the positions accordingly.
 *
 * @param pathPositions - Match positions relative to the full path
 * @param path - The full path that was matched against
 * @param name - The display name to remap positions to
 * @returns New set of positions relative to the name, or null if no positions map to name
 *
 * @example
 * ```typescript
 * // Path: "src/MyComponent.tsx" (positions 4,5,6,7,8 for "MyComp")
 * // Name: "MyComponent.tsx"
 * const namePositions = remapPositionsToName(
 *   new Set([4, 5, 6, 7, 8]),
 *   'src/MyComponent.tsx',
 *   'MyComponent.tsx'
 * );
 * // namePositions === new Set([0, 1, 2, 3, 4]) for "MyComp"
 * ```
 */
export function remapPositionsToName(
  pathPositions: ReadonlySet<number>,
  path: string,
  name: string
): MatchPositions | null {
  // Find where the name starts in the path
  const nameStartIndex = path.lastIndexOf(name);
  if (nameStartIndex === -1) {
    return null;
  }

  const nameEndIndex = nameStartIndex + name.length;
  const remappedPositions = new Set<number>();

  // Convert to array for iteration (avoids downlevelIteration issues)
  const positions = Array.from(pathPositions);
  for (const pos of positions) {
    // Check if this position falls within the name portion
    if (pos >= nameStartIndex && pos < nameEndIndex) {
      remappedPositions.add(pos - nameStartIndex);
    }
  }

  // Return null if no positions mapped to the name
  if (remappedPositions.size === 0) {
    return null;
  }

  return remappedPositions as MatchPositions;
}

/**
 * Converts an fzf result item to our MatchResult type.
 *
 * This function transforms the fzf library's result format into
 * the application's internal match result representation, including
 * remapping positions from path-relative to name-relative.
 *
 * @param result - fzf result item containing match data
 * @returns MatchResult with nodeId, score, positions, and isDirectMatch flag
 *
 * @example
 * ```typescript
 * const fzfResults = matcher.filter('comp');
 * const matchResult = convertToMatchResult(fzfResults[0]);
 * // matchResult.positions contains indices for highlighting the name
 * ```
 */
export function convertToMatchResult(
  result: FzfResultItem<FileEntry>
): MatchResult {
  const { item, score, positions } = result;

  // Remap positions from path to name for display highlighting
  const namePositions = remapPositionsToName(positions, item.path, item.name);

  return {
    nodeId: item.id,
    score,
    // Use remapped positions if available, otherwise use original
    // (positions may not map to name if match was in parent path)
    positions: namePositions ?? (new Set<number>() as MatchPositions),
    isDirectMatch: true,
  };
}

/**
 * Converts an array of fzf results to a Map of MatchResults.
 *
 * This is a batch conversion utility that transforms all fzf results
 * into a Map keyed by node ID for efficient lookup during rendering.
 *
 * @param results - Array of fzf result items
 * @returns Map of node IDs to their corresponding MatchResult objects
 *
 * @example
 * ```typescript
 * const fzfResults = matcher.filter('comp');
 * const matchResultMap = convertToMatchResultMap(fzfResults);
 * // matchResultMap.get('/src/MyComponent.tsx') contains the match result
 * ```
 */
export function convertToMatchResultMap(
  results: readonly FzfResultItem<FileEntry>[]
): Map<string, MatchResult> {
  const map = new Map<string, MatchResult>();

  for (const result of results) {
    const matchResult = convertToMatchResult(result);
    map.set(matchResult.nodeId, matchResult);
  }

  return map;
}

/**
 * Creates an ancestor-only match result for a parent folder.
 *
 * When a file matches, its ancestor folders need to be visible
 * but should not receive highlighting. This function creates
 * a special match result for such ancestors.
 *
 * @param nodeId - The node ID of the ancestor folder
 * @returns MatchResult with isDirectMatch set to false
 */
export function createAncestorMatchResult(nodeId: string): MatchResult {
  return {
    nodeId,
    score: 0,
    positions: new Set<number>() as MatchPositions,
    isDirectMatch: false,
  };
}
