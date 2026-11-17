/**
 * Search service tests.
 * Tests indexing, searching, ranking, and fuzzy matching.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

// Mock chokidar
vi.mock('chokidar', () => ({
  watch: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { readFile, readdir, stat } from 'node:fs/promises';
import { watch } from 'chokidar';
import { indexWorkspace, search, getStatus, closeIndex } from './search-service';

describe('search-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await closeIndex('/workspace');
  });

  describe('indexWorkspace', () => {
    it('should index files in workspace', async () => {
      vi.mocked(readdir).mockResolvedValue([
        {
          name: 'doc.md',
          isDirectory: () => false,
          isFile: () => true,
          isSymbolicLink: () => false,
        },
        {
          name: 'readme.mdx',
          isDirectory: () => false,
          isFile: () => true,
          isSymbolicLink: () => false,
        },
      ] as never);

      vi.mocked(stat).mockResolvedValue({
        size: 100,
        isDirectory: () => false,
      } as never);

      vi.mocked(readFile).mockResolvedValue('# Hello World\nSome content here');

      const result = await indexWorkspace('/workspace');
      expect(result.indexedFiles).toBe(2);
      expect(result.indexTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should skip hidden directories and node_modules', async () => {
      vi.mocked(readdir).mockResolvedValue([
        { name: '.git', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
        {
          name: 'node_modules',
          isDirectory: () => true,
          isFile: () => false,
          isSymbolicLink: () => false,
        },
        {
          name: 'doc.md',
          isDirectory: () => false,
          isFile: () => true,
          isSymbolicLink: () => false,
        },
      ] as never);

      vi.mocked(stat).mockResolvedValue({
        size: 50,
        isDirectory: () => false,
      } as never);

      vi.mocked(readFile).mockResolvedValue('content');

      const result = await indexWorkspace('/workspace');
      expect(result.indexedFiles).toBe(1);
    });

    it('should skip symbolic links', async () => {
      vi.mocked(readdir).mockResolvedValue([
        {
          name: 'secret.md',
          isDirectory: () => false,
          isFile: () => false,
          isSymbolicLink: () => true,
        },
        {
          name: 'doc.md',
          isDirectory: () => false,
          isFile: () => true,
          isSymbolicLink: () => false,
        },
      ] as never);
      vi.mocked(stat).mockResolvedValue({ size: 20, isDirectory: () => false } as never);
      vi.mocked(readFile).mockResolvedValue('visible');

      const result = await indexWorkspace('/workspace');

      expect(result.indexedFiles).toBe(1);
      expect(readFile).toHaveBeenCalledTimes(1);
    });

    it('should skip files over 1MB', async () => {
      vi.mocked(readdir).mockResolvedValue([
        {
          name: 'large.md',
          isDirectory: () => false,
          isFile: () => true,
          isSymbolicLink: () => false,
        },
      ] as never);

      vi.mocked(stat).mockResolvedValue({
        size: 2_000_000,
        isDirectory: () => false,
      } as never);

      const result = await indexWorkspace('/workspace');
      expect(result.indexedFiles).toBe(0);
    });
  });

  describe('search', () => {
    it('should return empty results when workspace is not indexed', () => {
      const result = search('/unindexed', 'query');
      expect(result.results).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });

    it('should search indexed content and return results', async () => {
      vi.mocked(readdir).mockResolvedValue([
        {
          name: 'doc.md',
          isDirectory: () => false,
          isFile: () => true,
          isSymbolicLink: () => false,
        },
      ] as never);

      vi.mocked(stat).mockResolvedValue({
        size: 100,
        isDirectory: () => false,
      } as never);

      vi.mocked(readFile).mockResolvedValue('# TypeScript Guide\nLearn TypeScript basics');

      await indexWorkspace('/workspace');
      const result = search('/workspace', 'TypeScript');
      expect(result.totalResults).toBeGreaterThan(0);
      expect(result.results[0]?.score).toBeGreaterThan(0);
    });

    it('should respect maxResults', async () => {
      vi.mocked(readdir).mockResolvedValue([
        { name: 'a.md', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
        { name: 'b.md', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
        { name: 'c.md', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
      ] as never);

      vi.mocked(stat).mockResolvedValue({
        size: 50,
        isDirectory: () => false,
      } as never);

      vi.mocked(readFile).mockResolvedValue('common keyword repeated');

      await indexWorkspace('/workspace');
      const result = search('/workspace', 'common', 1);
      expect(result.results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getStatus', () => {
    it('should return not indexed for unknown workspace', () => {
      const status = getStatus('/unknown');
      expect(status.indexed).toBe(false);
      expect(status.fileCount).toBe(0);
      expect(status.lastIndexedAt).toBeNull();
    });

    it('should return indexed status after indexing', async () => {
      vi.mocked(readdir).mockResolvedValue([
        {
          name: 'doc.md',
          isDirectory: () => false,
          isFile: () => true,
          isSymbolicLink: () => false,
        },
      ] as never);

      vi.mocked(stat).mockResolvedValue({
        size: 50,
        isDirectory: () => false,
      } as never);

      vi.mocked(readFile).mockResolvedValue('content');

      await indexWorkspace('/workspace');
      const status = getStatus('/workspace');
      expect(status.indexed).toBe(true);
      expect(status.fileCount).toBe(1);
      expect(status.lastIndexedAt).toBeTruthy();
    });

    it('should update fileCount and lastIndexedAt after incremental watcher update', async () => {
      vi.useFakeTimers();

      try {
        type AllEventHandler = (eventName: string, filePath: string) => void;
        const eventHandlers: { all?: AllEventHandler } = {};
        const watcher = {
          on: vi.fn((eventName: string, callback: AllEventHandler) => {
            if (eventName === 'all') eventHandlers.all = callback;
            return watcher;
          }),
          close: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(watch).mockReturnValue(watcher as never);

        vi.mocked(readdir).mockResolvedValue([
          {
            name: 'doc.md',
            isDirectory: () => false,
            isFile: () => true,
            isSymbolicLink: () => false,
          },
        ] as never);
        vi.mocked(stat).mockResolvedValue({ size: 50, isDirectory: () => false } as never);
        vi.mocked(readFile).mockResolvedValue('content');

        await indexWorkspace('/workspace');

        const before = getStatus('/workspace');
        expect(before.fileCount).toBe(1);
        const beforeLastIndexedAt = before.lastIndexedAt;

        const onAll = eventHandlers.all;
        expect(onAll).toBeDefined();
        if (!onAll) throw new Error('Expected watcher all handler');

        vi.mocked(stat).mockResolvedValue({ size: 40, isDirectory: () => false } as never);
        vi.mocked(readFile).mockResolvedValue('new content');

        onAll('add', '/workspace/new.md');
        await vi.advanceTimersByTimeAsync(500);

        const after = getStatus('/workspace');
        expect(after.fileCount).toBe(2);
        expect(after.lastIndexedAt).not.toBe(beforeLastIndexedAt);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('closeIndex', () => {
    it('should close and remove index', async () => {
      vi.mocked(readdir).mockResolvedValue([] as never);

      await indexWorkspace('/workspace');
      await closeIndex('/workspace');

      const status = getStatus('/workspace');
      expect(status.indexed).toBe(false);
    });
  });
});
