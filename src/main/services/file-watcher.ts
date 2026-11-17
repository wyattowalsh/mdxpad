/**
 * FileWatcher service - watches open files for external changes.
 *
 * This service monitors files opened in the editor for changes made
 * by external applications. It uses chokidar for cross-platform file
 * watching with a 500ms debounce threshold per FR-011 specification.
 *
 * @module main/services/file-watcher
 */

import chokidar, { type FSWatcher } from 'chokidar';
import type { BrowserWindow } from 'electron';
import type { FileId } from '@shared/types/file';

/**
 * File change event sent to renderer process.
 * Emitted when an external application modifies or deletes a watched file.
 */
export interface FileChangeEvent {
  /** Unique identifier of the changed file */
  readonly fileId: FileId;
  /** Absolute path to the file */
  readonly path: string;
  /** Type of change: 'change' for modification, 'unlink' for deletion */
  readonly type: 'change' | 'unlink';
}

/**
 * Internal representation of a watched file.
 */
interface WatchedFile {
  /** Unique identifier of the file */
  readonly fileId: FileId;
  /** Absolute path to the file */
  readonly path: string;
  /** Chokidar watcher instance for this file */
  readonly watcher: FSWatcher;
}

/**
 * FileWatcher service for monitoring external file changes.
 *
 * Watches files opened in the editor and emits events to the renderer
 * process when files are modified or deleted by external applications.
 *
 * @example
 * ```typescript
 * const watcher = new FileWatcher(mainWindow);
 * watcher.watch(fileId, '/path/to/file.mdx');
 *
 * // Later, when file is closed
 * watcher.unwatch(fileId);
 *
 * // On app quit
 * watcher.close();
 * ```
 */
export class FileWatcher {
  /** Map of fileId to watched file entry */
  private readonly watched = new Map<string, WatchedFile>();

  /** Browser window to send events to */
  private readonly window: BrowserWindow;

  /**
   * Create a new FileWatcher instance.
   * @param window - The BrowserWindow to send file change events to
   */
  constructor(window: BrowserWindow) {
    this.window = window;
  }

  /**
   * Start watching a file for external changes.
   *
   * If the file is already being watched, this method returns early
   * without creating a duplicate watcher.
   *
   * @param fileId - Unique identifier for the file
   * @param filePath - Absolute path to the file to watch
   */
  watch(fileId: FileId, filePath: string): void {
    if (this.watched.has(fileId)) {
      return;
    }
    for (const entry of this.watched.values()) {
      if (entry.path === filePath) {
        return;
      }
    }

    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500, // FR-011: 500ms debounce threshold
        pollInterval: 100,
      },
      atomic: true, // Handle atomic saves (temp file + rename)
    });

    watcher.on('change', () => {
      try {
        this.emitChange(fileId, filePath, 'change');
      } catch (error) {
        console.error('[FileWatcher] Error in change handler:', error);
      }
    });

    watcher.on('unlink', () => {
      try {
        this.emitChange(fileId, filePath, 'unlink');
      } catch (error) {
        console.error('[FileWatcher] Error in unlink handler:', error);
      }
    });

    watcher.on('error', (error) => {
      console.error('[FileWatcher] Watcher error:', error);
    });

    this.watched.set(fileId, { fileId, path: filePath, watcher });
  }

  /**
   * Stop watching a file.
   *
   * Closes the watcher for the specified file and removes it from
   * the internal tracking map.
   *
   * @param fileId - Unique identifier of the file to stop watching
   */
  async unwatch(fileId: FileId): Promise<void> {
    const entry = this.watched.get(fileId);
    if (entry) {
      this.watched.delete(fileId);
      try {
        await entry.watcher.close();
      } catch (error) {
        console.error('[FileWatcher] Failed to unwatch file:', error);
      }
    }
  }

  /**
   * Close all file watchers.
   *
   * Should be called when the application is shutting down to
   * release all file system resources.
   */
  async close(): Promise<void> {
    const entries = Array.from(this.watched.values());
    this.watched.clear();
    await Promise.all(
      entries.map(async (entry) => {
        try {
          await entry.watcher.close();
        } catch (error) {
          console.error('[FileWatcher] Failed to close watcher:', error);
        }
      })
    );
  }

  /**
   * Emit a file change event to the renderer process.
   *
   * @param fileId - Unique identifier of the changed file
   * @param path - Absolute path to the file
   * @param type - Type of change ('change' or 'unlink')
   */
  private emitChange(fileId: FileId, path: string, type: 'change' | 'unlink'): void {
    if (this.watched.get(fileId)?.path !== path) {
      return;
    }

    const windowDestroyed = this.window.isDestroyed();
    const webContentsDestroyed = this.window.webContents.isDestroyed();
    if (windowDestroyed || webContentsDestroyed) {
      return;
    }

    const event: FileChangeEvent = { fileId, path, type };
    // Send to renderer via IPC channel
    this.window.webContents.send('mdxpad:file:change', event);
  }
}
