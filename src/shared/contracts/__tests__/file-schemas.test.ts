/**
 * Tests for file-schemas Zod validation.
 *
 * Tests base schemas, FileHandle, FileError, FileResult factory,
 * IPC channel schemas, auto-save entries, and the channel registry.
 */

import { describe, it, expect, vi } from 'vitest';

const uuidv4 = () => crypto.randomUUID();
import {
  FileIdSchema,
  FilePathSchema,
  FileContentSchema,
  FileHandleSchema,
  FileErrorSchema,
  createFileResultSchema,
  FileResultVoidSchema,
  FileResultStringSchema,
  FileResultHandleSchema,
  FileSaveRequestSchema,
  FileSaveAsRequestSchema,
  FileReadRequestSchema,
  FileWriteRequestSchema,
  AutoSaveEntrySchema,
  RecoverySelectionSchema,
  RecentFileEntrySchema,
  RecentFilesListSchema,
  FileChangeEventSchema,
  createValidatedHandler,
  IPC_SCHEMAS,
} from '../file-schemas';
import { z } from 'zod';

// =============================================================================
// BASE SCHEMAS
// =============================================================================

describe('FileIdSchema', () => {
  it('should accept valid UUID v4', () => {
    const id = uuidv4();
    const result = FileIdSchema.safeParse(id);
    expect(result.success).toBe(true);
  });

  it('should reject non-UUID strings', () => {
    const result = FileIdSchema.safeParse('not-a-uuid');
    expect(result.success).toBe(false);
  });

  it('should reject empty string', () => {
    const result = FileIdSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});

describe('FilePathSchema', () => {
  it('should accept absolute paths', () => {
    const result = FilePathSchema.safeParse('/Users/test/file.mdx');
    expect(result.success).toBe(true);
  });

  it('should reject relative paths', () => {
    const result = FilePathSchema.safeParse('relative/path.mdx');
    expect(result.success).toBe(false);
  });

  it('should reject empty string', () => {
    const result = FilePathSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});

describe('FileContentSchema', () => {
  it('should accept any string', () => {
    expect(FileContentSchema.safeParse('').success).toBe(true);
    expect(FileContentSchema.safeParse('# Hello').success).toBe(true);
  });
});

// =============================================================================
// FILE HANDLE
// =============================================================================

describe('FileHandleSchema', () => {
  it('should accept valid handle with path', () => {
    const result = FileHandleSchema.safeParse({
      id: uuidv4(),
      path: '/test/file.mdx',
      name: 'file.mdx',
    });
    expect(result.success).toBe(true);
  });

  it('should accept handle with null path (untitled)', () => {
    const result = FileHandleSchema.safeParse({
      id: uuidv4(),
      path: null,
      name: 'Untitled',
    });
    expect(result.success).toBe(true);
  });

  it('should reject handle with empty name', () => {
    const result = FileHandleSchema.safeParse({
      id: uuidv4(),
      path: null,
      name: '',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// FILE ERROR
// =============================================================================

describe('FileErrorSchema', () => {
  it('should accept NOT_FOUND error', () => {
    const result = FileErrorSchema.safeParse({ code: 'NOT_FOUND', path: '/missing.mdx' });
    expect(result.success).toBe(true);
  });

  it('should accept PERMISSION_DENIED error', () => {
    const result = FileErrorSchema.safeParse({ code: 'PERMISSION_DENIED', path: '/protected.mdx' });
    expect(result.success).toBe(true);
  });

  it('should accept CANCELLED error', () => {
    const result = FileErrorSchema.safeParse({ code: 'CANCELLED' });
    expect(result.success).toBe(true);
  });

  it('should accept UNKNOWN error', () => {
    const result = FileErrorSchema.safeParse({ code: 'UNKNOWN', message: 'Something broke' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid error code', () => {
    const result = FileErrorSchema.safeParse({ code: 'INVALID_CODE' });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// FILE RESULT FACTORY
// =============================================================================

describe('createFileResultSchema', () => {
  it('should create schema accepting success result', () => {
    const schema = createFileResultSchema(z.number());
    const result = schema.safeParse({ ok: true, value: 42 });
    expect(result.success).toBe(true);
  });

  it('should create schema accepting error result', () => {
    const schema = createFileResultSchema(z.number());
    const result = schema.safeParse({
      ok: false,
      error: { code: 'CANCELLED' },
    });
    expect(result.success).toBe(true);
  });
});

describe('FileResultVoidSchema', () => {
  it('should accept void success', () => {
    const result = FileResultVoidSchema.safeParse({ ok: true, value: undefined });
    expect(result.success).toBe(true);
  });
});

describe('FileResultStringSchema', () => {
  it('should accept string success', () => {
    const result = FileResultStringSchema.safeParse({ ok: true, value: 'content' });
    expect(result.success).toBe(true);
  });
});

describe('FileResultHandleSchema', () => {
  it('should accept handle success', () => {
    const result = FileResultHandleSchema.safeParse({
      ok: true,
      value: { id: uuidv4(), path: '/test.mdx', name: 'test.mdx' },
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// IPC REQUEST SCHEMAS
// =============================================================================

describe('FileSaveRequestSchema', () => {
  it('should accept valid save request', () => {
    const result = FileSaveRequestSchema.safeParse({
      handle: { id: uuidv4(), path: '/test.mdx', name: 'test.mdx' },
      content: '# Content',
    });
    expect(result.success).toBe(true);
  });
});

describe('FileSaveAsRequestSchema', () => {
  it('should accept valid save-as request', () => {
    const result = FileSaveAsRequestSchema.safeParse({ content: '# New Content' });
    expect(result.success).toBe(true);
  });
});

describe('FileReadRequestSchema', () => {
  it('should accept valid read request', () => {
    const result = FileReadRequestSchema.safeParse({ path: '/test.mdx' });
    expect(result.success).toBe(true);
  });

  it('should reject relative path', () => {
    const result = FileReadRequestSchema.safeParse({ path: 'test.mdx' });
    expect(result.success).toBe(false);
  });
});

describe('FileWriteRequestSchema', () => {
  it('should accept valid write request', () => {
    const result = FileWriteRequestSchema.safeParse({ path: '/test.mdx', content: '# Test' });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// AUTO-SAVE & RECOVERY SCHEMAS
// =============================================================================

describe('AutoSaveEntrySchema', () => {
  it('should accept valid entry', () => {
    const result = AutoSaveEntrySchema.safeParse({
      fileId: uuidv4(),
      originalPath: '/test.mdx',
      tempPath: '/tmp/recovery.json',
      savedAt: Date.now(),
      displayName: 'test.mdx',
    });
    expect(result.success).toBe(true);
  });

  it('should accept entry with null original path', () => {
    const result = AutoSaveEntrySchema.safeParse({
      fileId: uuidv4(),
      originalPath: null,
      tempPath: '/tmp/recovery.json',
      savedAt: Date.now(),
      displayName: 'Untitled',
    });
    expect(result.success).toBe(true);
  });
});

describe('RecoverySelectionSchema', () => {
  it('should accept empty selection', () => {
    const result = RecoverySelectionSchema.safeParse({ selectedIds: [] });
    expect(result.success).toBe(true);
  });

  it('should accept selection with valid UUIDs', () => {
    const result = RecoverySelectionSchema.safeParse({
      selectedIds: [uuidv4(), uuidv4()],
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// RECENT FILES
// =============================================================================

describe('RecentFileEntrySchema', () => {
  it('should accept valid entry', () => {
    const result = RecentFileEntrySchema.safeParse({
      path: '/test.mdx',
      accessedAt: Date.now(),
    });
    expect(result.success).toBe(true);
  });
});

describe('RecentFilesListSchema', () => {
  it('should accept up to 10 entries', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      path: `/file-${i}.mdx`,
      accessedAt: Date.now(),
    }));
    const result = RecentFilesListSchema.safeParse(entries);
    expect(result.success).toBe(true);
  });

  it('should reject more than 10 entries', () => {
    const entries = Array.from({ length: 11 }, (_, i) => ({
      path: `/file-${i}.mdx`,
      accessedAt: Date.now(),
    }));
    const result = RecentFilesListSchema.safeParse(entries);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// FILE CHANGE EVENT
// =============================================================================

describe('FileChangeEventSchema', () => {
  it('should accept change event', () => {
    const result = FileChangeEventSchema.safeParse({
      fileId: uuidv4(),
      path: '/test.mdx',
      type: 'change',
    });
    expect(result.success).toBe(true);
  });

  it('should accept unlink event', () => {
    const result = FileChangeEventSchema.safeParse({
      fileId: uuidv4(),
      path: '/test.mdx',
      type: 'unlink',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid event type', () => {
    const result = FileChangeEventSchema.safeParse({
      fileId: uuidv4(),
      path: '/test.mdx',
      type: 'rename',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// VALIDATION HELPER
// =============================================================================

describe('createValidatedHandler', () => {
  it('should pass validated data to handler', async () => {
    const handler = vi.fn().mockResolvedValue('result');
    const schema = z.object({ name: z.string() });
    const validated = createValidatedHandler(schema, handler);

    const result = await validated({ name: 'test' });

    expect(result).toBe('result');
    expect(handler).toHaveBeenCalledWith({ name: 'test' });
  });

  it('should throw on invalid data', async () => {
    const handler = vi.fn();
    const schema = z.object({ name: z.string() });
    const validated = createValidatedHandler(schema, handler);

    await expect(validated({ name: 123 })).rejects.toThrow('Validation failed');
    expect(handler).not.toHaveBeenCalled();
  });
});

// =============================================================================
// CHANNEL REGISTRY
// =============================================================================

describe('IPC_SCHEMAS', () => {
  it('should have all expected channels', () => {
    const channels = Object.keys(IPC_SCHEMAS);
    expect(channels).toContain('mdxpad:file:open');
    expect(channels).toContain('mdxpad:file:save');
    expect(channels).toContain('mdxpad:file:save-as');
    expect(channels).toContain('mdxpad:file:read');
    expect(channels).toContain('mdxpad:file:write');
    expect(channels).toContain('mdxpad:window:close');
    expect(channels).toContain('mdxpad:window:minimize');
    expect(channels).toContain('mdxpad:window:maximize');
    expect(channels).toContain('mdxpad:app:version');
    expect(channels).toContain('mdxpad:app:ready');
  });

  it('each channel should have request and response schemas', () => {
    for (const [, schema] of Object.entries(IPC_SCHEMAS)) {
      expect(schema).toHaveProperty('request');
      expect(schema).toHaveProperty('response');
    }
  });
});
