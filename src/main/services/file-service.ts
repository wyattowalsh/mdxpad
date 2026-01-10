/**
 * File service for main process file operations.
 * All file system operations run exclusively in the main process (Constitution Section 3.1).
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { FileHandle, FileResult, FileError, FileId } from '@shared/types/file';
import { createFileId } from '@shared/types/file';
import { FileWatcher } from './file-watcher';
import { RecentFilesService } from './recent-files';
import { AutoSaveManager } from './auto-save';

/**
 * Maps Node.js file system error codes to FileError types.
 * @param error - The caught error from fs operations
 * @param filePath - The file path that caused the error
 * @returns A properly typed FileError
 */
function mapFsError(error: unknown, filePath: string): FileError {
  if (error instanceof Error && 'code' in error) {
    const nodeError = error as NodeJS.ErrnoException;
    switch (nodeError.code) {
      case 'ENOENT':
        return { code: 'NOT_FOUND', path: filePath };
      case 'EACCES':
        return { code: 'PERMISSION_DENIED', path: filePath };
      default:
        return { code: 'UNKNOWN', message: nodeError.message };
    }
  }
  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Reads a file from the file system.
 * @param filePath - The absolute path to the file to read
 * @returns A FileResult containing the file contents as a string, or an error
 */
export async function readFile(filePath: string): Promise<FileResult<string>> {
  try {
    const content = await fs.readFile(filePath, { encoding: 'utf-8' });
    return { ok: true, value: content };
  } catch (error: unknown) {
    const fileError = mapFsError(error, filePath);
    console.error(`[FileService] Failed to read file "${filePath}":`, fileError);
    return { ok: false, error: fileError };
  }
}

/**
 * Writes content to a file on the file system.
 * @param filePath - The absolute path to the file to write
 * @param content - The string content to write to the file
 * @returns A FileResult indicating success or an error
 */
export async function writeFile(
  filePath: string,
  content: string
): Promise<FileResult<void>> {
  try {
    await fs.writeFile(filePath, content, { encoding: 'utf-8' });
    return { ok: true, value: undefined };
  } catch (error: unknown) {
    const fileError = mapFsError(error, filePath);
    console.error(`[FileService] Failed to write file "${filePath}":`, fileError);
    return { ok: false, error: fileError };
  }
}

/**
 * Creates a new untitled file handle.
 * The file has no path and is named "Untitled".
 * @returns A FileHandle for the new untitled file
 */
export function createNewFile(): FileHandle {
  const id = createFileId();
  return {
    id,
    path: null,
    name: 'Untitled',
  };
}

/**
 * Creates a file handle for an existing file path.
 * @param filePath - The absolute path to the file
 * @returns A FileHandle with the path and extracted file name
 */
export function createFileHandle(filePath: string): FileHandle {
  const id = createFileId();
  const name = path.basename(filePath);
  return {
    id,
    path: filePath,
    name,
  };
}

/**
 * Integrates FileWatcher, RecentFilesService, and AutoSaveManager with file operations.
 *
 * This class provides opt-in integration hooks that handlers can call when appropriate
 * file lifecycle events occur. It coordinates file watching, recent files tracking,
 * and auto-save functionality.
 *
 * Note: The FileWatcher must be instantiated with the BrowserWindow separately,
 * as it needs the window reference to send IPC events for external file changes.
 *
 * @example
 * ```typescript
 * const fileWatcher = new FileWatcher(mainWindow);
 * const integration = new FileServiceIntegration({
 *   fileWatcher,
 *   recentFilesService: new RecentFilesService(),
 *   autoSaveManager: autoSaveManager,
 * });
 *
 * // When a file is opened
 * integration.onFileOpened(fileHandle);
 *
 * // When content changes (becomes dirty)
 * integration.onContentChanged(fileId, content, originalPath);
 *
 * // When file is saved
 * integration.onFileSaved(fileId);
 *
 * // When file is closed
 * integration.onFileClosed(fileId);
 * ```
 */
export class FileServiceIntegration {
  private readonly fileWatcher: FileWatcher | null;
  private readonly recentFilesService: RecentFilesService | null;
  private readonly autoSaveManager: AutoSaveManager | null;

  /**
   * Map of fileId to FileHandle for tracking open files.
   * Used for looking up file metadata when needed.
   */
  private readonly openFiles = new Map<string, FileHandle>();

  /**
   * Creates a new FileServiceIntegration instance.
   *
   * All services are optional - if not provided, corresponding functionality
   * will be silently skipped (graceful degradation).
   *
   * @param options - Configuration options with optional service instances
   * @param options.fileWatcher - FileWatcher instance for external change detection
   * @param options.recentFilesService - RecentFilesService for tracking recent files
   * @param options.autoSaveManager - AutoSaveManager for auto-save functionality
   */
  constructor(options: {
    fileWatcher?: FileWatcher;
    recentFilesService?: RecentFilesService;
    autoSaveManager?: AutoSaveManager;
  } = {}) {
    this.fileWatcher = options.fileWatcher ?? null;
    this.recentFilesService = options.recentFilesService ?? null;
    this.autoSaveManager = options.autoSaveManager ?? null;
  }

  /**
   * Called when a file is successfully opened.
   *
   * Performs the following integrations:
   * - Starts watching the file for external changes (if file has a path)
   * - Adds the file to recent files list (if file has a path)
   * - Tracks the file handle for later reference
   *
   * @param handle - The FileHandle of the opened file
   */
  onFileOpened(handle: FileHandle): void {
    // Track the open file
    this.openFiles.set(handle.id, handle);

    // Only start watching and add to recent if the file has a path (not untitled)
    if (handle.path !== null) {
      // Start watching for external changes
      this.fileWatcher?.watch(handle.id, handle.path);

      // Add to recent files
      this.recentFilesService?.addRecent(handle.path);
    }
  }

  /**
   * Called when a file is closed.
   *
   * Performs the following cleanup:
   * - Stops watching the file for external changes
   * - Stops auto-save tracking for this file
   * - Removes the file from internal tracking
   *
   * @param fileId - The unique identifier of the closed file
   */
  onFileClosed(fileId: FileId): void {
    // Stop watching for external changes
    this.fileWatcher?.unwatch(fileId);

    // Stop auto-save tracking
    this.autoSaveManager?.unregister(fileId);

    // Remove from internal tracking
    this.openFiles.delete(fileId);
  }

  /**
   * Called when file content changes (file becomes dirty).
   *
   * Registers the file with the auto-save manager so its content
   * will be periodically saved to a temp file for recovery.
   *
   * @param fileId - The unique identifier of the changed file
   * @param content - The current content of the file
   * @param originalPath - The original file path, or null for untitled files
   */
  onContentChanged(fileId: FileId, content: string, originalPath: string | null): void {
    const handle = this.openFiles.get(fileId);
    const displayName = handle?.name ?? 'Untitled';

    // Register with auto-save manager for periodic backup
    this.autoSaveManager?.registerDirty(fileId, originalPath, displayName, content);
  }

  /**
   * Called after a file is successfully saved.
   *
   * Performs the following cleanup:
   * - Cleans up any auto-save temp file for this file
   * - Unregisters from auto-save tracking (no longer dirty)
   *
   * Note: If saving to a new path, caller should also call onFileOpened
   * to update watchers and recent files with the new path.
   *
   * @param fileId - The unique identifier of the saved file
   */
  onFileSaved(fileId: FileId): void {
    // Clean up auto-save temp file (async, fire and forget)
    void this.autoSaveManager?.cleanupEntry(fileId);

    // Unregister from auto-save tracking since file is no longer dirty
    this.autoSaveManager?.unregister(fileId);
  }

  /**
   * Called when a file is saved to a new path (Save As).
   *
   * Updates internal tracking and services for the new path:
   * - Updates the file watcher to the new path
   * - Adds the new path to recent files
   * - Updates internal handle tracking
   *
   * @param oldHandle - The previous FileHandle
   * @param newHandle - The new FileHandle with updated path
   */
  onFilePathChanged(oldHandle: FileHandle, newHandle: FileHandle): void {
    // Stop watching old path
    this.fileWatcher?.unwatch(oldHandle.id);

    // Update internal tracking
    this.openFiles.delete(oldHandle.id);
    this.openFiles.set(newHandle.id, newHandle);

    // Start watching new path and add to recent (if has path)
    if (newHandle.path !== null) {
      this.fileWatcher?.watch(newHandle.id, newHandle.path);
      this.recentFilesService?.addRecent(newHandle.path);
    }
  }

  /**
   * Gets the current FileHandle for an open file.
   *
   * @param fileId - The unique identifier of the file
   * @returns The FileHandle, or undefined if not tracked
   */
  getFileHandle(fileId: FileId): FileHandle | undefined {
    return this.openFiles.get(fileId);
  }

  /**
   * Checks if a file is currently being tracked.
   *
   * @param fileId - The unique identifier to check
   * @returns True if the file is tracked, false otherwise
   */
  isFileOpen(fileId: FileId): boolean {
    return this.openFiles.has(fileId);
  }

  /**
   * Gets the RecentFilesService instance for direct access.
   *
   * Useful for building recent files menu or other direct operations.
   *
   * @returns The RecentFilesService instance, or null if not configured
   */
  getRecentFilesService(): RecentFilesService | null {
    return this.recentFilesService;
  }

  /**
   * Gets the AutoSaveManager instance for direct access.
   *
   * Useful for recovery operations or manual auto-save triggers.
   *
   * @returns The AutoSaveManager instance, or null if not configured
   */
  getAutoSaveManager(): AutoSaveManager | null {
    return this.autoSaveManager;
  }

  /**
   * Closes all resources held by the integration.
   *
   * Should be called during application shutdown to properly clean up
   * file watchers and stop auto-save timers.
   */
  close(): void {
    // Close all file watchers
    this.fileWatcher?.close();

    // Stop auto-save timer (but don't clear dirty files - let them persist for recovery)
    this.autoSaveManager?.stop();

    // Clear internal tracking
    this.openFiles.clear();
  }
}
