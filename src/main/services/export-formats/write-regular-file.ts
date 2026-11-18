/**
 * Write an export at its path without following a link already there.
 */

import { lstat, unlink, writeFile } from 'node:fs/promises';

function missingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function replaceOutputLink(filePath: string): Promise<void> {
  try {
    const info = await lstat(filePath);
    if (info.isSymbolicLink()) {
      await unlink(filePath);
    }
  } catch (error) {
    if (!missingFile(error)) {
      throw error;
    }
  }
}

export async function writeRegularFile(filePath: string, content: string | Buffer): Promise<void> {
  await replaceOutputLink(filePath);
  await writeFile(filePath, content);
}
