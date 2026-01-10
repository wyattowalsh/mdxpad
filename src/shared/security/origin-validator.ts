/**
 * Origin Validator
 *
 * Validates postMessage origins to prevent cross-origin attacks.
 * @module shared/security/origin-validator
 */

import { SECURITY_CONSTANTS } from './constants';

/**
 * Result of origin validation
 */
export interface OriginValidationResult {
  /** Whether the origin is allowed */
  readonly allowed: boolean;
  /** Reason for the decision */
  readonly reason: string;
  /** The validated origin */
  readonly origin: string;
}

/**
 * Gets the list of allowed origins based on environment.
 *
 * In development mode, localhost origins are allowed.
 * In production, only file:// and sandboxed iframe origins are allowed.
 *
 * @param isDev - Whether running in development mode
 * @returns Array of allowed origins
 */
export function getAllowedOrigins(isDev: boolean = false): readonly string[] {
  const baseOrigins = [...SECURITY_CONSTANTS.allowedOrigins];

  // In dev mode, allow localhost for dev server
  // This is safe because dev mode is only enabled during local development
  if (isDev) {
    // Common localhost origins for Vite dev server
    baseOrigins.push('http://localhost:5173');
    baseOrigins.push('http://localhost:5174');
    baseOrigins.push('http://localhost:3000');
    baseOrigins.push('http://127.0.0.1:5173');
    baseOrigins.push('http://127.0.0.1:5174');
    baseOrigins.push('http://127.0.0.1:3000');
  }

  return baseOrigins;
}

/**
 * Checks if an origin matches the allowed localhost pattern.
 *
 * @param origin - Origin to check
 * @returns True if origin is a localhost origin
 */
function isLocalhostOrigin(origin: string): boolean {
  try {
    // Handle 'null' origin (sandboxed iframes)
    if (origin === 'null') {
      return false;
    }

    const url = new URL(origin);
    return (
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      url.protocol === 'http:'
    );
  } catch {
    return false;
  }
}

/**
 * Validates whether an origin is allowed for postMessage communication.
 *
 * Security considerations:
 * - Sandboxed iframes report origin as 'null' (string, not null value)
 * - Electron file:// protocol has origin 'file://'
 * - Dev mode allows localhost for dev server
 * - All other origins are rejected
 *
 * @param origin - The origin from MessageEvent
 * @param currentOrigin - The current window's origin (for same-origin check)
 * @param isDev - Whether running in development mode
 * @returns Validation result with allowed status and reason
 */
export function validateOrigin(
  origin: string,
  currentOrigin: string,
  isDev: boolean = false
): OriginValidationResult {
  // Same-origin is always allowed
  if (origin === currentOrigin) {
    return {
      allowed: true,
      reason: 'Same origin',
      origin,
    };
  }

  // Check against static allowed origins
  const allowedOrigins = getAllowedOrigins(isDev);
  if (allowedOrigins.includes(origin)) {
    return {
      allowed: true,
      reason: 'Origin in allowed list',
      origin,
    };
  }

  // In dev mode, allow any localhost origin (for dynamic port assignment)
  if (isDev && isLocalhostOrigin(origin)) {
    return {
      allowed: true,
      reason: 'Localhost origin in dev mode',
      origin,
    };
  }

  // All other origins are rejected
  return {
    allowed: false,
    reason: 'Origin not in allowed list',
    origin,
  };
}

/**
 * Simple boolean check for origin validation.
 *
 * @param origin - The origin from MessageEvent
 * @param currentOrigin - The current window's origin
 * @param isDev - Whether running in development mode
 * @returns True if origin is allowed
 */
export function isAllowedOrigin(
  origin: string,
  currentOrigin: string,
  isDev: boolean = false
): boolean {
  return validateOrigin(origin, currentOrigin, isDev).allowed;
}
