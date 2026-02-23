/**
 * AutoSaveManager Unit Tests
 *
 * Tests for the AutoSaveManager class including lifecycle management,
 * dirty file tracking, periodic saving, and recovery discovery.
 *
 * @module tests/unit/auto-save
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

const { mockWriteFile, mockUnlink, mockStat, mockGetPath, mockGlob } = vi.hoisted(() => ({
  mockWriteFile: vi.fn(),
  mockUnlink: vi.fn(),
  mockStat: vi.fn(),
  mockGetPath: vi.fn(() => '/tmp'),
  mockGlob: vi.fn(() => Promise.resolve([] as string[])),
}));

vi.mock('electron', () => ({
  app: {
    getPath: mockGetPath,
  },
}));

vi.mock('node:fs', () => ({
  default: {
    promises: {
      writeFile: mockWriteFile,
      unlink: mockUnlink,
      stat: mockStat,
    },
  },
  promises: {
    writeFile: mockWriteFile,
    unlink: mockUnlink,
    stat: mockStat,
  },
}));

vi.mock('glob', () => ({
  glob: mockGlob,
}));

import { AutoSaveManager } from '../auto-save';
import type { FileId } from '@shared/types/file';

// ============================================================================
// Helpers
// ============================================================================

function createFileId(id: string): FileId {
  return id as FileId;
}

// ============================================================================
// Tests
// ============================================================================

describe('AutoSaveManager', () => {
  let manager: AutoSaveManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    manager = new AutoSaveManager();
  });

  afterEach(() => {
    manager.stop();
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  describe('start/stop lifecycle', () => {
    it('should start the auto-save interval', () => {
      manager.start();

      // No immediate save occurs
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should be safe to call start multiple times', () => {
      manager.start();
      manager.start();
      manager.start();

      // Should not throw or create multiple intervals
      expect(true).toBe(true);
    });

    it('should stop the auto-save interval', () => {
      manager.start();
      manager.stop();

      // Register a dirty file and advance timer - should NOT trigger save
      manager.registerDirty(createFileId('f1'), '/path/to/file.mdx', 'Test', 'content');
      vi.advanceTimersByTime(35_000);

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should be safe to call stop without starting', () => {
      manager.stop();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should be safe to call stop multiple times', () => {
      manager.start();
      manager.stop();
      manager.stop();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // registerDirty / unregister
  // --------------------------------------------------------------------------

  describe('registerDirty', () => {
    it('should register a dirty file for auto-save', async () => {
      const fileId = createFileId('file-001');
      manager.registerDirty(fileId, '/original.mdx', 'My Doc', 'hello world');

      mockWriteFile.mockResolvedValue(undefined);
      await manager.saveDirty();

      expect(mockWriteFile).toHaveBeenCalledOnce();
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/tmp/mdxpad-autosave-file-001.mdx',
        'hello world',
        'utf-8'
      );
    });

    it('should update content when registering same file ID again', async () => {
      const fileId = createFileId('file-002');
      manager.registerDirty(fileId, '/original.mdx', 'My Doc', 'first version');
      manager.registerDirty(fileId, '/original.mdx', 'My Doc', 'second version');

      mockWriteFile.mockResolvedValue(undefined);
      await manager.saveDirty();

      expect(mockWriteFile).toHaveBeenCalledOnce();
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/tmp/mdxpad-autosave-file-002.mdx',
        'second version',
        'utf-8'
      );
    });

    it('should accept null originalPath for untitled files', async () => {
      const fileId = createFileId('file-003');
      manager.registerDirty(fileId, null, 'Untitled', 'content');

      mockWriteFile.mockResolvedValue(undefined);
      await manager.saveDirty();

      expect(mockWriteFile).toHaveBeenCalledOnce();
    });
  });

  describe('unregister', () => {
    it('should remove a file from auto-save tracking', async () => {
      const fileId = createFileId('file-004');
      manager.registerDirty(fileId, '/original.mdx', 'Doc', 'content');
      manager.unregister(fileId);

      await manager.saveDirty();

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should be safe to unregister a file that was not registered', () => {
      manager.unregister(createFileId('nonexistent'));
      // Should not throw
      expect(true).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // saveDirty
  // --------------------------------------------------------------------------

  describe('saveDirty', () => {
    it('should save all registered dirty files', async () => {
      const id1 = createFileId('a1');
      const id2 = createFileId('b2');
      manager.registerDirty(id1, '/path1.mdx', 'Doc1', 'content-a');
      manager.registerDirty(id2, '/path2.mdx', 'Doc2', 'content-b');

      mockWriteFile.mockResolvedValue(undefined);
      await manager.saveDirty();

      expect(mockWriteFile).toHaveBeenCalledTimes(2);
    });

    it('should not throw when no dirty files exist', async () => {
      await expect(manager.saveDirty()).resolves.toBeUndefined();
    });

    it('should continue saving other files when one fails', async () => {
      const id1 = createFileId('c1');
      const id2 = createFileId('c2');
      manager.registerDirty(id1, '/path1.mdx', 'Doc1', 'content-a');
      manager.registerDirty(id2, '/path2.mdx', 'Doc2', 'content-b');

      // First call fails, second succeeds
      mockWriteFile.mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(manager.saveDirty()).resolves.toBeUndefined();
      expect(mockWriteFile).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it('should be triggered by the interval timer', async () => {
      const fileId = createFileId('timer-test');
      manager.registerDirty(fileId, '/path.mdx', 'Doc', 'content');

      mockWriteFile.mockResolvedValue(undefined);
      manager.start();

      // Advance 30 seconds (AUTO_SAVE_INTERVAL) and flush microtasks
      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // findRecoverable
  // --------------------------------------------------------------------------

  describe('findRecoverable', () => {
    it('should return empty array when no recovery files exist', async () => {
      mockGlob.mockResolvedValue([]);

      const entries = await manager.findRecoverable();

      expect(entries).toEqual([]);
    });

    it('should discover recovery files and return sorted entries', async () => {
      mockGlob.mockResolvedValue([
        '/tmp/mdxpad-autosave-abc123.mdx',
        '/tmp/mdxpad-autosave-def456.mdx',
      ]);

      mockStat
        .mockResolvedValueOnce({ mtime: new Date('2026-01-01T10:00:00Z') })
        .mockResolvedValueOnce({ mtime: new Date('2026-01-02T10:00:00Z') });

      const entries = await manager.findRecoverable();

      expect(entries).toHaveLength(2);
      // Most recent first
      expect(entries[0]!.fileId).toBe('def456');
      expect(entries[1]!.fileId).toBe('abc123');
    });

    it('should skip files that cannot be stat-ed', async () => {
      mockGlob.mockResolvedValue(['/tmp/mdxpad-autosave-good.mdx', '/tmp/mdxpad-autosave-bad.mdx']);

      mockStat
        .mockResolvedValueOnce({ mtime: new Date('2026-01-01T10:00:00Z') })
        .mockRejectedValueOnce(new Error('ENOENT'));

      const entries = await manager.findRecoverable();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.fileId).toBe('good');
    });

    it('should set originalPath to null for recovery entries', async () => {
      mockGlob.mockResolvedValue(['/tmp/mdxpad-autosave-id1.mdx']);
      mockStat.mockResolvedValue({ mtime: new Date() });

      const entries = await manager.findRecoverable();

      expect(entries[0]!.originalPath).toBeNull();
    });

    it('should include display name with truncated file ID', async () => {
      mockGlob.mockResolvedValue(['/tmp/mdxpad-autosave-abcdefghij.mdx']);
      mockStat.mockResolvedValue({ mtime: new Date() });

      const entries = await manager.findRecoverable();

      expect(entries[0]!.displayName).toContain('Recovered:');
      expect(entries[0]!.displayName).toContain('abcdefgh');
    });
  });

  // --------------------------------------------------------------------------
  // cleanupEntry
  // --------------------------------------------------------------------------

  describe('cleanupEntry', () => {
    it('should delete the auto-save temp file', async () => {
      mockUnlink.mockResolvedValue(undefined);

      await manager.cleanupEntry(createFileId('cleanup-1'));

      expect(mockUnlink).toHaveBeenCalledWith('/tmp/mdxpad-autosave-cleanup-1.mdx');
    });

    it('should not throw when file is already deleted', async () => {
      mockUnlink.mockRejectedValue(new Error('ENOENT'));

      await expect(manager.cleanupEntry(createFileId('gone'))).resolves.toBeUndefined();
    });
  });
});
