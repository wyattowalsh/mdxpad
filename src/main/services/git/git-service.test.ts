/**
 * Git service tests.
 * Tests git operations with mocked simple-git.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock simple-git before imports
const mockGit = {
  checkIsRepo: vi.fn(),
  status: vi.fn(),
  add: vi.fn(),
  commit: vi.fn(),
  log: vi.fn(),
  diff: vi.fn(),
  branch: vi.fn(),
  checkout: vi.fn(),
};

vi.mock('simple-git', () => ({
  default: () => mockGit,
}));

import {
  isGitRepo,
  getStatus,
  addFiles,
  commit,
  getLog,
  getDiff,
  getBranches,
  checkout,
  GitServiceError,
} from './git-service';

describe('git-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isGitRepo', () => {
    it('should return true for a git repository', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      const result = await isGitRepo('/path/to/repo');
      expect(result).toBe(true);
    });

    it('should return false for a non-git directory', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);
      const result = await isGitRepo('/path/to/dir');
      expect(result).toBe(false);
    });

    it('should return false when simple-git throws', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('not a git repo'));
      const result = await isGitRepo('/invalid');
      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return mapped status from simple-git', async () => {
      mockGit.status.mockResolvedValue({
        isClean: () => true,
        staged: [],
        modified: [],
        not_added: [],
        created: [],
        deleted: [],
        conflicted: [],
        current: 'main',
        tracking: 'origin/main',
      });

      const result = await getStatus('/repo');
      expect(result).toEqual({
        isClean: true,
        staged: [],
        modified: [],
        notAdded: [],
        created: [],
        deleted: [],
        conflicted: [],
        current: 'main',
        tracking: 'origin/main',
      });
    });

    it('should map dirty status correctly', async () => {
      mockGit.status.mockResolvedValue({
        isClean: () => false,
        staged: ['file.ts'],
        modified: ['other.ts'],
        not_added: ['new.ts'],
        created: ['created.ts'],
        deleted: ['old.ts'],
        conflicted: [],
        current: 'feature',
        tracking: null,
      });

      const result = await getStatus('/repo');
      expect(result.isClean).toBe(false);
      expect(result.staged).toEqual(['file.ts']);
      expect(result.modified).toEqual(['other.ts']);
      expect(result.notAdded).toEqual(['new.ts']);
    });

    it('should throw GitServiceError on failure', async () => {
      mockGit.status.mockRejectedValue(new Error('git error'));
      await expect(getStatus('/repo')).rejects.toThrow(GitServiceError);
    });
  });

  describe('addFiles', () => {
    it('should stage files', async () => {
      mockGit.add.mockResolvedValue(undefined);
      await addFiles('/repo', ['file1.ts', 'file2.ts']);
      expect(mockGit.add).toHaveBeenCalledWith(['file1.ts', 'file2.ts']);
    });

    it('should throw GitServiceError on failure', async () => {
      mockGit.add.mockRejectedValue(new Error('staging failed'));
      await expect(addFiles('/repo', ['file.ts'])).rejects.toThrow(GitServiceError);
    });
  });

  describe('commit', () => {
    it('should commit and return hash + message', async () => {
      mockGit.commit.mockResolvedValue({ commit: 'abc123' });
      const result = await commit('/repo', 'feat: add feature');
      expect(mockGit.commit).toHaveBeenCalledWith('feat: add feature');
      expect(result).toEqual({ hash: 'abc123', message: 'feat: add feature' });
    });

    it('commits only the named files', async () => {
      mockGit.commit.mockResolvedValue({ commit: 'abc123' });
      await commit('/repo', 'Save notes', ['readme.md']);
      expect(mockGit.commit).toHaveBeenCalledWith('Save notes', ['readme.md']);
    });

    it('should throw GitServiceError on failure', async () => {
      mockGit.commit.mockRejectedValue(new Error('nothing to commit'));
      await expect(commit('/repo', 'msg')).rejects.toThrow(GitServiceError);
    });
  });

  describe('getLog', () => {
    it('should return mapped log entries', async () => {
      mockGit.log.mockResolvedValue({
        all: [
          { hash: 'abc', date: '2024-01-01', message: 'init', author_name: 'Test' },
          { hash: 'def', date: '2024-01-02', message: 'update', author_name: 'Test' },
        ],
        total: 2,
      });

      const result = await getLog('/repo');
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual({
        hash: 'abc',
        date: '2024-01-01',
        message: 'init',
        author: 'Test',
      });
      expect(result.total).toBe(2);
    });

    it('should pass maxCount option', async () => {
      mockGit.log.mockResolvedValue({ all: [], total: 0 });
      await getLog('/repo', 5);
      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 5 });
    });

    it('should pass undefined when no maxCount', async () => {
      mockGit.log.mockResolvedValue({ all: [], total: 0 });
      await getLog('/repo');
      expect(mockGit.log).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getDiff', () => {
    it('should return diff and files changed count', async () => {
      mockGit.diff.mockResolvedValueOnce('+ added line');
      mockGit.diff.mockResolvedValueOnce('1\t0\tfile.ts\n');

      const result = await getDiff('/repo');
      expect(result.diff).toBe('+ added line');
      expect(result.filesChanged).toBe(1);
    });

    it('should pass --cached for staged diff', async () => {
      mockGit.diff.mockResolvedValueOnce('staged diff');
      mockGit.diff.mockResolvedValueOnce('');

      await getDiff('/repo', true);
      expect(mockGit.diff).toHaveBeenCalledWith(['--cached']);
      expect(mockGit.diff).toHaveBeenCalledWith(['--cached', '--numstat']);
    });
  });

  describe('getBranches', () => {
    it('should return mapped branch list', async () => {
      mockGit.branch.mockResolvedValue({
        current: 'main',
        branches: {
          main: { name: 'main', current: true },
          feature: { name: 'feature', current: false },
        },
      });

      const result = await getBranches('/repo');
      expect(result.current).toBe('main');
      expect(result.branches).toHaveLength(2);
      expect(result.branches[0]).toEqual({ name: 'main', current: true });
    });
  });

  describe('checkout', () => {
    it('should checkout and return success', async () => {
      mockGit.checkout.mockResolvedValue(undefined);
      const result = await checkout('/repo', 'feature');
      expect(result).toEqual({ success: true, branch: 'feature' });
    });

    it('should throw BRANCH_NOT_FOUND for missing branch', async () => {
      mockGit.checkout.mockRejectedValue(new Error('did not match any'));
      await expect(checkout('/repo', 'nonexistent')).rejects.toThrow(GitServiceError);
      try {
        await checkout('/repo', 'nonexistent');
      } catch (e) {
        expect((e as GitServiceError).code).toBe('BRANCH_NOT_FOUND');
      }
    });

    it('should throw MERGE_CONFLICT for conflicts', async () => {
      mockGit.checkout.mockRejectedValue(new Error('conflict detected'));
      try {
        await checkout('/repo', 'conflicting');
      } catch (e) {
        expect((e as GitServiceError).code).toBe('MERGE_CONFLICT');
      }
    });
  });
});
