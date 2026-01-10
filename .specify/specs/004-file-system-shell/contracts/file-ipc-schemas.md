# IPC Contract Schemas: File System Shell

**Date**: 2026-01-09
**Feature**: 004-file-system-shell
**Target**: `src/shared/contracts/file-schemas.ts`

## Overview

Zod schemas for validating all file and window IPC channel payloads per Constitution §3.3.

---

## Base Schemas

```typescript
import { z } from 'zod';

/**
 * Branded FileId schema
 * Validates UUID v4 format
 */
export const FileIdSchema = z.string().uuid().brand<'FileId'>();
export type FileId = z.infer<typeof FileIdSchema>;

/**
 * File path schema
 * Must be absolute path (starts with /)
 */
export const FilePathSchema = z.string().min(1).startsWith('/');

/**
 * File content schema
 * UTF-8 string content
 */
export const FileContentSchema = z.string();
```

---

## FileHandle Schema

```typescript
/**
 * FileHandle - Reference to a file
 */
export const FileHandleSchema = z.object({
  id: FileIdSchema,
  path: z.string().nullable(),
  name: z.string().min(1),
});
export type FileHandle = z.infer<typeof FileHandleSchema>;
```

---

## FileError Schema

```typescript
/**
 * FileError - Typed error codes
 */
export const FileErrorSchema = z.discriminatedUnion('code', [
  z.object({ code: z.literal('NOT_FOUND'), path: z.string() }),
  z.object({ code: z.literal('PERMISSION_DENIED'), path: z.string() }),
  z.object({ code: z.literal('CANCELLED') }),
  z.object({ code: z.literal('UNKNOWN'), message: z.string() }),
]);
export type FileError = z.infer<typeof FileErrorSchema>;
```

---

## FileResult Schema

```typescript
/**
 * Generic FileResult factory
 */
export function createFileResultSchema<T extends z.ZodType>(valueSchema: T) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: valueSchema }),
    z.object({ ok: z.literal(false), error: FileErrorSchema }),
  ]);
}

// Specific result schemas
export const FileResultVoidSchema = createFileResultSchema(z.void());
export const FileResultStringSchema = createFileResultSchema(z.string());
export const FileResultHandleSchema = createFileResultSchema(FileHandleSchema);
```

---

## IPC Channel Schemas

### File Operations

#### mdxpad:file:open
```typescript
/**
 * Open file dialog and return selected file handle
 * Request: void (no arguments)
 * Response: FileResult<FileHandle>
 */
export const FileOpenRequestSchema = z.void();
export const FileOpenResponseSchema = FileResultHandleSchema;
```

#### mdxpad:file:save
```typescript
/**
 * Save content to existing file path
 * Request: { handle: FileHandle, content: string }
 * Response: FileResult<void>
 */
export const FileSaveRequestSchema = z.object({
  handle: FileHandleSchema,
  content: FileContentSchema,
});
export const FileSaveResponseSchema = FileResultVoidSchema;
```

#### mdxpad:file:save-as
```typescript
/**
 * Show save dialog and save content to new path
 * Request: { content: string }
 * Response: FileResult<FileHandle>
 */
export const FileSaveAsRequestSchema = z.object({
  content: FileContentSchema,
});
export const FileSaveAsResponseSchema = FileResultHandleSchema;
```

#### mdxpad:file:read
```typescript
/**
 * Read file contents from path
 * Request: { path: string }
 * Response: FileResult<string>
 */
export const FileReadRequestSchema = z.object({
  path: FilePathSchema,
});
export const FileReadResponseSchema = FileResultStringSchema;
```

#### mdxpad:file:write
```typescript
/**
 * Write content to path
 * Request: { path: string, content: string }
 * Response: FileResult<void>
 */
export const FileWriteRequestSchema = z.object({
  path: FilePathSchema,
  content: FileContentSchema,
});
export const FileWriteResponseSchema = FileResultVoidSchema;
```

---

### Window Operations

#### mdxpad:window:close
```typescript
/**
 * Close current window (with dirty check)
 * Request: void
 * Response: void (may trigger confirmation dialog)
 */
export const WindowCloseRequestSchema = z.void();
export const WindowCloseResponseSchema = z.void();
```

#### mdxpad:window:minimize
```typescript
/**
 * Minimize window
 * Request: void
 * Response: void
 */
export const WindowMinimizeRequestSchema = z.void();
export const WindowMinimizeResponseSchema = z.void();
```

#### mdxpad:window:maximize
```typescript
/**
 * Toggle maximize window
 * Request: void
 * Response: void
 */
export const WindowMaximizeRequestSchema = z.void();
export const WindowMaximizeResponseSchema = z.void();
```

---

### App Operations

#### mdxpad:app:version
```typescript
/**
 * Get application version
 * Request: void
 * Response: string
 */
export const AppVersionRequestSchema = z.void();
export const AppVersionResponseSchema = z.string();
```

#### mdxpad:app:ready
```typescript
/**
 * Signal renderer is ready
 * Request: void
 * Response: void
 */
export const AppReadyRequestSchema = z.void();
export const AppReadyResponseSchema = z.void();
```

---

## Auto-Save Schemas

```typescript
/**
 * Auto-save entry for recovery dialog
 */
export const AutoSaveEntrySchema = z.object({
  fileId: FileIdSchema,
  originalPath: z.string().nullable(),
  tempPath: z.string(),
  savedAt: z.number(),
  displayName: z.string(),
});
export type AutoSaveEntry = z.infer<typeof AutoSaveEntrySchema>;

/**
 * Recovery dialog result
 */
export const RecoverySelectionSchema = z.object({
  selectedIds: z.array(FileIdSchema),
});
export type RecoverySelection = z.infer<typeof RecoverySelectionSchema>;
```

---

## Recent Files Schemas

```typescript
/**
 * Recent file entry
 */
export const RecentFileEntrySchema = z.object({
  path: FilePathSchema,
  accessedAt: z.number(),
});
export type RecentFileEntry = z.infer<typeof RecentFileEntrySchema>;

/**
 * Recent files list (max 10)
 */
export const RecentFilesListSchema = z.array(RecentFileEntrySchema).max(10);
export type RecentFilesList = z.infer<typeof RecentFilesListSchema>;
```

---

## File Watcher Event Schemas

```typescript
/**
 * External file change notification
 * Sent from main to renderer
 */
export const FileChangeEventSchema = z.object({
  fileId: FileIdSchema,
  path: z.string(),
  type: z.enum(['change', 'unlink']),
});
export type FileChangeEvent = z.infer<typeof FileChangeEventSchema>;
```

---

## Validation Helper

```typescript
/**
 * Validated IPC handler wrapper
 */
export function createValidatedHandler<
  TRequest extends z.ZodType,
  TResponse
>(
  requestSchema: TRequest,
  handler: (args: z.infer<TRequest>) => Promise<TResponse>
) {
  return async (rawArgs: unknown): Promise<TResponse> => {
    const parsed = requestSchema.safeParse(rawArgs);
    if (!parsed.success) {
      throw new Error(`Validation failed: ${parsed.error.message}`);
    }
    return handler(parsed.data);
  };
}
```

---

## Channel Registry

```typescript
/**
 * Type-safe channel registry
 * Maps channel names to request/response schemas
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

export type IpcSchemas = typeof IPC_SCHEMAS;
export type IpcChannel = keyof IpcSchemas;
```
