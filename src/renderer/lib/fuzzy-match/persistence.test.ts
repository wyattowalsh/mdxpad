/**
 * Tests for filter persistence utilities.
 *
 * Tests FNV-1a hashing, storage key generation, and load/save operations.
 *
 * @module fuzzy-match/persistence.test
 * Feature: 014-smart-filtering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  simpleHash,
  getFilterStorageKey,
  loadPersistedFilterQuery,
  saveFilterQuery,
  FILTER_STORAGE_KEY_PREFIX,
} from './persistence';

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockStorage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
});

// =============================================================================
// simpleHash TESTS
// =============================================================================

describe('simpleHash', () => {
  it('returns 8-character hex string', () => {
    const hash = simpleHash('/Users/dev/my-project');

    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('returns consistent hash for same input', () => {
    const path = '/Users/dev/my-project';

    const hash1 = simpleHash(path);
    const hash2 = simpleHash(path);

    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different inputs', () => {
    const hash1 = simpleHash('/project-a');
    const hash2 = simpleHash('/project-b');

    expect(hash1).not.toBe(hash2);
  });

  it('handles empty string', () => {
    const hash = simpleHash('');

    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles very long paths', () => {
    const longPath = '/a'.repeat(1000);
    const hash = simpleHash(longPath);

    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles special characters in path', () => {
    const path = '/Users/名前/プロジェクト/日本語';
    const hash = simpleHash(path);

    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles Windows-style paths', () => {
    const path = 'C:\\Users\\Dev\\Project';
    const hash = simpleHash(path);

    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('produces different hashes for similar paths', () => {
    const hash1 = simpleHash('/project');
    const hash2 = simpleHash('/project1');
    const hash3 = simpleHash('/project2');

    expect(hash1).not.toBe(hash2);
    expect(hash2).not.toBe(hash3);
    expect(hash1).not.toBe(hash3);
  });
});

// =============================================================================
// getFilterStorageKey TESTS
// =============================================================================

describe('getFilterStorageKey', () => {
  it('returns key with correct prefix', () => {
    const key = getFilterStorageKey('/my/project');

    expect(key.startsWith(FILTER_STORAGE_KEY_PREFIX)).toBe(true);
  });

  it('returns key in correct format', () => {
    const key = getFilterStorageKey('/my/project');

    expect(key).toMatch(/^mdxpad:filter:query:[0-9a-f]{8}$/);
  });

  it('returns different keys for different projects', () => {
    const key1 = getFilterStorageKey('/project-a');
    const key2 = getFilterStorageKey('/project-b');

    expect(key1).not.toBe(key2);
  });

  it('returns same key for same project', () => {
    const path = '/my/project';

    const key1 = getFilterStorageKey(path);
    const key2 = getFilterStorageKey(path);

    expect(key1).toBe(key2);
  });
});

// =============================================================================
// loadPersistedFilterQuery TESTS
// =============================================================================

describe('loadPersistedFilterQuery', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('returns empty string when no persisted query', () => {
    const query = loadPersistedFilterQuery('/new/project');

    expect(query).toBe('');
  });

  it('returns persisted query when present', () => {
    const projectPath = '/my/project';
    const key = getFilterStorageKey(projectPath);
    mockStorage.set(key, 'component');

    const query = loadPersistedFilterQuery(projectPath);

    expect(query).toBe('component');
  });

  it('returns empty string on localStorage error', () => {
    const originalGetItem = localStorage.getItem;
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage error');
    });

    const query = loadPersistedFilterQuery('/project');

    expect(query).toBe('');

    vi.spyOn(localStorage, 'getItem').mockImplementation(originalGetItem);
  });
});

// =============================================================================
// saveFilterQuery TESTS
// =============================================================================

describe('saveFilterQuery', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('saves query to localStorage', () => {
    const projectPath = '/my/project';
    const query = 'button';

    saveFilterQuery(projectPath, query);

    const key = getFilterStorageKey(projectPath);
    expect(mockStorage.get(key)).toBe('button');
  });

  it('removes key when query is empty', () => {
    const projectPath = '/my/project';
    const key = getFilterStorageKey(projectPath);

    // First save a query
    saveFilterQuery(projectPath, 'button');
    expect(mockStorage.has(key)).toBe(true);

    // Then clear it
    saveFilterQuery(projectPath, '');
    expect(mockStorage.has(key)).toBe(false);
  });

  it('removes key when query is whitespace only', () => {
    const projectPath = '/my/project';
    const key = getFilterStorageKey(projectPath);

    // First save a query
    saveFilterQuery(projectPath, 'button');
    expect(mockStorage.has(key)).toBe(true);

    // Then clear with whitespace
    saveFilterQuery(projectPath, '   ');
    expect(mockStorage.has(key)).toBe(false);
  });

  it('does not throw on localStorage error', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    // Should not throw
    expect(() => {
      saveFilterQuery('/project', 'query');
    }).not.toThrow();

    vi.restoreAllMocks();
  });

  it('preserves queries for different projects', () => {
    const project1 = '/project-a';
    const project2 = '/project-b';

    saveFilterQuery(project1, 'query1');
    saveFilterQuery(project2, 'query2');

    expect(loadPersistedFilterQuery(project1)).toBe('query1');
    expect(loadPersistedFilterQuery(project2)).toBe('query2');
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('persistence integration', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('round-trips filter query correctly', () => {
    const projectPath = '/Users/dev/mdxpad-project';
    const originalQuery = 'MyComponent.tsx';

    // Save
    saveFilterQuery(projectPath, originalQuery);

    // Load
    const loadedQuery = loadPersistedFilterQuery(projectPath);

    expect(loadedQuery).toBe(originalQuery);
  });

  it('isolates queries per project', () => {
    const projects = ['/project-a', '/project-b', '/project-c'];
    const queries = ['query-a', 'query-b', 'query-c'];

    // Save different queries for each project
    projects.forEach((project, i) => {
      saveFilterQuery(project, queries[i]!);
    });

    // Verify each project has its own query
    projects.forEach((project, i) => {
      expect(loadPersistedFilterQuery(project)).toBe(queries[i]);
    });
  });

  it('handles special characters in query', () => {
    const projectPath = '/project';
    const specialQuery = 'file[1].test(2).tsx';

    saveFilterQuery(projectPath, specialQuery);
    const loaded = loadPersistedFilterQuery(projectPath);

    expect(loaded).toBe(specialQuery);
  });

  it('handles unicode in query', () => {
    const projectPath = '/project';
    const unicodeQuery = '日本語コンポーネント';

    saveFilterQuery(projectPath, unicodeQuery);
    const loaded = loadPersistedFilterQuery(projectPath);

    expect(loaded).toBe(unicodeQuery);
  });
});
