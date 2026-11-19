/**
 * Keep an electron-store file from being a symlink.
 * A link would be followed and parsed as application data.
 */

import { lstatSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

import { ensureRealDirectorySync } from './ensure-real-directory';

export function replaceSymlinkFile(filePath: string): void {
  try {
    if (lstatSync(filePath).isSymbolicLink()) {
      unlinkSync(filePath);
    }
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : '';
    if (code !== 'ENOENT') {
      throw error;
    }
  }
}

function userDataDirectory(): string | null {
  try {
    const directory = app.getPath('userData');
    return directory.length === 0 ? null : directory;
  } catch {
    return null;
  }
}

/** Drop a linked store so electron-store creates a real file instead. */
export function prepareElectronStore(name: string): void {
  const directory = userDataDirectory();
  if (directory === null) {
    return;
  }
  ensureRealDirectorySync(directory);
  replaceSymlinkFile(path.join(directory, `${name}.json`));
}
