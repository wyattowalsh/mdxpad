import { useEffect, useState } from 'react';

import type { FileListEntry } from '@shared/contracts/file-schemas';

const EMPTY_FILES: readonly FileListEntry[] = [];

export function directoryOfOpenedFile(filePath: string | null): string | null {
  if (!filePath?.includes('/')) {
    return null;
  }
  const directory = filePath.slice(0, filePath.lastIndexOf('/'));
  return directory.length > 0 ? directory : null;
}

export interface OpenedFolderFiles {
  readonly files: readonly FileListEntry[];
  readonly error: string | null;
}

export function useOpenedFolderFiles(filePath: string | null): OpenedFolderFiles {
  const [files, setFiles] = useState<readonly FileListEntry[]>(EMPTY_FILES);
  const [error, setError] = useState<string | null>(null);
  const directory = directoryOfOpenedFile(filePath);

  useEffect(() => {
    if (!directory || typeof window.mdxpad.listDirectory !== 'function') {
      setFiles(EMPTY_FILES);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    void window.mdxpad
      .listDirectory(directory)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setFiles(result.files);
          setError(null);
          return;
        }
        setFiles(EMPTY_FILES);
        setError(result.error ?? 'Could not list this folder');
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setFiles(EMPTY_FILES);
        setError(caught instanceof Error ? caught.message : 'Could not list this folder');
      });

    return () => {
      cancelled = true;
    };
  }, [directory]);

  return { files, error };
}
