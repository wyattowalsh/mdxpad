/**
 * AutoSaveManager - handles automatic saving of dirty documents.
 *
 * Implements FR-014: Auto-save dirty files every 30 seconds to a temporary location.
 * Implements FR-015: On app launch detect recoverable auto-saved files.
 *
 * Per Constitution §7.3, documents are auto-saved to prevent data loss.
 *
 * @module @main/services/auto-save
 */

import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import type { FileId } from '@shared/types/file';

/** Auto-save interval in milliseconds (30 seconds per FR-014) */
const AUTO_SAVE_INTERVAL = 30_000;

/** Prefix for auto-save temporary files */
const AUTO_SAVE_PREFIX = 'mdxpad-autosave-';

/** Extension for auto-save temporary files */
const AUTO_SAVE_EXT = '.mdx';

/**
 * Represents a recoverable auto-saved file entry.
 * Used when presenting recovery options to the user on app launch.
 */
export interface AutoSaveEntry {
  /** Unique identifier for the file */
  readonly fileId: FileId;

  /** Original file path (null if unknown at recovery time) */
  readonly originalPath: string | null;

  /** Path to the temporary auto-saved file */
  readonly tempPath: string;

  /** Timestamp when the file was last auto-saved */
  readonly savedAt: number;

  /** Human-readable name for display in recovery dialog */
  readonly displayName: string;
}

/**
 * Internal representation of a file pending auto-save.
 */
interface DirtyFile {
  /** Unique identifier for the file */
  readonly fileId: FileId;

  /** Original file path (null for untitled files) */
  readonly originalPath: string | null;

  /** Human-readable display name */
  readonly displayName: string;

  /** Current content to be saved */
  readonly content: string;
}

/**
 * Manages automatic saving of dirty documents to prevent data loss.
 *
 * The AutoSaveManager tracks files with unsaved changes and periodically
 * saves them to the system temp directory. On app launch, it can discover
 * these files for recovery.
 *
 * @example
 * ```typescript
 * const autoSave = new AutoSaveManager();
 * autoSave.start();
 *
 * // Register a dirty file for auto-saving
 * autoSave.registerDirty(fileId, '/path/to/file.mdx', 'Document', content);
 *
 * // After user saves, remove from auto-save tracking
 * autoSave.unregister(fileId);
 *
 * // On app shutdown
 * autoSave.stop();
 * ```
 */
export class AutoSaveManager {
  /** Map of file IDs to their dirty state */
  private readonly dirtyFiles = new Map<string, DirtyFile>();

  /** Handle for the periodic auto-save interval */
  private interval: NodeJS.Timeout | null = null;

  /**
   * Computes the temporary file path for a given file ID.
   *
   * @param fileId - The unique file identifier
   * @returns The full path in the temp directory
   */
  private getTempPath(fileId: FileId): string {
    return path.join(
      app.getPath('temp'),
      `${AUTO_SAVE_PREFIX}${fileId}${AUTO_SAVE_EXT}`
    );
  }

  /**
   * Registers a file as dirty, marking it for auto-save on the next interval.
   *
   * Call this method whenever the user modifies a document. The file will be
   * included in the next auto-save cycle.
   *
   * @param fileId - Unique identifier for the file
   * @param originalPath - The file's original path on disk, or null if untitled
   * @param displayName - Human-readable name for display purposes
   * @param content - Current content of the file to be saved
   */
  registerDirty(
    fileId: FileId,
    originalPath: string | null,
    displayName: string,
    content: string
  ): void {
    this.dirtyFiles.set(fileId, { fileId, originalPath, displayName, content });
  }

  /**
   * Removes a file from auto-save tracking.
   *
   * Call this method when a file is saved (no longer dirty) or closed.
   *
   * @param fileId - Unique identifier for the file to unregister
   */
  unregister(fileId: FileId): void {
    this.dirtyFiles.delete(fileId);
  }

  /**
   * Saves all registered dirty files to the temp directory.
   *
   * This method is called automatically by the interval timer, but can also
   * be called manually (e.g., before app shutdown).
   *
   * @returns Promise that resolves when all saves complete
   */
  async saveDirty(): Promise<void> {
    const promises = Array.from(this.dirtyFiles.values()).map(async (file) => {
      const tempPath = this.getTempPath(file.fileId);
      try {
        await fs.writeFile(tempPath, file.content, 'utf-8');
      } catch (err) {
        console.error(`Auto-save failed for ${file.displayName}:`, err);
      }
    });
    await Promise.all(promises);
  }

  /**
   * Discovers recoverable auto-saved files in the temp directory.
   *
   * Call this method on app launch to find files that may need recovery.
   * Returns entries sorted by most recently saved first.
   *
   * @returns Promise resolving to array of recoverable file entries
   */
  async findRecoverable(): Promise<AutoSaveEntry[]> {
    const pattern = path.join(
      app.getPath('temp'),
      `${AUTO_SAVE_PREFIX}*${AUTO_SAVE_EXT}`
    );
    const files = await glob(pattern);

    const entries: AutoSaveEntry[] = [];
    for (const tempPath of files) {
      try {
        const stat = await fs.stat(tempPath);
        const filename = path.basename(tempPath);
        const fileId = filename
          .replace(AUTO_SAVE_PREFIX, '')
          .replace(AUTO_SAVE_EXT, '') as FileId;

        entries.push({
          fileId,
          originalPath: null, // Unknown at recovery time
          tempPath,
          savedAt: stat.mtime.getTime(),
          displayName: `Recovered: ${fileId.slice(0, 8)}...`,
        });
      } catch {
        // Skip files we can't stat (may have been deleted)
      }
    }

    // Sort by most recently saved first
    return entries.sort((a, b) => b.savedAt - a.savedAt);
  }

  /**
   * Removes an auto-save file from the temp directory.
   *
   * Call this after a recovered file has been properly saved or discarded.
   *
   * @param fileId - Unique identifier for the file to clean up
   * @returns Promise that resolves when cleanup completes
   */
  async cleanupEntry(fileId: FileId): Promise<void> {
    const tempPath = this.getTempPath(fileId);
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore if file was already deleted
    }
  }

  /**
   * Starts the periodic auto-save timer.
   *
   * Files registered via `registerDirty` will be saved every 30 seconds.
   * Safe to call multiple times; subsequent calls are no-ops.
   */
  start(): void {
    if (this.interval) {
      return;
    }
    this.interval = setInterval(() => {
      void this.saveDirty();
    }, AUTO_SAVE_INTERVAL);
  }

  /**
   * Stops the periodic auto-save timer.
   *
   * Call this method during app shutdown. Consider calling `saveDirty()`
   * first to ensure all pending changes are saved.
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
