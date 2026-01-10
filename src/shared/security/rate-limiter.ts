/**
 * Rate Limiter
 *
 * Token bucket rate limiter for postMessage flood protection.
 * @module shared/security/rate-limiter
 */

import { SECURITY_CONSTANTS } from './constants';

/**
 * Configuration for rate limiter
 */
export interface RateLimiterConfig {
  /** Maximum number of messages allowed in the window */
  readonly maxMessages: number;
  /** Time window in milliseconds */
  readonly windowMs: number;
}

/**
 * Rate limiter instance
 */
export interface RateLimiter {
  /** Check if a message is allowed and consume a token if so */
  tryConsume(): boolean;
  /** Get current token count */
  getTokens(): number;
  /** Reset the rate limiter */
  reset(): void;
  /** Get stats about the rate limiter */
  getStats(): RateLimiterStats;
}

/**
 * Statistics about rate limiter usage
 */
export interface RateLimiterStats {
  /** Current number of tokens available */
  readonly tokens: number;
  /** Maximum tokens */
  readonly maxTokens: number;
  /** Number of messages rejected since last reset */
  readonly rejected: number;
  /** Number of messages allowed since last reset */
  readonly allowed: number;
  /** Whether the limiter is currently at capacity */
  readonly isLimited: boolean;
}

/**
 * Creates a token bucket rate limiter.
 *
 * Uses a sliding window approach for smooth rate limiting.
 * Tokens refill continuously over time rather than in discrete chunks.
 *
 * @param config - Rate limiter configuration (optional, uses defaults)
 * @returns Rate limiter instance
 */
export function createRateLimiter(config?: Partial<RateLimiterConfig>): RateLimiter {
  const maxTokens = config?.maxMessages ?? SECURITY_CONSTANTS.rateLimitMaxMessages;
  const windowMs = config?.windowMs ?? SECURITY_CONSTANTS.rateLimitWindowMs;

  // Token bucket state
  let tokens = maxTokens;
  let lastRefill = Date.now();
  let rejected = 0;
  let allowed = 0;

  /**
   * Refills tokens based on elapsed time
   */
  function refillTokens(): void {
    const now = Date.now();
    const elapsed = now - lastRefill;

    // Calculate tokens to add based on elapsed time
    // Tokens refill at rate of maxTokens per windowMs
    const tokensToAdd = (elapsed / windowMs) * maxTokens;

    tokens = Math.min(maxTokens, tokens + tokensToAdd);
    lastRefill = now;
  }

  return {
    tryConsume(): boolean {
      refillTokens();

      if (tokens >= 1) {
        tokens -= 1;
        allowed += 1;
        return true;
      }

      rejected += 1;
      return false;
    },

    getTokens(): number {
      refillTokens();
      return Math.floor(tokens);
    },

    reset(): void {
      tokens = maxTokens;
      lastRefill = Date.now();
      rejected = 0;
      allowed = 0;
    },

    getStats(): RateLimiterStats {
      refillTokens();
      return {
        tokens: Math.floor(tokens),
        maxTokens,
        rejected,
        allowed,
        isLimited: tokens < 1,
      };
    },
  };
}
