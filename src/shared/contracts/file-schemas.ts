/**
 * File system IPC contract schemas.
 * Zod schemas for validating all file and window IPC channel payloads.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module file-schemas
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Branded FileId schema.
 * Validates UUID v4 format and applies FileId brand.
 */
export const FileIdSchema = z.string().uuid().brand<'FileId'>();

/** Inferred FileId type from schema */
export type FileId = z.infer<typeof FileIdSchema>;

/**
 * File path schema.
 * Must be an absolute path (starts with /).
 */
export const FilePathSchema = z.string().min(1).startsWith('/');

/**
 * File content schema.
 * UTF-8 string content.
 */
export const FileContentSchema = z.string();

// ============================================================================
// FileHandle Schema
// ============================================================================

/**
 * FileHandle schema - Reference to a file.
 * Path is nullable for untitled files.
 */
export const FileHandleSchema = z.object({
  id: FileIdSchema,
  path: z.string().nullable(),
  name: z.string().min(1),
});

/** Inferred FileHandle type from schema */
export type FileHandle = z.infer<typeof FileHandleSchema>;

// ============================================================================
// FileError Schema
// ============================================================================

/**
 * FileError schema - Typed error codes.
 * Uses discriminated union on 'code' field.
 */
export const FileErrorSchema = z.discriminatedUnion('code', [
  z.object({ code: z.literal('NOT_FOUND'), path: z.string() }),
  z.object({ code: z.literal('PERMISSION_DENIED'), path: z.string() }),
  z.object({ code: z.literal('CANCELLED') }),
  z.object({ code: z.literal('UNKNOWN'), message: z.string() }),
]);

/** Inferred FileError type from schema */
export type FileError = z.infer<typeof FileErrorSchema>;

// ============================================================================
// FileResult Schema
// ============================================================================

/**
 * Generic FileResult factory.
 * Creates a discriminated union on 'ok' field with success value or error.
 *
 * @param valueSchema - Zod schema for the success value
 * @returns Discriminated union schema for FileResult
 */
export function createFileResultSchema<T extends z.ZodType>(valueSchema: T) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: valueSchema }),
    z.object({ ok: z.literal(false), error: FileErrorSchema }),
  ]);
}

/** FileResult with void value */
export const FileResultVoidSchema = createFileResultSchema(z.void());

/** Inferred FileResultVoid type */
export type FileResultVoid = z.infer<typeof FileResultVoidSchema>;

/** FileResult with string value */
export const FileResultStringSchema = createFileResultSchema(z.string());

/** Inferred FileResultString type */
export type FileResultString = z.infer<typeof FileResultStringSchema>;

/** FileResult with FileHandle value */
export const FileResultHandleSchema = createFileResultSchema(FileHandleSchema);

/** Inferred FileResultHandle type */
export type FileResultHandle = z.infer<typeof FileResultHandleSchema>;

// ============================================================================
// IPC Channel Schemas - File Operations
// ============================================================================

/**
 * mdxpad:file:open request schema.
 * Opens file dialog and returns selected file handle.
 * Request: void (no arguments)
 */
export const FileOpenRequestSchema = z.void();

/**
 * mdxpad:file:open response schema.
 * Response: FileResult<FileHandle>
 */
export const FileOpenResponseSchema = FileResultHandleSchema;

/**
 * mdxpad:file:save request schema.
 * Saves content to existing file path.
 */
export const FileSaveRequestSchema = z.object({
  handle: FileHandleSchema,
  content: FileContentSchema,
});

/** Inferred FileSaveRequest type */
export type FileSaveRequest = z.infer<typeof FileSaveRequestSchema>;

/**
 * mdxpad:file:save response schema.
 * Response: FileResult<void>
 */
export const FileSaveResponseSchema = FileResultVoidSchema;

/**
 * mdxpad:file:save-as request schema.
 * Shows save dialog and saves content to new path.
 */
export const FileSaveAsRequestSchema = z.object({
  content: FileContentSchema,
});

/** Inferred FileSaveAsRequest type */
export type FileSaveAsRequest = z.infer<typeof FileSaveAsRequestSchema>;

/**
 * mdxpad:file:save-as response schema.
 * Response: FileResult<FileHandle>
 */
export const FileSaveAsResponseSchema = FileResultHandleSchema;

/**
 * mdxpad:file:read request schema.
 * Reads file contents from path.
 */
export const FileReadRequestSchema = z.object({
  path: FilePathSchema,
});

/** Inferred FileReadRequest type */
export type FileReadRequest = z.infer<typeof FileReadRequestSchema>;

/**
 * mdxpad:file:read response schema.
 * Response: FileResult<string>
 */
export const FileReadResponseSchema = FileResultStringSchema;

/**
 * mdxpad:file:write request schema.
 * Writes content to path.
 */
export const FileWriteRequestSchema = z.object({
  path: FilePathSchema,
  content: FileContentSchema,
});

/** Inferred FileWriteRequest type */
export type FileWriteRequest = z.infer<typeof FileWriteRequestSchema>;

/**
 * mdxpad:file:write response schema.
 * Response: FileResult<void>
 */
export const FileWriteResponseSchema = FileResultVoidSchema;

// ============================================================================
// IPC Channel Schemas - Window Operations
// ============================================================================

/**
 * mdxpad:window:close request schema.
 * Closes current window (with dirty check).
 */
export const WindowCloseRequestSchema = z.void();

/**
 * mdxpad:window:close response schema.
 * May trigger confirmation dialog.
 */
export const WindowCloseResponseSchema = z.void();

