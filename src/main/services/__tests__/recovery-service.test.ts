/**
 * RecoveryService Unit Tests
 *
 * Tests for the recovery service including manifest parsing,
 * restore logic, checksum validation, and retention cleanup.
 *
 * Per Constitution Article III.1: File I/O operations owned by main process.
 * Per Constitution Article VI.1: JSDoc with @param, @returns on all public APIs.
 *
 * @module tests/unit/recovery-service
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { createHash } from 'node:crypto';

// Mock electron before imports
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
}));

// Mock node:fs/promises
vi.mock('node:fs', () => {
  const mockPromises = {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    rename: vi.fn(),
    stat: vi.fn(),
  };
  return {
    default: { promises: mockPromises },
    promises: mockPromises,
  };
});

// Mock AutosaveSettingsService
vi.mock('../autosave-settings', () => ({
  AutosaveSettingsService: vi.fn().mockImplementation(() => ({
    getSettings: vi.fn(() => ({
      enabled: true,
      intervalMs: 30000,
      retentionDays: 30,
      maxFiles: 50,
      maxStorageMB: 100,
    })),
  })),
}));

// Mock AutosaveService
vi.mock('../autosave-service', () => ({
  AutosaveService: vi.fn().mockImplementation(() => ({
    deleteRecoveryFile: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Import after mocks are set up
import { promises as fs } from 'node:fs';
import { app } from 'electron';
import { RecoveryService } from '../recovery-service';
import { AutosaveSettingsService } from '../autosave-settings';
import type { AutosaveService } from '../autosave-service';
import type { DocumentId, RecoveryFile, RecoveryManifest } from '@shared/contracts/autosave-schemas';

// Type assertion helpers for mocks
const mockFs = {
  mkdir: fs.mkdir as Mock,
  readFile: fs.readFile as Mock,
  writeFile: fs.writeFile as Mock,
  unlink: fs.unlink as Mock,
  rename: fs.rename as Mock,
  stat: fs.stat as Mock,
};

const mockApp = app as unknown as { getPath: Mock };

/**
 * Helper to compute SHA-256 checksum
 */
function computeChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Helper to create a valid DocumentId
 */
function createDocumentId(uuid: string): DocumentId {
  return uuid as DocumentId;
}

/**
 * Helper to create a valid RecoveryFile
 */
function createRecoveryFile(
  documentId: string,
  content: string,
  overrides?: Partial<RecoveryFile>
): RecoveryFile {
  return {
    version: 1,
    documentId: createDocumentId(documentId),
    filePath: '/test/file.mdx',
    fileName: 'file.mdx',
    content,
    savedAt: Date.now(),
    checksum: computeChecksum(content),
    ...overrides,
  };
}

/**
 * Helper to create a valid RecoveryManifest
 */
function createManifest(
  entries: Record<string, { documentId: string; savedAt: number; fileName?: string; filePath?: string | null }>
): RecoveryManifest {
  const manifestEntries: RecoveryManifest['entries'] = {};
  for (const [id, entry] of Object.entries(entries)) {
    manifestEntries[id] = {
      documentId: createDocumentId(entry.documentId),
      filePath: entry.filePath ?? `/test/${entry.fileName ?? 'file.mdx'}`,
      fileName: entry.fileName ?? 'file.mdx',
      savedAt: entry.savedAt,
      recoveryFilePath: `${entry.documentId}.json`,
    };
  }
  return {
    version: 1,
    entries: manifestEntries,
  };
}

