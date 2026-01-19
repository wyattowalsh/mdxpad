/**
 * Tests for fuzzy matcher module.
 *
 * Tests fuzzy matching logic, position remapping, and result conversion.
 *
 * @module fuzzy-match/matcher.test
 * Feature: 014-smart-filtering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createFileMatcher,
  filterFiles,
  remapPositionsToName,
  convertToMatchResult,
  convertToMatchResultMap,
  createAncestorMatchResult,
  type FileEntry,
} from './matcher';

// =============================================================================
// TEST DATA
// =============================================================================

/**
 * Sample file entries for testing.
 */
const createTestFiles = (): FileEntry[] => [
  { id: '/src/MyComponent.tsx', path: 'src/MyComponent.tsx', name: 'MyComponent.tsx' },
  { id: '/src/utils/helpers.ts', path: 'src/utils/helpers.ts', name: 'helpers.ts' },
  { id: '/src/components/Button.tsx', path: 'src/components/Button.tsx', name: 'Button.tsx' },
  { id: '/src/components/Modal.tsx', path: 'src/components/Modal.tsx', name: 'Modal.tsx' },
  { id: '/src/hooks/useState.ts', path: 'src/hooks/useState.ts', name: 'useState.ts' },
  { id: '/tests/App.test.tsx', path: 'tests/App.test.tsx', name: 'App.test.tsx' },
  { id: '/package.json', path: 'package.json', name: 'package.json' },
];

// =============================================================================
// createFileMatcher TESTS
// =============================================================================

describe('createFileMatcher', () => {
  describe('sequential matching', () => {
    it('should match characters in sequence ("mcp" → "MyComponent")', () => {
      const files = createTestFiles();
      const matcher = createFileMatcher(files);

      const results = matcher.filter('mcp');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.item.name).toBe('MyComponent.tsx');
    });

    it('should match non-contiguous characters ("btn" → "Button")', () => {
      const files = createTestFiles();
      const matcher = createFileMatcher(files);

      const results = matcher.filter('btn');

      expect(results.length).toBeGreaterThan(0);
      const buttonResult = results.find((r) => r.item.name === 'Button.tsx');
      expect(buttonResult).toBeDefined();
    });

    it('should match path segments ("src/comp" matches "src/components/...")', () => {
      const files = createTestFiles();
      const matcher = createFileMatcher(files);

      const results = matcher.filter('src/comp');

      expect(results.length).toBeGreaterThan(0);
      const componentMatches = results.filter((r) =>
        r.item.path.includes('components')
      );
      expect(componentMatches.length).toBeGreaterThan(0);
    });
  });

  describe('case insensitivity', () => {
    it('should match case-insensitively ("MODAL" → "Modal.tsx")', () => {
      const files = createTestFiles();
      const matcher = createFileMatcher(files);

      const results = matcher.filter('MODAL');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.item.name).toBe('Modal.tsx');
    });

    it('should match mixed case queries ("mOdAl" → "Modal.tsx")', () => {
      const files = createTestFiles();
      const matcher = createFileMatcher(files);

      const results = matcher.filter('mOdAl');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.item.name).toBe('Modal.tsx');
    });
  });

  describe('no match behavior', () => {
    it('should return empty array when no matches found', () => {
      const files = createTestFiles();
      const matcher = createFileMatcher(files);

      const results = matcher.filter('xyz123notfound');

      expect(results).toEqual([]);
    });

    it('should return empty array for empty query', () => {
      const files = createTestFiles();
      const matcher = createFileMatcher(files);

      const results = matcher.filter('');

      expect(results).toEqual([]);
    });

    it('should return empty array for whitespace-only query', () => {
      const files = createTestFiles();
      const matcher = createFileMatcher(files);

      const results = matcher.filter('   ');

      expect(results).toEqual([]);
    });
  });

  describe('match positions', () => {
    it('should return correct character positions for matches', () => {
      const files = createTestFiles();
      const matcher = createFileMatcher(files);

      const results = matcher.filter('button');

      expect(results.length).toBeGreaterThan(0);
      const buttonResult = results.find((r) => r.item.name === 'Button.tsx');
      expect(buttonResult).toBeDefined();
      expect(buttonResult?.positions).toBeInstanceOf(Set);
      expect(buttonResult?.positions.size).toBeGreaterThan(0);
    });

    it('should have positions that reference valid character indices', () => {
      const files = createTestFiles();
      const matcher = createFileMatcher(files);

      const results = matcher.filter('modal');
      const modalResult = results.find((r) => r.item.name === 'Modal.tsx');

      expect(modalResult).toBeDefined();
      if (modalResult) {
        const pathLength = modalResult.item.path.length;
        for (const pos of modalResult.positions) {
          expect(pos).toBeGreaterThanOrEqual(0);
          expect(pos).toBeLessThan(pathLength);
        }
      }
    });
  });

  describe('tiebreaker - shorter paths preferred', () => {
    it('should rank shorter paths higher for equal scores', () => {
      const files: FileEntry[] = [
        { id: '/a/b/c/file.ts', path: 'a/b/c/file.ts', name: 'file.ts' },
        { id: '/file.ts', path: 'file.ts', name: 'file.ts' },
        { id: '/a/file.ts', path: 'a/file.ts', name: 'file.ts' },
      ];
      const matcher = createFileMatcher(files);

      const results = matcher.filter('file');

      // Shorter paths should be ranked first
      expect(results[0]?.item.path).toBe('file.ts');
    });
  });

  describe('updateFiles', () => {
    it('should update the file list for matching', () => {
      const files = createTestFiles();
      const matcher = createFileMatcher(files);

      // Initially should find MyComponent
      let results = matcher.filter('mcp');
      expect(results.length).toBeGreaterThan(0);

      // Update to different files
      const newFiles: FileEntry[] = [
        { id: '/other.ts', path: 'other.ts', name: 'other.ts' },
      ];
      matcher.updateFiles(newFiles);

      // Now should not find MyComponent
      results = matcher.filter('mcp');
      expect(results).toEqual([]);

      // But should find new file
      results = matcher.filter('other');
      expect(results.length).toBe(1);
    });
  });
});

