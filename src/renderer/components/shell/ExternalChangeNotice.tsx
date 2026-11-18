import type { DocumentFileHandle, DocumentId } from '@shared/types/document';
import { liveSourceText } from '@renderer/components/tabs/live-source-text';
import { useDocumentStore, selectExternalChangeDetected } from '@renderer/stores/document-store';

async function saveConflictCopy(content: string, filePath: string | null): Promise<void> {
  if (!('mdxpad' in window)) {
    return;
  }
  const result = await window.mdxpad.saveFileAs(content);
  if (!result.ok || !result.value.path) {
    return;
  }
  const current = useDocumentStore.getState();
  const shown = liveSourceText() ?? current.content;
  if (current.filePath !== filePath || shown !== content) {
    return;
  }
  if (current.content !== content) {
    current.setContent(content);
  }
  const handle: DocumentFileHandle = {
    fileId: result.value.id as unknown as DocumentId,
    filePath: result.value.path,
    mtime: Date.now(),
  };
  current.markSaved(handle);
}

/**
 * Shown when the open file changed on disk while the editor has unsaved edits.
 * Saving stays on Save As so the disk copy is left intact.
 */
export function ExternalChangeNotice(): React.JSX.Element | null {
  const detected = useDocumentStore(selectExternalChangeDetected);
  const fileMissing = useDocumentStore((state) => state.fileMissing);
  const acceptExternalChange = useDocumentStore((state) => state.acceptExternalChange);

  if (fileMissing) {
    return (
      <div
        role="alert"
        className="border-b bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-50"
      >
        This file was deleted. Save writes it back to the same place.
      </div>
    );
  }

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
        <button
          type="button"
          className="underline"
          onClick={() => {
            const snapshot = liveSourceText() ?? useDocumentStore.getState().content;
            void saveConflictCopy(snapshot, useDocumentStore.getState().filePath);
          }}
        >
          Save my version as…
        </button>
      </div>
    </div>
  );
}
