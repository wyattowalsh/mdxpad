/**
 * Filter Persistence Utilities
 *
 * Provides localStorage persistence for file tree filter queries.
 * Each project gets its own isolated filter state via hashed storage keys.
 *
 * Feature: 014-smart-filtering
 * @module renderer/lib/fuzzy-match/persistence
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Prefix for filter query storage keys.
 * Used to namespace filter persistence in localStorage.
 */
export const FILTER_STORAGE_KEY_PREFIX = 'mdxpad:filter:query:' as const;

// =============================================================================
// HASH UTILITY
// =============================================================================

/**
 * Generate a simple 8-character hash for project path using FNV-1a algorithm.
 *
 * FNV-1a is a fast, non-cryptographic hash function that provides good
 * distribution with minimal collision for string inputs like file paths.
 *
 * @param str - String to hash (typically project path)
 * @returns 8-character hexadecimal hash
 *
 * @example
 * ```ts
 * const hash = simpleHash('/Users/dev/my-project');
 * // Returns: 'a1b2c3d4' (8-char hex string)
 * ```
 */
export function simpleHash(str: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0');
}

// =============================================================================
// STORAGE KEY GENERATION
// =============================================================================

/**
 * Generate localStorage key for filter query persistence.
 *
 * Creates a unique storage key per project by hashing the project path.
 * This allows multiple projects to have independent filter states.
 *
 * @param projectPath - Absolute path to project root
 * @returns Storage key in format "mdxpad:filter:query:<8-char-hash>"
 *
 * @example
 * ```ts
 * const key = getFilterStorageKey('/Users/dev/my-project');
 * // Returns: 'mdxpad:filter:query:a1b2c3d4'
 * ```
 */
export function getFilterStorageKey(projectPath: string): string {
  return `${FILTER_STORAGE_KEY_PREFIX}${simpleHash(projectPath)}`;
}

// =============================================================================
// LOAD/SAVE FUNCTIONS
// =============================================================================

/**
 * Load persisted filter query for a project.
 *
 * Retrieves the previously saved filter query from localStorage.
 * Returns empty string if not found or on error.
 *
 * @param projectPath - Project root path
 * @returns Persisted filter query or empty string
 *
 * @example
 * ```ts
 * const query = loadPersistedFilterQuery('/Users/dev/my-project');
 * // Returns: 'component' or '' if not found
 * ```
 */
export function loadPersistedFilterQuery(projectPath: string): string {
  try {
    const key = getFilterStorageKey(projectPath);
    return localStorage.getItem(key) ?? '';
  } catch {
    // Silent fail - filter is non-critical
    console.warn('[Filter] Failed to load persisted filter query');
    return '';
  }
}

/**
 * Save filter query for a project.
 *
 * Persists the filter query to localStorage for later restoration.
 * Removes the key if query is empty to avoid storing empty strings.
 *
 * @param projectPath - Project root path
 * @param query - Filter query to persist
 *
 * @example
 * ```ts
 * saveFilterQuery('/Users/dev/my-project', 'component');
 * // Persists: 'component' to localStorage
 *
 * saveFilterQuery('/Users/dev/my-project', '');
 * // Removes key from localStorage
 * ```
 */
export function saveFilterQuery(projectPath: string, query: string): void {
  try {
    const key = getFilterStorageKey(projectPath);
    if (query.trim() === '') {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, query);
    }
  } catch {
    // Silent fail - filter persistence is non-critical
    console.warn('[Filter] Failed to persist filter query');
  }
}
