/**
 * A trusted-directory read may not follow a symlink out of that directory.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export function readStaysInsideDirectory(filePath: string, directory: string): boolean {
  let realDirectory: string;
  try {
    realDirectory = fs.realpathSync(directory);
  } catch {
    return false;
  }

  let realFile: string;
  try {
    realFile = fs.realpathSync(filePath);
  } catch (error: unknown) {
    return isMissingFile(error);
  }

  const relative = path.relative(realDirectory, realFile);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}
