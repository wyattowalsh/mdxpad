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
  readonly canGoUp: boolean;
  readonly openDirectory: (directory: string) => void;
  readonly goUp: () => void;
}

function staysInsideDirectory(root: string, target: string): boolean {
  if (target.includes('\0') || target.split('/').includes('..')) {
    return false;
  }
  return target === root || target.startsWith(`${root}/`);
}

export function useOpenedFolderFiles(filePath: string | null): OpenedFolderFiles {
  const root = directoryOfOpenedFile(filePath);
  const [browse, setBrowse] = useState<string | null>(null);
  const [files, setFiles] = useState<readonly FileListEntry[]>(EMPTY_FILES);
  const [error, setError] = useState<string | null>(null);
  const directory =
    root !== null && browse !== null && staysInsideDirectory(root, browse) ? browse : root;

  useEffect(() => {
    setBrowse(null);
  }, [root]);

  const openDirectory = (next: string): void => {
    if (root !== null && staysInsideDirectory(root, next) && next !== root) {
      setBrowse(next);
    }
  };

  const goUp = (): void => {
    if (directory === null || root === null || directory === root) {
      return;
    }
    const parent = directory.slice(0, directory.lastIndexOf('/'));
    setBrowse(parent.length > 0 && staysInsideDirectory(root, parent) ? parent : null);
  };

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

  return {
    files,
    error,
    canGoUp: directory !== null && root !== null && directory !== root,
    openDirectory,
    goUp,
  };
}
