/**
 * Create an application directory without following a symlink.
 * A linked directory would store recovery data outside the app folder.
 */

import { lstatSync, mkdirSync, unlinkSync, promises as fs } from 'node:fs';
import * as path from 'node:path';

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error ? String(error.code) : '';
}

function notDirectory(directory: string): NodeJS.ErrnoException {
  const error = new Error(`Not a directory: ${directory}`) as NodeJS.ErrnoException;
  error.code = 'ENOTDIR';
  return error;
}

async function ensureOne(directory: string): Promise<void> {
  try {
    const info = await fs.lstat(directory);
    if (info.isSymbolicLink()) {
      await fs.unlink(directory);
    } else if (typeof info.isDirectory === 'function') {
      if (info.isDirectory()) {
        return;
      }
      throw notDirectory(directory);
    }
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') {
      throw error;
    }
  }
  await fs.mkdir(directory, { recursive: true });
}

/**
 * Use `directory` when the caller passed one.
 * The default app directory also records its parent so a linked userData
 * folder is replaced before any child is read.
 */
export function resolveAppDirectory(
  directory: string | undefined,
  defaultDirectory: () => string,
  ownedRoot?: string
): { directory: string; ownedRoot: string | undefined } {
  if (directory !== undefined) {
    return { directory, ownedRoot };
  }
  const resolved = defaultDirectory();
  return { directory: resolved, ownedRoot: ownedRoot ?? path.dirname(resolved) };
}

/**
 * True when `target` is reached by following a symlink at `ownedRoot` or below it.
 * A missing path is not a link. Paths outside the root are left to the caller.
 */
export async function containsDirectoryLink(ownedRoot: string, target: string): Promise<boolean> {
  const root = path.resolve(ownedRoot);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(root, resolvedTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return false;
  }
  const checkpoints = [root];
  let current = root;
  for (const segment of relative.split(path.sep)) {
    if (segment.length === 0 || segment === '.') {
      continue;
    }
    current = path.join(current, segment);
    checkpoints.push(current);
  }
  for (const checkpoint of checkpoints) {
    try {
      const info = await fs.lstat(checkpoint);
      if (info.isSymbolicLink()) {
        return true;
      }
      if (typeof info.isDirectory === 'function' && !info.isDirectory()) {
        return true;
      }
    } catch (error) {
      if (errorCode(error) === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }
  return false;
}

/**
 * True when a directory under `root` is a symlink.
 * The root itself may be a link the user chose.
 */
export async function containsLinkBelowRoot(root: string, target: string): Promise<boolean> {
  const base = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(base, resolvedTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return true;
  }
  let current = base;
  for (const segment of relative.split(path.sep)) {
    if (segment.length === 0 || segment === '.') {
      continue;
    }
    current = path.join(current, segment);
    try {
      const info = await fs.lstat(current);
      if (info.isSymbolicLink()) {
        return true;
      }
      if (typeof info.isDirectory === 'function' && !info.isDirectory()) {
        return true;
      }
    } catch (error) {
      if (errorCode(error) === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }
  return false;
}

/** True when a templates directory or its resources parent is a symlink. */
export async function linkedResourceDirectory(directory: string): Promise<boolean> {
  if (await containsDirectoryLink(directory, directory)) {
    return true;
  }
  const parent = path.dirname(path.resolve(directory));
  if (path.basename(parent).toLowerCase() !== 'resources') {
    return false;
  }
  return containsDirectoryLink(parent, parent);
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

function ensureOneSync(directory: string): void {
  try {
    const info = lstatSync(directory);
    if (info.isSymbolicLink()) {
      unlinkSync(directory);
    } else if (typeof info.isDirectory === 'function') {
      if (info.isDirectory()) {
        return;
      }
      throw notDirectory(directory);
    }
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') {
      throw error;
    }
  }
  mkdirSync(directory, { recursive: true });
}

/** Synchronous form of {@link ensureRealDirectory} for stores that load during construction. */
export function ensureRealDirectorySync(directory: string, ownedRoot?: string): void {
  if (ownedRoot === undefined) {
    ensureOneSync(directory);
    return;
  }
  const root = path.resolve(ownedRoot);
  const target = path.resolve(directory);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    ensureOneSync(target);
    return;
  }
  let current = root;
  ensureOneSync(current);
  for (const segment of relative.split(path.sep)) {
    if (segment.length === 0 || segment === '.') {
      continue;
    }
    current = path.join(current, segment);
    ensureOneSync(current);
  }
}
