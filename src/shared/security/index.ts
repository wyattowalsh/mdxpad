/**
 * Security Module
 *
 * Centralized security utilities for the mdxpad preview system.
 * Includes message validation, rate limiting, origin validation, and sanitization.
 * @module shared/security
 */

export {
  validateOrigin,
  isAllowedOrigin,
  getAllowedOrigins,
  type OriginValidationResult,
} from './origin-validator';

export {
  createRateLimiter,
  type RateLimiter,
  type RateLimiterConfig,
} from './rate-limiter';

export {
  validateParentToIframeMessage,
  validateIframeToParentMessage,
  createSecureMessageHandler,
  type SecureMessageHandlerConfig,
  type MessageValidationResult,
} from './message-validator';

export {
  sanitizeTextContent,
  sanitizeErrorMessage,
  sanitizeComponentStack,
  type SanitizeOptions,
} from './sanitizer';

export {
  generateNonce,
  createNonceCSP,
  type NonceCSPResult,
} from './csp-nonce';

export {
  SECURITY_CONSTANTS,
  type SecurityConfig,
} from './constants';

export {
  computeHash,
  verifyIntegrity,
  createIntegrityAttribute,
  verifyBlobIntegrity,
  isIntegrityCheckingSupported,
  type IntegrityCheckResult,
  type HashAlgorithm,
} from './integrity';
