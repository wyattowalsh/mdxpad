import type { FileError } from '@shared/types/file';
import { useDocumentStore } from '@renderer/stores/document-store';
import { documentIdForPath } from './document-id';
import { useStatusMessageStore } from '@renderer/stores/status-message-store';

function openFailureMessage(error: FileError): string {
  switch (error.code) {
    case 'PERMISSION_DENIED':
      return 'Open this file from the file dialog before reading it';
    case 'NOT_FOUND':
      return 'That file could not be found';
    case 'CANCELLED':
      return 'Opening the file was cancelled';
    case 'UNKNOWN':
      return error.message;
    default: {
      const unexpected: never = error;
      return unexpected;
    }
  }
}

const SOURCE_EXTENSIONS = ['.mdx', '.md', '.markdown', '.tsx', '.ts', '.jsx', '.js'] as const;

export function importPathCandidates(resolved: string): readonly string[] {
  if (/\.[a-z0-9]+$/i.test(resolved)) {
    return [resolved];
  }
  const files = SOURCE_EXTENSIONS.map((extension) => `${resolved}${extension}`);
  const indexes = SOURCE_EXTENSIONS.map((extension) => `${resolved}/index${extension}`);
  return [resolved, ...files, ...indexes];
}

function showOpenFailure(error: FileError): void {
  useStatusMessageStore.getState().show(openFailureMessage(error));
}

interface OpenSnapshot {
  readonly filePath: string | null;
  readonly content: string;
}

function snapshotDocument(): OpenSnapshot {
  const state = useDocumentStore.getState();
  return { filePath: state.filePath, content: state.content };
}

function documentUnchanged(before: OpenSnapshot): boolean {
  const state = useDocumentStore.getState();
  return state.filePath === before.filePath && state.content === before.content;
}

function stillOnSameFile(before: OpenSnapshot): boolean {
  return useDocumentStore.getState().filePath === before.filePath;
}

function placeOpenedFile(filePath: string, content: string, before: OpenSnapshot): void {
  if (!documentUnchanged(before)) {
    return;
  }
  const state = useDocumentStore.getState();
  if (state.filePath === filePath) {
    return;
  }
  useDocumentStore.getState().openDocument(
    {
      fileId: documentIdForPath(filePath),
      filePath,
      mtime: Date.now(),
    },
    content
  );
}

export async function openFileFromPath(filePath: string): Promise<void> {
  const before = snapshotDocument();
  if (before.filePath === filePath) {
    return;
  }
  const result = await window.mdxpad.readFile(filePath);
  if (!stillOnSameFile(before)) {
    return;
  }
  if (!result.ok) {
    showOpenFailure(result.error);
    return;
  }
  placeOpenedFile(filePath, result.value, before);
}

export async function openFirstExistingFile(paths: readonly string[]): Promise<void> {
  const before = snapshotDocument();
  let missing: FileError | null = null;
  for (const filePath of paths) {
    if (!stillOnSameFile(before)) {
      return;
    }
    const result = await window.mdxpad.readFile(filePath);
    if (!stillOnSameFile(before)) {
      return;
    }
    if (result.ok) {
      placeOpenedFile(filePath, result.value, before);
      return;
    }
    if (result.error.code !== 'NOT_FOUND') {
      showOpenFailure(result.error);
      return;
    }
    missing = result.error;
  }
  if (missing && stillOnSameFile(before)) {
    showOpenFailure(missing);
  }
}
