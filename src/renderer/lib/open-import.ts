/**
 * Open a relative import specifier beside the current document.
 * The source editor and the visual editor share this path.
 */

import { importPathCandidates, openFirstExistingFile } from '@renderer/lib/open-file-from-path';
import { joinRelativePath } from '@renderer/lib/resolve-beside-file';
import { useDocumentStore } from '@renderer/stores/document-store';

export function openImportSpecifier(specifier: string): void {
  if (!specifier.startsWith('.')) {
    return;
  }
  const current = useDocumentStore.getState().filePath;
  if (current?.includes('/') !== true) {
    return;
  }
  let decoded = specifier;
  try {
    decoded = decodeURIComponent(specifier);
  } catch {
    return;
  }
  const directory = current.slice(0, current.lastIndexOf('/'));
  const resolved = joinRelativePath(directory, decoded);
  if (resolved) {
    void openFirstExistingFile(importPathCandidates(resolved));
  }
}
