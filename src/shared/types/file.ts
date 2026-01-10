/**
 * File system type definitions.
 * Defines types for file handles, state, and operations.
 *
 * Note: FileId uses Zod's branded type from file-schemas.ts as the single source of truth.
 * This ensures type compatibility between schema validation and type definitions.
 */

// Import FileId type and schema from the canonical schema definition
// This ensures a single source of truth for the branded FileId type
import { FileIdSchema, type FileId } from '@shared/contracts/file-schemas';

// Re-export for consumers of this module
export type { FileId };
export { FileIdSchema };

/**
 * Create a new FileId.
 * Uses Zod schema's parse to ensure proper branding.
 * @returns A unique file identifier with proper Zod brand
 */
export function createFileId(): FileId {
  // Use Zod's parse to properly brand the UUID string
  return FileIdSchema.parse(crypto.randomUUID());
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
