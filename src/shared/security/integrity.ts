/**
 * Resource Integrity Checker
 *
 * Provides utilities for verifying integrity of loaded resources.
 * Uses Subresource Integrity (SRI) where applicable.
 * @module shared/security/integrity
 */

/**
 * Result of integrity verification
 */
export interface IntegrityCheckResult {
  /** Whether the integrity check passed */
  readonly valid: boolean;
  /** The computed hash (if applicable) */
  readonly hash?: string;
  /** Error message (if check failed) */
  readonly error?: string;
}

/**
 * Supported hash algorithms for SRI
 */
export type HashAlgorithm = 'sha256' | 'sha384' | 'sha512';

/**
 * Computes a cryptographic hash of content using Web Crypto API.
 *
 * @param content - Content to hash (string or ArrayBuffer)
 * @param algorithm - Hash algorithm to use
 * @returns Base64-encoded hash with algorithm prefix (SRI format)
 */
export async function computeHash(
  content: string | ArrayBuffer,
  algorithm: HashAlgorithm = 'sha384'
): Promise<string> {
  // Convert string to ArrayBuffer if needed
  const data =
    typeof content === 'string'
      ? new TextEncoder().encode(content)
      : content;

  // Map algorithm name to Web Crypto format
  const cryptoAlgorithm = {
    sha256: 'SHA-256',
    sha384: 'SHA-384',
    sha512: 'SHA-512',
  }[algorithm];

  // Compute hash using Web Crypto API
  const hashBuffer = await crypto.subtle.digest(cryptoAlgorithm, data);

  // Convert to base64
  const hashArray = new Uint8Array(hashBuffer);
  let binary = '';
  for (let i = 0; i < hashArray.length; i++) {
    binary += String.fromCharCode(hashArray[i]!);
  }
  const base64Hash = btoa(binary);

  // Return in SRI format: algorithm-hash
  return `${algorithm}-${base64Hash}`;
}

/**
 * Verifies content against an expected SRI hash.
 *
 * @param content - Content to verify
 * @param expectedHash - Expected hash in SRI format (e.g., "sha384-abc123...")
 * @returns Verification result
 */
export async function verifyIntegrity(
  content: string | ArrayBuffer,
  expectedHash: string
): Promise<IntegrityCheckResult> {
  try {
    // Parse expected hash to get algorithm
    const match = expectedHash.match(/^(sha256|sha384|sha512)-(.+)$/);
    if (!match) {
      return {
        valid: false,
        error: 'Invalid hash format. Expected: algorithm-base64hash',
      };
    }

    const algorithm = match[1] as HashAlgorithm;
    const computedHash = await computeHash(content, algorithm);

    if (computedHash === expectedHash) {
      return {
        valid: true,
        hash: computedHash,
      };
    }

    return {
      valid: false,
      hash: computedHash,
      error: 'Hash mismatch',
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error during integrity check',
    };
  }
}

/**
 * Creates an integrity attribute value for a script or link tag.
 *
 * Usage:
 * ```html
 * <script src="..." integrity={await createIntegrityAttribute(code)}>
 * ```
 *
 * @param content - Content to hash
 * @param algorithm - Hash algorithm (default: sha384)
 * @returns SRI hash string
 */
export async function createIntegrityAttribute(
  content: string,
  algorithm: HashAlgorithm = 'sha384'
): Promise<string> {
  return computeHash(content, algorithm);
}

/**
 * Validates that a blob URL's content matches expected integrity.
 *
 * This is useful for verifying dynamically created blob URLs
 * before loading them as scripts.
 *
 * @param blobUrl - Blob URL to verify
 * @param expectedHash - Expected hash in SRI format
 * @returns Verification result
 */
export async function verifyBlobIntegrity(
  blobUrl: string,
  expectedHash: string
): Promise<IntegrityCheckResult> {
  try {
    // Fetch the blob content
    const response = await fetch(blobUrl);
    if (!response.ok) {
      return {
        valid: false,
        error: `Failed to fetch blob: ${response.status} ${response.statusText}`,
      };
    }

    const content = await response.arrayBuffer();
    return verifyIntegrity(content, expectedHash);
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to fetch blob',
    };
  }
}

/**
 * Checks if Web Crypto API is available for integrity operations.
 *
 * @returns True if integrity checking is supported
 */
export function isIntegrityCheckingSupported(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.digest === 'function'
  );
}
