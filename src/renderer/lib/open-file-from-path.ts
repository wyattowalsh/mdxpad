import type { DocumentId } from '@shared/types/document';
import type { FileError } from '@shared/types/file';
import { checkDirtyState } from '@renderer/commands/file-commands';
import { useDocumentStore } from '@renderer/stores/document-store';
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

function placeOpenedFile(
  filePath: string,
  content: string,
  before: OpenSnapshot,
  alreadyConfirmed: boolean
): void {
  if (!documentUnchanged(before)) {
    return;
  }
  const state = useDocumentStore.getState();
  if (state.filePath === filePath) {
    return;
  }
  if (state.isDirty && !alreadyConfirmed && !checkDirtyState()) {
    return;
  }
  if (!documentUnchanged(before)) {
    return;
  }
  useDocumentStore.getState().openDocument(
    {
      fileId: filePath as unknown as DocumentId,
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
  const confirmed = useDocumentStore.getState().isDirty;
  if (confirmed && !checkDirtyState()) {
    return;
  }
  const result = await window.mdxpad.readFile(filePath);
  if (!result.ok) {
    showOpenFailure(result.error);
    return;
  }
  placeOpenedFile(filePath, result.value, before, confirmed);
}

export async function openFirstExistingFile(paths: readonly string[]): Promise<void> {
  const before = snapshotDocument();
  let missing: FileError | null = null;
  for (const filePath of paths) {
    const result = await window.mdxpad.readFile(filePath);
    if (result.ok) {
      placeOpenedFile(filePath, result.value, before, false);
      return;
    }
    if (result.error.code !== 'NOT_FOUND') {
      showOpenFailure(result.error);
      return;
    }
    missing = result.error;
  }
  if (missing) {
    showOpenFailure(missing);
  }
}
