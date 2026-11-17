import type { DocumentId } from '@shared/types/document';
import type { FileError } from '@shared/types/file';
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

export async function openFileFromPath(filePath: string): Promise<void> {
  const result = await window.mdxpad.readFile(filePath);
  if (!result.ok) {
    useStatusMessageStore.getState().show(openFailureMessage(result.error));
    return;
  }
  useDocumentStore.getState().openDocument(
    {
      fileId: filePath as unknown as DocumentId,
      filePath,
      mtime: Date.now(),
    },
    result.value
  );
}