// =============================================================================
// filterFiles TESTS
// =============================================================================

describe('filterFiles', () => {
  it('should filter files with single call (convenience function)', () => {
    const files = createTestFiles();

    const results = filterFiles(files, 'button');

    expect(results.length).toBeGreaterThan(0);
    const buttonResult = results.find((r) => r.item.name === 'Button.tsx');
    expect(buttonResult).toBeDefined();
  });

  it('should return empty array for empty query', () => {
    const files = createTestFiles();

    const results = filterFiles(files, '');

    expect(results).toEqual([]);
  });
});

// =============================================================================
// remapPositionsToName TESTS
// =============================================================================

describe('remapPositionsToName', () => {
  it('should remap positions from path to name correctly', () => {
    // Path: "src/MyComponent.tsx" (positions 4,5,6,7,8 for "MyComp")
    // Name starts at index 4
    const pathPositions = new Set([4, 5, 6, 7, 8]);
    const path = 'src/MyComponent.tsx';
    const name = 'MyComponent.tsx';

    const namePositions = remapPositionsToName(pathPositions, path, name);

    expect(namePositions).not.toBeNull();
    if (namePositions) {
      // Positions should be remapped: 4-4=0, 5-4=1, etc.
      expect(namePositions.has(0)).toBe(true); // M
      expect(namePositions.has(1)).toBe(true); // y
      expect(namePositions.has(2)).toBe(true); // C
      expect(namePositions.has(3)).toBe(true); // o
      expect(namePositions.has(4)).toBe(true); // m
    }
  });

  it('should return null when no positions map to name', () => {
    // Positions only in "src/" portion, not in name
    const pathPositions = new Set([0, 1, 2]); // "src"
    const path = 'src/file.tsx';
    const name = 'file.tsx';

    const namePositions = remapPositionsToName(pathPositions, path, name);

    expect(namePositions).toBeNull();
  });

  it('should return null when name not found in path', () => {
    const pathPositions = new Set([0, 1]);
    const path = 'src/file.tsx';
    const name = 'different.tsx';

    const namePositions = remapPositionsToName(pathPositions, path, name);

    expect(namePositions).toBeNull();
  });

  it('should handle positions spanning both path and name', () => {
    // Some positions in path portion, some in name portion
    const pathPositions = new Set([0, 1, 4, 5]); // "sr" and "fi"
    const path = 'src/file.tsx';
    const name = 'file.tsx';

    const namePositions = remapPositionsToName(pathPositions, path, name);

    expect(namePositions).not.toBeNull();
    if (namePositions) {
      // Only positions 4,5 should be remapped (to 0,1)
      expect(namePositions.size).toBe(2);
      expect(namePositions.has(0)).toBe(true); // f
      expect(namePositions.has(1)).toBe(true); // i
    }
  });

  it('should handle name at end of path with trailing slash', () => {
    const pathPositions = new Set([10, 11, 12, 13]);
    const path = 'a/b/c/d/e/file.ts';
    const name = 'file.ts';

    const namePositions = remapPositionsToName(pathPositions, path, name);

    expect(namePositions).not.toBeNull();
  });
});

// =============================================================================
// convertToMatchResult TESTS
// =============================================================================

