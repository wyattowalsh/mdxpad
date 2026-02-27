/**
 * Tests for useComputedFrontmatter hook and pure computation functions.
 */

import { describe, it, expect } from 'vitest';
import {
  computeWordCount,
  computeCharacterCount,
  computeReadingTime,
  computeLastModified,
  computeAllFields,
} from './useComputedFrontmatter';

describe('computeWordCount', () => {
  it('should return 0 for empty string', () => {
    expect(computeWordCount('')).toBe(0);
  });

  it('should return 0 for whitespace-only string', () => {
    expect(computeWordCount('   \n\t  ')).toBe(0);
  });

  it('should count single word', () => {
    expect(computeWordCount('hello')).toBe(1);
  });

  it('should count multiple words', () => {
    expect(computeWordCount('hello world foo bar')).toBe(4);
  });

  it('should handle multiple spaces between words', () => {
    expect(computeWordCount('hello    world')).toBe(2);
  });

  it('should handle newlines and tabs', () => {
    expect(computeWordCount('hello\nworld\tfoo')).toBe(3);
  });

  it('should handle markdown content', () => {
    const md = '# Hello World\n\nThis is a **paragraph** with *emphasis*.';
    // Counts raw tokens including markdown syntax like # and **
    expect(computeWordCount(md)).toBe(9);
  });
});

describe('computeCharacterCount', () => {
  it('should return 0 for empty string', () => {
    expect(computeCharacterCount('')).toBe(0);
  });

  it('should count all characters including spaces', () => {
    expect(computeCharacterCount('hello world')).toBe(11);
  });

  it('should count newlines', () => {
    expect(computeCharacterCount('a\nb')).toBe(3);
  });
});

describe('computeReadingTime', () => {
  it('should return 0 for 0 words', () => {
    expect(computeReadingTime(0)).toBe(0);
  });

  it('should return 1 minute for short content', () => {
    expect(computeReadingTime(50)).toBe(1);
  });

  it('should return 1 minute for exactly 200 words', () => {
    expect(computeReadingTime(200)).toBe(1);
  });

  it('should return 2 minutes for 201 words', () => {
    expect(computeReadingTime(201)).toBe(2);
  });

  it('should return 5 minutes for 1000 words', () => {
    expect(computeReadingTime(1000)).toBe(5);
  });
});

describe('computeLastModified', () => {
  it('should return a valid ISO date string', () => {
    const result = computeLastModified();
    expect(() => new Date(result)).not.toThrow();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('computeAllFields', () => {
  it('should compute all fields from content', () => {
    const content = 'Hello world, this is a test document.';
    const fields = computeAllFields(content);

    expect(fields.wordCount).toBe(7);
    expect(fields.characterCount).toBe(37);
    expect(fields.readingTime).toBe(1);
    expect(fields.lastModified).toBeTruthy();
  });

  it('should handle empty content', () => {
    const fields = computeAllFields('');
    expect(fields.wordCount).toBe(0);
    expect(fields.characterCount).toBe(0);
    expect(fields.readingTime).toBe(0);
  });
});
