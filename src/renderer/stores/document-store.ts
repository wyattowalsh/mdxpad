/**
 * Document Store
 *
 * Zustand store with Immer middleware for document state management.
 * Tracks current file, content, and dirty state (in-memory only, no persistence).
 *
 * @module renderer/stores/document-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DocumentState, DocumentFileHandle } from '@shared/types/document';
import { INITIAL_DOCUMENT_STATE } from '@shared/types/document';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract the filename from a file path.
 * Works cross-platform by handling both forward and back slashes.
 *
 * @param filePath - Full path to the file
 * @returns The filename portion of the path
 */
function getFileName(filePath: string): string {
  // Handle both Unix (/) and Windows (\) path separators
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
}

// =============================================================================
// ACTIONS INTERFACE
// =============================================================================

/**
 * Document store actions interface.
 */
export interface DocumentStoreActions {
  /** Initialize store with new document content */
  newDocument: () => void;
  /** Load content from file (after IPC call returns DocumentFileHandle) */
  openDocument: (handle: DocumentFileHandle, content: string) => void;
  /** Update content (called on editor changes) */
  setContent: (content: string) => void;
  /** Mark as saved (after IPC save completes) */
  markSaved: (handle?: DocumentFileHandle) => void;
  /** Reset to initial state */
  reset: () => void;
  /** Update mtime after external check */
  updateMtime: (mtime: number) => void;
}

// =============================================================================
// COMBINED STORE TYPE
// =============================================================================

/**
 * Combined document store type.
 */
export type DocumentStore = DocumentState & DocumentStoreActions;

// =============================================================================
// STORE CREATION
// =============================================================================

/**
 * Document store hook.
 * Manages document state including file info, content, and dirty tracking.
 *
 * @example
 * ```tsx
 * const { content, isDirty, setContent, openDocument, markSaved } = useDocumentStore();
 *
 * // Update content on editor changes
 * setContent(newContent);
 *
 * // After opening a file via IPC
 * openDocument(fileHandle, fileContent);
 *
 * // After saving via IPC
 * markSaved(fileHandle);
 * ```
 */
export const useDocumentStore = create<DocumentStore>()(
  immer((set) => ({
    ...INITIAL_DOCUMENT_STATE,

    newDocument: () =>
      set((draft) => {
        draft.fileId = null;
        draft.filePath = null;
        draft.fileName = 'Untitled';
        draft.content = '';
        draft.savedContent = '';
        draft.isDirty = false;
        draft.lastKnownMtime = null;
      }),

    openDocument: (handle, content) =>
      set((draft) => {
        draft.fileId = handle.fileId;
        draft.filePath = handle.filePath;
        draft.fileName = getFileName(handle.filePath);
        draft.content = content;
        draft.savedContent = content;
        draft.isDirty = false;
        draft.lastKnownMtime = handle.mtime;
      }),

    setContent: (content) =>
      set((draft) => {
        draft.content = content;
        // Compute isDirty based on content vs savedContent
        draft.isDirty = content !== draft.savedContent;
      }),

    markSaved: (handle) =>
      set((draft) => {
        // Update savedContent to match current content
        draft.savedContent = draft.content;
        draft.isDirty = false;

        // If a handle is provided, update file information
        if (handle) {
          draft.fileId = handle.fileId;
          draft.filePath = handle.filePath;
          draft.fileName = getFileName(handle.filePath);
          draft.lastKnownMtime = handle.mtime;
        }
      }),

    reset: () =>
      set((draft) => {
        draft.fileId = null;
        draft.filePath = null;
        draft.fileName = 'Untitled';
        draft.content = '';
        draft.savedContent = '';
        draft.isDirty = false;
        draft.lastKnownMtime = null;
      }),

    updateMtime: (mtime) =>
      set((draft) => {
        draft.lastKnownMtime = mtime;
      }),
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Selector for file path.
 *
 * @param state - Document store state
 * @returns File path or null for untitled documents
 */
export const selectFilePath = (state: DocumentStore): string | null =>
  state.filePath;

/**
 * Selector for file name.
 *
 * @param state - Document store state
 * @returns File name or "Untitled"
 */
export const selectFileName = (state: DocumentStore): string => state.fileName;

/**
 * Selector for content.
 *
 * @param state - Document store state
 * @returns Current content
 */
export const selectContent = (state: DocumentStore): string => state.content;

/**
 * Selector for dirty state.
 *
 * @param state - Document store state
 * @returns Whether document has unsaved changes
 */
export const selectIsDirty = (state: DocumentStore): boolean => state.isDirty;

/**
 * Selector for checking if document is untitled.
 *
 * @param state - Document store state
 * @returns Whether document is untitled (not yet saved to disk)
 */
export const selectIsUntitled = (state: DocumentStore): boolean =>
  state.filePath === null;

/**
 * Selector for last known mtime.
 *
 * @param state - Document store state
 * @returns Last known modification time or null
 */
export const selectLastKnownMtime = (state: DocumentStore): number | null =>
  state.lastKnownMtime;
