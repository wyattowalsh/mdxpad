/**
 * Open every recovered document in the tab bar.
 */

import { documentIdForPath } from '@renderer/lib/document-id';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';
import type { DocumentId } from '@shared/types/document';

import { noteTabEpoch, whileApplyingTabs } from './document-tabs';
import { recoveryDocumentId } from './tab-recovery-id';

export interface RecoveredTabDocument {
  readonly documentId: string;
  readonly filePath: string | null;
  readonly fileName: string;
  readonly content: string;
}

function rememberRecoveredTab(doc: RecoveredTabDocument): string {
  const id = useTabStore.getState().addTab({
    filePath: doc.filePath,
    fileName: doc.fileName,
    isDirty: true,
    content: doc.content,
    savedContent: '',
  });
  recoveryDocumentId(id, () => doc.documentId);
  noteTabEpoch(id);
  return id;
}

function showFirstRecoveredDocument(doc: RecoveredTabDocument): void {
  useDocumentStore.setState((state) => ({
    ...state,
    fileId: (doc.filePath
      ? documentIdForPath(doc.filePath, doc.documentId)
      : doc.documentId) as DocumentId,
    filePath: doc.filePath,
    fileName: doc.fileName,
    content: doc.content,
    savedContent: '',
    isDirty: true,
    lastKnownMtime: null,
    externalChangeDetected: false,
    externalContent: null,
    externalMtime: null,
    fileMissing: false,
  }));
}

/** Open every recovered document, with the first one in the editor. */
export function openRecoveredDocuments(documents: readonly RecoveredTabDocument[]): void {
  const first = documents[0];
  if (!first) {
    return;
  }
  whileApplyingTabs(() => {
    useTabStore.getState().reset();
    let firstId = '';
    for (const doc of documents) {
      const id = rememberRecoveredTab(doc);
      if (firstId.length === 0) {
        firstId = id;
      }
    }
    if (firstId.length > 0) {
      useTabStore.getState().setActiveTab(firstId);
    }
    showFirstRecoveredDocument(first);
  });
}