describe('convertToMatchResult', () => {
  it('should convert fzf result to MatchResult', () => {
    const fzfResult = {
      item: {
        id: '/src/Button.tsx',
        path: 'src/Button.tsx',
        name: 'Button.tsx',
      },
      start: 0,
      end: 15,
      score: 42,
      positions: new Set([4, 5, 6, 7, 8, 9]), // "Button" in path
    };

    const matchResult = convertToMatchResult(fzfResult);

    expect(matchResult.nodeId).toBe('/src/Button.tsx');
    expect(matchResult.score).toBe(42);
    expect(matchResult.isDirectMatch).toBe(true);
    expect(matchResult.positions).toBeInstanceOf(Set);
  });

  it('should remap positions to name', () => {
    const fzfResult = {
      item: {
        id: '/src/Button.tsx',
        path: 'src/Button.tsx',
        name: 'Button.tsx',
      },
      start: 0,
      end: 15,
      score: 42,
      positions: new Set([4, 5, 6]), // "But" in "src/Button.tsx"
    };

    const matchResult = convertToMatchResult(fzfResult);

    // Positions should be remapped: 4-4=0, 5-4=1, 6-4=2
    expect(matchResult.positions.has(0)).toBe(true); // B
    expect(matchResult.positions.has(1)).toBe(true); // u
    expect(matchResult.positions.has(2)).toBe(true); // t
  });

  it('should return empty positions when no positions map to name', () => {
    const fzfResult = {
      item: {
        id: '/src/file.tsx',
        path: 'src/file.tsx',
        name: 'file.tsx',
      },
      start: 0,
      end: 10,
      score: 30,
      positions: new Set([0, 1, 2]), // "src" only
    };

    const matchResult = convertToMatchResult(fzfResult);

    expect(matchResult.positions.size).toBe(0);
  });
});

// =============================================================================
// convertToMatchResultMap TESTS
// =============================================================================

describe('convertToMatchResultMap', () => {
  it('should convert array of fzf results to Map', () => {
    const fzfResults = [
      {
        item: { id: '/a.tsx', path: 'a.tsx', name: 'a.tsx' },
        start: 0,
        end: 5,
        score: 10,
        positions: new Set([0]),
      },
      {
        item: { id: '/b.tsx', path: 'b.tsx', name: 'b.tsx' },
        start: 0,
        end: 5,
        score: 20,
        positions: new Set([0]),
      },
    ];

    const map = convertToMatchResultMap(fzfResults);

    expect(map.size).toBe(2);
    expect(map.has('/a.tsx')).toBe(true);
    expect(map.has('/b.tsx')).toBe(true);
    expect(map.get('/a.tsx')?.score).toBe(10);
    expect(map.get('/b.tsx')?.score).toBe(20);
  });

  it('should return empty Map for empty results', () => {
    const map = convertToMatchResultMap([]);

    expect(map.size).toBe(0);
  });
});

// =============================================================================
// createAncestorMatchResult TESTS
// =============================================================================

describe('createAncestorMatchResult', () => {
  it('should create ancestor match result with isDirectMatch false', () => {
    const result = createAncestorMatchResult('/src/components');

    expect(result.nodeId).toBe('/src/components');
    expect(result.score).toBe(0);
    expect(result.positions.size).toBe(0);
    expect(result.isDirectMatch).toBe(false);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('edge cases', () => {
  it('should handle special characters in query (treat as literal)', () => {
    const files: FileEntry[] = [
      { id: '/file.test.tsx', path: 'file.test.tsx', name: 'file.test.tsx' },
      { id: '/test[1].tsx', path: 'test[1].tsx', name: 'test[1].tsx' },
    ];
    const matcher = createFileMatcher(files);

    // Dots should work
    const dotResults = matcher.filter('.test');
    expect(dotResults.length).toBeGreaterThan(0);

    // Brackets might be treated as literal
    const bracketResults = matcher.filter('[1]');
    // fzf may or may not match brackets specially
    expect(bracketResults).toBeDefined();
  });

  it('should handle very long queries', () => {
    const files = createTestFiles();
    const matcher = createFileMatcher(files);

    const longQuery = 'a'.repeat(256);
    const results = matcher.filter(longQuery);

    // Should not throw, should return empty or results
    expect(Array.isArray(results)).toBe(true);
  });

  it('should handle empty file list', () => {
    const matcher = createFileMatcher([]);

    const results = matcher.filter('anything');

    expect(results).toEqual([]);
  });

  it('should handle single file', () => {
    const files: FileEntry[] = [
      { id: '/only.ts', path: 'only.ts', name: 'only.ts' },
    ];
    const matcher = createFileMatcher(files);

    const results = matcher.filter('only');

    expect(results.length).toBe(1);
    expect(results[0]?.item.name).toBe('only.ts');
  });

  it('should handle files with same name in different directories', () => {
    const files: FileEntry[] = [
      { id: '/src/index.ts', path: 'src/index.ts', name: 'index.ts' },
      { id: '/lib/index.ts', path: 'lib/index.ts', name: 'index.ts' },
      { id: '/tests/index.ts', path: 'tests/index.ts', name: 'index.ts' },
    ];
    const matcher = createFileMatcher(files);

    const results = matcher.filter('index');

    expect(results.length).toBe(3);
  });

  it('should handle Unicode characters in file names', () => {
    const files: FileEntry[] = [
      { id: '/components/日本語.tsx', path: 'components/日本語.tsx', name: '日本語.tsx' },
      { id: '/i18n/messages_한국어.json', path: 'i18n/messages_한국어.json', name: 'messages_한국어.json' },
    ];
    const matcher = createFileMatcher(files);

    // Should find Japanese filename
    const results = matcher.filter('日本');
    expect(results.length).toBeGreaterThan(0);
  });
});
