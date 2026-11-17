/**
 * Git schema validation tests.
 */

import { describe, it, expect } from 'vitest';
import {
  GitStatusRequestSchema,
  GitAddRequestSchema,
  GitCommitRequestSchema,
  GitLogRequestSchema,
  GitDiffRequestSchema,
  GitCheckoutRequestSchema,
  GitIsRepoRequestSchema,
  GitStatusResponseSchema,
  GitLogResponseSchema,
  GitBranchesResponseSchema,
} from './git-schemas';

describe('git-schemas', () => {
  describe('GitStatusRequestSchema', () => {
    it('should accept valid request', () => {
      const result = GitStatusRequestSchema.safeParse({ workingDir: '/repo' });
      expect(result.success).toBe(true);
    });

    it('should reject empty workingDir', () => {
      const result = GitStatusRequestSchema.safeParse({ workingDir: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing workingDir', () => {
      const result = GitStatusRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('GitAddRequestSchema', () => {
    it('should accept valid request with files', () => {
      const result = GitAddRequestSchema.safeParse({
        workingDir: '/repo',
        files: ['file.ts'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty files array', () => {
      const result = GitAddRequestSchema.safeParse({
        workingDir: '/repo',
        files: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GitCommitRequestSchema', () => {
    it('should accept valid commit request', () => {
      const result = GitCommitRequestSchema.safeParse({
        workingDir: '/repo',
        message: 'feat: add feature',
      });
      expect(result.success).toBe(true);
    });

    it('should accept a commit limited to named files', () => {
      const result = GitCommitRequestSchema.safeParse({
        workingDir: '/repo',
        message: 'Save notes',
        files: ['readme.md'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const result = GitCommitRequestSchema.safeParse({
        workingDir: '/repo',
        message: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GitLogRequestSchema', () => {
    it('should accept request without maxCount', () => {
      const result = GitLogRequestSchema.safeParse({ workingDir: '/repo' });
      expect(result.success).toBe(true);
    });

    it('should accept request with maxCount', () => {
      const result = GitLogRequestSchema.safeParse({
        workingDir: '/repo',
        maxCount: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-positive maxCount', () => {
      const result = GitLogRequestSchema.safeParse({
        workingDir: '/repo',
        maxCount: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GitDiffRequestSchema', () => {
    it('should accept request with optional staged', () => {
      const result = GitDiffRequestSchema.safeParse({
        workingDir: '/repo',
        staged: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('GitCheckoutRequestSchema', () => {
    it('should accept valid checkout request', () => {
      const result = GitCheckoutRequestSchema.safeParse({
        workingDir: '/repo',
        branch: 'main',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('GitIsRepoRequestSchema', () => {
    it('should accept valid path', () => {
      const result = GitIsRepoRequestSchema.safeParse({ path: '/some/dir' });
      expect(result.success).toBe(true);
    });
  });

  describe('Response schemas', () => {
    it('should validate GitStatusResponse', () => {
      const result = GitStatusResponseSchema.safeParse({
        isClean: true,
        staged: [],
        modified: [],
        notAdded: [],
        created: [],
        deleted: [],
        conflicted: [],
        current: 'main',
        tracking: null,
      });
      expect(result.success).toBe(true);
    });

    it('should validate GitLogResponse', () => {
      const result = GitLogResponseSchema.safeParse({
        entries: [{ hash: 'abc', date: '2024-01-01', message: 'init', author: 'Test' }],
        total: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should validate GitBranchesResponse', () => {
      const result = GitBranchesResponseSchema.safeParse({
        branches: [{ name: 'main', current: true }],
        current: 'main',
      });
      expect(result.success).toBe(true);
    });
  });
});
