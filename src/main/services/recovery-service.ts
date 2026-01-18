/**
 * RecoveryService - Manages crash recovery operations for autosaved documents.
 *
 * This service handles startup recovery detection, document restoration,
 * discard logic, and retention cleanup. It works in conjunction with
 * AutosaveService to manage the recovery manifest and files.
 *
 * Per FR-003: Detects on startup whether recovery data exists.
 * Per FR-005: Allows users to preview recoverable document content.
 * Per FR-006: Restores selected documents to their autosaved state.
 * Per FR-007: Discards recovery data only on explicit user decline.
 * Per FR-019: Validates recovery file checksums on load.
 * Per FR-021: Automatically cleans up old recovery files.
 *
 * Recovery files are stored at: `{userData}/recovery/{documentId}.json`
 * Manifest is stored at: `{userData}/recovery/manifest.json`
 *
 * Per Constitution Article III.1: File I/O operations are owned by main process.
 * Per Constitution Article VI.1: JSDoc with @param, @returns on all public APIs.
 *
 * @module main/services/recovery-service
 */

import { app } from 'electron';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import {
  type DocumentId,
  type RecoveryFile,
  RecoveryFileSchema,
  type RecoveryManifest,
  type ManifestEntry,
  type RecoveryDialogEntry,
  EMPTY_RECOVERY_MANIFEST,
  RecoveryManifestSchema,
} from '@shared/contracts/autosave-schemas';

import type {
  RecoveryCheckResponse,
  RecoveryListResponse,
  RecoveryPreviewResponse,
  RecoveryRestoreRequest,
  RecoveryRestoreResponse,
  RecoveryDiscardResponse,
  RestoredDocument,
} from '@shared/contracts/autosave-ipc';

import { AutosaveSettingsService } from './autosave-settings';
import type { AutosaveService } from './autosave-service';

/** Length of content preview in characters */
const CONTENT_PREVIEW_LENGTH = 100;

/** Recovery directory name under userData */
const RECOVERY_DIR_NAME = 'recovery';

/** Manifest file name */
const MANIFEST_FILE = 'manifest.json';

/** Temp file suffix for atomic writes */
const TEMP_SUFFIX = '.tmp';

/**
 * Service for managing crash recovery operations.
 *
 * Provides functionality to:
 * - Check for recovery data on startup (FR-003)
 * - List recoverable documents for dialog display (FR-004, FR-005)
 * - Preview full document content with checksum validation (FR-005, FR-019)
 * - Restore selected documents (FR-006)
 * - Discard recovery files on explicit decline (FR-007)
 * - Run retention cleanup (FR-021)
 *
 * This service is designed to work independently of AutosaveService for
 * reading operations, while optionally integrating with it for cleanup.
 * Recovery files are managed at `{userData}/recovery/`.
 *
 * @example
 * ```typescript
 * const settingsService = new AutosaveSettingsService();
 * const autosaveService = new AutosaveService(settingsService);
 * const recoveryService = new RecoveryService(settingsService, autosaveService);
 *
 * // On app startup
 * const check = await recoveryService.checkForRecovery();
 * if (check.hasRecoveryData) {
 *   const list = await recoveryService.listRecoverable();
 *   // Show recovery dialog with list.entries
 * }
 *
 * // Run cleanup periodically
 * await recoveryService.runRetentionCleanup();
 * ```
 */
export class RecoveryService {
  private readonly settingsService: AutosaveSettingsService;
  private readonly autosaveService: AutosaveService | null;
  private recoveryDirPath: string | null = null;

  /**
   * Creates a new RecoveryService instance.
   *
   * @param settingsService - Service for accessing autosave configuration settings
   * @param autosaveService - Optional AutosaveService for cleanup operations
   */
  constructor(
    settingsService: AutosaveSettingsService,
    autosaveService?: AutosaveService
  ) {
    this.settingsService = settingsService;
    this.autosaveService = autosaveService ?? null;
  }

