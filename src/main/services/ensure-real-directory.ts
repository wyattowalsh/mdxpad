/**
 * Create an application directory without following a symlink.
 * A linked directory would store recovery data outside the app folder.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error ? String(error.code) : '';
}

async function ensureOne(directory: string): Promise<void> {
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

/**
 * Create `directory` as a real folder.
 * When `ownedRoot` is set, a symlink at that root or any directory under it is
 * replaced before the child is created.
 */
export async function ensureRealDirectory(directory: string, ownedRoot?: string): Promise<void> {
  if (ownedRoot === undefined) {
    await ensureOne(directory);
    return;
  }
  const root = path.resolve(ownedRoot);
  const target = path.resolve(directory);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    await ensureOne(target);
    return;
  }
  let current = root;
  await ensureOne(current);
  for (const segment of relative.split(path.sep)) {
    if (segment.length === 0 || segment === '.') {
      continue;
    }
    current = path.join(current, segment);
    await ensureOne(current);
  }
}
