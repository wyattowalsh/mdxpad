/**
 * Text Statistics Tests
 *
 * Tests for word count, character count, and reading time utilities.
 * Covers edge cases including empty strings, CJK text, and mixed content.
 *
 * @module renderer/lib/text-stats.test
 */

import { describe, it, expect } from 'vitest';
import { countWords, countCharacters, estimateReadingTime } from './text-stats';

describe('countWords', () => {
  it('should return 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('should count single word', () => {
    expect(countWords('hello')).toBe(1);
  });

  it('should count multiple words', () => {
    expect(countWords('hello world foo bar')).toBe(4);
  });

  it('should handle multiple spaces', () => {
    expect(countWords('hello   world')).toBe(2);
  });

  it('should handle leading and trailing whitespace', () => {
    expect(countWords('  hello world  ')).toBe(2);
  });

  it('should handle tabs and newlines', () => {
    expect(countWords('hello\nworld\tfoo')).toBe(3);
  });

  it('should count CJK characters as individual words', () => {
    expect(countWords('hello')).toBe(1);
    // Three CJK characters
    const cjkResult = countWords('\u4f60\u597d\u4e16\u754c');
    expect(cjkResult).toBe(4);
  });

  it('should handle mixed CJK and Latin text', () => {
    // "hello 你好" = 1 word + 2 CJK chars = 3
    const result = countWords('hello \u4f60\u597d');
    expect(result).toBe(3);
  });

  it('should handle only whitespace', () => {
    expect(countWords('   \n\t  ')).toBe(0);
  });

  it('should handle punctuation attached to words', () => {
    expect(countWords('hello, world!')).toBe(2);
  });
});

describe('countCharacters', () => {
  it('should return 0 for empty string', () => {
    expect(countCharacters('')).toBe(0);
  });

  it('should count non-whitespace characters', () => {
    expect(countCharacters('hello')).toBe(5);
  });

  it('should exclude spaces', () => {
    expect(countCharacters('hello world')).toBe(10);
  });

  it('should exclude tabs and newlines', () => {
    expect(countCharacters('hello\n\tworld')).toBe(10);
  });

  it('should count CJK characters', () => {
    expect(countCharacters('\u4f60\u597d')).toBe(2);
  });

  it('should return 0 for whitespace-only string', () => {
    expect(countCharacters('   \n\t  ')).toBe(0);
  });
});

describe('estimateReadingTime', () => {
  it('should return 0 for empty string', () => {
    const result = estimateReadingTime('');
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
  });

  it('should estimate reading time at default 200 WPM', () => {
    // 200 words = 1 minute
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const result = estimateReadingTime(words);
    expect(result.minutes).toBe(1);
    expect(result.seconds).toBe(0);
  });

  it('should handle fractional minutes', () => {
    // 100 words at 200 WPM = 0.5 min = 30 seconds
    const words = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
    const result = estimateReadingTime(words);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(30);
  });

  it('should accept custom WPM', () => {
    // 100 words at 100 WPM = 1 minute
    const words = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
    const result = estimateReadingTime(words, 100);
    expect(result.minutes).toBe(1);
    expect(result.seconds).toBe(0);
  });

  it('should return less than 1 minute for short text', () => {
    const result = estimateReadingTime('hello world');
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBeGreaterThan(0);
  });
});
