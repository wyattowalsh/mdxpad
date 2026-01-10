/**
 * MdxpadAPI - Interface exposed to renderer via contextBridge.
 * This is the ONLY way renderer can communicate with main process.
 */

import type { SecurityInfo } from '@shared/lib/ipc';
import type { FileHandle, FileResult } from '@shared/types/file';

/** File change event received from main process */
export interface FileChangeEvent {
  fileId: string;
  path: string;
  type: 'change' | 'unlink';
}

/**
 * API surface exposed to renderer process via contextBridge.
 *
 * @security All methods use invoke/handle pattern.
 * @security All responses should be validated before use.
 */
export interface MdxpadAPI {
  // === App Info ===
  /**
   * Get application version.
   * @returns Semantic version string (e.g., "0.1.0")
   */
  getVersion(): Promise<string>;

  /**
   * Get current security configuration.
   * Used by verify-security script and debug info.
   * @returns Security settings object
   */
  getSecurityInfo(): Promise<SecurityInfo>;

  // === File Operations ===
  /**
   * Open a file using native dialog.
   * @returns FileHandle on success, error on cancel/failure
   */
  openFile(): Promise<FileResult<FileHandle>>;

  /**
   * Save content to existing file.
   * @param handle - File handle with path
   * @param content - Content to save
   * @returns void on success, error on failure
   */
  saveFile(handle: FileHandle, content: string): Promise<FileResult<void>>;

  /**
   * Save content to new location using native dialog.
   * @param content - Content to save
   * @returns New FileHandle on success, error on cancel/failure
   */
  saveFileAs(content: string): Promise<FileResult<FileHandle>>;

  /**
   * Read file content from path.
   * @param path - Absolute file path
   * @returns File content on success, error on failure
   */
  readFile(path: string): Promise<FileResult<string>>;

  /**
   * Write content to path.
   * @param path - Absolute file path
   * @param content - Content to write
   * @returns void on success, error on failure
   */
  writeFile(path: string, content: string): Promise<FileResult<void>>;

  // === Window Operations ===
  /**
   * Close the current window.
   * May show confirmation dialog if document is dirty.
   */
  closeWindow(): Promise<void>;

  /**
   * Minimize the current window.
   */
  minimizeWindow(): Promise<void>;

  /**
   * Maximize or restore the current window.
   */
  maximizeWindow(): Promise<void>;

  // === App Lifecycle ===
  /**
   * Signal that renderer is ready.
   */
  signalReady(): Promise<void>;

  // === Events ===
  /**
   * Subscribe to file change events from main process.
   * @param callback - Called when an open file changes externally
   * @returns Unsubscribe function
   */
  onFileChange(callback: (event: FileChangeEvent) => void): () => void;

  /**
   * Platform information.
   */
  platform: {
    os: 'darwin'; // macOS only per constitution
    arch: 'arm64' | 'x64';
  };
}
