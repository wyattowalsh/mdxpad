/**
 * AutosaveService - Core service for automatic document backup and recovery file management.
 *
 * This service handles atomic writes to the recovery directory, checksum generation
 * for content integrity, and manifest management for tracking recoverable documents.
 *
 * Per FR-001: Automatically saves document content to recovery location.
 * Per FR-015: Uses atomic write pattern (write to temp file, then rename).
 * Per FR-017: Detects insufficient disk space before autosave write.
 * Per FR-019: Generates SHA-256 checksums for content integrity verification.
 *
 * Recovery files are stored at: `{userData}/recovery/{documentId}.json`
 * Manifest is stored at: `{userData}/recovery/manifest.json`
 *
 * Per Constitution Article III.1: File I/O operations are owned by main process.
 * Per Constitution Article VII.3: Documents are auto-saved to prevent data loss.
 *
 * @module main/services/autosave-service
 */

import { app } from 'electron';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { statfs } from 'node:fs/promises';
import path from 'node:path';

import type { AutosaveSettingsService } from './autosave-settings';
import {
  type DocumentId,
  type RecoveryFile,
  RecoveryFileSchema,
  type RecoveryManifest,
  type ManifestEntry,
  RecoveryManifestSchema,
  EMPTY_RECOVERY_MANIFEST,
} from '@shared/contracts/autosave-schemas';
import type {
  AutosaveTriggerRequest,
  AutosaveTriggerResponse,
} from '@shared/contracts/autosave-ipc';

/** Minimum disk space required for autosave in bytes (100MB per FR-017) */
const MIN_DISK_SPACE_BYTES = 100 * 1024 * 1024;

/** Recovery directory name within userData */
const RECOVERY_DIR_NAME = 'recovery';

/** Manifest file name */
const MANIFEST_FILE = 'manifest.json';

/** Temp file suffix for atomic writes */
const TEMP_SUFFIX = '.tmp';

/**
 * Service for managing automatic document saving to recovery location.
 *
 * Provides methods to save documents with atomic write pattern and checksum
 * generation, check disk space availability, and manage the recovery manifest.
 *
 * Per FR-001: Automatically saves document content to recovery location.
 * Per FR-015: Uses atomic write pattern (temp file + rename).
 * Per FR-017: Detects insufficient disk space before write.
 * Per FR-019: Generates SHA-256 checksums for content integrity verification.
 *
 * @example
 * ```typescript
 * const settingsService = new AutosaveSettingsService();
 * const autosaveService = new AutosaveService(settingsService);
 *
 * const result = await autosaveService.saveDocument({
 *   documentId: 'uuid-here' as DocumentId,
 *   filePath: '/path/to/file.mdx',
 *   fileName: 'My Document',
 *   content: '# Hello World',
 * });
 *
 * if (result.ok) {
 *   console.log('Saved at:', result.savedAt);
 * } else {
 *   console.error('Save failed:', result.error, result.message);
 * }
 *
 * // Delete recovery file after manual save
 * await autosaveService.deleteRecoveryFile('uuid-here' as DocumentId);
 * ```
 */
export class AutosaveService {
  private readonly settingsService: AutosaveSettingsService;
  private recoveryDirPath: string | null = null;

  /**
   * Creates a new AutosaveService instance.
   *
   * @param settingsService - Service for accessing autosave configuration settings
   */
  constructor(settingsService: AutosaveSettingsService) {
    this.settingsService = settingsService;
  }

  /**
   * Saves a document to the recovery location using atomic write pattern.
   *
   * The atomic write pattern ensures data integrity even if the application
   * crashes during the write operation:
   * 1. Check available disk space (FR-017)
   * 2. Generate SHA-256 checksum of content (FR-019)
   * 3. Validate recovery file structure with zod schema
   * 4. Write recovery file to a temp location ({file}.tmp)
   * 5. Rename temp file to final location (atomic on most file systems)
   * 6. Update the recovery manifest
   *
   * Per FR-001: Saves document content to recovery location.
   * Per FR-015: Uses atomic write pattern (write to temp, then rename).
   * Per FR-019: Includes SHA-256 checksum for integrity verification.
   *
   * @param request - The autosave trigger request containing document details
   * @returns Promise resolving to success with timestamp or error response
   */
  async saveDocument(request: AutosaveTriggerRequest): Promise<AutosaveTriggerResponse> {
    const recoveryDir = await this.getRecoveryDir();

    // FR-017: Check disk space before write
    const diskSpaceCheck = await this.checkDiskSpace(recoveryDir);
    if (!diskSpaceCheck.ok) {
      console.warn(`[AutosaveService] Skipping autosave: ${diskSpaceCheck.message}`);
      return diskSpaceCheck;
    }

    const { documentId, filePath, fileName, content } = request;

    try {
      // Generate checksum for content integrity verification (FR-019)
      const checksum = this.computeChecksum(content);
      const savedAt = Date.now();

      // Build recovery file structure
      const recoveryFile: RecoveryFile = {
        version: 1,
        documentId,
        filePath,
        fileName,
        content,
        savedAt,
        checksum,
      };

      // Validate recovery file structure before writing
      const validated = RecoveryFileSchema.parse(recoveryFile);

      // Compute file paths
      const recoveryFilePath = `${documentId}.json`;
      const fullRecoveryPath = path.join(recoveryDir, recoveryFilePath);
      const tempRecoveryPath = `${fullRecoveryPath}${TEMP_SUFFIX}`;

      // Write recovery file using atomic pattern (FR-015)
      await this.atomicWrite(tempRecoveryPath, fullRecoveryPath, JSON.stringify(validated, null, 2));

      // Update manifest entry
      const manifestEntry: ManifestEntry = {
        documentId,
        filePath,
        fileName,
        savedAt,
        recoveryFilePath,
      };

      await this.updateManifest(documentId, manifestEntry);

      return {
        ok: true,
        savedAt,
      };
    } catch (error) {
      return this.mapWriteError(error);
    }
  }

