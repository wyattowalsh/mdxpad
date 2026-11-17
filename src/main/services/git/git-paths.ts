/**
 * Keep git pathspecs inside the directory the user opened.
 */

import { realpathSync } from 'node:fs';
import path from 'node:path';

function canonical(filePath: string): string {
  const resolved = path.resolve(filePath);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function staysInside(root: string, file: string): boolean {
  if (file.includes('\0') || path.isAbsolute(file)) {
    return false;
  }

  const resolved = path.resolve(root, file);
  try {
    const target = realpathSync(resolved);
    const relative = path.relative(root, target);
    return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
  } catch {
    const parent = canonical(path.dirname(resolved));
    const parentRelative = path.relative(root, parent);
    return (
      parentRelative.length === 0 ||
      (!parentRelative.startsWith('..') && !path.isAbsolute(parentRelative))
    );
  }
}

/** Return the paths when every one stays inside workingDir, otherwise null. */
export function pathsInsideDirectory(
  workingDir: string,
  files: readonly string[]
): string[] | null {
  const root = canonical(workingDir);
  const kept: string[] = [];
  for (const file of files) {
    if (!staysInside(root, file)) {
      return null;
    }
    kept.push(file);
  }
  return kept;
}