describe('RecoveryService', () => {
  let settingsService: AutosaveSettingsService;
  let recoveryService: RecoveryService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock behaviors
    mockApp.getPath.mockReturnValue('/mock/userData');
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.rename.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);

    // Create service instances
    settingsService = new AutosaveSettingsService();
    recoveryService = new RecoveryService(settingsService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Manifest Parsing Tests
  // ==========================================================================

  describe('manifest parsing', () => {
    it('should parse valid manifest', async () => {
      const validManifest = createManifest({
        'doc-1': {
          documentId: '123e4567-e89b-12d3-a456-426614174001',
          savedAt: Date.now(),
          fileName: 'test1.mdx',
        },
        'doc-2': {
          documentId: '123e4567-e89b-12d3-a456-426614174002',
          savedAt: Date.now() - 1000,
          fileName: 'test2.mdx',
        },
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify(validManifest));

      const result = await recoveryService.checkForRecovery();

      expect(result.hasRecoveryData).toBe(true);
      expect(result.count).toBe(2);
    });

    it('should handle missing manifest gracefully', async () => {
      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockFs.readFile.mockRejectedValue(enoentError);

      const result = await recoveryService.checkForRecovery();

      expect(result.hasRecoveryData).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should reject invalid manifest schema and return empty', async () => {
      // Invalid manifest - missing required fields
      const invalidManifest = {
        version: 1,
        entries: {
          'doc-1': {
            // Missing required fields: documentId, filePath, fileName, savedAt, recoveryFilePath
            badField: 'invalid',
          },
        },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidManifest));

      const result = await recoveryService.checkForRecovery();

      // Should return empty manifest on validation failure
      expect(result.hasRecoveryData).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should handle corrupted JSON manifest gracefully', async () => {
      mockFs.readFile.mockResolvedValue('{ invalid json }');

      const result = await recoveryService.checkForRecovery();

      expect(result.hasRecoveryData).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should handle manifest with wrong version gracefully', async () => {
      const wrongVersionManifest = {
        version: 99, // Invalid version
        entries: {},
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(wrongVersionManifest));

      const result = await recoveryService.checkForRecovery();

      expect(result.hasRecoveryData).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should return empty manifest when entries is null', async () => {
      const nullEntriesManifest = {
        version: 1,
        entries: null,
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(nullEntriesManifest));

      const result = await recoveryService.checkForRecovery();

      expect(result.hasRecoveryData).toBe(false);
      expect(result.count).toBe(0);
    });
  });

  // ==========================================================================
  // Checksum Validation Tests
  // ==========================================================================

  describe('checksum validation', () => {
    it('should accept valid checksum', () => {
      const content = '# Test MDX Content\n\nHello world!';
      const recoveryFile = createRecoveryFile(
        '123e4567-e89b-12d3-a456-426614174001',
        content
      );

      const isValid = recoveryService.validateChecksum(recoveryFile);

      expect(isValid).toBe(true);
    });

    it('should reject invalid checksum', () => {
      const content = '# Test MDX Content\n\nHello world!';
      // Valid length (64 chars) but wrong checksum
      const wrongChecksum = '0'.repeat(64);
      const recoveryFile = createRecoveryFile(
        '123e4567-e89b-12d3-a456-426614174001',
        content,
        { checksum: wrongChecksum }
      );

      const isValid = recoveryService.validateChecksum(recoveryFile);

      expect(isValid).toBe(false);
    });

    it('should reject tampered content with original checksum', () => {
      const originalContent = '# Original Content';
      const tamperedContent = '# Tampered Content';
      const originalChecksum = computeChecksum(originalContent);

      const recoveryFile = createRecoveryFile(
        '123e4567-e89b-12d3-a456-426614174001',
        tamperedContent,
        { checksum: originalChecksum }
      );

      const isValid = recoveryService.validateChecksum(recoveryFile);

      expect(isValid).toBe(false);
    });

    it('should handle empty content with valid checksum', () => {
      const content = '';
      const recoveryFile = createRecoveryFile(
        '123e4567-e89b-12d3-a456-426614174001',
        content
      );

      const isValid = recoveryService.validateChecksum(recoveryFile);

      expect(isValid).toBe(true);
    });

    it('should handle unicode content correctly', () => {
      const content = '# MDX\n\n\u6CE8\u91C8\u306E\u30C6\u30B9\u30C8 Test with special chars: \u00E9\u00E0\u00FC\u00F1';
      const recoveryFile = createRecoveryFile(
        '123e4567-e89b-12d3-a456-426614174001',
        content
      );

      const isValid = recoveryService.validateChecksum(recoveryFile);

      expect(isValid).toBe(true);
    });

    it('should reject checksum of wrong length', () => {
      const content = '# Test Content';
      const recoveryFile = createRecoveryFile(
        '123e4567-e89b-12d3-a456-426614174001',
        content,
        { checksum: 'abc123' } // Too short - SHA-256 should be 64 hex chars
      );

      const isValid = recoveryService.validateChecksum(recoveryFile);

      expect(isValid).toBe(false);
    });
  });

  // ==========================================================================
  // Restore Logic Tests
  // ==========================================================================

  describe('restore logic', () => {
    const docId = '123e4567-e89b-12d3-a456-426614174001';
    const docId2 = '123e4567-e89b-12d3-a456-426614174002';

    beforeEach(() => {
      // Set up manifest
      const manifest = createManifest({
        [docId]: {
          documentId: docId,
          savedAt: Date.now(),
          fileName: 'test.mdx',
        },
        [docId2]: {
          documentId: docId2,
          savedAt: Date.now() - 1000,
          fileName: 'test2.mdx',
        },
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith('manifest.json')) {
          return Promise.resolve(JSON.stringify(manifest));
        }
        if (filePath.includes(docId)) {
          const file = createRecoveryFile(docId, '# Test Content 1');
          return Promise.resolve(JSON.stringify(file));
        }
        if (filePath.includes(docId2)) {
          const file = createRecoveryFile(docId2, '# Test Content 2', {
            fileName: 'test2.mdx',
            filePath: '/test/test2.mdx',
          });
          return Promise.resolve(JSON.stringify(file));
        }
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });
    });

    it('should restore document from recovery file', async () => {
      const result = await recoveryService.restore({
        decision: {
          action: 'accept',
          selectedIds: [createDocumentId(docId)],
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.restored).toHaveLength(1);
        const firstRestored = result.restored[0];
        expect(firstRestored).toBeDefined();
        expect(firstRestored?.documentId).toBe(docId);
        expect(firstRestored?.content).toBe('# Test Content 1');
        expect(firstRestored?.fileName).toBe('file.mdx');
      }
    });

    it('should restore multiple selected documents', async () => {
      const result = await recoveryService.restore({
        decision: {
          action: 'accept',
          selectedIds: [createDocumentId(docId), createDocumentId(docId2)],
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.restored).toHaveLength(2);
      }
    });

    it('should handle missing recovery file gracefully', async () => {
      const missingDocId = '123e4567-e89b-12d3-a456-426614174099';

      const result = await recoveryService.restore({
        decision: {
          action: 'accept',
          selectedIds: [createDocumentId(missingDocId)],
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.restored).toHaveLength(0); // Missing file skipped
      }
    });

    it('should skip corrupted recovery files during restore', async () => {
      // Set up a corrupted file
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith('manifest.json')) {
          const manifest = createManifest({
            [docId]: {
              documentId: docId,
              savedAt: Date.now(),
              fileName: 'test.mdx',
            },
          });
          return Promise.resolve(JSON.stringify(manifest));
        }
        if (filePath.includes(docId)) {
          // Return file with valid length (64 chars) but wrong checksum
          const wrongChecksum = '0'.repeat(64);
          const file = createRecoveryFile(docId, '# Content', {
            checksum: wrongChecksum,
          });
          return Promise.resolve(JSON.stringify(file));
        }
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });

      const result = await recoveryService.restore({
        decision: {
          action: 'accept',
          selectedIds: [createDocumentId(docId)],
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.restored).toHaveLength(0); // Corrupted file skipped
      }
    });

    it('should discard all recovery data on decline action', async () => {
      const mockAutosaveService = {
        deleteRecoveryFile: vi.fn().mockResolvedValue(undefined),
      } as unknown as AutosaveService;

      const serviceWithAutosave = new RecoveryService(settingsService, mockAutosaveService);

      const result = await serviceWithAutosave.restore({
        decision: { action: 'decline' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.restored).toHaveLength(0);
      }
      expect(mockAutosaveService.deleteRecoveryFile).toHaveBeenCalled();
    });

    it('should preserve data on dismiss action', async () => {
      const result = await recoveryService.restore({
        decision: { action: 'dismiss' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.restored).toHaveLength(0);
      }
      // No files should be deleted
      expect(mockFs.unlink).not.toHaveBeenCalled();
    });

    it('should delete recovery file after successful restore', async () => {
      await recoveryService.restore({
        decision: {
          action: 'accept',
          selectedIds: [createDocumentId(docId)],
        },
      });

      // Should have tried to delete the recovery file
      expect(mockFs.unlink).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Preview Tests
  // ==========================================================================

  describe('getPreview', () => {
    const docId = '123e4567-e89b-12d3-a456-426614174001';

    it('should return content for valid recovery file', async () => {
      const content = '# Preview Test Content';
      const file = createRecoveryFile(docId, content);

      mockFs.readFile.mockResolvedValue(JSON.stringify(file));
      // No conflict - file doesn't exist
      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockFs.stat.mockRejectedValue(enoentError);

      const result = await recoveryService.getPreview(createDocumentId(docId));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.content).toBe(content);
        expect(result.conflict).toBeNull();
      }
    });

    it('should return NOT_FOUND error for missing file', async () => {
      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockFs.readFile.mockRejectedValue(enoentError);

      const result = await recoveryService.getPreview(createDocumentId(docId));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('NOT_FOUND');
      }
    });

    it('should return CORRUPTED error for invalid checksum', async () => {
      // Use valid length (64 chars) but wrong checksum
      const wrongChecksum = '0'.repeat(64);
      const file = createRecoveryFile(docId, '# Content', {
        checksum: wrongChecksum,
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify(file));

      const result = await recoveryService.getPreview(createDocumentId(docId));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('CORRUPTED');
      }
    });

    it('should detect conflict when disk file is newer', async () => {
      const savedAt = Date.now() - 60000; // 1 minute ago
      const diskModifiedAt = Date.now(); // Now

      const file = createRecoveryFile(docId, '# Recovery Content', {
        savedAt,
        filePath: '/test/conflict.mdx',
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes(docId)) {
          return Promise.resolve(JSON.stringify(file));
        }
        // Disk file content
        return Promise.resolve('# Disk Content');
      });

      mockFs.stat.mockResolvedValue({
        mtime: new Date(diskModifiedAt),
      });

      const result = await recoveryService.getPreview(createDocumentId(docId));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.conflict).not.toBeNull();
        expect(result.conflict?.diskContent).toBe('# Disk Content');
        expect(result.conflict?.recoveryContent).toBe('# Recovery Content');
      }
    });

    it('should not detect conflict for untitled documents', async () => {
      const file = createRecoveryFile(docId, '# Untitled Content', {
        filePath: null, // Untitled document
        fileName: 'Untitled',
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify(file));

      const result = await recoveryService.getPreview(createDocumentId(docId));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.conflict).toBeNull();
      }
    });
  });

  // ==========================================================================
  // List Recoverable Tests
  // ==========================================================================

  describe('listRecoverable', () => {
    it('should list all recoverable documents sorted by date', async () => {
      const now = Date.now();
      const docId1 = '123e4567-e89b-12d3-a456-426614174001';
      const docId2 = '123e4567-e89b-12d3-a456-426614174002';

      const manifest = createManifest({
        [docId1]: { documentId: docId1, savedAt: now - 5000, fileName: 'older.mdx' },
        [docId2]: { documentId: docId2, savedAt: now, fileName: 'newer.mdx' },
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith('manifest.json')) {
          return Promise.resolve(JSON.stringify(manifest));
        }
        if (filePath.includes(docId1)) {
          const file = createRecoveryFile(docId1, '# Older', {
            savedAt: now - 5000,
            fileName: 'older.mdx',
          });
          return Promise.resolve(JSON.stringify(file));
        }
        if (filePath.includes(docId2)) {
          const file = createRecoveryFile(docId2, '# Newer', {
            savedAt: now,
            fileName: 'newer.mdx',
          });
          return Promise.resolve(JSON.stringify(file));
        }
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });

      // No conflicts
      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockFs.stat.mockRejectedValue(enoentError);

      const result = await recoveryService.listRecoverable();

      expect(result.entries).toHaveLength(2);
      // Should be sorted by most recent first
      const firstEntry = result.entries[0];
      const secondEntry = result.entries[1];
      expect(firstEntry).toBeDefined();
      expect(secondEntry).toBeDefined();
      expect(firstEntry?.fileName).toBe('newer.mdx');
      expect(secondEntry?.fileName).toBe('older.mdx');
    });

    it('should mark invalid files in dialog entries', async () => {
      const docId = '123e4567-e89b-12d3-a456-426614174001';

      const manifest = createManifest({
        [docId]: { documentId: docId, savedAt: Date.now(), fileName: 'corrupt.mdx' },
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith('manifest.json')) {
          return Promise.resolve(JSON.stringify(manifest));
        }
        // Return file with valid length (64 chars) but wrong checksum
        const wrongChecksum = '0'.repeat(64);
        const file = createRecoveryFile(docId, '# Content', {
          checksum: wrongChecksum,
          fileName: 'corrupt.mdx',
        });
        return Promise.resolve(JSON.stringify(file));
      });

      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockFs.stat.mockRejectedValue(enoentError);

      const result = await recoveryService.listRecoverable();

      expect(result.entries).toHaveLength(1);
      const entry = result.entries[0];
      expect(entry).toBeDefined();
      expect(entry?.isValid).toBe(false);
    });

    it('should include content preview', async () => {
      const docId = '123e4567-e89b-12d3-a456-426614174001';
      const longContent = '# Title\n\n' + 'A'.repeat(200);

      const manifest = createManifest({
        [docId]: { documentId: docId, savedAt: Date.now() },
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith('manifest.json')) {
          return Promise.resolve(JSON.stringify(manifest));
        }
        const file = createRecoveryFile(docId, longContent);
        return Promise.resolve(JSON.stringify(file));
      });

      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockFs.stat.mockRejectedValue(enoentError);

      const result = await recoveryService.listRecoverable();

      expect(result.entries).toHaveLength(1);
      // Preview should be truncated to 100 chars
      const previewEntry = result.entries[0];
      expect(previewEntry).toBeDefined();
      expect(previewEntry?.contentPreview.length).toBe(100);
    });

    it('should return empty array when manifest read fails', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Read error'));

      const result = await recoveryService.listRecoverable();

      expect(result.entries).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Discard Recovery Tests
  // ==========================================================================

  describe('discardRecovery', () => {
    it('should delete specified recovery files', async () => {
      const docId = '123e4567-e89b-12d3-a456-426614174001';

      const manifest = createManifest({
        [docId]: { documentId: docId, savedAt: Date.now() },
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify(manifest));

      const result = await recoveryService.discardRecovery([createDocumentId(docId)]);

      expect(result.discardedCount).toBe(1);
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it('should continue on error and count successful discards', async () => {
      const docId1 = '123e4567-e89b-12d3-a456-426614174001';
      const docId2 = '123e4567-e89b-12d3-a456-426614174002';

      const manifest = createManifest({
        [docId1]: { documentId: docId1, savedAt: Date.now() },
        [docId2]: { documentId: docId2, savedAt: Date.now() },
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify(manifest));

      // First unlink succeeds, second fails
      let unlinkCallCount = 0;
      mockFs.unlink.mockImplementation(() => {
        unlinkCallCount++;
        if (unlinkCallCount === 2) {
          return Promise.reject(new Error('Delete failed'));
        }
        return Promise.resolve(undefined);
      });

      const result = await recoveryService.discardRecovery([
        createDocumentId(docId1),
        createDocumentId(docId2),
      ]);

      // Should have discarded at least 1
      expect(result.discardedCount).toBeGreaterThanOrEqual(1);
    });

    it('should ignore ENOENT errors when file already deleted', async () => {
      const docId = '123e4567-e89b-12d3-a456-426614174001';

      const manifest = createManifest({
        [docId]: { documentId: docId, savedAt: Date.now() },
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify(manifest));

      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockFs.unlink.mockRejectedValue(enoentError);

      const result = await recoveryService.discardRecovery([createDocumentId(docId)]);

      // Should still count as success (file doesn't exist = effectively discarded)
      expect(result.discardedCount).toBe(1);
    });
  });

  // ==========================================================================
  // Retention Cleanup Tests
  // ==========================================================================

  describe('retention cleanup', () => {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    /**
     * Creates a recovery service with properly mocked settings service for retention tests.
     */
    function createServiceWithSettings(settings: {
      retentionDays: number;
      maxFiles: number;
    }): RecoveryService {
      const mockSettings = {
        getSettings: vi.fn().mockReturnValue({
          enabled: true,
          intervalMs: 30000,
          retentionDays: settings.retentionDays,
          maxFiles: settings.maxFiles,
          maxStorageMB: 100,
        }),
      } as unknown as AutosaveSettingsService;
      return new RecoveryService(mockSettings);
    }

    it('should delete files older than retention period', async () => {
      const oldDocId = '123e4567-e89b-12d3-a456-426614174001';
      const newDocId = '123e4567-e89b-12d3-a456-426614174002';

      const service = createServiceWithSettings({ retentionDays: 30, maxFiles: 50 });

      // Create manifest with old and new entries
      const currentManifest = createManifest({
        [oldDocId]: {
          documentId: oldDocId,
          savedAt: now - 31 * msPerDay, // 31 days old (> 30 day retention)
          fileName: 'old.mdx',
        },
        [newDocId]: {
          documentId: newDocId,
          savedAt: now - 1 * msPerDay, // 1 day old
          fileName: 'new.mdx',
        },
      });

      // Track deleted IDs and update manifest accordingly
      const deletedIds: string[] = [];

      mockFs.readFile.mockImplementation(() => {
        return Promise.resolve(JSON.stringify(currentManifest));
      });

      mockFs.unlink.mockImplementation((filePath: string) => {
        const match = /([0-9a-f-]+)\.json$/.exec((filePath));
        if (match) {
          deletedIds.push(match[1] ?? '');
        }
        return Promise.resolve(undefined);
      });

      await service.runRetentionCleanup();

      // Should have identified the old file for deletion
      expect(deletedIds).toContain(oldDocId);
      expect(deletedIds).not.toContain(newDocId);
    });

    it('should respect max files limit', async () => {
      const service = createServiceWithSettings({ retentionDays: 30, maxFiles: 50 });

      // Create manifest with more than maxFiles entries (but all recent)
      const entries: Record<string, { documentId: string; savedAt: number; fileName: string }> = {};
      for (let i = 0; i < 55; i++) {
        const docId = `123e4567-e89b-12d3-a456-4266141740${i.toString().padStart(2, '0')}`;
        entries[docId] = {
          documentId: docId,
          savedAt: now - i * 1000, // Each 1 second older (but still within retention)
          fileName: `file${i}.mdx`,
        };
      }

      const manifest = createManifest(entries);
      const deletedIds: string[] = [];

      mockFs.readFile.mockImplementation(() => {
        return Promise.resolve(JSON.stringify(manifest));
      });

      mockFs.unlink.mockImplementation((filePath: string) => {
        const match = /([0-9a-f-]+)\.json$/.exec((filePath));
        if (match) {
          deletedIds.push(match[1] ?? '');
        }
        return Promise.resolve(undefined);
      });

      await service.runRetentionCleanup();

      // Should have deleted at least 5 files (55 - 50 max)
      expect(deletedIds.length).toBeGreaterThanOrEqual(5);
    });

    it('should delete oldest files when over max files limit', async () => {
      // Create a service with low max files
      const service = createServiceWithSettings({ retentionDays: 30, maxFiles: 3 });

      const entries: Record<string, { documentId: string; savedAt: number; fileName: string }> = {};
      const docIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const docId = `123e4567-e89b-12d3-a456-4266141740${i.toString().padStart(2, '0')}`;
        docIds.push(docId);
        entries[docId] = {
          documentId: docId,
          savedAt: now - i * 1000, // Each 1 second older (index 4 is oldest)
          fileName: `file${i}.mdx`,
        };
      }

      const manifest = createManifest(entries);
      const deletedIds: string[] = [];

      mockFs.readFile.mockImplementation(() => {
        return Promise.resolve(JSON.stringify(manifest));
      });

      mockFs.unlink.mockImplementation((filePath: string) => {
        const match = /([0-9a-f-]+)\.json$/.exec((filePath));
        if (match) {
          deletedIds.push(match[1] ?? '');
        }
        return Promise.resolve(undefined);
      });

      await service.runRetentionCleanup();

      // Should have deleted 2 files (5 - 3 max)
      expect(deletedIds.length).toBeGreaterThanOrEqual(2);

      // Should have deleted the oldest files (docIds[4] and docIds[3])
      expect(deletedIds).toContain(docIds[4]);
      expect(deletedIds).toContain(docIds[3]);
    });

    it('should handle cleanup errors gracefully', async () => {
      const docId = '123e4567-e89b-12d3-a456-426614174001';

      const service = createServiceWithSettings({ retentionDays: 30, maxFiles: 50 });

      const manifest = createManifest({
        [docId]: {
          documentId: docId,
          savedAt: now - 31 * msPerDay, // Should be deleted
          fileName: 'old.mdx',
        },
      });

      mockFs.readFile.mockImplementation(() => {
        return Promise.resolve(JSON.stringify(manifest));
      });

      mockFs.unlink.mockRejectedValue(new Error('Delete failed'));

      // Should not throw
      await expect(service.runRetentionCleanup()).resolves.not.toThrow();
    });

    it('should not delete any files when under limits', async () => {
      const docId = '123e4567-e89b-12d3-a456-426614174001';

      const service = createServiceWithSettings({ retentionDays: 30, maxFiles: 50 });

      const manifest = createManifest({
        [docId]: {
          documentId: docId,
          savedAt: now - 1 * msPerDay, // 1 day old (< 30 day retention)
          fileName: 'recent.mdx',
        },
      });

      const deletedIds: string[] = [];

      mockFs.readFile.mockImplementation(() => {
        return Promise.resolve(JSON.stringify(manifest));
      });

      mockFs.unlink.mockImplementation((filePath: string) => {
        const match = /([0-9a-f-]+)\.json$/.exec((filePath));
        if (match) {
          deletedIds.push(match[1] ?? '');
        }
        return Promise.resolve(undefined);
      });

      await service.runRetentionCleanup();

      // Should not have deleted any files
      expect(deletedIds.length).toBe(0);
    });

    it('should handle empty manifest', async () => {
      const emptyManifest: RecoveryManifest = {
        version: 1,
        entries: {},
      };

      const service = createServiceWithSettings({ retentionDays: 30, maxFiles: 50 });

      const deletedIds: string[] = [];

      mockFs.readFile.mockImplementation(() => {
        return Promise.resolve(JSON.stringify(emptyManifest));
      });

      mockFs.unlink.mockImplementation((filePath: string) => {
        const match = /([0-9a-f-]+)\.json$/.exec((filePath));
        if (match) {
          deletedIds.push(match[1] ?? '');
        }
        return Promise.resolve(undefined);
      });

      await service.runRetentionCleanup();

      expect(deletedIds.length).toBe(0);
    });
  });

  // ==========================================================================
  // Integration with AutosaveService
  // ==========================================================================

  describe('integration with AutosaveService', () => {
    it('should delegate deletion to AutosaveService when provided', async () => {
      const docId = '123e4567-e89b-12d3-a456-426614174001';
      const mockAutosaveService = {
        deleteRecoveryFile: vi.fn().mockResolvedValue(undefined),
      } as unknown as AutosaveService;

      const serviceWithAutosave = new RecoveryService(settingsService, mockAutosaveService);

      const manifest = createManifest({
        [docId]: { documentId: docId, savedAt: Date.now() },
      });

      const file = createRecoveryFile(docId, '# Content');

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith('manifest.json')) {
          return Promise.resolve(JSON.stringify(manifest));
        }
        return Promise.resolve(JSON.stringify(file));
      });

      await serviceWithAutosave.restore({
        decision: {
          action: 'accept',
          selectedIds: [createDocumentId(docId)],
        },
      });

      expect(mockAutosaveService.deleteRecoveryFile).toHaveBeenCalledWith(
        createDocumentId(docId)
      );
    });

    it('should handle deletion independently when AutosaveService not provided', async () => {
      const docId = '123e4567-e89b-12d3-a456-426614174001';
      // recoveryService created without AutosaveService

      const manifest = createManifest({
        [docId]: { documentId: docId, savedAt: Date.now() },
      });

      const file = createRecoveryFile(docId, '# Content');

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith('manifest.json')) {
          return Promise.resolve(JSON.stringify(manifest));
        }
        return Promise.resolve(JSON.stringify(file));
      });

      await recoveryService.restore({
        decision: {
          action: 'accept',
          selectedIds: [createDocumentId(docId)],
        },
      });

      // Should have called fs.unlink directly
      expect(mockFs.unlink).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Recovery Directory Path Tests
  // ==========================================================================

  describe('recovery directory path', () => {
    it('should use correct recovery directory under userData', async () => {
      mockApp.getPath.mockReturnValue('/custom/userData');

      const docId = '123e4567-e89b-12d3-a456-426614174001';
      const manifest = createManifest({
        [docId]: { documentId: docId, savedAt: Date.now() },
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify(manifest));

      await recoveryService.checkForRecovery();

      // Should have read from the correct path
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('/custom/userData/recovery/manifest.json'),
        'utf-8'
      );
    });

    it('should create recovery directory if it does not exist', async () => {
      // First call fails (directory doesn't exist)
      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockFs.readFile.mockRejectedValue(enoentError);

      await recoveryService.checkForRecovery();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('recovery'),
        { recursive: true }
      );
    });
  });
});
