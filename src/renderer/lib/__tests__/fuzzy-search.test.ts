/**
 * Tests for fuzzy-search.ts
 *
 * Tests fuzzy matching accuracy, scoring, ranking, and highlight generation.
 */

import { describe, it, expect } from 'vitest';
import { fuzzyMatch, fuzzySearch, highlightMatches, normalizeShortcut } from '../fuzzy-search';

describe('fuzzyMatch', () => {
  it('should match empty query against any target', () => {
    const result = fuzzyMatch('', 'anything');
    expect(result).not.toBeNull();
    expect(result!.score).toBe(0);
    expect(result!.matches).toEqual([]);
  });

  it('should return null for non-matching query', () => {
    const result = fuzzyMatch('xyz', 'hello');
    expect(result).toBeNull();
  });

  it('should find exact substring matches', () => {
    const result = fuzzyMatch('hello', 'hello world');
    expect(result).not.toBeNull();
    expect(result!.matches).toEqual([0, 1, 2, 3, 4]);
  });

  it('should match case-insensitively', () => {
    const result = fuzzyMatch('hello', 'HELLO');
    expect(result).not.toBeNull();
  });

  it('should match non-contiguous characters', () => {
    const result = fuzzyMatch('hw', 'hello world');
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBe(2);
  });

  it('should score word boundary matches higher', () => {
    const exact = fuzzyMatch('fb', 'fooBar');
    const middle = fuzzyMatch('fb', 'aafbb');

    expect(exact).not.toBeNull();
    expect(middle).not.toBeNull();
    // Word boundary match should score higher
    expect(exact!.score).toBeGreaterThan(middle!.score);
  });

  it('should score consecutive matches higher', () => {
    const consecutive = fuzzyMatch('abc', 'abcdef');
    const spread = fuzzyMatch('abc', 'a_b_c_');

    expect(consecutive).not.toBeNull();
    expect(spread).not.toBeNull();
    expect(consecutive!.score).toBeGreaterThan(spread!.score);
  });

  it('should score camelCase boundary matches', () => {
    const result = fuzzyMatch('mC', 'myComponent');
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
  });

  it('should penalize trailing characters', () => {
    const short = fuzzyMatch('a', 'ab');
    const long = fuzzyMatch('a', 'abcdefghij');

    expect(short).not.toBeNull();
    expect(long).not.toBeNull();
    expect(short!.score).toBeGreaterThan(long!.score);
  });

  it('should return null when query is longer than remaining matches', () => {
    const result = fuzzyMatch('abcdef', 'abc');
    expect(result).toBeNull();
  });
});

describe('fuzzySearch', () => {
  it('should search string array', () => {
    const items = ['apple', 'banana', 'apricot', 'grape'];
    const results = fuzzySearch('ap', items);

    // 'ap' matches apple, apricot, and grape ('a' in grape, 'p' in grape)
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.map((r) => r.item)).toContain('apple');
    expect(results.map((r) => r.item)).toContain('apricot');
  });

  it('should sort by score descending', () => {
    const items = ['document-store.ts', 'doc.md', 'docker-compose.yml'];
    const results = fuzzySearch('doc', items);

    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }
  });

  it('should work with accessor function', () => {
    const items = [
      { name: 'Alpha', id: 1 },
      { name: 'Beta', id: 2 },
      { name: 'Gamma', id: 3 },
    ];
    const results = fuzzySearch('al', items, (item) => item.name);

    expect(results.length).toBe(1);
    expect(results[0]!.item.name).toBe('Alpha');
  });

  it('should return all items for empty query', () => {
    const items = ['a', 'b', 'c'];
    const results = fuzzySearch('', items);

    expect(results.length).toBe(3);
  });

  it('should return empty array when nothing matches', () => {
    const items = ['hello', 'world'];
    const results = fuzzySearch('xyz', items);

    expect(results).toEqual([]);
  });
});

describe('highlightMatches', () => {
  it('should return single non-match segment for empty matches', () => {
    const segments = highlightMatches('hello', []);
    expect(segments).toEqual([{ text: 'hello', isMatch: false }]);
  });

  it('should return empty array for empty text', () => {
    const segments = highlightMatches('', [0]);
    expect(segments).toEqual([]);
  });

  it('should highlight matched characters', () => {
    const segments = highlightMatches('hello', [0, 1]);
    expect(segments).toEqual([
      { text: 'he', isMatch: true },
      { text: 'llo', isMatch: false },
    ]);
  });

  it('should handle non-contiguous matches', () => {
    const segments = highlightMatches('hello', [0, 3]);
    expect(segments).toEqual([
      { text: 'h', isMatch: true },
      { text: 'el', isMatch: false },
      { text: 'l', isMatch: true },
      { text: 'o', isMatch: false },
    ]);
  });

  it('should handle all characters matched', () => {
    const segments = highlightMatches('abc', [0, 1, 2]);
    expect(segments).toEqual([{ text: 'abc', isMatch: true }]);
  });
});

describe('normalizeShortcut', () => {
  it('should sort modifiers alphabetically', () => {
    const result = normalizeShortcut({ key: 'p', modifiers: ['Shift', 'Mod'] });
    expect(result).toBe('Mod+Shift+p');
  });

  it('should handle single modifier', () => {
    const result = normalizeShortcut({ key: 's', modifiers: ['Mod'] });
    expect(result).toBe('Mod+s');
  });

  it('should handle no modifiers', () => {
    const result = normalizeShortcut({ key: 'F1', modifiers: [] });
    expect(result).toBe('F1');
  });

  it('should produce consistent output regardless of modifier order', () => {
    const a = normalizeShortcut({ key: 'k', modifiers: ['Mod', 'Shift', 'Alt'] });
    const b = normalizeShortcut({ key: 'k', modifiers: ['Alt', 'Mod', 'Shift'] });
    expect(a).toBe(b);
  });
});
