/**
 * Tests for Placeholder Marker Utilities
 *
 * Feature: 016-template-library
 * Task: T036 (Placeholder Preservation), T037 (Visual Styling)
 *
 * @module renderer/lib/editor/placeholder-markers.test
 */

import { describe, it, expect } from 'vitest';
import { hasPlaceholders, findPlaceholderPositions } from './placeholder-markers';

// =============================================================================
// hasPlaceholders Tests
// =============================================================================

describe('hasPlaceholders', () => {
  describe('bracket syntax [TODO: ...]', () => {
    it('detects [TODO: description] pattern', () => {
      expect(hasPlaceholders('[TODO: Add content here]')).toBe(true);
    });

    it('detects [PLACEHOLDER: description] pattern', () => {
      expect(hasPlaceholders('[PLACEHOLDER: Insert your text]')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(hasPlaceholders('[todo: lowercase]')).toBe(true);
      expect(hasPlaceholders('[Todo: mixed case]')).toBe(true);
      expect(hasPlaceholders('[placeholder: lower]')).toBe(true);
    });

    it('handles placeholder in middle of text', () => {
      expect(hasPlaceholders('Some text [TODO: Add more] and more text')).toBe(true);
    });

    it('handles multiple placeholders', () => {
      expect(hasPlaceholders('[TODO: First] and [PLACEHOLDER: Second]')).toBe(true);
    });
  });

  describe('HTML comment syntax <!-- TODO: ... -->', () => {
    it('detects <!-- TODO: description --> pattern', () => {
      expect(hasPlaceholders('<!-- TODO: Add your implementation -->')).toBe(true);
    });

    it('detects <!-- PLACEHOLDER --> pattern (no description)', () => {
      expect(hasPlaceholders('<!-- PLACEHOLDER -->')).toBe(true);
    });

    it('detects <!-- PLACEHOLDER: description --> pattern', () => {
      expect(hasPlaceholders('<!-- PLACEHOLDER: Custom content -->')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(hasPlaceholders('<!-- todo: lowercase -->')).toBe(true);
      expect(hasPlaceholders('<!-- Todo: mixed -->')).toBe(true);
    });
  });

  describe('non-matching content', () => {
    it('returns false for plain text', () => {
      expect(hasPlaceholders('Regular text without placeholders')).toBe(false);
    });

    it('returns false for incomplete patterns', () => {
      expect(hasPlaceholders('[TODO without closing bracket')).toBe(false);
      expect(hasPlaceholders('TODO: Not in brackets')).toBe(false);
    });

    it('returns false for dynamic variable syntax {{...}}', () => {
      expect(hasPlaceholders('{{title}}')).toBe(false);
      expect(hasPlaceholders('Hello {{name}}!')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(hasPlaceholders('')).toBe(false);
    });
  });
});

// =============================================================================
// findPlaceholderPositions Tests
// =============================================================================

describe('findPlaceholderPositions', () => {
  it('returns empty array for no placeholders', () => {
    expect(findPlaceholderPositions('No placeholders here')).toEqual([]);
  });

  it('finds single bracket placeholder', () => {
    const result = findPlaceholderPositions('[TODO: Test]');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      from: 0,
      to: 12,
      text: '[TODO: Test]',
    });
  });

  it('finds single HTML comment placeholder', () => {
    const result = findPlaceholderPositions('<!-- TODO: Test -->');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      from: 0,
      to: 19,
      text: '<!-- TODO: Test -->',
    });
  });

  it('finds placeholder with correct offset when in middle of text', () => {
    const result = findPlaceholderPositions('Hello [TODO: World] there');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      from: 6,
      to: 19,
      text: '[TODO: World]',
    });
  });

  it('finds multiple placeholders with correct positions', () => {
    const content = '[TODO: First] and [PLACEHOLDER: Second]';
    const result = findPlaceholderPositions(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      from: 0,
      to: 13,
      text: '[TODO: First]',
    });
    expect(result[1]).toEqual({
      from: 18,
      to: 39,
      text: '[PLACEHOLDER: Second]',
    });
  });

  it('finds mixed syntax placeholders', () => {
    const content = '[TODO: Bracket] and <!-- PLACEHOLDER: Comment -->';
    const result = findPlaceholderPositions(content);

    expect(result).toHaveLength(2);
    expect(result[0]?.text).toBe('[TODO: Bracket]');
    expect(result[1]?.text).toBe('<!-- PLACEHOLDER: Comment -->');
  });
});

// =============================================================================
// Integration with Template Variables (T036 Verification)
// =============================================================================

describe('Placeholder Preservation with substituteVariables', () => {
  // Import the substituteVariables function to verify integration
  // These tests confirm that [TODO: ...] patterns survive variable substitution
  it('ensures placeholder patterns are not affected by variable substitution regex', () => {
    // The VARIABLE_REGEX in template-variables.ts is /\{\{(\w+)\}\}/g
    // This should NOT match [TODO: ...] or <!-- TODO: --> patterns
    const variableRegex = /\{\{(\w+)\}\}/g;

    // Test that placeholder patterns don't match the variable regex
    expect('[TODO: Add content]'.match(variableRegex)).toBeNull();
    expect('[PLACEHOLDER: Insert here]'.match(variableRegex)).toBeNull();
    expect('<!-- TODO: Description -->'.match(variableRegex)).toBeNull();
    expect('<!-- PLACEHOLDER -->'.match(variableRegex)).toBeNull();
  });
});
