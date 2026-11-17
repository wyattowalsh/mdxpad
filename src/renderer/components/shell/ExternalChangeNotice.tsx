import type { DocumentFileHandle, DocumentId } from '@shared/types/document';
import { useDocumentStore, selectExternalChangeDetected } from '@renderer/stores/document-store';

async function saveConflictCopy(content: string): Promise<void> {
  if (!('mdxpad' in window)) {
    return;
  }
  const result = await window.mdxpad.saveFileAs(content);
  if (!result.ok || !result.value.path) {
    return;
  }
  const handle: DocumentFileHandle = {
    fileId: result.value.id as unknown as DocumentId,
    filePath: result.value.path,
    mtime: Date.now(),
  };
  useDocumentStore.getState().markSaved(handle);
}

/**
 * Shown when the open file changed on disk while the editor has unsaved edits.
 * Saving stays on Save As so the disk copy is left intact.
 */
export function ExternalChangeNotice(): React.JSX.Element | null {
  const detected = useDocumentStore(selectExternalChangeDetected);
  const content = useDocumentStore((state) => state.content);
  const acceptExternalChange = useDocumentStore((state) => state.acceptExternalChange);

  if (!detected) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-2 border-b bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-50"
    >
      <p>This file changed on disk. Saving keeps that copy and writes yours somewhere else.</p>
      <div className="flex gap-2">
        <button type="button" className="underline" onClick={acceptExternalChange}>
          Use the version on disk
        </button>
        <button type="button" className="underline" onClick={() => void saveConflictCopy(content)}>
          Save my version as…
        </button>
      </div>
    </div>
  );
}
