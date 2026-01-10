/**
 * CSP Nonce Generator
 *
 * Generates cryptographically secure nonces for Content Security Policy.
 * @module shared/security/csp-nonce
 */

import { SECURITY_CONSTANTS } from './constants';

/**
 * Result of nonce CSP generation
 */
export interface NonceCSPResult {
  /** The generated nonce value (base64 encoded) */
  readonly nonce: string;
  /** Full CSP header value with nonce */
  readonly csp: string;
  /** CSP meta tag HTML for embedding in pages */
  readonly metaTag: string;
}

/**
 * Generates a cryptographically secure nonce.
 *
 * Uses Web Crypto API (crypto.getRandomValues) for secure random generation.
 * Falls back to Math.random() only if crypto is unavailable (not recommended).
 *
 * The nonce is base64 encoded and URL-safe.
 *
 * @param byteLength - Length of random bytes (default: 16 = 128 bits)
 * @returns Base64-encoded nonce string
 */
export function generateNonce(byteLength: number = SECURITY_CONSTANTS.nonceByteLength): string {
  // Use Web Crypto API if available (preferred)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return bytesToBase64(bytes);
  }

  // Fallback for environments without Web Crypto (Node.js < 15, older browsers)
  // This is less secure but better than nothing
  console.warn(
    '[Security] Web Crypto API not available. Using less secure fallback for nonce generation.'
  );

  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytesToBase64(bytes);
}

/**
 * Converts a Uint8Array to base64 string.
 *
 * Uses URL-safe base64 encoding (no +, /, or =).
 *
 * @param bytes - Bytes to encode
 * @returns Base64-encoded string
 */
function bytesToBase64(bytes: Uint8Array): string {
  // Convert to regular base64
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }

  // In browser/DOM environment
  if (typeof btoa === 'function') {
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // In Node.js environment
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  throw new Error('No base64 encoding function available');
}

/**
 * Base CSP directives for the preview iframe.
 *
 * These are the security policies that protect against various attacks:
 * - default-src 'none': Block everything by default
 * - script-src 'nonce-X': Only allow scripts with matching nonce
 * - style-src 'self' 'unsafe-inline': Allow styles (needed for MDX)
 * - img-src 'self' data: blob: https:: Allow various image sources
 * - font-src 'self' data:: Allow fonts
 * - connect-src 'none': Block network requests
 * - base-uri 'none': Prevent base tag injection
 * - object-src 'none': Block plugins
 * - form-action 'none': Block form submissions
 * - frame-ancestors 'self': Only allow embedding in same origin
 */
const BASE_CSP_DIRECTIVES: Readonly<Record<string, string>> = {
  'default-src': "'none'",
  'script-src': "'self' blob:", // Nonce added dynamically
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data: blob: https:",
  'font-src': "'self' data:",
  'connect-src': "'none'",
  'base-uri': "'none'",
  'object-src': "'none'",
  'form-action': "'none'",
  'frame-ancestors': "'self'",
};

/**
 * Creates a Content Security Policy with a fresh nonce.
 *
 * The returned nonce should be used as an attribute on script tags:
 * <script nonce="generated-nonce">...</script>
 *
 * @returns Nonce, CSP header value, and meta tag HTML
 */
export function createNonceCSP(): NonceCSPResult {
  const nonce = generateNonce();

  // Build CSP with nonce for script-src
  const directives = { ...BASE_CSP_DIRECTIVES };
  directives['script-src'] = `'self' blob: 'nonce-${nonce}'`;

  const csp = Object.entries(directives)
    .map(([key, value]) => `${key} ${value}`)
    .join('; ');

  // Create meta tag for embedding in HTML
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttr(csp)}">`;

  return {
    nonce,
    csp,
    metaTag,
  };
}

/**
 * Escapes a string for use in an HTML attribute.
 *
 * @param str - String to escape
 * @returns Escaped string
 */
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