  /**
   * Checks if any recovery data exists on startup.
   *
   * Performs a fast manifest check without reading individual recovery files.
   * This is the primary entry point for the startup recovery flow.
   *
   * Per FR-003: Detects on startup whether recovery data exists.
   *
   * @returns Promise resolving to recovery check response with hasRecoveryData and count
   *
   * @example
   * ```typescript
   * const check = await recoveryService.checkForRecovery();
   * if (check.hasRecoveryData) {
   *   console.log(`Found ${check.count} recoverable documents`);
   * }
   * ```
   */
  async checkForRecovery(): Promise<RecoveryCheckResponse> {
    try {
      const manifest = await this.readManifest();
      const count = Object.keys(manifest.entries).length;
      return {
        hasRecoveryData: count > 0,
        count,
      };
    } catch {
      // If manifest doesn't exist or can't be read, no recovery data
      return {
        hasRecoveryData: false,
        count: 0,
      };
    }
  }

  /**
   * Lists all recoverable documents for dialog display.
   *
   * Reads the manifest and generates dialog entries with content previews.
   * Each entry includes validation status based on checksum verification.
   *
   * Per FR-004: Display recovery dialog.
   * Per FR-005: Allow preview of recoverable content.
   * Per FR-019: Validates checksum and marks invalid entries.
   *
   * @returns Promise resolving to list of RecoveryDialogEntry objects
   *
   * @example
   * ```typescript
   * const response = await recoveryService.listRecoverable();
   * for (const entry of response.entries) {
   *   console.log(`${entry.fileName} - Valid: ${entry.isValid}`);
   * }
   * ```
   */
  async listRecoverable(): Promise<RecoveryListResponse> {
    try {
      const manifest = await this.readManifest();
      const entries: RecoveryDialogEntry[] = [];

      const manifestEntries = Object.values(manifest.entries) as ManifestEntry[];
      for (const entry of manifestEntries) {
        const dialogEntry = await this.createDialogEntry(entry.documentId);
        if (dialogEntry) {
          entries.push(dialogEntry);
        }
      }

      // Sort by most recent first
      entries.sort((a, b) => b.savedAt - a.savedAt);

      return { entries };
    } catch {
      return { entries: [] };
    }
  }

  /**
   * Gets full content for preview with checksum validation.
   *
   * Per FR-005: Allow preview of recoverable content.
   * Per FR-019: Validates checksum; returns CORRUPTED error on mismatch.
   *
   * @param documentId - The document ID to preview
   * @returns Promise resolving to preview response with content or error
   */
  async getPreview(documentId: DocumentId): Promise<RecoveryPreviewResponse> {
    try {
      const recoveryFile = await this.readRecoveryFile(documentId);

      if (!recoveryFile) {
        return { ok: false, error: 'NOT_FOUND' };
      }

      // Validate checksum per FR-019
      if (!this.validateChecksum(recoveryFile)) {
        console.error(
          `[RecoveryService] Checksum validation failed for document ${documentId}`
        );
        return { ok: false, error: 'CORRUPTED' };
      }

      // Check for file conflict if original file exists
      const conflict = await this.detectConflict(recoveryFile);

      return {
        ok: true,
        content: recoveryFile.content,
        conflict,
      };
    } catch (error) {
      console.error(
        `[RecoveryService] Failed to get preview for ${documentId}:`,
        error
      );
      return { ok: false, error: 'READ_ERROR' };
    }
  }

