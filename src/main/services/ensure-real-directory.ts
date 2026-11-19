/**
 * Create an application directory without following a symlink.
 * A linked directory would store recovery data outside the app folder.
 */

import { promises as fs } from 'node:fs';

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error ? String(error.code) : '';
}

export async function ensureRealDirectory(directory: string): Promise<void> {
  try {
    const info = await fs.lstat(directory);
    if (info.isSymbolicLink()) {
      await fs.unlink(directory);
    } else if (typeof info.isDirectory === 'function' && info.isDirectory()) {
      return;
    }
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') {
      throw error;
    }
  }
  await fs.mkdir(directory, { recursive: true });
}
