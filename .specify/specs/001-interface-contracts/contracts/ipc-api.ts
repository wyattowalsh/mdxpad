/**
 * IPC API Contract Reference
 *
 * This file serves as the contract reference for all IPC communication
 * between Electron main and renderer processes.
 *
 * Per Constitution Article III.3:
 * - All channels follow mdxpad:<domain>:<action> naming
 * - Max 10 top-level channels (nested operations allowed)
 * - All payloads validated with zod on both ends
 *
 * NOTE: This is a reference file. The actual implementation will be in
 * src/shared/types/ipc.ts
 */

import type { FileHandle, FileResult } from '../../../src/shared/types/file';

// ============================================================================
// Channel Names (const object for type-safe string literals)
// ============================================================================

export const IpcChannels = {
  // File operations (5 channels)
  FILE_OPEN: 'mdxpad:file:open',
  FILE_SAVE: 'mdxpad:file:save',
  FILE_SAVE_AS: 'mdxpad:file:save-as',
  FILE_READ: 'mdxpad:file:read',
  FILE_WRITE: 'mdxpad:file:write',

  // Window operations (3 channels)
  WINDOW_CLOSE: 'mdxpad:window:close',
  WINDOW_MINIMIZE: 'mdxpad:window:minimize',
  WINDOW_MAXIMIZE: 'mdxpad:window:maximize',

  // App info (2 channels)
  APP_VERSION: 'mdxpad:app:version',
  APP_READY: 'mdxpad:app:ready',
} as const;

// ============================================================================
// Derived Types
// ============================================================================

/** Union type of all valid IPC channel names */
export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

// ============================================================================
// API Contract (type-safe invoke/handle signatures)
// ============================================================================

/**
 * Type-safe IPC API contract.
 *
 * Each key is a channel name, and the value is the function signature
 * that the main process handler must implement.
 *
 * Usage in main process:
 * ```typescript
 * ipcMain.handle(IpcChannels.FILE_OPEN, async (): Promise<FileResult<FileHandle>> => {
 *   // Implementation
 * });
 * ```
 *
 * Usage in renderer process (via preload):
 * ```typescript
 * const result = await window.api.invoke(IpcChannels.FILE_OPEN);
 * ```
 */
export interface IpcApi {
  // ─────────────────────────────────────────────────────────────────────────
  // File Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Open a file via native dialog.
   * @returns FileHandle on success, FileError on failure/cancel
   */
  [IpcChannels.FILE_OPEN]: () => Promise<FileResult<FileHandle>>;

  /**
   * Save content to an existing file.
   * @param handle - File to save to
   * @param content - Content to write
   * @returns void on success, FileError on failure
   */
  [IpcChannels.FILE_SAVE]: (handle: FileHandle, content: string) => Promise<FileResult<void>>;

  /**
   * Save content to a new file via native dialog.
   * @param content - Content to write
   * @returns New FileHandle on success, FileError on failure/cancel
   */
  [IpcChannels.FILE_SAVE_AS]: (content: string) => Promise<FileResult<FileHandle>>;

  /**
   * Read file contents from disk.
   * @param path - File path to read
   * @returns File content string on success, FileError on failure
   */
  [IpcChannels.FILE_READ]: (path: string) => Promise<FileResult<string>>;

  /**
   * Write content to a specific file path.
   * @param path - File path to write
   * @param content - Content to write
   * @returns void on success, FileError on failure
   */
  [IpcChannels.FILE_WRITE]: (path: string, content: string) => Promise<FileResult<void>>;

  // ─────────────────────────────────────────────────────────────────────────
  // Window Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Close the current window.
   * May trigger unsaved changes confirmation.
   */
  [IpcChannels.WINDOW_CLOSE]: () => Promise<void>;

  /**
   * Minimize the current window.
   */
  [IpcChannels.WINDOW_MINIMIZE]: () => Promise<void>;

  /**
   * Toggle maximize/restore for the current window.
   */
  [IpcChannels.WINDOW_MAXIMIZE]: () => Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────
  // App Info
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the application version string.
   * @returns Semantic version string (e.g., "0.1.0")
   */
  [IpcChannels.APP_VERSION]: () => Promise<string>;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Extract the handler type for a specific channel.
 *
 * Usage:
 * ```typescript
 * const openHandler: IpcHandler<typeof IpcChannels.FILE_OPEN> = async () => {
 *   // Must return Promise<FileResult<FileHandle>>
 * };
 * ```
 */
export type IpcHandler<C extends IpcChannel> = C extends keyof IpcApi ? IpcApi[C] : never;

/**
 * Extract the return type of a channel handler.
 *
 * Usage:
 * ```typescript
 * type OpenResult = IpcReturnType<typeof IpcChannels.FILE_OPEN>;
 * // = FileResult<FileHandle>
 * ```
 */
export type IpcReturnType<C extends IpcChannel> = C extends keyof IpcApi
  ? Awaited<ReturnType<IpcApi[C]>>
  : never;

/**
 * Extract the parameters of a channel handler.
 *
 * Usage:
 * ```typescript
 * type SaveParams = IpcParams<typeof IpcChannels.FILE_SAVE>;
 * // = [handle: FileHandle, content: string]
 * ```
 */
export type IpcParams<C extends IpcChannel> = C extends keyof IpcApi
  ? Parameters<IpcApi[C]>
  : never;
