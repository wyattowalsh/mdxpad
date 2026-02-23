/**
 * Tests for Checksum utility
 *
 * Covers SHA-256 checksum computation for content integrity verification.
 *
 * @module shared/lib/__tests__/checksum.test
 */

import { describe, it, expect } from 'vitest';
import { computeChecksum } from '../checksum';

describe('computeChecksum', () => {
  it('should return a hex string of 64 characters', () => {
    const result = computeChecksum('hello');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce consistent results for same input', () => {
    const a = computeChecksum('test content');
    const b = computeChecksum('test content');
    expect(a).toBe(b);
  });

  it('should produce different results for different input', () => {
    const a = computeChecksum('content A');
    const b = computeChecksum('content B');
    expect(a).not.toBe(b);
  });

  it('should compute correct SHA-256 for known input', () => {
    // SHA-256 of empty string is well-known
    const emptyHash = computeChecksum('');
    expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should compute correct SHA-256 for "hello"', () => {
    // Known SHA-256 of "hello"
    const hash = computeChecksum('hello');
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('should handle Unicode content correctly', () => {
    const hash1 = computeChecksum('你好');
    const hash2 = computeChecksum('你好');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('should handle emoji', () => {
    const hash = computeChecksum('Hello 🎉');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle newlines', () => {
    const withNewline = computeChecksum('line1\nline2');
    const withoutNewline = computeChecksum('line1line2');
    expect(withNewline).not.toBe(withoutNewline);
  });

  it('should handle large content', () => {
    const largeContent = 'x'.repeat(1024 * 1024); // 1MB
    const hash = computeChecksum(largeContent);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should be sensitive to single character changes', () => {
    const hash1 = computeChecksum('abc');
    const hash2 = computeChecksum('abd');
    expect(hash1).not.toBe(hash2);
  });

  it('should be sensitive to whitespace', () => {
    const hash1 = computeChecksum('hello');
    const hash2 = computeChecksum('hello ');
    expect(hash1).not.toBe(hash2);
  });

  it('should use UTF-8 encoding', () => {
    // The function specifies 'utf-8' encoding
    const hash = computeChecksum('\u00e9'); // e with acute accent
    expect(hash).toHaveLength(64);
    // Should be consistent
    expect(hash).toBe(computeChecksum('\u00e9'));
  });
});