  /**
   * Restores selected documents based on user decision.
   *
   * Handles three action types:
   * - 'accept': Restores selected documents and deletes their recovery files
   * - 'decline': Discards ALL recovery data per FR-007
   * - 'dismiss': Preserves data for next startup (no action)
   *
   * Per FR-006: Restores selected documents to their autosaved state.
   * Per FR-007: Discards only when user explicitly declines.
   * Per FR-019: Validates checksum before restore, skips corrupted files.
   *
   * @param request - The recovery restore request containing user decision
   * @returns Promise resolving to restore response with documents or error
   *
   * @example
   * ```typescript
   * // Accept selected documents
   * const result = await recoveryService.restore({
   *   decision: {
   *     action: 'accept',
   *     selectedIds: ['doc-1', 'doc-2'] as DocumentId[],
   *   },
   * });
   *
   * // Decline all recovery (deletes files)
   * await recoveryService.restore({
   *   decision: { action: 'decline' },
   * });
   * ```
   */
  async restore(request: RecoveryRestoreRequest): Promise<RecoveryRestoreResponse> {
    const { decision } = request;

    try {
      if (decision.action === 'decline') {
        // User explicitly declined - discard all recovery data per FR-007
        const manifest = await this.readManifest();
        const allIds = Object.keys(manifest.entries) as DocumentId[];
        await this.discardRecovery(allIds);
        return { ok: true, restored: [] };
      }

      if (decision.action === 'dismiss') {
        // User dismissed without decision - preserve data for next startup
        return { ok: true, restored: [] };
      }

      // decision.action === 'accept' - restore selected documents
      const restored: RestoredDocument[] = [];

      for (const documentId of decision.selectedIds) {
        const recoveryFile = await this.readRecoveryFile(documentId);

        if (!recoveryFile) {
          console.warn(
            `[RecoveryService] Recovery file not found for ${documentId}`
          );
          continue;
        }

        // Validate checksum before restore per FR-019
        if (!this.validateChecksum(recoveryFile)) {
          console.error(
            `[RecoveryService] Skipping corrupted file for ${documentId}`
          );
          continue;
        }

        restored.push({
          documentId: recoveryFile.documentId,
          filePath: recoveryFile.filePath,
          fileName: recoveryFile.fileName,
          content: recoveryFile.content,
        });

        // Delete recovery file after successful restore
        await this.deleteRecoveryFileAndUpdateManifest(documentId);
      }

      return { ok: true, restored };
    } catch (error) {
      console.error('[RecoveryService] Failed to restore documents:', error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown restore error',
      };
    }
  }

  /**
   * Discards recovery files for specified document IDs.
   *
   * Deletes the recovery files from disk and updates the manifest.
   * Continues processing even if individual deletions fail.
   *
   * Per FR-007: Discards recovery data on explicit decline.
   * Per FR-008: Called after successful manual save.
   *
   * @param documentIds - Array of document IDs to discard
   * @returns Promise resolving to discard response with count
   *
   * @example
   * ```typescript
   * // Discard specific documents
   * const result = await recoveryService.discardRecovery([docId1, docId2]);
   * console.log(`Discarded ${result.discardedCount} files`);
   * ```
   */
  async discardRecovery(documentIds: DocumentId[]): Promise<RecoveryDiscardResponse> {
    let discardedCount = 0;

    for (const documentId of documentIds) {
      try {
        await this.deleteRecoveryFileAndUpdateManifest(documentId);
        discardedCount++;
      } catch (error) {
        console.error(
          `[RecoveryService] Failed to discard ${documentId}:`,
          error
        );
        // Continue with other files
      }
    }

    return { discardedCount };
  }

  /**
   * Runs retention cleanup to enforce storage limits.
   *
   * Performs two-phase cleanup:
   * 1. Delete files older than settings.retentionDays (default 30)
   * 2. If count > settings.maxFiles (default 50), delete oldest files
   *
   * This should be called periodically (e.g., on app startup or after autosave).
   *
   * Per FR-021: Automatically deletes recovery files older than retentionDays.
   *
   * @example
   * ```typescript
   * // Run cleanup on startup
   * await recoveryService.runRetentionCleanup();
   * ```
   */
  async runRetentionCleanup(): Promise<void> {
    try {
      const settings = this.settingsService.getSettings();
      const manifest = await this.readManifest();

      // Get all entries sorted by savedAt (oldest first)
      const manifestEntries = Object.values(manifest.entries) as ManifestEntry[];
      const entries = manifestEntries.sort((a, b) => a.savedAt - b.savedAt);

      const now = Date.now();
      const maxAgeMs = settings.retentionDays * 24 * 60 * 60 * 1000;
      const cutoffTime = now - maxAgeMs;

      const idsToDelete: DocumentId[] = [];

      // Step 1: Mark files older than retentionDays for deletion
      for (const entry of entries) {
        if (entry.savedAt < cutoffTime) {
          idsToDelete.push(entry.documentId);
        }
      }

      // Step 2: Calculate remaining entries after age-based deletion
      const remainingEntries = entries.filter(
        (e) => !idsToDelete.includes(e.documentId)
      );

      // Step 3: If still over maxFiles, mark oldest for deletion
      if (remainingEntries.length > settings.maxFiles) {
        const excessCount = remainingEntries.length - settings.maxFiles;
        // remainingEntries is already sorted oldest-first
        for (let i = 0; i < excessCount; i++) {
          const entry = remainingEntries[i];
          if (entry && !idsToDelete.includes(entry.documentId)) {
            idsToDelete.push(entry.documentId);
          }
        }
      }

      // Delete identified files
      if (idsToDelete.length > 0) {
        console.log(
          `[RecoveryService] Cleaning up ${idsToDelete.length} recovery files`
        );
        await this.discardRecovery(idsToDelete);
      }
    } catch (error) {
      console.error('[RecoveryService] Cleanup failed:', error);
      // Non-fatal error - don't throw
    }
  }

