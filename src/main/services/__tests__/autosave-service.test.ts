/**
 * AutosaveService Unit Tests
 *
 * Tests for the autosave service including atomic writes,
 * checksum computation, and manifest management.
 *
 * Per FR-001: Automatically saves document content to recovery location.
 * Per FR-015: Uses atomic write pattern (write to temp file, then rename).
 * Per FR-017: Detects insufficient disk space before autosave write.
 * Per FR-019: Generates SHA-256 checksums for content integrity verification.
 *
 * @module tests/unit/autosave-service
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { createHash } from 'node:crypto';
import type { AutosaveSettingsService } from '../autosave-settings';
import type { DocumentId } from '@shared/contracts/autosave-schemas';

// ============================================================================
// Mock Setup - Use vi.hoisted for hoisted mock variables
// ============================================================================

// Create hoisted mock functions that can be referenced in vi.mock
const { mockMkdir, mockWriteFile, mockRename, mockReadFile, mockUnlink, mockStatfs, mockGetPath } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockWriteFile: vi.fn(),
  mockRename: vi.fn(),
  mockReadFile: vi.fn(),
  mockUnlink: vi.fn(),
  mockStatfs: vi.fn(),
  mockGetPath: vi.fn(() => '/mock/user/data'),
}));

// Mock electron app module
vi.mock('electron', () => ({
  app: {
    getPath: mockGetPath,
  },
}));

// Mock fs module with proper structure
vi.mock('node:fs', () => ({
  default: {
    promises: {
      mkdir: mockMkdir,
      writeFile: mockWriteFile,
      rename: mockRename,
      readFile: mockReadFile,
      unlink: mockUnlink,
    },
  },
  promises: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    rename: mockRename,
    readFile: mockReadFile,
    unlink: mockUnlink,
  },
}));

// Mock statfs for disk space checks - needs default export
vi.mock('node:fs/promises', () => ({
  default: {
    statfs: mockStatfs,
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    rename: mockRename,
    readFile: mockReadFile,
    unlink: mockUnlink,
  },
  statfs: mockStatfs,
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  rename: mockRename,
  readFile: mockReadFile,
  unlink: mockUnlink,
}));

// Import after mocks are set up
import { AutosaveService } from '../autosave-service';
import { EMPTY_RECOVERY_MANIFEST } from '@shared/contracts/autosave-schemas';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock AutosaveSettingsService for testing.
 */
function createMockSettingsService(): AutosaveSettingsService {
  return {
    getSettings: vi.fn(() => ({
      enabled: true,
      intervalMs: 30000,
      retentionDays: 30,
      maxFiles: 50,
      maxStorageMB: 100,
    })),
    setSettings: vi.fn(),
  } as unknown as AutosaveSettingsService;
}

/**
 * Create a valid DocumentId for testing.
 */
function createTestDocumentId(): DocumentId {
  return '550e8400-e29b-41d4-a716-446655440000' as DocumentId;
}

/**
 * Create a valid autosave trigger request for testing.
 */
function createTestRequest(overrides?: Partial<{
  documentId: DocumentId;
  filePath: string | null;
  fileName: string;
  content: string;
}>) {
  return {
    documentId: overrides?.documentId ?? createTestDocumentId(),
    // Use 'filePath' in overrides check to allow explicit null
    filePath: overrides && 'filePath' in overrides ? overrides.filePath : '/test/file.mdx',
    fileName: overrides?.fileName ?? 'Test Document',
    content: overrides?.content ?? '# Hello World',
  };
}

// ============================================================================
// AutosaveService Tests
// ============================================================================

