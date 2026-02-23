/**
 * Tests for Origin Validator
 *
 * Covers origin validation for postMessage communication including
 * same-origin checks, allowed origins, dev mode localhost handling,
 * and rejection of disallowed origins.
 *
 * @module shared/security/__tests__/origin-validator.test
 */

import { describe, it, expect } from 'vitest';
import { getAllowedOrigins, validateOrigin, isAllowedOrigin } from '../origin-validator';

describe('getAllowedOrigins', () => {
  it('should include file:// in production', () => {
    const origins = getAllowedOrigins(false);
    expect(origins).toContain('file://');
  });

  it('should include "null" for sandboxed iframes', () => {
    const origins = getAllowedOrigins(false);
    expect(origins).toContain('null');
  });

  it('should include localhost origins in dev mode', () => {
    const origins = getAllowedOrigins(true);
    expect(origins).toContain('http://localhost:5173');
    expect(origins).toContain('http://localhost:5174');
    expect(origins).toContain('http://localhost:3000');
    expect(origins).toContain('http://127.0.0.1:5173');
    expect(origins).toContain('http://127.0.0.1:5174');
    expect(origins).toContain('http://127.0.0.1:3000');
  });

  it('should not include localhost origins in production', () => {
    const origins = getAllowedOrigins(false);
    expect(origins).not.toContain('http://localhost:5173');
    expect(origins).not.toContain('http://127.0.0.1:5173');
  });
});

describe('validateOrigin', () => {
  describe('same-origin', () => {
    it('should allow same origin', () => {
      const result = validateOrigin('file://', 'file://');
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Same origin');
    });

    it('should allow same origin for localhost', () => {
      const result = validateOrigin('http://localhost:5173', 'http://localhost:5173');
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Same origin');
    });
  });

  describe('allowed origins', () => {
    it('should allow file:// origin', () => {
      const result = validateOrigin('file://', 'http://localhost:5173', false);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Origin in allowed list');
    });

    it('should allow "null" origin (sandboxed iframes)', () => {
      const result = validateOrigin('null', 'file://', false);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Origin in allowed list');
    });
  });

  describe('dev mode', () => {
    it('should allow known localhost origins in dev mode', () => {
      const result = validateOrigin('http://localhost:5173', 'file://', true);
      expect(result.allowed).toBe(true);
    });

    it('should allow dynamic localhost ports in dev mode', () => {
      const result = validateOrigin('http://localhost:8080', 'file://', true);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Localhost origin in dev mode');
    });

    it('should allow 127.0.0.1 with any port in dev mode', () => {
      const result = validateOrigin('http://127.0.0.1:9999', 'file://', true);
      expect(result.allowed).toBe(true);
    });

    it('should reject non-localhost origins in dev mode', () => {
      const result = validateOrigin('https://evil.com', 'file://', true);
      expect(result.allowed).toBe(false);
    });

    it('should reject https localhost in dev mode (only http allowed)', () => {
      const result = validateOrigin('https://localhost:5173', 'file://', true);
      expect(result.allowed).toBe(false);
    });
  });

  describe('rejected origins', () => {
    it('should reject external HTTPS origins', () => {
      const result = validateOrigin('https://evil.com', 'file://', false);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Origin not in allowed list');
      expect(result.origin).toBe('https://evil.com');
    });

    it('should reject localhost in production mode', () => {
      const result = validateOrigin('http://localhost:5173', 'file://', false);
      expect(result.allowed).toBe(false);
    });

    it('should reject data: URI origins', () => {
      const result = validateOrigin('data:', 'file://', false);
      expect(result.allowed).toBe(false);
    });

    it('should reject blob: URI origins', () => {
      const result = validateOrigin('blob:http://example.com', 'file://', false);
      expect(result.allowed).toBe(false);
    });

    it('should reject empty string origin', () => {
      const result = validateOrigin('', 'file://', false);
      expect(result.allowed).toBe(false);
    });
  });

  describe('spoofing attempts', () => {
    it('should reject origins containing "file://" as substring', () => {
      const result = validateOrigin('https://file://.evil.com', 'file://', false);
      expect(result.allowed).toBe(false);
    });

    it('should reject localhost-like external domains', () => {
      const result = validateOrigin('http://localhost.evil.com', 'file://', true);
      expect(result.allowed).toBe(false);
    });

    it('should reject origins with different scheme', () => {
      const result = validateOrigin('ftp://localhost:5173', 'file://', true);
      expect(result.allowed).toBe(false);
    });
  });
});

describe('isAllowedOrigin', () => {
  it('should return true for allowed origins', () => {
    expect(isAllowedOrigin('file://', 'file://')).toBe(true);
  });

  it('should return false for disallowed origins', () => {
    expect(isAllowedOrigin('https://evil.com', 'file://', false)).toBe(false);
  });

  it('should pass through isDev flag', () => {
    expect(isAllowedOrigin('http://localhost:5173', 'file://', true)).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173', 'file://', false)).toBe(false);
  });
});
