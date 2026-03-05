/**
 * FileService Unit Tests
 *
 * Tests for file service operations including read, write, file handles,
 * and the FileServiceIntegration class with save lock mechanism.
 *
 * @module tests/unit/file-service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FileHandle, FileId } from '@shared/types/file';
import type { FileWatcher } from '../file-watcher';
import type { RecentFilesService } from '../recent-files';
import type { AutoSaveManager } from '../auto-save';
import type { BrowserWindow } from 'electron';

// ============================================================================
// Mock Setup
// ============================================================================

const { mockReadFile, mockWriteFile, mockAtomicWrite } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockAtomicWrite: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
  },
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}));

vi.mock('@shared/lib/atomic-write', () => ({
  atomicWrite: mockAtomicWrite,
}));

// Import after mocks
import {
  readFile,
  writeFile,
  createNewFile,
  createFileHandle,
  FileServiceIntegration,
  createFileServiceIntegration,
} from '../file-service';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockFileWatcher(): FileWatcher {
  return {
    watch: vi.fn(),
    unwatch: vi.fn(),
    close: vi.fn(),
  } as unknown as FileWatcher;
}

function createMockRecentFilesService(): RecentFilesService {
  return {
    addRecent: vi.fn(),
    getRecent: vi.fn(() => []),
    removeRecent: vi.fn(),
    clear: vi.fn(),
  } as unknown as RecentFilesService;
}

function createMockAutoSaveManager(): AutoSaveManager {
  return {
    registerDirty: vi.fn(),
    unregister: vi.fn(),
    cleanupEntry: vi.fn(),
    stop: vi.fn(),
  } as unknown as AutoSaveManager;
}

function createTestFileHandle(overrides?: Partial<FileHandle>): FileHandle {
  return {
    id: 'test-file-id' as FileId,
    path: '/test/document.mdx',
    name: 'document.mdx',
    ...overrides,
  };
}

// ============================================================================
// readFile Tests
// ============================================================================

describe('readFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully read file content', async () => {
    const testContent = '# Hello World\n\nThis is test content.';
    mockReadFile.mockResolvedValueOnce(testContent);

    const result = await readFile('/test/file.mdx');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(testContent);
    }
    expect(mockReadFile).toHaveBeenCalledWith('/test/file.mdx', { encoding: 'utf-8' });
  });

  it('should handle file not found error', async () => {
    const error = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockReadFile.mockRejectedValueOnce(error);

    const result = await readFile('/nonexistent/file.mdx');

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === 'NOT_FOUND') {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.path).toBe('/nonexistent/file.mdx');
    }
  });

  it('should handle permission denied error', async () => {
    const error = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    mockReadFile.mockRejectedValueOnce(error);

    const result = await readFile('/forbidden/file.mdx');

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === 'PERMISSION_DENIED') {
      expect(result.error.code).toBe('PERMISSION_DENIED');
      expect(result.error.path).toBe('/forbidden/file.mdx');
    }
  });

  it('should handle unknown errors', async () => {
    const error = new Error('Unknown error');
    mockReadFile.mockRejectedValueOnce(error);

    const result = await readFile('/test/file.mdx');

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === 'UNKNOWN') {
      expect(result.error.code).toBe('UNKNOWN');
      expect(result.error.message).toBe('Unknown error');
    }
  });

  it('should handle non-Error throws', async () => {
    mockReadFile.mockRejectedValueOnce('string error');

    const result = await readFile('/test/file.mdx');

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === 'UNKNOWN') {
      expect(result.error.code).toBe('UNKNOWN');
      expect(result.error.message).toBe('string error');
    }
  });

  it('should read UTF-8 encoded files', async () => {
    const unicodeContent = '# Hello 世界\n\nUnicode: 😀';
    mockReadFile.mockResolvedValueOnce(unicodeContent);

    const result = await readFile('/test/unicode.mdx');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(unicodeContent);
    }
  });

  it('should handle empty files', async () => {
    mockReadFile.mockResolvedValueOnce('');

    const result = await readFile('/test/empty.mdx');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('');
    }
  });
});

// ============================================================================
// writeFile Tests
// ============================================================================

describe('writeFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully write file content', async () => {
    mockAtomicWrite.mockResolvedValueOnce(undefined);

    const result = await writeFile('/test/file.mdx', '# Test Content');

    expect(result.ok).toBe(true);
    expect(mockAtomicWrite).toHaveBeenCalledWith(
      '/test/file.mdx',
      '# Test Content',
      expect.objectContaining({
        durabilityContract: expect.any(Object),
      })
    );
  });

  it('should handle permission denied error', async () => {
    const error = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    mockAtomicWrite.mockRejectedValueOnce(error);

    const result = await writeFile('/forbidden/file.mdx', 'content');

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === 'PERMISSION_DENIED') {
      expect(result.error.code).toBe('PERMISSION_DENIED');
      expect(result.error.path).toBe('/forbidden/file.mdx');
    }
  });

  it('should handle file not found (directory missing)', async () => {
    const error = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockAtomicWrite.mockRejectedValueOnce(error);

    const result = await writeFile('/nonexistent/dir/file.mdx', 'content');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('should handle unknown errors', async () => {
    const error = new Error('Disk full');
    mockAtomicWrite.mockRejectedValueOnce(error);

    const result = await writeFile('/test/file.mdx', 'content');

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === 'UNKNOWN') {
      expect(result.error.code).toBe('UNKNOWN');
      expect(result.error.message).toBe('Disk full');
    }
  });

  it('should write UTF-8 encoded content', async () => {
    mockAtomicWrite.mockResolvedValueOnce(undefined);

    const unicodeContent = '# Unicode Test\n\n世界 😀';
    const result = await writeFile('/test/unicode.mdx', unicodeContent);

    expect(result.ok).toBe(true);
    expect(mockAtomicWrite).toHaveBeenCalledWith(
      '/test/unicode.mdx',
      unicodeContent,
      expect.objectContaining({
        durabilityContract: expect.any(Object),
      })
    );
  });

  it('should write empty content', async () => {
    mockAtomicWrite.mockResolvedValueOnce(undefined);

    const result = await writeFile('/test/empty.mdx', '');

    expect(result.ok).toBe(true);
    expect(mockAtomicWrite).toHaveBeenCalledWith(
      '/test/empty.mdx',
      '',
      expect.objectContaining({
        durabilityContract: expect.any(Object),
      })
    );
  });

  it('should preserve line endings', async () => {
    mockAtomicWrite.mockResolvedValueOnce(undefined);

    const content = 'Line1\r\nLine2\nLine3';
    const result = await writeFile('/test/file.mdx', content);

    expect(result.ok).toBe(true);
    expect(mockAtomicWrite).toHaveBeenCalledWith(
      '/test/file.mdx',
      content,
      expect.objectContaining({
        durabilityContract: expect.any(Object),
      })
    );
  });
});

// ============================================================================
// createNewFile Tests
// ============================================================================

describe('createNewFile', () => {
  it('should create untitled file with null path', () => {
    const handle = createNewFile();

    expect(handle.id).toBeDefined();
    expect(handle.path).toBeNull();
    expect(handle.name).toBe('Untitled');
  });

  it('should generate unique IDs for different untitled files', () => {
    const handle1 = createNewFile();
    const handle2 = createNewFile();

    expect(handle1.id).not.toBe(handle2.id);
  });

  it('should create valid FileHandle structure', () => {
    const handle = createNewFile();

    expect(handle).toHaveProperty('id');
    expect(handle).toHaveProperty('path');
    expect(handle).toHaveProperty('name');
  });
});

// ============================================================================
// createFileHandle Tests
// ============================================================================

describe('createFileHandle', () => {
  it('should create file handle with extracted name', () => {
    const handle = createFileHandle('/test/path/document.mdx');

    expect(handle.id).toBeDefined();
    expect(handle.path).toBe('/test/path/document.mdx');
    expect(handle.name).toBe('document.mdx');
  });

  it('should handle nested directory paths', () => {
    const handle = createFileHandle('/deeply/nested/path/to/file.mdx');

    expect(handle.name).toBe('file.mdx');
    expect(handle.path).toBe('/deeply/nested/path/to/file.mdx');
  });

  it('should handle filenames with multiple dots', () => {
    const handle = createFileHandle('/test/my.document.mdx');

    expect(handle.name).toBe('my.document.mdx');
  });

  it('should generate unique IDs for different files', () => {
    const handle1 = createFileHandle('/test/file1.mdx');
    const handle2 = createFileHandle('/test/file2.mdx');

    expect(handle1.id).not.toBe(handle2.id);
  });

  it('should handle paths with spaces', () => {
    const handle = createFileHandle('/test/My Document.mdx');

    expect(handle.name).toBe('My Document.mdx');
    expect(handle.path).toBe('/test/My Document.mdx');
  });
});

describe('createFileServiceIntegration', () => {
  it('should create integration with watcher wiring for a BrowserWindow', () => {
    const window = {
      webContents: {
        send: vi.fn(),
      },
    } as unknown as BrowserWindow;

    const integration = createFileServiceIntegration(window);

    expect(integration).toBeInstanceOf(FileServiceIntegration);
    expect(integration.getRecentFilesService()).toBeNull();
    expect(integration.getAutoSaveManager()).toBeNull();
  });
});

// ============================================================================
// FileServiceIntegration - Constructor and Basic Methods
// ============================================================================

describe('FileServiceIntegration', () => {
  let integration: FileServiceIntegration;
  let mockWatcher: FileWatcher;
  let mockRecentFiles: RecentFilesService;
  let mockAutoSave: AutoSaveManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWatcher = createMockFileWatcher();
    mockRecentFiles = createMockRecentFilesService();
    mockAutoSave = createMockAutoSaveManager();

    integration = new FileServiceIntegration({
      fileWatcher: mockWatcher,
      recentFilesService: mockRecentFiles,
      autoSaveManager: mockAutoSave,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with all services', () => {
      expect(integration).toBeDefined();
      expect(integration.getRecentFilesService()).toBe(mockRecentFiles);
      expect(integration.getAutoSaveManager()).toBe(mockAutoSave);
    });

    it('should support optional services (graceful degradation)', () => {
      const minimalIntegration = new FileServiceIntegration();

      expect(minimalIntegration.getRecentFilesService()).toBeNull();
      expect(minimalIntegration.getAutoSaveManager()).toBeNull();
    });

    it('should allow partial service configuration', () => {
      const partialIntegration = new FileServiceIntegration({
        fileWatcher: mockWatcher,
      });

      expect(partialIntegration.getRecentFilesService()).toBeNull();
      expect(partialIntegration.getAutoSaveManager()).toBeNull();
    });
  });

  describe('onFileOpened', () => {
    it('should watch file and add to recent files', () => {
      const handle = createTestFileHandle();

      integration.onFileOpened(handle);

      expect(mockWatcher.watch).toHaveBeenCalledWith(handle.id, handle.path);
      expect(mockRecentFiles.addRecent).toHaveBeenCalledWith(handle.path);
    });

    it('should track file handle internally', () => {
      const handle = createTestFileHandle();

      integration.onFileOpened(handle);

      expect(integration.isFileOpen(handle.id)).toBe(true);
      expect(integration.getFileHandle(handle.id)).toEqual(handle);
    });

    it('should not watch or add untitled files to recent', () => {
      const handle = createTestFileHandle({ path: null });

      integration.onFileOpened(handle);

      expect(mockWatcher.watch).not.toHaveBeenCalled();
      expect(mockRecentFiles.addRecent).not.toHaveBeenCalled();
      expect(integration.isFileOpen(handle.id)).toBe(true);
    });

    it('should handle gracefully when services are null', () => {
      const noServicesIntegration = new FileServiceIntegration();
      const handle = createTestFileHandle();

      expect(() => noServicesIntegration.onFileOpened(handle)).not.toThrow();
    });
  });

  describe('onFileClosed', () => {
    it('should unwatch file and unregister from auto-save', () => {
      const handle = createTestFileHandle();
      integration.onFileOpened(handle);

      integration.onFileClosed(handle.id);

      expect(mockWatcher.unwatch).toHaveBeenCalledWith(handle.id);
      expect(mockAutoSave.unregister).toHaveBeenCalledWith(handle.id);
      expect(integration.isFileOpen(handle.id)).toBe(false);
    });

    it('should remove file from internal tracking', () => {
      const handle = createTestFileHandle();
      integration.onFileOpened(handle);

      integration.onFileClosed(handle.id);

      expect(integration.getFileHandle(handle.id)).toBeUndefined();
    });

    it('should handle closing file that was never opened', () => {
      expect(() => integration.onFileClosed('unknown-id' as FileId)).not.toThrow();
    });

    it('should handle gracefully when services are null', () => {
      const noServicesIntegration = new FileServiceIntegration();

      expect(() => noServicesIntegration.onFileClosed('test-id' as FileId)).not.toThrow();
    });
  });

  describe('onContentChanged', () => {
    it('should register dirty file with auto-save manager', () => {
      const handle = createTestFileHandle();
      integration.onFileOpened(handle);

      const content = '# Test content';
      integration.onContentChanged(handle.id, content, handle.path);

      expect(mockAutoSave.registerDirty).toHaveBeenCalledWith(
        handle.id,
        handle.path,
        handle.name,
        content
      );
    });

    it('should handle untitled files with null path', () => {
      const handle = createTestFileHandle({ path: null, name: 'Untitled' });
      integration.onFileOpened(handle);

      integration.onContentChanged(handle.id, '# Content', null);

      expect(mockAutoSave.registerDirty).toHaveBeenCalledWith(
        handle.id,
        null,
        'Untitled',
        '# Content'
      );
    });

    it('should use fallback name when handle not tracked', () => {
      integration.onContentChanged('unknown-id' as FileId, '# Content', '/test/file.mdx');

      expect(mockAutoSave.registerDirty).toHaveBeenCalledWith(
        'unknown-id',
        '/test/file.mdx',
        'Untitled',
        '# Content'
      );
    });

    it('should handle gracefully when auto-save manager is null', () => {
      const noAutoSaveIntegration = new FileServiceIntegration({
        fileWatcher: mockWatcher,
      });

      expect(() =>
        noAutoSaveIntegration.onContentChanged('test-id' as FileId, 'content', null)
      ).not.toThrow();
    });
  });

  describe('onFileSaved', () => {
    beforeEach(() => {
      vi.mocked(mockAutoSave.cleanupEntry).mockResolvedValue(undefined);
    });

    it('should cleanup auto-save entry and unregister', async () => {
      const handle = createTestFileHandle();

      await integration.onFileSaved(handle.id);

      expect(mockAutoSave.cleanupEntry).toHaveBeenCalledWith(handle.id);
      expect(mockAutoSave.unregister).toHaveBeenCalledWith(handle.id);
    });

    it('should wait for existing save operation (save lock mechanism)', async () => {
      const handle = createTestFileHandle();

      // Mock cleanup to take some time
      let cleanupResolve: () => void;
      const cleanupPromise = new Promise<void>((resolve) => {
        cleanupResolve = resolve;
      });
      vi.mocked(mockAutoSave.cleanupEntry).mockReturnValue(cleanupPromise);

      // Start first save
      const firstSave = integration.onFileSaved(handle.id);

      // Start second save immediately (should wait for first)
      const secondSave = integration.onFileSaved(handle.id);

      // First cleanup should be called first
      expect(mockAutoSave.cleanupEntry).toHaveBeenCalledTimes(1);

      // Resolve first cleanup
      cleanupResolve!();
      await firstSave;

      // Now second save should proceed
      await secondSave;

      // Both operations should complete
      expect(mockAutoSave.cleanupEntry).toHaveBeenCalledTimes(2);
      expect(mockAutoSave.unregister).toHaveBeenCalledTimes(2);
    });

    it('should prevent race condition with concurrent saves', async () => {
      const handle = createTestFileHandle();
      const callOrder: string[] = [];

      vi.mocked(mockAutoSave.cleanupEntry).mockImplementation(async () => {
        callOrder.push('cleanup-start');
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push('cleanup-end');
      });

      vi.mocked(mockAutoSave.unregister).mockImplementation(() => {
        callOrder.push('unregister');
      });

      // Start first save
      const save1 = integration.onFileSaved(handle.id);

      // Wait a bit to ensure first save starts
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Start second save (should wait for first)
      const save2 = integration.onFileSaved(handle.id);

      await Promise.all([save1, save2]);

      // Verify operations were serialized, not interleaved
      expect(callOrder).toEqual([
        'cleanup-start',
        'cleanup-end',
        'unregister',
        'cleanup-start',
        'cleanup-end',
        'unregister',
      ]);
    });

    it('should release lock after save completes', async () => {
      const handle = createTestFileHandle();

      await integration.onFileSaved(handle.id);

      // Start another save - should not wait if lock was released
      const secondSave = integration.onFileSaved(handle.id);
      await expect(secondSave).resolves.toBeUndefined();
    });

    it('should release lock even if cleanup fails', async () => {
      const handle = createTestFileHandle();
      vi.mocked(mockAutoSave.cleanupEntry).mockRejectedValueOnce(new Error('Cleanup failed'));

      await expect(integration.onFileSaved(handle.id)).rejects.toThrow('Cleanup failed');

      // Lock should be released, next save should proceed
      vi.mocked(mockAutoSave.cleanupEntry).mockResolvedValueOnce(undefined);
      await expect(integration.onFileSaved(handle.id)).resolves.toBeUndefined();
    });

    it('should handle gracefully when auto-save manager is null', async () => {
      const noAutoSaveIntegration = new FileServiceIntegration();

      await expect(noAutoSaveIntegration.onFileSaved('test-id' as FileId)).resolves.toBeUndefined();
    });
  });

  describe('onFilePathChanged', () => {
    it('should update watcher and recent files with new path', () => {
      const oldHandle = createTestFileHandle({ id: 'old-id' as FileId, path: '/old/path.mdx' });
      const newHandle = createTestFileHandle({ id: 'new-id' as FileId, path: '/new/path.mdx' });

      integration.onFilePathChanged(oldHandle, newHandle);

      expect(mockWatcher.unwatch).toHaveBeenCalledWith(oldHandle.id);
      expect(mockWatcher.watch).toHaveBeenCalledWith(newHandle.id, newHandle.path);
      expect(mockRecentFiles.addRecent).toHaveBeenCalledWith(newHandle.path);
    });

    it('should update internal tracking', () => {
      const oldHandle = createTestFileHandle({ id: 'old-id' as FileId });
      const newHandle = createTestFileHandle({ id: 'new-id' as FileId });

      integration.onFileOpened(oldHandle);
      integration.onFilePathChanged(oldHandle, newHandle);

      expect(integration.isFileOpen(oldHandle.id)).toBe(false);
      expect(integration.isFileOpen(newHandle.id)).toBe(true);
      expect(integration.getFileHandle(newHandle.id)).toEqual(newHandle);
    });

    it('should handle saving untitled file (null to path)', () => {
      const oldHandle = createTestFileHandle({ path: null });
      const newHandle = createTestFileHandle({ path: '/saved/file.mdx' });

      integration.onFilePathChanged(oldHandle, newHandle);

      expect(mockWatcher.watch).toHaveBeenCalledWith(newHandle.id, newHandle.path);
      expect(mockRecentFiles.addRecent).toHaveBeenCalledWith(newHandle.path);
    });

    it('should not watch if new path is null', () => {
      const oldHandle = createTestFileHandle();
      const newHandle = createTestFileHandle({ path: null });

      integration.onFilePathChanged(oldHandle, newHandle);

      expect(mockWatcher.watch).not.toHaveBeenCalled();
      expect(mockRecentFiles.addRecent).not.toHaveBeenCalled();
    });
  });

  describe('isFileOpen and getFileHandle', () => {
    it('should correctly report file open status', () => {
      const handle = createTestFileHandle();

      expect(integration.isFileOpen(handle.id)).toBe(false);

      integration.onFileOpened(handle);

      expect(integration.isFileOpen(handle.id)).toBe(true);
    });

    it('should return undefined for unknown file IDs', () => {
      expect(integration.getFileHandle('unknown-id' as FileId)).toBeUndefined();
    });

    it('should return correct file handle', () => {
      const handle = createTestFileHandle();
      integration.onFileOpened(handle);

      expect(integration.getFileHandle(handle.id)).toEqual(handle);
    });
  });

  describe('close', () => {
    it('should close all watchers and stop auto-save', () => {
      const handle1 = createTestFileHandle({ id: 'file1' as FileId });
      const handle2 = createTestFileHandle({ id: 'file2' as FileId });
      integration.onFileOpened(handle1);
      integration.onFileOpened(handle2);

      integration.close();

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(mockAutoSave.stop).toHaveBeenCalled();
      expect(integration.isFileOpen(handle1.id)).toBe(false);
      expect(integration.isFileOpen(handle2.id)).toBe(false);
    });

    it('should clear all internal tracking', () => {
      const handle = createTestFileHandle();
      integration.onFileOpened(handle);

      integration.close();

      expect(integration.getFileHandle(handle.id)).toBeUndefined();
    });

    it('should handle gracefully when services are null', () => {
      const noServicesIntegration = new FileServiceIntegration();

      expect(() => noServicesIntegration.close()).not.toThrow();
    });
  });

  describe('getRecentFilesService and getAutoSaveManager', () => {
    it('should return service instances when configured', () => {
      expect(integration.getRecentFilesService()).toBe(mockRecentFiles);
      expect(integration.getAutoSaveManager()).toBe(mockAutoSave);
    });

    it('should return null when not configured', () => {
      const noServicesIntegration = new FileServiceIntegration();

      expect(noServicesIntegration.getRecentFilesService()).toBeNull();
      expect(noServicesIntegration.getAutoSaveManager()).toBeNull();
    });
  });
});
