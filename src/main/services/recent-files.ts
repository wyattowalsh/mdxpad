/**
 * RecentFilesService - Manages the list of recently opened files.
 *
 * This service provides persistence for recent files using electron-store,
 * storing data at the user's app data directory. It maintains a maximum
 * of 10 entries per FR-013 requirements.
 *
 * @module main/services/recent-files
 */

import Store from 'electron-store';

/**
 * Represents a single entry in the recent files list.
 */
export interface RecentFileEntry {
  /** Absolute path to the file */
  path: string;
  /** Unix timestamp (milliseconds) when the file was last accessed */
  accessedAt: number;
}

/**
 * Schema definition for the electron-store instance.
 */
interface StoreSchema {
  recentFiles: RecentFileEntry[];
}

/** Maximum number of recent files to retain (per FR-013) */
const MAX_RECENT_FILES = 10;

/**
 * Service for managing recently opened files.
 *
 * Provides methods to add, retrieve, remove, and clear recent file entries.
 * Files are automatically deduplicated and the list is capped at 10 entries.
 *
 * @example
 * ```typescript
 * const recentFiles = new RecentFilesService();
 *
 * // Add a file to recent files
 * recentFiles.addRecent('/path/to/document.mdx');
 *
 * // Get all recent files
 * const files = recentFiles.getRecent();
 *
 * // Remove a file that no longer exists
 * recentFiles.removeRecent('/path/to/deleted.mdx');
 *
 * // Clear all recent files
 * recentFiles.clear();
 * ```
 */
export class RecentFilesService {
  private readonly store: Store<StoreSchema>;

  /**
   * Creates a new RecentFilesService instance.
   *
   * The store is persisted at the user's app data directory
   * (app.getPath('userData')) in a file named 'recent-files.json'.
   */
  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'recent-files',
      defaults: {
        recentFiles: [],
      },
    });
  }

  /**
   * Adds a file to the recent files list.
   *
   * If the file already exists in the list, it is moved to the front
   * with an updated timestamp. The list is capped at {@link MAX_RECENT_FILES}
   * entries, with oldest entries removed when the limit is exceeded.
   *
   * @param filePath - The absolute path to the file to add
   */
  addRecent(filePath: string): void {
    const current = this.store.get('recentFiles');

    // Remove existing entry with same path to avoid duplicates
    const filtered = current.filter((entry) => entry.path !== filePath);

    // Create new entry with current timestamp
    const entry: RecentFileEntry = {
      path: filePath,
      accessedAt: Date.now(),
    };

    // Add new entry at front and enforce maximum limit
    const updated = [entry, ...filtered].slice(0, MAX_RECENT_FILES);
    this.store.set('recentFiles', updated);
  }

  /**
   * Retrieves all recent files, ordered from most to least recently accessed.
   *
   * @returns An array of recent file entries, with the most recent first
   */
  getRecent(): RecentFileEntry[] {
    return this.store.get('recentFiles');
  }

  /**
   * Removes a specific file from the recent files list.
   *
   * This is useful when a file has been deleted or moved and should
   * no longer appear in the recent files menu.
   *
   * @param filePath - The absolute path to the file to remove
   */
  removeRecent(filePath: string): void {
    const current = this.store.get('recentFiles');
    const filtered = current.filter((entry) => entry.path !== filePath);
    this.store.set('recentFiles', filtered);
  }

  /**
   * Clears all entries from the recent files list.
   */
  clear(): void {
    this.store.set('recentFiles', []);
  }
}
