/**
 * VersionHistoryService - Backend service for version history management.
 *
 * Aggregates version history from multiple sources: autosave snapshots,
 * manual saves, and git commits (when available). Stores autosave
 * snapshots in ~/.mdxpad/history/.
 *
 * Per Constitution Article III.1: File I/O operations owned by main process.
 *
 * @module main/services/version-history-service
 */

import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

import { ensureRealDirectory } from './ensure-real-directory';
import type {
  VersionEntry,
  VersionHistoryResponse,
  GetVersionResponse,
  RestoreVersionResponse,
  CreateSnapshotResponse,
} from '@shared/contracts/history-schemas';
import {
  assertOpenedDocumentWrite,
  assertSnapshotId,
  readOpenedDocument,
  readSnapshotText,
  sameOpenedFile,
  snapshotFile,
  writeOpenedDocument,
  writeSnapshotFile,
} from './version-history-path';

const execFileAsync = promisify(execFile);

// ============================================================================
// Constants
// ============================================================================

/** History storage directory name */
const HISTORY_DIR_NAME = 'history';

/** Maximum number of autosave snapshots per file */
const MAX_SNAPSHOTS_PER_FILE = 50;

/** Maximum number of git commits to include */
const MAX_GIT_COMMITS = 100;

// ============================================================================
// Types
// ============================================================================

/**
 * Snapshot file structure stored on disk.
 */
interface SnapshotFile {
  readonly version: 1;
  readonly filePath: string;
  readonly content: string;
  readonly timestamp: number;
  readonly source: 'autosave' | 'manual';
  readonly label?: string;
  readonly checksum: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Service for managing version history.
 *
 * Aggregates version history from autosave snapshots, manual saves,
 * and git commits. Provides methods to list, retrieve, restore,
 * and create snapshots.
 *
 * @example
 * ```typescript
 * const service = new VersionHistoryService();
 *
 * const history = await service.getHistory('/path/to/file.mdx');
 * const version = await service.getVersion('snapshot-123', '/path/to/file.mdx');
 * await service.restoreVersion('snapshot-123', '/path/to/file.mdx');
 * ```
 */
export class VersionHistoryService {
  private historyDirPath: string | null = null;

  constructor(private readonly canWrite: (filePath: string) => boolean = () => false) {}

  /**
   * Get version history for a file.
   *
   * Aggregates entries from autosave snapshots, manual saves,
   * and git commits (if the file is in a git repository).
   *
   * @param filePath - Absolute path to the file
   * @returns Version history response with sorted entries
   */
  async getHistory(filePath: string): Promise<VersionHistoryResponse> {
    const openedPath = await assertOpenedDocumentWrite(filePath, this.canWrite);
    const entries: VersionEntry[] = [];

    // Get autosave/manual snapshots
    const snapshots = await this.getSnapshots(openedPath);
    entries.push(...snapshots);

    // Get git commits if available
    const gitEntries = await this.getGitHistory(openedPath);
    entries.push(...gitEntries);

    // Sort by timestamp, newest first
    entries.sort((a, b) => b.timestamp - a.timestamp);

    return { entries };
  }

  /**
   * Get the content of a specific version.
   *
   * @param id - Version identifier
   * @param filePath - File path for context
   * @returns Version content and metadata
   */
  async getVersion(id: string, filePath: string): Promise<GetVersionResponse> {
    const identity = assertSnapshotId(id);
    const openedPath = await assertOpenedDocumentWrite(filePath, this.canWrite);
    if (identity.kind === 'git') {
      return this.getGitVersion(identity.gitHash ?? '', openedPath);
    }

    const historyDir = await this.getHistoryDir();
    const snapshotPath = snapshotFile(historyDir, id);

    try {
      const raw = await readSnapshotText(snapshotPath);
      const snapshot = JSON.parse(raw) as SnapshotFile;
      if (!sameOpenedFile(snapshot.filePath, openedPath)) {
        throw new Error('Version not found');
      }

      return {
        content: snapshot.content,
        entry: {
          id,
          timestamp: snapshot.timestamp,
          source: snapshot.source,
          label: snapshot.label,
        },
      };
    } catch {
      throw new Error(`Version not found: ${id}`);
    }
  }

  /**
   * Restore a specific version by writing its content to the file.
   *
   * @param id - Version identifier to restore
   * @param filePath - File path to write restored content to
   * @param createBackup - Whether to create a backup before restoring
   * @returns Restore result
   */
  async restoreVersion(
    id: string,
    filePath: string,
    createBackup = true,
    backupContent?: string
  ): Promise<RestoreVersionResponse> {
    try {
      const openedPath = await assertOpenedDocumentWrite(filePath, this.canWrite);
      const version = await this.getVersion(id, openedPath);

      // Create backup of current file if requested
      if (createBackup) {
        try {
          const currentContent = backupContent ?? (await readOpenedDocument(openedPath));
          await this.createSnapshotInternal(
            openedPath,
            currentContent,
            'manual',
            'Pre-restore backup'
          );
        } catch {
          // File might not exist yet, that's ok
        }
      }

      // Write restored content to file
      await writeOpenedDocument(openedPath, version.content);

      return {
        ok: true,
        content: version.content,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to restore version',
      };
    }
  }

