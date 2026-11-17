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

export function useOpenedFolderFiles(filePath: string | null): readonly FileListEntry[] {
  const [files, setFiles] = useState<readonly FileListEntry[]>(EMPTY_FILES);
  const directory = directoryOfOpenedFile(filePath);

  useEffect(() => {
    if (!directory || typeof window.mdxpad.listDirectory !== 'function') {
      setFiles(EMPTY_FILES);
      return undefined;
    }

    let cancelled = false;
    void window.mdxpad.listDirectory(directory).then((result) => {
      if (!cancelled) {
        setFiles(result.ok ? result.files : EMPTY_FILES);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [directory]);

  return files;
}
