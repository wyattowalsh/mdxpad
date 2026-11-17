import type { DocumentId } from '@shared/types/document';
import { useDocumentStore } from '@renderer/stores/document-store';

export async function openFileFromPath(filePath: string): Promise<void> {
  const result = await window.mdxpad.readFile(filePath);
  if (!result.ok) {
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
