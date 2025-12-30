/**
 * File system type definitions.
 * Defines types for file handles, state, and operations.
 */

/** Unique identifier for an open file */
export type FileId = string & { readonly __brand: 'FileId' };

/**
 * Create a new FileId
 * @returns A unique file identifier
 */
export function createFileId(): FileId {
  return crypto.randomUUID() as FileId;
}

/** Handle to a file (may be untitled) */
export interface FileHandle {
  readonly id: FileId;
  readonly path: string | null; // null for untitled files
  readonly name: string;
}

/** Runtime state of an open file */
export interface FileState {
  readonly handle: FileHandle;
  readonly content: string;
  readonly savedContent: string; // Content at last save
  readonly isDirty: boolean;
}

/** Result of a file operation */
export type FileResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FileError };

/** File operation errors */
export type FileError =
  | { readonly code: 'NOT_FOUND'; readonly path: string }
  | { readonly code: 'PERMISSION_DENIED'; readonly path: string }
  | { readonly code: 'CANCELLED' }
  | { readonly code: 'UNKNOWN'; readonly message: string };
