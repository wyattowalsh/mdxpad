/**
 * Tests for CSP Nonce Generator
 *
 * Covers nonce generation, base64 encoding, CSP header construction,
 * and meta tag generation.
 *
 * @module shared/security/__tests__/csp-nonce.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateNonce, createNonceCSP } from '../csp-nonce';

describe('generateNonce', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should generate a non-empty string', () => {
    const nonce = generateNonce();
    expect(nonce).toBeTruthy();
    expect(typeof nonce).toBe('string');
    expect(nonce.length).toBeGreaterThan(0);
  });

  it('should generate unique nonces', () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 100; i++) {
      nonces.add(generateNonce());
    }
    // All 100 nonces should be unique
    expect(nonces.size).toBe(100);
  });

  it('should generate URL-safe base64 (no +, /, or =)', () => {
    for (let i = 0; i < 50; i++) {
      const nonce = generateNonce();
      expect(nonce).not.toContain('+');
      expect(nonce).not.toContain('/');
      expect(nonce).not.toContain('=');
    }
  });

  it('should respect custom byte length', () => {
    const shortNonce = generateNonce(8);
    const longNonce = generateNonce(32);
    // Longer byte input produces longer base64 output
    expect(longNonce.length).toBeGreaterThan(shortNonce.length);
  });

  it('should use default byte length of 16 (128 bits)', () => {
    const nonce = generateNonce();
    // 16 bytes -> ~22 base64 chars (without padding)
    expect(nonce.length).toBeGreaterThanOrEqual(20);
    expect(nonce.length).toBeLessThanOrEqual(24);
  });

  it('should only contain base64url characters', () => {
    for (let i = 0; i < 20; i++) {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('should fail fast when secure randomness is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() => generateNonce()).toThrow('Secure random source unavailable');
  });
});

describe('createNonceCSP', () => {
  it('should return nonce, csp, and metaTag', () => {
    const result = createNonceCSP();
    expect(result).toHaveProperty('nonce');
    expect(result).toHaveProperty('csp');
    expect(result).toHaveProperty('metaTag');
  });

  it('should include nonce in CSP script-src directive', () => {
    const { nonce, csp } = createNonceCSP();
    expect(csp).toContain(`'nonce-${nonce}'`);
  });

  it('should include script-src directive', () => {
    const { csp } = createNonceCSP();
    expect(csp).toContain('script-src');
  });

  it('should include default-src none directive', () => {
    const { csp } = createNonceCSP();
    expect(csp).toContain("default-src 'none'");
  });

  it('should include style-src directive', () => {
    const { csp } = createNonceCSP();
    expect(csp).toContain('style-src');
  });

  it('should include img-src directive', () => {
    const { csp } = createNonceCSP();
    expect(csp).toContain('img-src');
  });

  it('should block connect-src', () => {
    const { csp } = createNonceCSP();
    expect(csp).toContain("connect-src 'none'");
  });

  it('should block object-src', () => {
    const { csp } = createNonceCSP();
    expect(csp).toContain("object-src 'none'");
  });

  it('should block form-action', () => {
    const { csp } = createNonceCSP();
    expect(csp).toContain("form-action 'none'");
  });

  it('should block base-uri', () => {
    const { csp } = createNonceCSP();
    expect(csp).toContain("base-uri 'none'");
  });

  it('should restrict frame-ancestors to self', () => {
    const { csp } = createNonceCSP();
    expect(csp).toContain("frame-ancestors 'self'");
  });

  describe('metaTag', () => {
    it('should be a valid meta tag', () => {
      const { metaTag } = createNonceCSP();
      expect(metaTag).toMatch(/^<meta http-equiv="Content-Security-Policy" content="[^"]*">$/);
    });

    it('should escape HTML entities in CSP content', () => {
      const { metaTag } = createNonceCSP();
      // The content attribute value should not contain raw angle brackets
      const contentMatch = /content="([^"]*)"/.exec(metaTag);
      expect(contentMatch).toBeTruthy();
      if (contentMatch) {
        // The CSP itself uses single quotes, not angle brackets
        // Just verify it doesn't contain unescaped HTML
        expect(contentMatch[1]).not.toContain('<');
        expect(contentMatch[1]).not.toContain('>');
      }
    });
  });

  it('should generate fresh nonce on each call', () => {
    const result1 = createNonceCSP();
    const result2 = createNonceCSP();
    expect(result1.nonce).not.toBe(result2.nonce);
    expect(result1.csp).not.toBe(result2.csp);
  });
});
