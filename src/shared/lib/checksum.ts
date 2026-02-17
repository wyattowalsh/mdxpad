/**
 * Checksum utility for content integrity verification.
 *
 * Per FR-019: Generates SHA-256 checksums for content integrity verification.
 *
 * @module shared/lib/checksum
 */

import { createHash } from 'node:crypto';

/**
 * Computes SHA-256 checksum of content.
 *
 * @param content - The string content to hash
 * @returns Hex-encoded SHA-256 hash (64 characters)
 */
export function computeChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}
