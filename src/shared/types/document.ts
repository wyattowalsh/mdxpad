/**
 * Document State Types
 *
 * Type definitions for document state management in the mdxpad application.
 * These types define the shape of document state tracked by the document store.
 *
 * @module shared/types/document
 */

// =============================================================================
// BRANDED TYPES
// =============================================================================

/**
 * Branded type for document identifiers.
 * Uses UUID v4 format to uniquely identify documents.
 */
export type DocumentId = string & { readonly __brand: 'DocumentId' };

// =============================================================================
// DOCUMENT FILE HANDLE
// =============================================================================

/**
 * Document file handle interface - returned from file operations.
 * Contains information about an opened/saved document file.
 *
 * Note: Named DocumentFileHandle to avoid conflict with FileHandle in file.ts
 * which has different properties.
 */
export interface DocumentFileHandle {
  /** Unique identifier for this document instance */
  readonly fileId: DocumentId;
  /** Absolute path to the file on disk */
  readonly filePath: string;
  /** Last modification time as Unix timestamp (milliseconds) */
  readonly mtime: number;
}

// =============================================================================
// DOCUMENT STATE
// =============================================================================

/**
 * Document state interface - complete document state.
 * Tracks the current document's content, file association, and dirty state.
 */
export interface DocumentState {
  /** Unique identifier for this document instance, null for untitled */
  readonly fileId: DocumentId | null;
  /** Absolute path to the file on disk, null for untitled */
  readonly filePath: string | null;
  /** Display name for the document (filename or "Untitled") */
  readonly fileName: string;
  /** Current content in the editor */
  readonly content: string;
  /** Content as it was last saved (for dirty comparison) */
  readonly savedContent: string;
  /** Whether the document has unsaved changes (content !== savedContent) */
  readonly isDirty: boolean;
  /** Last known modification time of the file (for external change detection) */
  readonly lastKnownMtime: number | null;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

/**
 * Initial document state for new/untitled documents.
 * Used when creating a new document or resetting the store.
 */
export const INITIAL_DOCUMENT_STATE: DocumentState = {
  fileId: null,
  filePath: null,
  fileName: 'Untitled',
  content: '',
  savedContent: '',
  isDirty: false,
  lastKnownMtime: null,
} as const;
