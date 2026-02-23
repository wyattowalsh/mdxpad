/**
 * Template Paths Tests
 *
 * Tests for path resolution utilities: getBuiltinTemplatesPath,
 * getCustomTemplatesPath, ensureCustomTemplatesDir, fileExists.
 *
 * @module tests/unit/template/paths
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

const { mockMkdir, mockAccess } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockAccess: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: { mkdir: mockMkdir, access: mockAccess },
  mkdir: mockMkdir,
  access: mockAccess,
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/app/path',
  },
}));

import {
  getBuiltinTemplatesPath,
  getBuiltinTemplatesPathCandidates,
  getCustomTemplatesPath,
  ensureCustomTemplatesDir,
  fileExists,
} from '../paths';

// ============================================================================
// Tests
// ============================================================================

describe('getBuiltinTemplatesPathCandidates', () => {
  it('should return array of candidate paths in dev mode', () => {
    const candidates = getBuiltinTemplatesPathCandidates();

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((p) => p.includes('templates'))).toBe(true);
  });
});

describe('getBuiltinTemplatesPath', () => {
  it('should return a string path containing templates', () => {
    const result = getBuiltinTemplatesPath();

    expect(typeof result).toBe('string');
    expect(result).toContain('templates');
  });
});

describe('getCustomTemplatesPath', () => {
  it('should return path under home directory', () => {
    const result = getCustomTemplatesPath();

    expect(result).toContain('.mdxpad');
    expect(result).toContain('templates');
  });
});

describe('ensureCustomTemplatesDir', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create directory recursively', async () => {
    mockMkdir.mockResolvedValue(undefined);

    await ensureCustomTemplatesDir();

    expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('templates'), {
      recursive: true,
    });
  });
});

describe('fileExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when file is accessible', async () => {
    mockAccess.mockResolvedValue(undefined);

    const result = await fileExists('/some/file.mdxt');

    expect(result).toBe(true);
  });

  it('should return false when file is not accessible', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));

    const result = await fileExists('/nonexistent/file.mdxt');

    expect(result).toBe(false);
  });
});