  /**
   * Gets the recovery directory path, creating it if necessary.
   *
   * The recovery directory is located at `{userData}/recovery/` where userData
   * is the Electron app's data directory (platform-specific).
   *
   * @returns Promise resolving to the absolute path of the recovery directory
   *
   * @example
   * ```typescript
   * const recoveryDir = await autosaveService.getRecoveryDir();
   * // Returns something like:
   * // macOS: ~/Library/Application Support/mdxpad/recovery
   * // Windows: %APPDATA%/mdxpad/recovery
   * // Linux: ~/.config/mdxpad/recovery
   * ```
   */
  async getRecoveryDir(): Promise<string> {
    if (this.recoveryDirPath !== null) {
      return this.recoveryDirPath;
    }

    const userData = app.getPath('userData');
    const recoveryDir = path.join(userData, RECOVERY_DIR_NAME);

    // Ensure directory exists
    await fs.mkdir(recoveryDir, { recursive: true });

    this.recoveryDirPath = recoveryDir;
    return recoveryDir;
  }

  /**
   * Deletes a recovery file and removes its entry from the manifest.
   *
   * Called after a document is successfully manually saved (FR-008) or when
   * user explicitly discards recovery data (FR-007).
   *
   * Per FR-008: Clears recovery data after successful manual save.
   *
   * @param documentId - The document identifier to delete
   *
   * @example
   * ```typescript
   * // After user saves document manually via File > Save
   * await autosaveService.deleteRecoveryFile(documentId);
   * ```
   */
  async deleteRecoveryFile(documentId: DocumentId): Promise<void> {
    const recoveryDir = await this.getRecoveryDir();
    const recoveryFilePath = path.join(recoveryDir, `${documentId}.json`);

    // Delete the recovery file (ignore if doesn't exist)
    try {
      await fs.unlink(recoveryFilePath);
    } catch (error) {
      // Ignore ENOENT (file doesn't exist)
      if (!this.isEnoentError(error)) {
        throw error;
      }
    }

    // Remove from manifest
    await this.removeFromManifest(documentId);
  }

  /**
   * Reads the recovery manifest from disk.
   *
   * Returns the manifest containing entries for all recoverable documents.
   * If no manifest exists or it's corrupted, returns an empty manifest.
   *
   * Per FR-003: Detect on startup whether recovery data exists.
   *
   * @returns Promise resolving to the recovery manifest
   *
   * @example
   * ```typescript
   * const manifest = await autosaveService.readManifest();
   * const hasRecoveryData = Object.keys(manifest.entries).length > 0;
   * console.log(`Found ${Object.keys(manifest.entries).length} recoverable documents`);
   * ```
   */
  async readManifest(): Promise<RecoveryManifest> {
    try {
      const recoveryDir = await this.getRecoveryDir();
      const manifestPath = path.join(recoveryDir, MANIFEST_FILE);

      const content = await fs.readFile(manifestPath, 'utf-8');
      const parsed: unknown = JSON.parse(content);

      // Validate manifest structure
      return RecoveryManifestSchema.parse(parsed);
    } catch (error) {
      // Return empty manifest if file doesn't exist or is corrupted
      if (this.isEnoentError(error) || error instanceof SyntaxError) {
        return EMPTY_RECOVERY_MANIFEST;
      }
      // For zod validation errors, return empty manifest (corrupted data)
      if (error instanceof Error && error.name === 'ZodError') {
        console.warn('[AutosaveService] Corrupted manifest, returning empty:', error.message);
        return EMPTY_RECOVERY_MANIFEST;
      }
      throw error;
    }
  }

