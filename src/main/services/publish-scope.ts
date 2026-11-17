/**
 * Publish may read only files the user opened, and may write only inside
 * a directory the user chose in the native folder dialog.
 */

import { realpathSync } from 'node:fs';
import path from 'node:path';

import type { PublishConfig } from '@shared/contracts/share-schemas';
import { hasReadCapability } from '@main/ipc/document-capability';

const chosenDirectories = new Set<string>();

function canonicalDirectory(directory: string): string | null {
  try {
    return realpathSync(directory);
  } catch {
    return null;
  }
}

export function rememberChosenDirectory(directory: string): void {
  const canonical = canonicalDirectory(directory);
  if (canonical !== null) {
    chosenDirectories.add(canonical);
  }
}

export function directoryWasChosen(directory: string): boolean {
  const canonical = canonicalDirectory(directory);
  if (canonical === null) {
    return false;
  }
  for (const root of chosenDirectories) {
    if (canonical === root || canonical.startsWith(`${root}${path.sep}`)) {
      return true;
    }
  }
  return false;
}

export function resetChosenDirectories(): void {
  chosenDirectories.clear();
}

export function publishScopeError(config: PublishConfig): string | null {
  if (!directoryWasChosen(config.outputDir)) {
    return 'Choose an output folder before publishing';
  }
  for (const file of config.files) {
    if (!hasReadCapability(file.path)) {
      return `Publish source is not an opened file: ${file.path}`;
    }
  }
  return null;
}
