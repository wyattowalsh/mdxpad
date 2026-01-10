/**
 * Message Validator
 *
 * Zod-based validation for postMessage payloads with security hardening.
 * @module shared/security/message-validator
 */

import { z } from 'zod';
import {
  parentToIframeMessageSchema,
  iframeToParentMessageSchema,
  type ParentToIframeMessage,
  type IframeToParentMessage,
} from '../schemas/preview';
import { SECURITY_CONSTANTS } from './constants';
import { validateOrigin, type OriginValidationResult } from './origin-validator';
import { createRateLimiter, type RateLimiter } from './rate-limiter';
import { sanitizeErrorMessage, sanitizeComponentStack } from './sanitizer';

/**
 * Result of message validation
 */
export interface MessageValidationResult<T> {
  /** Whether the message is valid */
  readonly valid: boolean;
  /** Validated and typed message (if valid) */
  readonly data?: T;
  /** Error message (if invalid) */
  readonly error?: string;
  /** Validation details for debugging */
  readonly details?: z.ZodError;
}

/**
 * Configuration for secure message handler
 */
export interface SecureMessageHandlerConfig {
  /** Whether running in development mode */
  readonly isDev: boolean;
  /** Current window's origin */
  readonly currentOrigin: string;
  /** Custom rate limiter (optional) */
  readonly rateLimiter?: RateLimiter;
  /** Callback when origin is rejected */
  readonly onOriginRejected?: (result: OriginValidationResult) => void;
  /** Callback when rate limit is exceeded */
  readonly onRateLimitExceeded?: () => void;
  /** Callback when validation fails */
  readonly onValidationFailed?: (error: string, details?: z.ZodError) => void;
}

/**
 * Validates a parent-to-iframe message using Zod schema.
 *
 * Security features:
 * - Strict schema validation (no extra properties)
 * - Type narrowing for type-safe handling
 * - Size limits on string fields
 *
 * @param message - Unknown message to validate
 * @returns Validation result with typed data or error
 */
export function validateParentToIframeMessage(
  message: unknown
): MessageValidationResult<ParentToIframeMessage> {
  // Pre-check: ensure message is an object and not too large
  if (typeof message !== 'object' || message === null) {
    return {
      valid: false,
      error: 'Message must be a non-null object',
    };
  }

  // Check approximate size by serializing
  // This is a heuristic - actual memory usage may differ
  try {
    const serialized = JSON.stringify(message);
    if (serialized.length > SECURITY_CONSTANTS.maxMessageSize) {
      return {
        valid: false,
        error: `Message exceeds maximum size of ${SECURITY_CONSTANTS.maxMessageSize} bytes`,
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Message is not JSON-serializable',
    };
  }

  // Validate against schema
  const result = parentToIframeMessageSchema.safeParse(message);

  if (!result.success) {
    return {
      valid: false,
      error: 'Message failed schema validation',
      details: result.error,
    };
  }

  return {
    valid: true,
    data: result.data,
  };
}

/**
 * Validates an iframe-to-parent message using Zod schema.
 *
 * Security features:
 * - Strict schema validation
 * - Sanitization of error messages and component stacks
 * - Size limits on string fields
 *
 * @param message - Unknown message to validate
 * @returns Validation result with typed data or error
 */
export function validateIframeToParentMessage(
  message: unknown
): MessageValidationResult<IframeToParentMessage> {
  // Pre-check: ensure message is an object and not too large
  if (typeof message !== 'object' || message === null) {
    return {
      valid: false,
      error: 'Message must be a non-null object',
    };
  }

  // Check approximate size by serializing
  try {
    const serialized = JSON.stringify(message);
    if (serialized.length > SECURITY_CONSTANTS.maxMessageSize) {
      return {
        valid: false,
        error: `Message exceeds maximum size of ${SECURITY_CONSTANTS.maxMessageSize} bytes`,
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Message is not JSON-serializable',
    };
  }

  // Validate against schema
  const result = iframeToParentMessageSchema.safeParse(message);

  if (!result.success) {
    return {
      valid: false,
      error: 'Message failed schema validation',
      details: result.error,
    };
  }

  // Post-process: sanitize error messages if present
  const data = result.data;
  if (data.type === 'runtime-error') {
    return {
      valid: true,
      data: {
        ...data,
        message: sanitizeErrorMessage(data.message),
        ...(data.componentStack !== undefined
          ? { componentStack: sanitizeComponentStack(data.componentStack) }
          : {}),
      },
    };
  }

  return {
    valid: true,
    data,
  };
}

/**
 * Creates a secure message handler with origin validation and rate limiting.
 *
 * This is the recommended way to handle postMessage events securely.
 * It combines all security checks into a single handler.
 *
 * @param config - Handler configuration
 * @returns Message handler function for use with addEventListener
 */
export function createSecureMessageHandler<T>(
  config: SecureMessageHandlerConfig,
  validator: (message: unknown) => MessageValidationResult<T>,
  onMessage: (message: T, event: MessageEvent) => void
): (event: MessageEvent) => void {
  const rateLimiter = config.rateLimiter ?? createRateLimiter();

  return (event: MessageEvent): void => {
    // Step 1: Validate origin
    const originResult = validateOrigin(
      event.origin,
      config.currentOrigin,
      config.isDev
    );

    if (!originResult.allowed) {
      config.onOriginRejected?.(originResult);
      return;
    }

    // Step 2: Check rate limit
    if (!rateLimiter.tryConsume()) {
      config.onRateLimitExceeded?.();
      return;
    }

    // Step 3: Validate message
    const validationResult = validator(event.data);

    if (!validationResult.valid || validationResult.data === undefined) {
      config.onValidationFailed?.(
        validationResult.error ?? 'Unknown validation error',
        validationResult.details
      );
      return;
    }

    // Step 4: Call handler with validated message
    onMessage(validationResult.data, event);
  };
}