  /**
   * Create a manual snapshot of the current file.
   *
   * @param filePath - File path to snapshot
   * @param label - Optional label for the snapshot
   * @returns Snapshot creation result
   */
  async createSnapshot(
    filePath: string,
    label?: string,
    content?: string
  ): Promise<CreateSnapshotResponse> {
    try {
      const openedPath = await assertOpenedDocumentWrite(filePath, this.canWrite);
      const snapshotContent = content ?? (await readOpenedDocument(openedPath));
      const entry = await this.createSnapshotInternal(openedPath, snapshotContent, 'manual', label);

      return { ok: true, entry };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to create snapshot',
      };
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Create a snapshot and write it to disk.
   */
  private async createSnapshotInternal(
    filePath: string,
    content: string,
    source: 'autosave' | 'manual',
    label?: string
  ): Promise<VersionEntry> {
    const historyDir = await this.getHistoryDir();
    const timestamp = Date.now();
    const checksum = createHash('sha256').update(content, 'utf-8').digest('hex');
    const id = `snapshot-${timestamp}-${checksum.slice(0, 8)}`;

    const snapshot: SnapshotFile = {
      version: 1,
      filePath,
      content,
      timestamp,
      source,
      ...(label !== undefined ? { label } : {}),
      checksum,
    };

    const snapshotPath = path.join(historyDir, `${id}.json`);
    await writeSnapshotFile(snapshotPath, JSON.stringify(snapshot, null, 2));

    // Cleanup old snapshots
    await this.cleanupSnapshots(filePath);

    const entry: VersionEntry = { id, timestamp, source, label };
    return entry;
  }

  /**
   * Get saved snapshots for a file.
   */
  private async getSnapshots(filePath: string): Promise<VersionEntry[]> {
    const historyDir = await this.getHistoryDir();
    const entries: VersionEntry[] = [];

    try {
      const files = await fs.readdir(historyDir);

      for (const file of files) {
        if (!file.startsWith('snapshot-') || !file.endsWith('.json')) continue;

        try {
          const fullPath = path.join(historyDir, file);
          const raw = await readSnapshotText(fullPath);
          const snapshot = JSON.parse(raw) as SnapshotFile;

          if (sameOpenedFile(snapshot.filePath, filePath)) {
            entries.push({
              id: file.replace('.json', ''),
              timestamp: snapshot.timestamp,
              source: snapshot.source,
              label: snapshot.label,
            });
          }
        } catch {
          // Skip corrupted snapshot files
        }
      }
    } catch {
      // History directory might not exist yet
    }

    return entries;
  }

  /**
   * Get git commit history for a file (if in a git repo).
   */
  private async getGitHistory(filePath: string): Promise<VersionEntry[]> {
    const entries: VersionEntry[] = [];
    const dir = path.dirname(filePath);

    try {
      const { stdout } = await execFileAsync(
        'git',
        ['log', `--max-count=${MAX_GIT_COMMITS}`, '--format=%H|%at|%s', '--', filePath],
        { cwd: dir }
      );

      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        if (line.length === 0) continue;
        const parts = line.split('|');
        const hash = parts[0];
        const timestamp = parts[1];
        const message = parts.slice(2).join('|');

        if (hash !== undefined && timestamp !== undefined) {
          entries.push({
            id: `git-${hash}`,
            timestamp: parseInt(timestamp, 10) * 1000,
            source: 'git',
            label: message,
          });
        }
      }
    } catch {
      // Not a git repo or git not available -- silently skip
    }

    return entries;
  }

  /**
   * Get a specific git version.
   */
  private async getGitVersion(commitHash: string, filePath: string): Promise<GetVersionResponse> {
    const dir = path.dirname(filePath);

    try {
      // Get file content at specific commit
      const relativePath = await this.getGitRelativePath(filePath, dir);
      const { stdout: content } = await execFileAsync(
        'git',
        ['show', `${commitHash}:${relativePath}`],
        { cwd: dir }
      );

      // Get commit info
      const { stdout: info } = await execFileAsync(
        'git',
        ['log', '-1', '--format=%at|%s', commitHash],
        { cwd: dir }
      );

      const parts = info.trim().split('|');
      const timestamp = parseInt(parts[0] ?? '0', 10) * 1000;
      const label = parts.slice(1).join('|');

      return {
        content,
        entry: {
          id: `git-${commitHash}`,
          timestamp,
          source: 'git',
          label,
        },
      };
    } catch {
      throw new Error(`Git version not found: git-${commitHash}`);
    }
  }

  /**
   * Get the relative path of a file within a git repo.
   */
  private async getGitRelativePath(filePath: string, cwd: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['ls-files', '--full-name', filePath], { cwd });
      const result = stdout.trim();
      if (result.length > 0) return result;
    } catch {
      // Fallback to basename
    }
    return path.basename(filePath);
  }

  /**
   * Remove old snapshots exceeding the maximum per file.
   */
  private async cleanupSnapshots(filePath: string): Promise<void> {
    const snapshots = await this.getSnapshots(filePath);
    if (snapshots.length <= MAX_SNAPSHOTS_PER_FILE) return;

    // Sort oldest first
    const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
    const toDelete = sorted.slice(0, sorted.length - MAX_SNAPSHOTS_PER_FILE);

    const historyDir = await this.getHistoryDir();
    for (const entry of toDelete) {
      try {
        await fs.unlink(path.join(historyDir, `${entry.id}.json`));
      } catch {
        // Ignore deletion errors
      }
    }
  }

  /**
   * Get the history directory path, creating it if necessary.
   */
  private async getHistoryDir(): Promise<string> {
    if (this.historyDirPath !== null) {
      return this.historyDirPath;
    }

    const userData = app.getPath('userData');
    const historyDir = path.join(userData, HISTORY_DIR_NAME);

    await ensureRealDirectory(historyDir);

    this.historyDirPath = historyDir;
    return historyDir;
  }
}
