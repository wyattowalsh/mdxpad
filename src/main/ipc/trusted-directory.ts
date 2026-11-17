/**
 * A directory is readable when the user chose it in the native dialog,
 * or it is the folder of a file they opened.
 */

import { directoryWasChosen } from '@main/services/publish-scope';

import { isWithinOpenedDirectory } from './document-capability';

export function trustedDirectoryError(directory: string): string | null {
  if (directoryWasChosen(directory) || isWithinOpenedDirectory(directory)) {
    return null;
  }
  return 'Choose this folder or open a file in it before reading it';
}