  /**
   * Validates the checksum of a recovery file.
   *
   * Per FR-019: Validates checksum to ensure file integrity.
   * Computes SHA-256 of content and compares to stored checksum.
   *
   * @param file - The recovery file to validate
   * @returns True if checksum matches, false otherwise
   */
  validateChecksum(file: RecoveryFile): boolean {
    const computedChecksum = this.computeChecksum(file.content);
    return computedChecksum === file.checksum;
  }

  /**
   * Computes SHA-256 checksum of content.
   *
   * @param content - The content to hash
   * @returns Hex-encoded SHA-256 hash (64 characters)
   */
  private computeChecksum(content: string): string {
    return createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  /**
   * Creates a dialog entry for a document ID.
   *
   * Reads the recovery file, validates checksum, checks for conflicts,
   * and creates a dialog entry with content preview.
   *
   * Per FR-016: Detects when source file was modified externally.
   *
   * @param documentId - The document ID to create entry for
   * @returns Promise resolving to dialog entry or null if file not found
   */
  private async createDialogEntry(
    documentId: DocumentId
  ): Promise<RecoveryDialogEntry | null> {
    try {
      const recoveryFile = await this.readRecoveryFile(documentId);

      if (!recoveryFile) {
        return null;
      }

      const isValid = this.validateChecksum(recoveryFile);

      // Generate content preview (first 100 characters)
      const contentPreview = recoveryFile.content.slice(0, CONTENT_PREVIEW_LENGTH);

      // Check for conflict (disk file modified after recovery save)
      const hasConflict = await this.checkForConflict(recoveryFile);

      return {
        documentId: recoveryFile.documentId,
        fileName: recoveryFile.fileName,
        filePath: recoveryFile.filePath,
        savedAt: recoveryFile.savedAt,
        contentPreview,
        isValid,
        hasConflict,
      };
    } catch (error) {
      console.error(
        `[RecoveryService] Failed to create dialog entry for ${documentId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Checks if there's a conflict between recovery and disk file (mtime only).
   *
   * This is a lightweight check that only stats the file, without reading content.
   * Used for dialog display to flag potential conflicts.
   *
   * Per FR-016: Detects when source file was modified externally.
   *
   * @param recoveryFile - The recovery file to check
   * @returns True if disk file was modified after recovery save, false otherwise
   */
  private async checkForConflict(recoveryFile: RecoveryFile): Promise<boolean> {
    // No conflict possible for untitled documents
    if (!recoveryFile.filePath) {
      return false;
    }

    try {
      const stat = await fs.stat(recoveryFile.filePath);
      const diskModifiedAt = stat.mtime.getTime();

      // If disk file was modified after recovery save, there's a conflict
      return diskModifiedAt > recoveryFile.savedAt;
    } catch {
      // File doesn't exist or can't be read - no conflict
      return false;
    }
  }

  // ==========================================================================
  // Private Helper Methods - File System Operations
  // ==========================================================================

  /**
   * Gets the recovery directory path, creating it if necessary.
   *
   * @returns Promise resolving to the absolute path of the recovery directory
   */
  private async getRecoveryDirPath(): Promise<string> {
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
   * Gets the full path to the recovery directory (sync, may not exist).
   *
   * @returns The recovery directory path
   */
  private getRecoveryDir(): string {
    return path.join(app.getPath('userData'), RECOVERY_DIR_NAME);
  }

  /**
   * Gets the full path to a recovery file.
   *
   * @param documentId - The document ID
   * @returns The full path to the recovery file
   */
  private getRecoveryFilePath(documentId: DocumentId): string {
    return path.join(this.getRecoveryDir(), `${documentId}.json`);
  }

  /**
   * Reads the recovery manifest from disk.
   *
   * Returns the manifest containing entries for all recoverable documents.
   * If no manifest exists or it's corrupted, returns an empty manifest.
   *
   * @returns Promise resolving to the recovery manifest
   */
  private async readManifest(): Promise<RecoveryManifest> {
    try {
      const recoveryDir = await this.getRecoveryDirPath();
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
        console.warn('[RecoveryService] Corrupted manifest, returning empty:', error.message);
        return EMPTY_RECOVERY_MANIFEST;
      }
      throw error;
    }
  }

  /**
   * Reads a recovery file from disk.
   *
   * @param documentId - The document ID to read
   * @returns Promise resolving to RecoveryFile or null if not found
   */
  private async readRecoveryFile(
    documentId: DocumentId
  ): Promise<RecoveryFile | null> {
    try {
      const filePath = this.getRecoveryFilePath(documentId);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as unknown;

      // Validate schema
      const result = RecoveryFileSchema.safeParse(parsed);
      if (!result.success) {
        console.error(
          `[RecoveryService] Invalid recovery file schema for ${documentId}:`,
          result.error
        );
        return null;
      }

      return result.data;
    } catch (error) {
      if (this.isEnoentError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Deletes a recovery file and updates the manifest.
   *
   * Uses atomic write pattern for manifest update to ensure consistency.
   *
   * @param documentId - The document ID to delete
   */
  private async deleteRecoveryFileAndUpdateManifest(documentId: DocumentId): Promise<void> {
    // If we have an AutosaveService, delegate to it for consistency
    if (this.autosaveService) {
      await this.autosaveService.deleteRecoveryFile(documentId);
      return;
    }

    const recoveryDir = await this.getRecoveryDirPath();
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

    // Update manifest to remove entry
    await this.removeFromManifest(documentId);
  }

  /**
   * Removes an entry from the recovery manifest using atomic write.
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

    const recoveryDir = await this.getRecoveryDirPath();
    const manifestPath = path.join(recoveryDir, MANIFEST_FILE);
    const tempManifestPath = `${manifestPath}${TEMP_SUFFIX}`;

    // Atomic write for manifest
    await this.atomicWrite(tempManifestPath, manifestPath, JSON.stringify(updatedManifest, null, 2));
  }

  /**
   * Performs an atomic write operation.
   *
   * Writes content to a temporary file, then renames it to the target path.
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
   * Detects if there's a conflict between recovery and disk file.
   *
   * Per FR-016: Detects when source file was modified externally.
   *
   * @param recoveryFile - The recovery file to check
   * @returns Conflict info or null if no conflict
   */
  private async detectConflict(
    recoveryFile: RecoveryFile
  ): Promise<{
    documentId: DocumentId;
    filePath: string;
    recoveryContent: string;
    diskContent: string;
    recoveryTimestamp: number;
    diskModifiedAt: number;
  } | null> {
    // No conflict possible for untitled documents
    if (!recoveryFile.filePath) {
      return null;
    }

    try {
      const stat = await fs.stat(recoveryFile.filePath);
      const diskModifiedAt = stat.mtime.getTime();

      // If disk file was modified after recovery save, there's a conflict
      if (diskModifiedAt > recoveryFile.savedAt) {
        const diskContent = await fs.readFile(recoveryFile.filePath, 'utf-8');

        return {
          documentId: recoveryFile.documentId,
          filePath: recoveryFile.filePath,
          recoveryContent: recoveryFile.content,
          diskContent,
          recoveryTimestamp: recoveryFile.savedAt,
          diskModifiedAt,
        };
      }

      return null;
    } catch (error) {
      // File doesn't exist or can't be read - no conflict
      if (this.isEnoentError(error)) {
        return null;
      }
      console.warn(
        `[RecoveryService] Could not check conflict for ${recoveryFile.filePath}:`,
        error
      );
      return null;
    }
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
