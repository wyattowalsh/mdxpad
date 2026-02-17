/**
 * Atomic file write utility.
 *
 * Writes content to a temporary file, then renames to the target path.
 * This ensures the target file is either fully written or doesn't exist,
 * preventing partial writes that could corrupt data.
 *
 * Per FR-015: Atomic write pattern to prevent corruption during crashes.
 *
 * @module shared/lib/atomic-write
 */

import { promises as fs } from 'node:fs';

/** Default temp file suffix */
const TEMP_SUFFIX = '.tmp';

/**
 * Performs an atomic write operation.
 *
 * @param targetPath - Final destination path
 * @param content - Content to write
 * @param tempSuffix - Suffix for temporary file (defaults to '.tmp')
 */
export async function atomicWrite(
  targetPath: string,
  content: string,
  tempSuffix: string = TEMP_SUFFIX,
): Promise<void> {
  const tempPath = `${targetPath}${tempSuffix}`;
  try {
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, targetPath);
  } catch (err) {
    // Best-effort cleanup — ignore errors (file may not exist)
    await fs.unlink(tempPath).catch(() => { /* intentional noop */ });
    throw err;
  }
}
