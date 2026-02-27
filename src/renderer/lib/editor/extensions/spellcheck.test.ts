/**
 * Unit tests for Spellcheck extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { spellcheckExtension, isCorrectWord, buildSkipRanges } from './spellcheck';
import { COMMON_WORDS } from './spellcheck-dictionary';

describe('spellcheckExtension', () => {
  it('returns a valid extension', () => {
    const ext = spellcheckExtension();
    expect(ext).toBeDefined();
  });

  it('creates a valid EditorState', () => {
    const state = EditorState.create({
      doc: 'Hello world',
      extensions: [spellcheckExtension()],
    });
    expect(state.doc.toString()).toBe('Hello world');
  });

  it('accepts whitelist option', () => {
    const ext = spellcheckExtension({
      whitelist: ['MDXPad', 'CodeMirror'],
    });
    expect(ext).toBeDefined();
  });

  it('accepts minWordLength option', () => {
    const ext = spellcheckExtension({
      minWordLength: 5,
    });
    expect(ext).toBeDefined();
  });

  it('accepts delay option', () => {
    const ext = spellcheckExtension({
      delay: 1000,
    });
    expect(ext).toBeDefined();
  });
});

describe('COMMON_WORDS', () => {
  it('contains common English words', () => {
    expect(COMMON_WORDS.has('the')).toBe(true);
    expect(COMMON_WORDS.has('and')).toBe(true);
    expect(COMMON_WORDS.has('function')).toBe(true);
  });

  it('contains tech words', () => {
    expect(COMMON_WORDS.has('typescript')).toBe(true);
    expect(COMMON_WORDS.has('react')).toBe(true);
    expect(COMMON_WORDS.has('mdx')).toBe(true);
  });
});

describe('isCorrectWord', () => {
  const emptyWhitelist = new Set<string>();

  it('accepts common English words', () => {
    expect(isCorrectWord('hello', emptyWhitelist)).toBe(false); // Not in our minimal dict
    expect(isCorrectWord('the', emptyWhitelist)).toBe(true);
    expect(isCorrectWord('world', emptyWhitelist)).toBe(true);
  });

  it('accepts single character words', () => {
    expect(isCorrectWord('a', emptyWhitelist)).toBe(true);
    expect(isCorrectWord('I', emptyWhitelist)).toBe(true);
  });

  it('accepts words with digits', () => {
    expect(isCorrectWord('h3llo', emptyWhitelist)).toBe(true);
    expect(isCorrectWord('test123', emptyWhitelist)).toBe(true);
  });

  it('accepts short acronyms', () => {
    expect(isCorrectWord('API', emptyWhitelist)).toBe(true);
    expect(isCorrectWord('URL', emptyWhitelist)).toBe(true);
    expect(isCorrectWord('HTML', emptyWhitelist)).toBe(true);
  });

  it('accepts CamelCase identifiers', () => {
    expect(isCorrectWord('myVariable', emptyWhitelist)).toBe(true);
    expect(isCorrectWord('EditorView', emptyWhitelist)).toBe(true);
  });

  it('accepts whitelisted words', () => {
    const whitelist = new Set(['mdxpad', 'codemirror']);
    expect(isCorrectWord('MDXPad', whitelist)).toBe(true); // CamelCase
    expect(isCorrectWord('codemirror', whitelist)).toBe(true);
  });
});

describe('buildSkipRanges', () => {
  it('skips inline code', () => {
    const text = 'hello `code here` world';
    const ranges = buildSkipRanges(text);

    // Characters inside backticks should be skipped
    expect(ranges.has(6)).toBe(true); // first backtick
    expect(ranges.has(10)).toBe(true); // inside code
    expect(ranges.has(16)).toBe(true); // closing backtick
  });

  it('skips URLs', () => {
    const text = 'visit https://example.com for more';
    const ranges = buildSkipRanges(text);

    expect(ranges.has(6)).toBe(true); // start of URL
    expect(ranges.has(15)).toBe(true); // middle of URL
  });

  it('returns empty set for plain text', () => {
    const ranges = buildSkipRanges('just plain text');
    // No code or URLs to skip
    expect(ranges.size).toBe(0);
  });
});