  /**
   * Computes the SHA-256 checksum of content.
   *
   * Used for content integrity verification per FR-019.
   *
   * @param content - The string content to hash
   * @returns The SHA-256 hash as a 64-character hexadecimal string
   *
   * @example
   * ```typescript
   * const checksum = autosaveService.computeChecksum('Hello, World!');
   * // Returns: "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"
   * ```
   */
  computeChecksum(content: string): string {
    return createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  /**
   * Performs an atomic write operation.
   *
   * Writes content to a temporary file, then renames it to the target path.
   * This pattern ensures that the target file is either fully written or
   * doesn't exist, preventing partial writes that could corrupt data.
   *
   * Per FR-015: Atomic write pattern to prevent corruption during crashes.
   *
   * @param tempPath - Path to write temporary file
   * @param targetPath - Final destination path
   * @param content - Content to write
   */
  private async atomicWrite(tempPath: string, targetPath: string, content: string): Promise<void> {
    // Write to temp file
    await fs.writeFile(tempPath, content, 'utf-8');

    // Rename to target (atomic on most file systems)
    await fs.rename(tempPath, targetPath);
  }

  /**
   * Updates the recovery manifest with a new or updated entry.
   *
   * Uses atomic write pattern to prevent manifest corruption.
   *
   * @param documentId - The document identifier
   * @param entry - The manifest entry to add or update
   */
  private async updateManifest(documentId: DocumentId, entry: ManifestEntry): Promise<void> {
    const manifest = await this.readManifest();
    const updatedManifest: RecoveryManifest = {
      ...manifest,
      entries: {
        ...manifest.entries,
        [documentId]: entry,
      },
    };

    const recoveryDir = await this.getRecoveryDir();
    const manifestPath = path.join(recoveryDir, MANIFEST_FILE);
    const tempManifestPath = `${manifestPath}${TEMP_SUFFIX}`;

    // Atomic write for manifest
    await this.atomicWrite(tempManifestPath, manifestPath, JSON.stringify(updatedManifest, null, 2));
  }

  /**
   * Removes an entry from the recovery manifest.
   *
   * Uses atomic write pattern to prevent manifest corruption.
   *
   * @param documentId - The document identifier to remove
   */
  private async removeFromManifest(documentId: DocumentId): Promise<void> {
    const manifest = await this.readManifest();

    // Create new entries object without the specified documentId
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [documentId]: _removed, ...remainingEntries } = manifest.entries;

    const updatedManifest: RecoveryManifest = {
      ...manifest,
      entries: remainingEntries,
    };

    const recoveryDir = await this.getRecoveryDir();
    const manifestPath = path.join(recoveryDir, MANIFEST_FILE);
    const tempManifestPath = `${manifestPath}${TEMP_SUFFIX}`;

    // Atomic write for manifest
    await this.atomicWrite(tempManifestPath, manifestPath, JSON.stringify(updatedManifest, null, 2));
  }

  /**
   * Checks if sufficient disk space is available for autosave.
   *
   * Per FR-017: Detects if <100MB available before autosave write,
   * returns DISK_FULL error response if insufficient space.
   *
   * @param recoveryDir - The recovery directory path to check
   * @returns Promise resolving to success or DISK_FULL error
   */
  private async checkDiskSpace(
    recoveryDir: string
  ): Promise<{ ok: true } | Extract<AutosaveTriggerResponse, { ok: false }>> {
    try {
      const stats = await statfs(recoveryDir);
      const availableBytes = stats.bfree * stats.bsize;

      if (availableBytes < MIN_DISK_SPACE_BYTES) {
        const availableMB = Math.floor(availableBytes / (1024 * 1024));
        return {
          ok: false,
          error: 'DISK_FULL',
          message: `Insufficient disk space. Less than 100MB available (${availableMB}MB free).`,
        };
      }

      return { ok: true };
    } catch (error) {
      // If we can't check disk space, log warning but allow the save attempt
      console.warn(
        '[AutosaveService] Unable to check disk space:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return { ok: true };
    }
  }

  /**
   * Maps file system errors to AutosaveTriggerResponse error types.
   *
   * @param error - The caught error
   * @returns An error response with appropriate error code
   */
  private mapWriteError(error: unknown): AutosaveTriggerResponse {
    if (error instanceof Error && 'code' in error) {
      const nodeError = error as NodeJS.ErrnoException;

      switch (nodeError.code) {
        case 'ENOSPC':
          return {
            ok: false,
            error: 'DISK_FULL',
            message: 'Insufficient disk space for autosave',
          };
        case 'EACCES':
        case 'EPERM':
        case 'EROFS':
          return {
            ok: false,
            error: 'PERMISSION_DENIED',
            message: `Permission denied: ${nodeError.message}`,
          };
        default:
          return {
            ok: false,
            error: 'WRITE_ERROR',
            message: `Failed to save recovery file: ${nodeError.message}`,
          };
      }
    }

    return {
      ok: false,
      error: 'WRITE_ERROR',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  /**
   * Checks if an error is an ENOENT (file not found) error.
   *
   * @param error - The error to check
   * @returns True if the error is ENOENT
   */
  private isEnoentError(error: unknown): boolean {
    return (
      error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
    );
  }
}
