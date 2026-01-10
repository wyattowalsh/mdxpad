/**
 * Security Constants
 *
 * Centralized security configuration constants.
 * @module shared/security/constants
 */

/**
 * Security configuration interface
 */
export interface SecurityConfig {
  /** Maximum message size in bytes */
  readonly maxMessageSize: number;
  /** Rate limit: max messages per window */
  readonly rateLimitMaxMessages: number;
  /** Rate limit: window duration in milliseconds */
  readonly rateLimitWindowMs: number;
  /** Allowed origins for postMessage */
  readonly allowedOrigins: readonly string[];
  /** Maximum error message length */
  readonly maxErrorMessageLength: number;
  /** Maximum component stack length */
  readonly maxComponentStackLength: number;
  /** Nonce length in bytes (will be base64 encoded) */
  readonly nonceByteLength: number;
}

/**
 * Security constants for the preview system.
 * These values are carefully chosen to balance security and usability.
 */
export const SECURITY_CONSTANTS: Readonly<SecurityConfig> = {
  /**
   * Maximum message size: 5MB
   * MDX content can be large, but we need to prevent memory exhaustion attacks.
   * 5MB should accommodate most legitimate use cases.
   */
  maxMessageSize: 5 * 1024 * 1024,

  /**
   * Rate limit: 100 messages per second
   * This allows fast typing/updates while preventing flooding attacks.
   * Normal typing produces ~10-20 messages/second at most.
   */
  rateLimitMaxMessages: 100,

  /**
   * Rate limit window: 1 second
   * Short window for responsive feel while still limiting burst attacks.
   */
  rateLimitWindowMs: 1000,

  /**
   * Allowed origins for postMessage communication.
   * - 'file://' for Electron's local file protocol
   * - 'null' for sandboxed iframes (per HTML spec, opaque origin)
   * Note: localhost origins are added dynamically in dev mode only.
   */
  allowedOrigins: ['file://', 'null'] as const,

  /**
   * Maximum error message length: 10KB
   * Error messages should be concise. Long messages may indicate attack attempts.
   */
  maxErrorMessageLength: 10 * 1024,

  /**
   * Maximum component stack length: 50KB
   * Component stacks can be long in deep component trees but shouldn't be unbounded.
   */
  maxComponentStackLength: 50 * 1024,

  /**
   * Nonce byte length: 16 bytes (128 bits)
   * Per CSP specification, nonces should be at least 128 bits of entropy.
   * 16 bytes = 128 bits, which base64 encodes to 24 characters.
   */
  nonceByteLength: 16,
} as const;