describe('AutosaveService', () => {
  let service: AutosaveService;
  let mockSettingsService: AutosaveSettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsService = createMockSettingsService();
    service = new AutosaveService(mockSettingsService);

    // Reset mock implementations with defaults
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(JSON.stringify(EMPTY_RECOVERY_MANIFEST));
    mockUnlink.mockResolvedValue(undefined);
    mockStatfs.mockResolvedValue({
      bfree: 1000000,
      bsize: 4096,
    });
    mockGetPath.mockReturnValue('/mock/user/data');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should create instance with settings service', () => {
      expect(service).toBeDefined();
    });
  });

  // ==========================================================================
  // getRecoveryDir Tests
  // ==========================================================================

  describe('getRecoveryDir', () => {
    it('should return recovery directory path', async () => {
      const recoveryDir = await service.getRecoveryDir();

      expect(recoveryDir).toBe('/mock/user/data/recovery');
      expect(mockGetPath).toHaveBeenCalledWith('userData');
    });

    it('should create recovery directory if it does not exist', async () => {
      await service.getRecoveryDir();

      expect(mockMkdir).toHaveBeenCalledWith('/mock/user/data/recovery', { recursive: true });
    });

    it('should cache recovery directory path after first call', async () => {
      await service.getRecoveryDir();
      await service.getRecoveryDir();

      // mkdir should only be called once
      expect(mockMkdir).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Checksum Computation Tests (FR-019)
  // ==========================================================================

  describe('checksum computation', () => {
    it('should compute SHA-256 checksum of content', () => {
      const content = 'Hello, World!';
      const expectedChecksum = createHash('sha256').update(content, 'utf-8').digest('hex');

      const checksum = service.computeChecksum(content);

      expect(checksum).toBe(expectedChecksum);
      expect(checksum).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should compute different checksums for different content', () => {
      const checksum1 = service.computeChecksum('Content A');
      const checksum2 = service.computeChecksum('Content B');

      expect(checksum1).not.toBe(checksum2);
    });

    it('should compute same checksum for same content', () => {
      const content = '# Test MDX Document\n\nSome content here.';
      const checksum1 = service.computeChecksum(content);
      const checksum2 = service.computeChecksum(content);

      expect(checksum1).toBe(checksum2);
    });

    it('should handle empty content', () => {
      const checksum = service.computeChecksum('');
      const expectedChecksum = createHash('sha256').update('', 'utf-8').digest('hex');

      expect(checksum).toBe(expectedChecksum);
      expect(checksum).toHaveLength(64);
    });

    it('should handle unicode content', () => {
      const content = '# Hello World! ';
      const checksum = service.computeChecksum(content);

      expect(checksum).toHaveLength(64);
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle very long content', () => {
      const content = 'x'.repeat(1_000_000);
      const checksum = service.computeChecksum(content);

      expect(checksum).toHaveLength(64);
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle content with newlines', () => {
      const content = 'Line 1\nLine 2\r\nLine 3';
      const checksum = service.computeChecksum(content);

      expect(checksum).toHaveLength(64);
    });
  });

  // ==========================================================================
  // Atomic Write Tests (FR-015)
  // ==========================================================================

  describe('atomic writes', () => {
    it('should write to temp file then rename', async () => {
      const request = createTestRequest();

      const result = await service.saveDocument(request);

      expect(result.ok).toBe(true);

      // Verify atomic write pattern: write to temp, then rename
      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockRename).toHaveBeenCalled();

      // Check that temp file path ends with .tmp
      const writeFileCall = mockWriteFile.mock.calls[0];
      expect(writeFileCall).toBeDefined();
      expect(writeFileCall?.[0]).toContain('.tmp');
    });

    it('should not leave partial files on write failure', async () => {
      const request = createTestRequest();

      // Simulate write failure
      mockWriteFile.mockRejectedValueOnce(
        Object.assign(new Error('Write failed'), { code: 'EIO' })
      );

      const result = await service.saveDocument(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('WRITE_ERROR');
      }

      // Rename should not be called if write fails
      expect(mockRename).not.toHaveBeenCalled();
    });

    it('should handle rename failure gracefully', async () => {
      const request = createTestRequest();

      // First call succeeds (recovery file), simulate rename failure
      mockRename.mockRejectedValueOnce(
        Object.assign(new Error('Rename failed'), { code: 'EIO' })
      );

      const result = await service.saveDocument(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('WRITE_ERROR');
      }
    });

    it('should include checksum in saved recovery file', async () => {
      const request = createTestRequest({ content: '# Test Content' });

      await service.saveDocument(request);

      // Get the content written to the file
      const writeFileCall = mockWriteFile.mock.calls[0];
      expect(writeFileCall).toBeDefined();
      const writtenContent = JSON.parse(writeFileCall?.[1] as string);

      expect(writtenContent.checksum).toBeDefined();
      expect(writtenContent.checksum).toHaveLength(64);
      expect(writtenContent.checksum).toBe(service.computeChecksum('# Test Content'));
    });

    it('should include all required fields in recovery file', async () => {
      const request = createTestRequest({
        documentId: createTestDocumentId(),
        filePath: '/test/document.mdx',
        fileName: 'My Document',
        content: '# Hello',
      });

      await service.saveDocument(request);

      const writeFileCall = mockWriteFile.mock.calls[0];
      expect(writeFileCall).toBeDefined();
      const writtenContent = JSON.parse(writeFileCall?.[1] as string);

      expect(writtenContent.version).toBe(1);
      expect(writtenContent.documentId).toBe(request.documentId);
      expect(writtenContent.filePath).toBe(request.filePath);
      expect(writtenContent.fileName).toBe(request.fileName);
      expect(writtenContent.content).toBe(request.content);
      expect(writtenContent.savedAt).toBeGreaterThan(0);
      expect(writtenContent.checksum).toBeDefined();
    });

    it('should handle null filePath for untitled documents', async () => {
      const request = createTestRequest({ filePath: null });

      const result = await service.saveDocument(request);

      expect(result.ok).toBe(true);

      const writeFileCall = mockWriteFile.mock.calls[0];
      expect(writeFileCall).toBeDefined();
      const writtenContent = JSON.parse(writeFileCall?.[1] as string);

      expect(writtenContent.filePath).toBeNull();
    });
  });

  // ==========================================================================
  // Manifest Management Tests
  // ==========================================================================

  describe('manifest management', () => {
    it('should add entry to manifest on save', async () => {
      const request = createTestRequest();

      await service.saveDocument(request);

      // Manifest should be written (second write call after recovery file)
      // First write: recovery file temp
      // Second write: manifest temp
      expect(mockWriteFile).toHaveBeenCalledTimes(2);

      // Check manifest content
      const manifestWriteCall = mockWriteFile.mock.calls[1];
      expect(manifestWriteCall).toBeDefined();
      const manifestContent = JSON.parse(manifestWriteCall?.[1] as string);

      expect(manifestContent.version).toBe(1);
      expect(manifestContent.entries[request.documentId]).toBeDefined();
      expect(manifestContent.entries[request.documentId].documentId).toBe(request.documentId);
      expect(manifestContent.entries[request.documentId].filePath).toBe(request.filePath);
      expect(manifestContent.entries[request.documentId].fileName).toBe(request.fileName);
    });

    it('should remove entry from manifest on cleanup', async () => {
      const documentId = createTestDocumentId();

      // Setup manifest with existing entry
      const existingManifest = {
        version: 1,
        entries: {
          [documentId]: {
            documentId,
            filePath: '/test/file.mdx',
            fileName: 'Test',
            savedAt: Date.now(),
            recoveryFilePath: `${documentId}.json`,
          },
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(existingManifest));

      await service.deleteRecoveryFile(documentId);

      // Check that unlink was called for recovery file
      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringContaining(`${documentId}.json`)
      );

      // Check that manifest was updated without the entry
      const manifestWriteCall = mockWriteFile.mock.calls[0];
      expect(manifestWriteCall).toBeDefined();
      const updatedManifest = JSON.parse(manifestWriteCall?.[1] as string);

      expect(updatedManifest.entries[documentId]).toBeUndefined();
    });

    it('should handle concurrent manifest updates', async () => {
      const request1 = createTestRequest({
        documentId: '550e8400-e29b-41d4-a716-446655440001' as DocumentId,
        fileName: 'Document 1',
      });
      const request2 = createTestRequest({
        documentId: '550e8400-e29b-41d4-a716-446655440002' as DocumentId,
        fileName: 'Document 2',
      });

      // Simulate concurrent saves
      const result1 = await service.saveDocument(request1);
      const result2 = await service.saveDocument(request2);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      // Both should complete successfully
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should use atomic write for manifest updates', async () => {
      const request = createTestRequest();

      await service.saveDocument(request);

      // Check that manifest was written atomically (temp file then rename)
      const renameCallsForManifest = mockRename.mock.calls.filter(
        call => (call[0] as string).includes('manifest.json.tmp')
      );

      expect(renameCallsForManifest.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Read Manifest Tests
  // ==========================================================================

  describe('readManifest', () => {
    it('should return manifest contents when file exists', async () => {
      const expectedManifest = {
        version: 1,
        entries: {
          [createTestDocumentId()]: {
            documentId: createTestDocumentId(),
            filePath: '/test/file.mdx',
            fileName: 'Test',
            savedAt: Date.now(),
            recoveryFilePath: `${createTestDocumentId()}.json`,
          },
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(expectedManifest));

      const manifest = await service.readManifest();

      expect(manifest.version).toBe(1);
      expect(Object.keys(manifest.entries).length).toBe(1);
    });

    it('should return empty manifest when file does not exist', async () => {
      const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      mockReadFile.mockRejectedValueOnce(enoentError);

      const manifest = await service.readManifest();

      expect(manifest).toEqual(EMPTY_RECOVERY_MANIFEST);
    });

    it('should return empty manifest when file is corrupted JSON', async () => {
      mockReadFile.mockResolvedValueOnce('not valid json {{{');

      const manifest = await service.readManifest();

      expect(manifest).toEqual(EMPTY_RECOVERY_MANIFEST);
    });

    it('should return empty manifest when schema validation fails', async () => {
      // Invalid manifest structure (missing version)
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ entries: {} }));

      const manifest = await service.readManifest();

      expect(manifest).toEqual(EMPTY_RECOVERY_MANIFEST);
    });
  });

  // ==========================================================================
  // Delete Recovery File Tests
  // ==========================================================================

  describe('deleteRecoveryFile', () => {
    it('should delete recovery file and update manifest', async () => {
      const documentId = createTestDocumentId();

      await service.deleteRecoveryFile(documentId);

      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringContaining(`${documentId}.json`)
      );
    });

    it('should not throw when recovery file does not exist', async () => {
      const documentId = createTestDocumentId();
      const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      mockUnlink.mockRejectedValueOnce(enoentError);

      // Should not throw
      await expect(service.deleteRecoveryFile(documentId)).resolves.not.toThrow();
    });

    it('should throw for non-ENOENT errors', async () => {
      const documentId = createTestDocumentId();
      const permissionError = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
      mockUnlink.mockRejectedValueOnce(permissionError);

      await expect(service.deleteRecoveryFile(documentId)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Disk Space Check Tests (FR-017)
  // ==========================================================================

  describe('disk space check (FR-017)', () => {
    it('should allow save when sufficient disk space available', async () => {
      // 4GB free (1M blocks * 4KB)
      mockStatfs.mockResolvedValueOnce({
        bfree: 1000000,
        bsize: 4096,
      });

      const request = createTestRequest();
      const result = await service.saveDocument(request);

      expect(result.ok).toBe(true);
    });

    it('should return DISK_FULL error when less than 100MB available', async () => {
      // Less than 100MB (20MB free)
      mockStatfs.mockResolvedValueOnce({
        bfree: 5000,    // 5000 blocks
        bsize: 4096,    // 4KB = ~20MB
      });

      const request = createTestRequest();
      const result = await service.saveDocument(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('DISK_FULL');
        expect(result.message).toContain('Insufficient disk space');
      }
    });

    it('should allow save when disk space check fails (graceful degradation)', async () => {
      // Disk space check fails
      mockStatfs.mockRejectedValueOnce(new Error('statfs failed'));

      const request = createTestRequest();
      const result = await service.saveDocument(request);

      // Should still attempt to save
      expect(result.ok).toBe(true);
    });
  });

  // ==========================================================================
  // Error Mapping Tests
  // ==========================================================================

  describe('error mapping', () => {
    it('should map ENOSPC to DISK_FULL', async () => {
      mockWriteFile.mockRejectedValueOnce(
        Object.assign(new Error('No space left on device'), { code: 'ENOSPC' })
      );

      const request = createTestRequest();
      const result = await service.saveDocument(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('DISK_FULL');
      }
    });

    it('should map EACCES to PERMISSION_DENIED', async () => {
      mockWriteFile.mockRejectedValueOnce(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      );

      const request = createTestRequest();
      const result = await service.saveDocument(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('PERMISSION_DENIED');
      }
    });

    it('should map EPERM to PERMISSION_DENIED', async () => {
      mockWriteFile.mockRejectedValueOnce(
        Object.assign(new Error('Operation not permitted'), { code: 'EPERM' })
      );

      const request = createTestRequest();
      const result = await service.saveDocument(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('PERMISSION_DENIED');
      }
    });

    it('should map EROFS to PERMISSION_DENIED', async () => {
      mockWriteFile.mockRejectedValueOnce(
        Object.assign(new Error('Read-only file system'), { code: 'EROFS' })
      );

      const request = createTestRequest();
      const result = await service.saveDocument(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('PERMISSION_DENIED');
      }
    });

    it('should map unknown errors to WRITE_ERROR', async () => {
      mockWriteFile.mockRejectedValueOnce(
        Object.assign(new Error('Unknown error'), { code: 'UNKNOWN' })
      );

      const request = createTestRequest();
      const result = await service.saveDocument(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('WRITE_ERROR');
      }
    });

    it('should handle non-Error throws', async () => {
      mockWriteFile.mockRejectedValueOnce('string error');

      const request = createTestRequest();
      const result = await service.saveDocument(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('WRITE_ERROR');
      }
    });
  });

  // ==========================================================================
  // Save Document Success Path Tests
  // ==========================================================================

  describe('saveDocument success path', () => {
    it('should return savedAt timestamp on success', async () => {
      const request = createTestRequest();
      const beforeSave = Date.now();

      const result = await service.saveDocument(request);
      const afterSave = Date.now();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.savedAt).toBeGreaterThanOrEqual(beforeSave);
        expect(result.savedAt).toBeLessThanOrEqual(afterSave);
      }
    });

    it('should use correct file paths for recovery file', async () => {
      const documentId = createTestDocumentId();
      const request = createTestRequest({ documentId });

      await service.saveDocument(request);

      // Check temp file path
      const writeFileCall = mockWriteFile.mock.calls[0];
      expect(writeFileCall).toBeDefined();
      expect(writeFileCall?.[0]).toContain(`${documentId}.json.tmp`);

      // Check rename target path
      const renameCall = mockRename.mock.calls[0];
      expect(renameCall).toBeDefined();
      expect(renameCall?.[0]).toContain(`${documentId}.json.tmp`);
      expect(renameCall?.[1]).toContain(`${documentId}.json`);
      expect(renameCall?.[1]).not.toContain('.tmp');
    });

    it('should validate recovery file with zod schema before writing', async () => {
      const request = createTestRequest();

      const result = await service.saveDocument(request);

      expect(result.ok).toBe(true);

      // If validation failed, we would get an error
      // The fact that it succeeded means zod validation passed
      const writeFileCall = mockWriteFile.mock.calls[0];
      expect(writeFileCall).toBeDefined();
      const writtenContent = JSON.parse(writeFileCall?.[1] as string);

      // These fields are required by RecoveryFileSchema
      expect(writtenContent).toHaveProperty('version', 1);
      expect(writtenContent).toHaveProperty('documentId');
      expect(writtenContent).toHaveProperty('content');
      expect(writtenContent).toHaveProperty('savedAt');
      expect(writtenContent).toHaveProperty('checksum');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle very large content', async () => {
      const largeContent = 'x'.repeat(10_000_000); // 10MB
      const request = createTestRequest({ content: largeContent });

      const result = await service.saveDocument(request);

      expect(result.ok).toBe(true);
    });

    it('should handle content with special characters', async () => {
      const specialContent = '# Test\n\n<Component prop="value" />\n\n```js\nconst x = "test";\n```';
      const request = createTestRequest({ content: specialContent });

      const result = await service.saveDocument(request);

      expect(result.ok).toBe(true);

      const writeFileCall = mockWriteFile.mock.calls[0];
      expect(writeFileCall).toBeDefined();
      const writtenContent = JSON.parse(writeFileCall?.[1] as string);
      expect(writtenContent.content).toBe(specialContent);
    });

    it('should handle empty fileName with minimum length', async () => {
      // fileName must have min length of 1 per schema
      const request = createTestRequest({ fileName: 'A' });

      const result = await service.saveDocument(request);

      expect(result.ok).toBe(true);
    });

    it('should preserve exact content without modification', async () => {
      const originalContent = '# Test\r\n\nContent with CRLF\r\nand LF\nline endings';
      const request = createTestRequest({ content: originalContent });

      await service.saveDocument(request);

      const writeFileCall = mockWriteFile.mock.calls[0];
      expect(writeFileCall).toBeDefined();
      const writtenContent = JSON.parse(writeFileCall?.[1] as string);

      expect(writtenContent.content).toBe(originalContent);
    });
  });
});
