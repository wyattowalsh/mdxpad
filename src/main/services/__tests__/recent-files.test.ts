/**
 * RecentFilesService Unit Tests
 *
 * Tests for the recent files management service including persistence,
 * deduplication, and list management with electron-store.
 *
 * Per FR-013: Maintains maximum of 10 recent file entries.
 *
 * @module tests/unit/recent-files
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RecentFileEntry } from '../recent-files';

// ============================================================================
// Mock Setup
// ============================================================================

const { mockStoreInstance, mockStoreConstructor } = vi.hoisted(() => {
  const mockStoreInstance = {
    get: vi.fn(),
    set: vi.fn(),
  };

  const mockStoreConstructor = vi.fn(() => mockStoreInstance);

  return { mockStoreInstance, mockStoreConstructor };
});

vi.mock('electron-store', () => ({
  default: mockStoreConstructor,
}));

// Import after mocks
import { RecentFilesService } from '../recent-files';

// ============================================================================
// Test Utilities
// ============================================================================

function createRecentFileEntry(path: string, timestamp?: number): RecentFileEntry {
  return {
    path,
    accessedAt: timestamp ?? Date.now(),
  };
}

// ============================================================================
// RecentFilesService Tests
// ============================================================================

describe('RecentFilesService', () => {
  let service: RecentFilesService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreInstance.get.mockReturnValue([]);
    service = new RecentFilesService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should create electron-store instance with correct configuration', () => {
      expect(mockStoreConstructor).toHaveBeenCalledWith({
        name: 'recent-files',
        defaults: {
          recentFiles: [],
        },
      });
    });

    it('should initialize service successfully', () => {
      expect(service).toBeDefined();
    });
  });

  // ==========================================================================
  // addRecent Tests
  // ==========================================================================

  describe('addRecent', () => {
    it('should add file to empty recent files list', () => {
      mockStoreInstance.get.mockReturnValue([]);

      service.addRecent('/test/document.mdx');

      expect(mockStoreInstance.set).toHaveBeenCalledWith('recentFiles', [
        expect.objectContaining({
          path: '/test/document.mdx',
          accessedAt: expect.any(Number),
        }),
      ]);
    });

    it('should add file to front of list', () => {
      const existing = [
        createRecentFileEntry('/old/file1.mdx', 1000),
        createRecentFileEntry('/old/file2.mdx', 2000),
      ];
      mockStoreInstance.get.mockReturnValue(existing);

      service.addRecent('/new/document.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      expect(setCall?.[0]).toBe('recentFiles');
      const updatedList = setCall?.[1] as RecentFileEntry[];
      expect(updatedList[0]?.path).toBe('/new/document.mdx');
      expect(updatedList).toHaveLength(3);
    });

    it('should deduplicate existing file and move to front', () => {
      const existing = [
        createRecentFileEntry('/file1.mdx', 1000),
        createRecentFileEntry('/file2.mdx', 2000),
        createRecentFileEntry('/file3.mdx', 3000),
      ];
      mockStoreInstance.get.mockReturnValue(existing);

      service.addRecent('/file2.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      // Should have only 3 entries (deduplicated)
      expect(updatedList).toHaveLength(3);

      // file2.mdx should be at front with new timestamp
      expect(updatedList[0]?.path).toBe('/file2.mdx');
      expect(updatedList[0]?.accessedAt).toBeGreaterThan(3000);

      // Other files should maintain order
      expect(updatedList[1]?.path).toBe('/file1.mdx');
      expect(updatedList[2]?.path).toBe('/file3.mdx');
    });

    it('should enforce maximum of 10 files (FR-013)', () => {
      // Build list most-recent-first (as the service stores it)
      const existing: RecentFileEntry[] = [];
      for (let i = 10; i >= 1; i--) {
        existing.push(createRecentFileEntry(`/file${i}.mdx`, i * 1000));
      }
      mockStoreInstance.get.mockReturnValue(existing);

      service.addRecent('/new-file.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      // Should still have exactly 10 entries
      expect(updatedList).toHaveLength(10);

      // New file should be at front
      expect(updatedList[0]?.path).toBe('/new-file.mdx');

      // Oldest file (/file1.mdx at the tail) should be removed
      expect(updatedList.find((entry) => entry.path === '/file1.mdx')).toBeUndefined();
    });

    it('should update timestamp when re-adding existing file', () => {
      const oldTimestamp = 1000;
      const existing = [createRecentFileEntry('/file.mdx', oldTimestamp)];
      mockStoreInstance.get.mockReturnValue(existing);

      const beforeAdd = Date.now();
      service.addRecent('/file.mdx');
      const afterAdd = Date.now();

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList).toHaveLength(1);
      expect(updatedList[0]?.path).toBe('/file.mdx');
      expect(updatedList[0]?.accessedAt).toBeGreaterThanOrEqual(beforeAdd);
      expect(updatedList[0]?.accessedAt).toBeLessThanOrEqual(afterAdd);
      expect(updatedList[0]?.accessedAt).toBeGreaterThan(oldTimestamp);
    });

    it('should handle paths with special characters', () => {
      service.addRecent('/path/with spaces/document.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList[0]?.path).toBe('/path/with spaces/document.mdx');
    });

    it('should handle unicode paths', () => {
      service.addRecent('/path/文档.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList[0]?.path).toBe('/path/文档.mdx');
    });

    it('should maintain timestamp precision', () => {
      const timestamp = Date.now();

      service.addRecent('/file.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList[0]?.accessedAt).toBeGreaterThanOrEqual(timestamp);
      expect(Number.isInteger(updatedList[0]?.accessedAt)).toBe(true);
    });

    it('should handle adding same file multiple times in succession', () => {
      service.addRecent('/file.mdx');
      service.addRecent('/file.mdx');
      service.addRecent('/file.mdx');

      // Each call updates the store
      expect(mockStoreInstance.set).toHaveBeenCalledTimes(3);

      const lastCall = mockStoreInstance.set.mock.calls[2];
      const finalList = lastCall?.[1] as RecentFileEntry[];

      expect(finalList).toHaveLength(1);
      expect(finalList[0]?.path).toBe('/file.mdx');
    });

    it('should preserve exact file paths', () => {
      const path = '/Path/With/Mixed/Case.mdx';

      service.addRecent(path);

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList[0]?.path).toBe(path);
    });
  });

  // ==========================================================================
  // getRecent Tests
  // ==========================================================================

  describe('getRecent', () => {
    it('should return empty array when no recent files exist', () => {
      mockStoreInstance.get.mockReturnValue([]);

      const result = service.getRecent();

      expect(result).toEqual([]);
      expect(mockStoreInstance.get).toHaveBeenCalledWith('recentFiles');
    });

    it('should return all recent files', () => {
      const files = [
        createRecentFileEntry('/file1.mdx', 3000),
        createRecentFileEntry('/file2.mdx', 2000),
        createRecentFileEntry('/file3.mdx', 1000),
      ];
      mockStoreInstance.get.mockReturnValue(files);

      const result = service.getRecent();

      expect(result).toEqual(files);
      expect(result).toHaveLength(3);
    });

    it('should return files in stored order (most recent first)', () => {
      const files = [
        createRecentFileEntry('/newest.mdx', 5000),
        createRecentFileEntry('/middle.mdx', 3000),
        createRecentFileEntry('/oldest.mdx', 1000),
      ];
      mockStoreInstance.get.mockReturnValue(files);

      const result = service.getRecent();

      expect(result[0]?.path).toBe('/newest.mdx');
      expect(result[1]?.path).toBe('/middle.mdx');
      expect(result[2]?.path).toBe('/oldest.mdx');
    });

    it('should return array with correct structure', () => {
      const files = [createRecentFileEntry('/file.mdx', 1000)];
      mockStoreInstance.get.mockReturnValue(files);

      const result = service.getRecent();

      expect(result[0]).toHaveProperty('path');
      expect(result[0]).toHaveProperty('accessedAt');
      expect(typeof result[0]?.path).toBe('string');
      expect(typeof result[0]?.accessedAt).toBe('number');
    });

    it('should not modify returned array affecting store', () => {
      const baseEntry = createRecentFileEntry('/file.mdx', 1000);
      // Return a fresh copy each call so mutations to the returned array
      // don't affect subsequent calls (mirrors real electron-store behaviour).
      mockStoreInstance.get.mockImplementation(() => [{ ...baseEntry }]);

      const result = service.getRecent();
      result.push(createRecentFileEntry('/new.mdx', 2000));

      // Original store data should not be affected
      const secondCall = service.getRecent();
      expect(secondCall).toHaveLength(1);
    });
  });

  // ==========================================================================
  // removeRecent Tests
  // ==========================================================================

  describe('removeRecent', () => {
    it('should remove file from recent files list', () => {
      const files = [
        createRecentFileEntry('/file1.mdx', 1000),
        createRecentFileEntry('/file2.mdx', 2000),
        createRecentFileEntry('/file3.mdx', 3000),
      ];
      mockStoreInstance.get.mockReturnValue(files);

      service.removeRecent('/file2.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList).toHaveLength(2);
      expect(updatedList.find((entry) => entry.path === '/file2.mdx')).toBeUndefined();
      expect(updatedList.find((entry) => entry.path === '/file1.mdx')).toBeDefined();
      expect(updatedList.find((entry) => entry.path === '/file3.mdx')).toBeDefined();
    });

    it('should handle removing non-existent file gracefully', () => {
      const files = [createRecentFileEntry('/file1.mdx', 1000)];
      mockStoreInstance.get.mockReturnValue(files);

      service.removeRecent('/nonexistent.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      // List should remain unchanged
      expect(updatedList).toHaveLength(1);
      expect(updatedList[0]?.path).toBe('/file1.mdx');
    });

    it('should remove all matching paths (case-sensitive)', () => {
      const files = [
        createRecentFileEntry('/File.mdx', 1000),
        createRecentFileEntry('/file.mdx', 2000),
      ];
      mockStoreInstance.get.mockReturnValue(files);

      service.removeRecent('/file.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList).toHaveLength(1);
      expect(updatedList[0]?.path).toBe('/File.mdx');
    });

    it('should handle removing last file', () => {
      const files = [createRecentFileEntry('/file.mdx', 1000)];
      mockStoreInstance.get.mockReturnValue(files);

      service.removeRecent('/file.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList).toEqual([]);
    });

    it('should handle empty list', () => {
      mockStoreInstance.get.mockReturnValue([]);

      service.removeRecent('/file.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList).toEqual([]);
    });

    it('should preserve order of remaining files', () => {
      const files = [
        createRecentFileEntry('/file1.mdx', 3000),
        createRecentFileEntry('/file2.mdx', 2000),
        createRecentFileEntry('/file3.mdx', 1000),
      ];
      mockStoreInstance.get.mockReturnValue(files);

      service.removeRecent('/file2.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList[0]?.path).toBe('/file1.mdx');
      expect(updatedList[1]?.path).toBe('/file3.mdx');
    });

    it('should handle paths with special characters', () => {
      const files = [
        createRecentFileEntry('/path/with spaces/file.mdx', 1000),
        createRecentFileEntry('/other/file.mdx', 2000),
      ];
      mockStoreInstance.get.mockReturnValue(files);

      service.removeRecent('/path/with spaces/file.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList).toHaveLength(1);
      expect(updatedList[0]?.path).toBe('/other/file.mdx');
    });
  });

  // ==========================================================================
  // clear Tests
  // ==========================================================================

  describe('clear', () => {
    it('should clear all recent files', () => {
      const files = [
        createRecentFileEntry('/file1.mdx', 1000),
        createRecentFileEntry('/file2.mdx', 2000),
      ];
      mockStoreInstance.get.mockReturnValue(files);

      service.clear();

      expect(mockStoreInstance.set).toHaveBeenCalledWith('recentFiles', []);
    });

    it('should handle clearing empty list', () => {
      mockStoreInstance.get.mockReturnValue([]);

      service.clear();

      expect(mockStoreInstance.set).toHaveBeenCalledWith('recentFiles', []);
    });

    it('should allow adding files after clear', () => {
      service.clear();
      mockStoreInstance.get.mockReturnValue([]);

      service.addRecent('/new-file.mdx');

      const setCall = mockStoreInstance.set.mock.calls[1]; // Second call after clear
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList).toHaveLength(1);
      expect(updatedList[0]?.path).toBe('/new-file.mdx');
    });
  });

  // ==========================================================================
  // Integration and Edge Case Tests
  // ==========================================================================

  describe('integration and edge cases', () => {
    it('should handle rapid successive operations', () => {
      // Make get() return whatever was last set(), starting with []
      let stored: RecentFileEntry[] = [];
      mockStoreInstance.get.mockImplementation(() => [...stored]);
      mockStoreInstance.set.mockImplementation((_key: string, value: RecentFileEntry[]) => {
        stored = value;
      });

      service.addRecent('/file1.mdx');
      service.addRecent('/file2.mdx');
      service.addRecent('/file3.mdx');
      service.removeRecent('/file2.mdx');
      service.addRecent('/file4.mdx');

      // Should have called set 5 times
      expect(mockStoreInstance.set).toHaveBeenCalledTimes(5);

      expect(stored).toHaveLength(3);
      expect(stored.find((entry) => entry.path === '/file2.mdx')).toBeUndefined();
    });

    it('should maintain list integrity with maximum limit', () => {
      mockStoreInstance.get.mockReturnValue([]);

      // Add 15 files (should keep only 10)
      for (let i = 1; i <= 15; i++) {
        service.addRecent(`/file${i}.mdx`);
        mockStoreInstance.get.mockReturnValue(
          mockStoreInstance.set.mock.calls[i - 1]?.[1] as RecentFileEntry[]
        );
      }

      const lastCall = mockStoreInstance.set.mock.calls[14];
      const finalList = lastCall?.[1] as RecentFileEntry[];

      expect(finalList).toHaveLength(10);

      // Most recent should be file15
      expect(finalList[0]?.path).toBe('/file15.mdx');

      // Oldest should be file6 (files 1-5 were removed)
      expect(finalList[9]?.path).toBe('/file6.mdx');
    });

    it('should handle timestamp edge cases', () => {
      const now = Date.now();
      const veryOld = 0;
      const future = now + 1000000;

      const files = [
        createRecentFileEntry('/future.mdx', future),
        createRecentFileEntry('/now.mdx', now),
        createRecentFileEntry('/old.mdx', veryOld),
      ];
      mockStoreInstance.get.mockReturnValue(files);

      const result = service.getRecent();

      expect(result).toHaveLength(3);
      expect(result.every((entry) => typeof entry.accessedAt === 'number')).toBe(true);
    });

    it('should handle very long file paths', () => {
      const longPath = '/very/'.repeat(100) + 'long/path/to/file.mdx';

      service.addRecent(longPath);

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList[0]?.path).toBe(longPath);
    });

    it('should handle deduplication with different timestamps', () => {
      const files = [
        createRecentFileEntry('/file.mdx', 1000),
        createRecentFileEntry('/other.mdx', 2000),
      ];
      mockStoreInstance.get.mockReturnValue(files);

      // Re-add first file (should deduplicate and update timestamp)
      service.addRecent('/file.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList).toHaveLength(2);
      expect(updatedList[0]?.path).toBe('/file.mdx');
      expect(updatedList[0]?.accessedAt).toBeGreaterThan(2000);
    });

    it('should preserve all entries when under limit', () => {
      mockStoreInstance.get.mockReturnValue([]);

      for (let i = 1; i <= 5; i++) {
        service.addRecent(`/file${i}.mdx`);
        mockStoreInstance.get.mockReturnValue(
          mockStoreInstance.set.mock.calls[i - 1]?.[1] as RecentFileEntry[]
        );
      }

      const lastCall = mockStoreInstance.set.mock.calls[4];
      const finalList = lastCall?.[1] as RecentFileEntry[];

      expect(finalList).toHaveLength(5);
    });

    it('should handle concurrent operations simulation', () => {
      const initialFiles = [createRecentFileEntry('/file1.mdx', 1000)];
      mockStoreInstance.get.mockReturnValue(initialFiles);

      // Simulate concurrent adds
      service.addRecent('/file2.mdx');
      service.addRecent('/file3.mdx');

      expect(mockStoreInstance.set).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // FR-013 Compliance Tests
  // ==========================================================================

  describe('FR-013 compliance (max 10 entries)', () => {
    it('should never exceed 10 entries', () => {
      mockStoreInstance.get.mockReturnValue([]);

      for (let i = 1; i <= 20; i++) {
        service.addRecent(`/file${i}.mdx`);
        const setCall = mockStoreInstance.set.mock.calls[i - 1];
        const list = setCall?.[1] as RecentFileEntry[];
        expect(list.length).toBeLessThanOrEqual(10);
      }
    });

    it('should enforce limit exactly at 10', () => {
      mockStoreInstance.get.mockReturnValue([]);

      for (let i = 1; i <= 10; i++) {
        service.addRecent(`/file${i}.mdx`);
        mockStoreInstance.get.mockReturnValue(
          mockStoreInstance.set.mock.calls[i - 1]?.[1] as RecentFileEntry[]
        );
      }

      // Add 11th file
      service.addRecent('/file11.mdx');

      const lastCall = mockStoreInstance.set.mock.calls[10];
      const finalList = lastCall?.[1] as RecentFileEntry[];

      expect(finalList).toHaveLength(10);
      expect(finalList[0]?.path).toBe('/file11.mdx');
    });

    it('should remove oldest entry when at limit', () => {
      // Build list most-recent-first (as the service stores it)
      const files: RecentFileEntry[] = [];
      for (let i = 10; i >= 1; i--) {
        files.push(createRecentFileEntry(`/file${i}.mdx`, i * 1000));
      }
      mockStoreInstance.get.mockReturnValue(files);

      service.addRecent('/new.mdx');

      const setCall = mockStoreInstance.set.mock.calls[0];
      const updatedList = setCall?.[1] as RecentFileEntry[];

      expect(updatedList).toHaveLength(10);
      // Oldest file (/file1.mdx at the tail) should be removed
      expect(updatedList.find((entry) => entry.path === '/file1.mdx')).toBeUndefined();
      expect(updatedList[0]?.path).toBe('/new.mdx');
    });
  });
});
