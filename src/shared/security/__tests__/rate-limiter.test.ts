/**
 * Tests for Rate Limiter
 *
 * Covers token bucket rate limiting including consumption, refill behavior,
 * stats tracking, reset, and configuration.
 *
 * @module shared/security/__tests__/rate-limiter.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRateLimiter } from '../rate-limiter';
import { SECURITY_CONSTANTS } from '../constants';

describe('createRateLimiter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic consumption', () => {
    it('should allow messages up to the limit', () => {
      const limiter = createRateLimiter({ maxMessages: 3, windowMs: 60000 });

      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(true);
    });

    it('should reject messages after limit is reached', () => {
      const limiter = createRateLimiter({ maxMessages: 2, windowMs: 60000 });

      limiter.tryConsume();
      limiter.tryConsume();
      expect(limiter.tryConsume()).toBe(false);
    });

    it('should use default config from SECURITY_CONSTANTS', () => {
      const limiter = createRateLimiter();
      const stats = limiter.getStats();
      expect(stats.maxTokens).toBe(SECURITY_CONSTANTS.rateLimitMaxMessages);
    });
  });

  describe('token refill', () => {
    it('should refill tokens over time', () => {
      vi.useFakeTimers();
      const limiter = createRateLimiter({ maxMessages: 2, windowMs: 1000 });

      // Consume all tokens
      limiter.tryConsume();
      limiter.tryConsume();
      expect(limiter.tryConsume()).toBe(false);

      // Advance time by full window
      vi.advanceTimersByTime(1000);

      // Should have tokens again
      expect(limiter.tryConsume()).toBe(true);

      vi.useRealTimers();
    });

    it('should partially refill tokens', () => {
      vi.useFakeTimers();
      const limiter = createRateLimiter({ maxMessages: 10, windowMs: 1000 });

      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        limiter.tryConsume();
      }
      expect(limiter.tryConsume()).toBe(false);

      // Advance time by half window -> should get ~5 tokens back
      vi.advanceTimersByTime(500);

      // Should have some tokens
      expect(limiter.getTokens()).toBeGreaterThanOrEqual(4);
      expect(limiter.getTokens()).toBeLessThanOrEqual(6);

      vi.useRealTimers();
    });

    it('should not exceed max tokens', () => {
      vi.useFakeTimers();
      const limiter = createRateLimiter({ maxMessages: 5, windowMs: 1000 });

      // Advance time far beyond window
      vi.advanceTimersByTime(10000);

      // Tokens should be capped at max
      expect(limiter.getTokens()).toBe(5);

      vi.useRealTimers();
    });
  });

  describe('getTokens', () => {
    it('should return current token count', () => {
      const limiter = createRateLimiter({ maxMessages: 5, windowMs: 60000 });
      expect(limiter.getTokens()).toBe(5);

      limiter.tryConsume();
      expect(limiter.getTokens()).toBe(4);
    });

    it('should return floor of token count', () => {
      const limiter = createRateLimiter({ maxMessages: 5, windowMs: 60000 });
      limiter.tryConsume();
      // getTokens should return an integer
      expect(Number.isInteger(limiter.getTokens())).toBe(true);
    });
  });

  describe('reset', () => {
    it('should restore all tokens', () => {
      const limiter = createRateLimiter({ maxMessages: 3, windowMs: 60000 });

      limiter.tryConsume();
      limiter.tryConsume();
      limiter.tryConsume();
      expect(limiter.tryConsume()).toBe(false);

      limiter.reset();
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.getTokens()).toBe(2);
    });

    it('should reset stats counters', () => {
      const limiter = createRateLimiter({ maxMessages: 2, windowMs: 60000 });

      limiter.tryConsume();
      limiter.tryConsume();
      limiter.tryConsume(); // rejected

      limiter.reset();

      const stats = limiter.getStats();
      expect(stats.allowed).toBe(0);
      expect(stats.rejected).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should track allowed messages', () => {
      const limiter = createRateLimiter({ maxMessages: 5, windowMs: 60000 });

      limiter.tryConsume();
      limiter.tryConsume();

      const stats = limiter.getStats();
      expect(stats.allowed).toBe(2);
    });

    it('should track rejected messages', () => {
      const limiter = createRateLimiter({ maxMessages: 1, windowMs: 60000 });

      limiter.tryConsume(); // allowed
      limiter.tryConsume(); // rejected
      limiter.tryConsume(); // rejected

      const stats = limiter.getStats();
      expect(stats.allowed).toBe(1);
      expect(stats.rejected).toBe(2);
    });

    it('should report isLimited correctly', () => {
      const limiter = createRateLimiter({ maxMessages: 1, windowMs: 60000 });

      expect(limiter.getStats().isLimited).toBe(false);

      limiter.tryConsume();
      expect(limiter.getStats().isLimited).toBe(true);
    });

    it('should report maxTokens', () => {
      const limiter = createRateLimiter({ maxMessages: 42, windowMs: 1000 });
      expect(limiter.getStats().maxTokens).toBe(42);
    });

    it('should report current token count', () => {
      const limiter = createRateLimiter({ maxMessages: 10, windowMs: 60000 });
      limiter.tryConsume();
      limiter.tryConsume();
      limiter.tryConsume();

      const stats = limiter.getStats();
      expect(stats.tokens).toBe(7);
    });
  });

  describe('configuration', () => {
    it('should accept partial config', () => {
      const limiter = createRateLimiter({ maxMessages: 50 });
      expect(limiter.getStats().maxTokens).toBe(50);
    });

    it('should use defaults for missing config values', () => {
      const limiter = createRateLimiter({});
      expect(limiter.getStats().maxTokens).toBe(SECURITY_CONSTANTS.rateLimitMaxMessages);
    });

    it('should accept no config', () => {
      const limiter = createRateLimiter();
      expect(limiter.getStats().maxTokens).toBe(SECURITY_CONSTANTS.rateLimitMaxMessages);
    });
  });
});