/**
 * mdxpad:window:minimize request schema.
 * Minimizes window.
 */
export const WindowMinimizeRequestSchema = z.void();

/**
 * mdxpad:window:minimize response schema.
 */
export const WindowMinimizeResponseSchema = z.void();

/**
 * mdxpad:window:maximize request schema.
 * Toggles maximize window.
 */
export const WindowMaximizeRequestSchema = z.void();

/**
 * mdxpad:window:maximize response schema.
 */
export const WindowMaximizeResponseSchema = z.void();

// ============================================================================
// IPC Channel Schemas - App Operations
// ============================================================================

/**
 * mdxpad:app:version request schema.
 * Gets application version.
 */
export const AppVersionRequestSchema = z.void();

/**
 * mdxpad:app:version response schema.
 * Returns semantic version string (e.g., "0.1.0").
 */
export const AppVersionResponseSchema = z.string();

/**
 * mdxpad:app:ready request schema.
 * Signals renderer is ready.
 */
export const AppReadyRequestSchema = z.void();

/**
 * mdxpad:app:ready response schema.
 */
export const AppReadyResponseSchema = z.void();

// ============================================================================
// Auto-Save Schemas
// ============================================================================

/**
 * Auto-save entry for recovery dialog.
 * Represents a recoverable unsaved file.
 */
export const AutoSaveEntrySchema = z.object({
  fileId: FileIdSchema,
  originalPath: z.string().nullable(),
  tempPath: z.string(),
  savedAt: z.number(),
  displayName: z.string(),
});

/** Inferred AutoSaveEntry type */
export type AutoSaveEntry = z.infer<typeof AutoSaveEntrySchema>;

/**
 * Recovery dialog result.
 * Contains IDs of files selected for recovery.
 */
export const RecoverySelectionSchema = z.object({
  selectedIds: z.array(FileIdSchema),
});

/** Inferred RecoverySelection type */
export type RecoverySelection = z.infer<typeof RecoverySelectionSchema>;

// ============================================================================
// Recent Files Schemas
// ============================================================================

/**
 * Recent file entry.
 * Represents a recently accessed file.
 */
export const RecentFileEntrySchema = z.object({
  path: FilePathSchema,
  accessedAt: z.number(),
});

/** Inferred RecentFileEntry type */
export type RecentFileEntry = z.infer<typeof RecentFileEntrySchema>;

/**
 * Recent files list (max 10).
 * Ordered array of recent file entries.
 */
export const RecentFilesListSchema = z.array(RecentFileEntrySchema).max(10);

/** Inferred RecentFilesList type */
export type RecentFilesList = z.infer<typeof RecentFilesListSchema>;

// ============================================================================
// File Watcher Event Schemas
// ============================================================================

/**
 * External file change notification.
 * Sent from main to renderer when a watched file changes.
 */
export const FileChangeEventSchema = z.object({
  fileId: FileIdSchema,
  path: z.string(),
  type: z.enum(['change', 'unlink']),
});

/** Inferred FileChangeEvent type */
export type FileChangeEvent = z.infer<typeof FileChangeEventSchema>;

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Creates a validated IPC handler wrapper.
 * Validates request payload before passing to handler.
 *
 * @param requestSchema - Zod schema to validate request against
 * @param handler - Handler function receiving validated request
 * @returns Wrapped handler that validates input
 * @throws Error if validation fails
 */
export function createValidatedHandler<TRequest extends z.ZodType, TResponse>(
  requestSchema: TRequest,
  handler: (args: z.infer<TRequest>) => Promise<TResponse>
) {
  return async (rawArgs: unknown): Promise<TResponse> => {
    const parsed = requestSchema.safeParse(rawArgs);
    if (!parsed.success) {
      throw new Error(`Validation failed: ${parsed.error.message}`);
    }
    // Type assertion safe: zod validated the data matches the schema
    return handler(parsed.data as z.infer<TRequest>);
  };
}

// ============================================================================
// Channel Registry
// ============================================================================

/**
 * Type-safe channel registry.
 * Maps channel names to request/response schemas.
 */
export const IPC_SCHEMAS = {
  'mdxpad:file:open': {
    request: FileOpenRequestSchema,
    response: FileOpenResponseSchema,
  },
  'mdxpad:file:save': {
    request: FileSaveRequestSchema,
    response: FileSaveResponseSchema,
  },
  'mdxpad:file:save-as': {
    request: FileSaveAsRequestSchema,
    response: FileSaveAsResponseSchema,
  },
  'mdxpad:file:read': {
    request: FileReadRequestSchema,
    response: FileReadResponseSchema,
  },
  'mdxpad:file:write': {
    request: FileWriteRequestSchema,
    response: FileWriteResponseSchema,
  },
  'mdxpad:window:close': {
    request: WindowCloseRequestSchema,
    response: WindowCloseResponseSchema,
  },
  'mdxpad:window:minimize': {
    request: WindowMinimizeRequestSchema,
    response: WindowMinimizeResponseSchema,
  },
  'mdxpad:window:maximize': {
    request: WindowMaximizeRequestSchema,
    response: WindowMaximizeResponseSchema,
  },
  'mdxpad:app:version': {
    request: AppVersionRequestSchema,
    response: AppVersionResponseSchema,
  },
  'mdxpad:app:ready': {
    request: AppReadyRequestSchema,
    response: AppReadyResponseSchema,
  },
} as const;

/** Inferred IpcSchemas type from registry */
export type IpcSchemas = typeof IPC_SCHEMAS;

/** Union of all IPC channel names */
export type IpcChannel = keyof IpcSchemas;
