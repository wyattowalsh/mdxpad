/**
 * Position Cache Module
 *
 * Feature: 008-bidirectional-sync
 *
 * Provides TTL-based caching for position mappings to improve sync performance.
 * Cache entries automatically expire after the configured TTL to prevent stale
 * mappings from causing incorrect scroll positions.
 *
 * @module renderer/lib/sync/position-cache
 */

import type { PositionMapping } from '@shared/types/sync';
import { SYNC_CONSTANTS } from './constants';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for configuring the position cache.
 */
export interface PositionCacheOptions {
  /**
   * Time-to-live for cache entries in milliseconds.
   * Entries older than this will be considered expired.
   * @default SYNC_CONSTANTS.POSITION_CACHE_TTL_MS (1000ms)
   */
  readonly ttl?: number;

  /**
   * Callback invoked when a cache entry expires.
   * Useful for debugging or analytics.
   *
   * @param editorLine - The editor line number of the expired entry
   * @param mapping - The expired position mapping
   */
  readonly onExpire?: (editorLine: number, mapping: PositionMapping) => void;
}

/**
 * Position cache interface for storing and retrieving position mappings.
 * Maps editor line numbers to PositionMapping objects with TTL-based expiration.
 */
export interface PositionCache {
  /**
   * Get cached position mapping for an editor line.
   * Returns null if the entry doesn't exist or has expired.
   * Expired entries are automatically deleted and trigger onExpire callback.
   *
   * @param editorLine - The editor line number (1-indexed)
   * @returns The cached mapping or null if not found/expired
   */
  readonly get: (editorLine: number) => PositionMapping | null;

  /**
   * Store a position mapping in the cache.
   * Overwrites any existing entry for the same line.
   *
   * @param editorLine - The editor line number (1-indexed)
   * @param mapping - The position mapping to cache
   */
  readonly set: (editorLine: number, mapping: PositionMapping) => void;

  /**
   * Check if a valid (non-expired) entry exists for an editor line.
   *
   * @param editorLine - The editor line number (1-indexed)
   * @returns True if a valid entry exists
   */
  readonly has: (editorLine: number) => boolean;

  /**
   * Invalidate (remove) a specific cache entry.
   *
   * @param editorLine - The editor line number (1-indexed)
   */
  readonly invalidate: (editorLine: number) => void;

  /**
   * Clear all cache entries.
   * Should be called when document content changes to prevent stale mappings.
   */
  readonly clear: () => void;

  /**
   * Get the current number of entries in the cache.
   * Note: May include expired entries until they are accessed.
   *
   * @returns The number of cache entries
   */
  readonly size: () => number;

  /**
   * Get all cache entries for debugging purposes.
   * Note: May include expired entries.
   *
   * @returns ReadonlyMap of all cache entries
   */
  readonly entries: () => ReadonlyMap<number, PositionMapping>;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create a new position cache instance.
 *
 * The cache provides TTL-based expiration for position mappings, ensuring
 * that stale mappings don't cause incorrect scroll synchronization.
 *
 * @param options - Optional configuration for the cache
 * @returns A new PositionCache instance
 *
 * @example
 * ```typescript
 * const cache = createPositionCache({ ttl: 2000 });
 *
 * // Store a mapping
 * cache.set(10, {
 *   editorLine: 10,
 *   previewScrollTop: 500,
 *   confidence: 'high',
 *   timestamp: Date.now(),
 * });
 *
 * // Retrieve it later (returns null if expired)
 * const mapping = cache.get(10);
 *
 * // Clear on document change
 * cache.clear();
 * ```
 */
export function createPositionCache(
  options?: Partial<PositionCacheOptions>
): PositionCache {
  const ttl = options?.ttl ?? SYNC_CONSTANTS.POSITION_CACHE_TTL_MS;
  const cache = new Map<number, PositionMapping>();

  /**
   * Check if a mapping is still valid based on TTL.
   *
   * @param mapping - The mapping to validate
   * @returns True if the mapping hasn't expired
   */
  const isValid = (mapping: PositionMapping): boolean => {
    return Date.now() - mapping.timestamp < ttl;
  };

  return {
    get: (editorLine: number): PositionMapping | null => {
      const mapping = cache.get(editorLine);

      if (!mapping) {
        return null;
      }

      if (!isValid(mapping)) {
        cache.delete(editorLine);
        options?.onExpire?.(editorLine, mapping);
        return null;
      }

      return mapping;
    },

    set: (editorLine: number, mapping: PositionMapping): void => {
      cache.set(editorLine, mapping);
    },

    has: (editorLine: number): boolean => {
      const mapping = cache.get(editorLine);
      return mapping !== undefined && isValid(mapping);
    },

    invalidate: (editorLine: number): void => {
      cache.delete(editorLine);
    },

    clear: (): void => {
      cache.clear();
    },

    size: (): number => cache.size,

    entries: (): ReadonlyMap<number, PositionMapping> => cache,
  };
}
