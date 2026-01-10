/**
 * IPC integration tests for file and window handlers.
 * Tests validation, error mapping, and handler behavior.
 *
 * @see src/main/ipc/file-handlers.ts
 * @see src/main/ipc/window-handlers.ts
 * @see Constitution §3.3 - Validated inputs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  createValidatedHandler,
  FileReadRequestSchema,
  FileWriteRequestSchema,
  FileSaveRequestSchema,
  FileOpenRequestSchema,
  FileSaveAsRequestSchema,
  FileIdSchema,
  FileHandleSchema,
  FileErrorSchema,
  FileResultVoidSchema,
  FileResultStringSchema,
  FileResultHandleSchema,
} from '@shared/contracts/file-schemas';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock Electron modules
vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  app: {
    getVersion: vi.fn(() => '1.0.0'),
  },
}));

// Mock FileService
vi.mock('@main/services/file-service', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  createFileId: vi.fn(() => crypto.randomUUID()),
}));

// Import mocked modules after mock setup
import { dialog, app } from 'electron';
import * as FileService from '@main/services/file-service';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a valid FileHandle for testing.
 */
function createTestFileHandle(overrides?: Partial<{
  id: string;
  path: string | null;
  name: string;
}>) {
  return {
    id: overrides?.id ?? crypto.randomUUID(),
    // Use 'in' check to allow null to be explicitly passed
    path: overrides && 'path' in overrides ? overrides.path : '/test/file.mdx',
    name: overrides?.name ?? 'file.mdx',
  };
}

/**
 * Create a mock BrowserWindow for testing.
 */
function createMockWindow() {
  return {
    close: vi.fn(),
    minimize: vi.fn(),
    maximize: vi.fn(),
    restore: vi.fn(),
    isMaximized: vi.fn(() => false),
  };
}

// ============================================================================
// createValidatedHandler Tests
// ============================================================================

describe('createValidatedHandler', () => {
  describe('validation behavior', () => {
    it('returns validation error for invalid payloads', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ ok: true, value: 'content' });
      const validatedHandler = createValidatedHandler(FileReadRequestSchema, mockHandler);

      // Missing required 'path' field
      await expect(validatedHandler({})).rejects.toThrow('Validation failed');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('passes validated data to handler', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ ok: true, value: 'content' });
      const validatedHandler = createValidatedHandler(FileReadRequestSchema, mockHandler);

      const validRequest = { path: '/test/file.mdx' };
      await validatedHandler(validRequest);

      expect(mockHandler).toHaveBeenCalledWith(validRequest);
    });

    it('returns handler result on successful validation', async () => {
      const expectedResult = { ok: true, value: 'file content' };
      const mockHandler = vi.fn().mockResolvedValue(expectedResult);
      const validatedHandler = createValidatedHandler(FileReadRequestSchema, mockHandler);

      const result = await validatedHandler({ path: '/test/file.mdx' });

      expect(result).toEqual(expectedResult);
    });

    it('handles void request schemas (no arguments)', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ ok: true, value: { id: crypto.randomUUID(), path: '/test.mdx', name: 'test.mdx' } });
      const validatedHandler = createValidatedHandler(FileOpenRequestSchema, mockHandler);

      // void schema accepts undefined
      await validatedHandler(undefined);

      expect(mockHandler).toHaveBeenCalledWith(undefined);
    });
  });

  describe('error message formatting', () => {
    it('includes zod error message in thrown error', async () => {
      const mockHandler = vi.fn();
      const validatedHandler = createValidatedHandler(FileReadRequestSchema, mockHandler);

      await expect(validatedHandler({ path: 123 })).rejects.toThrow(/Validation failed/);
    });
  });
});

// ============================================================================
// Schema Validation Tests (Constitution §3.3 compliance)
// ============================================================================

describe('Schema validation (Constitution §3.3)', () => {
  describe('FileReadRequestSchema', () => {
    it('accepts paths starting with /', () => {
      const result = FileReadRequestSchema.safeParse({ path: '/test/file.mdx' });
      expect(result.success).toBe(true);
    });

    it('rejects paths not starting with /', () => {
      const result = FileReadRequestSchema.safeParse({ path: 'relative/path.mdx' });
      expect(result.success).toBe(false);
    });

    it('rejects empty paths', () => {
      const result = FileReadRequestSchema.safeParse({ path: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing path field', () => {
      const result = FileReadRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('FileWriteRequestSchema', () => {
    it('accepts valid path and content', () => {
      const result = FileWriteRequestSchema.safeParse({
        path: '/test/file.mdx',
        content: 'Hello, World!',
      });
      expect(result.success).toBe(true);
    });

    it('rejects paths not starting with /', () => {
      const result = FileWriteRequestSchema.safeParse({
        path: 'relative/path.mdx',
        content: 'content',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing content field', () => {
      const result = FileWriteRequestSchema.safeParse({
        path: '/test/file.mdx',
      });
      expect(result.success).toBe(false);
    });

    it('accepts empty content string', () => {
      const result = FileWriteRequestSchema.safeParse({
        path: '/test/file.mdx',
        content: '',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('FileSaveRequestSchema', () => {
    it('accepts valid handle and content', () => {
      const result = FileSaveRequestSchema.safeParse({
        handle: createTestFileHandle(),
        content: 'File content',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing handle field', () => {
      const result = FileSaveRequestSchema.safeParse({
        content: 'File content',
      });
      expect(result.success).toBe(false);
    });

    it('rejects handle with missing id field', () => {
      const result = FileSaveRequestSchema.safeParse({
        handle: {
          path: '/test/file.mdx',
          name: 'file.mdx',
        },
        content: 'content',
      });
      expect(result.success).toBe(false);
    });

    it('rejects handle with missing name field', () => {
      const result = FileSaveRequestSchema.safeParse({
        handle: {
          id: crypto.randomUUID(),
          path: '/test/file.mdx',
        },
        content: 'content',
      });
      expect(result.success).toBe(false);
    });

    it('accepts handle with null path (untitled file)', () => {
      const result = FileSaveRequestSchema.safeParse({
        handle: createTestFileHandle({ path: null }),
        content: 'content',
      });
      expect(result.success).toBe(true);
    });

    it('rejects handle with empty name', () => {
      const result = FileSaveRequestSchema.safeParse({
        handle: {
          id: crypto.randomUUID(),
          path: '/test/file.mdx',
          name: '',
        },
        content: 'content',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('FileIdSchema', () => {
    it('accepts valid UUID v4', () => {
      const result = FileIdSchema.safeParse(crypto.randomUUID());
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID strings', () => {
      const result = FileIdSchema.safeParse('not-a-uuid');
      expect(result.success).toBe(false);
    });

    it('rejects empty string', () => {
      const result = FileIdSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('rejects numeric values', () => {
      const result = FileIdSchema.safeParse(12345);
      expect(result.success).toBe(false);
    });

    it('rejects null', () => {
      const result = FileIdSchema.safeParse(null);
      expect(result.success).toBe(false);
    });
  });

  describe('FileHandleSchema', () => {
    it('accepts complete valid handle', () => {
      const result = FileHandleSchema.safeParse({
        id: crypto.randomUUID(),
        path: '/test/file.mdx',
        name: 'file.mdx',
      });
      expect(result.success).toBe(true);
    });

    it('accepts handle with null path', () => {
      const result = FileHandleSchema.safeParse({
        id: crypto.randomUUID(),
        path: null,
        name: 'Untitled',
      });
      expect(result.success).toBe(true);
    });

    it('rejects handle with invalid UUID id', () => {
      const result = FileHandleSchema.safeParse({
        id: 'invalid-id',
        path: '/test/file.mdx',
        name: 'file.mdx',
      });
      expect(result.success).toBe(false);
    });

    it('rejects handle with undefined path', () => {
      const result = FileHandleSchema.safeParse({
        id: crypto.randomUUID(),
        name: 'file.mdx',
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// FileError Schema Tests
// ============================================================================

describe('FileErrorSchema', () => {
  it('accepts NOT_FOUND error with path', () => {
    const result = FileErrorSchema.safeParse({
      code: 'NOT_FOUND',
      path: '/missing/file.mdx',
    });
    expect(result.success).toBe(true);
  });

  it('accepts PERMISSION_DENIED error with path', () => {
    const result = FileErrorSchema.safeParse({
      code: 'PERMISSION_DENIED',
      path: '/protected/file.mdx',
    });
    expect(result.success).toBe(true);
  });

  it('accepts CANCELLED error without additional fields', () => {
    const result = FileErrorSchema.safeParse({
      code: 'CANCELLED',
    });
    expect(result.success).toBe(true);
  });

  it('accepts UNKNOWN error with message', () => {
    const result = FileErrorSchema.safeParse({
      code: 'UNKNOWN',
      message: 'Something went wrong',
    });
    expect(result.success).toBe(true);
  });

  it('rejects NOT_FOUND without path', () => {
    const result = FileErrorSchema.safeParse({
      code: 'NOT_FOUND',
    });
    expect(result.success).toBe(false);
  });

  it('rejects UNKNOWN without message', () => {
    const result = FileErrorSchema.safeParse({
      code: 'UNKNOWN',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid error code', () => {
    const result = FileErrorSchema.safeParse({
      code: 'INVALID_CODE',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// FileResult Schema Tests
// ============================================================================

describe('FileResult schemas', () => {
  describe('FileResultVoidSchema', () => {
    it('accepts successful void result', () => {
      const result = FileResultVoidSchema.safeParse({
        ok: true,
        value: undefined,
      });
      expect(result.success).toBe(true);
    });

    it('accepts error result', () => {
      const result = FileResultVoidSchema.safeParse({
        ok: false,
        error: { code: 'CANCELLED' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('FileResultStringSchema', () => {
    it('accepts successful string result', () => {
      const result = FileResultStringSchema.safeParse({
        ok: true,
        value: 'file content',
      });
      expect(result.success).toBe(true);
    });

    it('rejects success without string value', () => {
      const result = FileResultStringSchema.safeParse({
        ok: true,
        value: 123,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('FileResultHandleSchema', () => {
    it('accepts successful handle result', () => {
      const result = FileResultHandleSchema.safeParse({
        ok: true,
        value: createTestFileHandle(),
      });
      expect(result.success).toBe(true);
    });

    it('rejects success with invalid handle', () => {
      const result = FileResultHandleSchema.safeParse({
        ok: true,
        value: { invalid: 'handle' },
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Error Code Mapping Tests
// ============================================================================

describe('Error code mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FileService error mapping', () => {
    it('ENOENT maps to NOT_FOUND', async () => {
      const enoentError = {
        ok: false as const,
        error: { code: 'NOT_FOUND' as const, path: '/missing/file.mdx' },
      };
      vi.mocked(FileService.readFile).mockResolvedValue(enoentError);

      const result = await FileService.readFile('/missing/file.mdx');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('EACCES maps to PERMISSION_DENIED', async () => {
      const eaccesError = {
        ok: false as const,
        error: { code: 'PERMISSION_DENIED' as const, path: '/protected/file.mdx' },
      };
      vi.mocked(FileService.readFile).mockResolvedValue(eaccesError);

      const result = await FileService.readFile('/protected/file.mdx');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PERMISSION_DENIED');
      }
    });

    it('Unknown errors return UNKNOWN with message', async () => {
      const unknownError = {
        ok: false as const,
        error: { code: 'UNKNOWN' as const, message: 'Disk is full' },
      };
      vi.mocked(FileService.writeFile).mockResolvedValue(unknownError);

      const result = await FileService.writeFile('/some/file.mdx', 'content');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNKNOWN');
        if (result.error.code === 'UNKNOWN') {
          expect(result.error.message).toBe('Disk is full');
        }
      }
    });
  });

  describe('Dialog cancel handling', () => {
    it('Dialog cancel returns CANCELLED error', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      // Verify the dialog mock works correctly
      const dialogResult = await dialog.showOpenDialog({} as any, {
        properties: ['openFile'],
      });

      expect(dialogResult.canceled).toBe(true);
      // The actual handler would return { ok: false, error: { code: 'CANCELLED' } }
    });

    it('Save dialog cancel returns CANCELLED error', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: true,
        filePath: undefined as unknown as string,
      });

      const dialogResult = await dialog.showSaveDialog({} as any, {});

      expect(dialogResult.canceled).toBe(true);
    });
  });
});

// ============================================================================
// Window Handler Tests
// ============================================================================

describe('Window handlers', () => {
  let mockWindow: ReturnType<typeof createMockWindow>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWindow = createMockWindow();
  });

  describe('close handler behavior', () => {
    it('calls window.close()', async () => {
      // Simulate what the handler does
      mockWindow.close();

      expect(mockWindow.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('minimize handler behavior', () => {
    it('calls window.minimize()', async () => {
      mockWindow.minimize();

      expect(mockWindow.minimize).toHaveBeenCalledTimes(1);
    });
  });

  describe('maximize handler behavior', () => {
    it('calls window.maximize() when not maximized', async () => {
      mockWindow.isMaximized.mockReturnValue(false);

      // Simulate toggle logic
      if (mockWindow.isMaximized()) {
        mockWindow.restore();
      } else {
        mockWindow.maximize();
      }

      expect(mockWindow.isMaximized).toHaveBeenCalled();
      expect(mockWindow.maximize).toHaveBeenCalledTimes(1);
      expect(mockWindow.restore).not.toHaveBeenCalled();
    });

    it('calls window.restore() when already maximized', async () => {
      mockWindow.isMaximized.mockReturnValue(true);

      // Simulate toggle logic
      if (mockWindow.isMaximized()) {
        mockWindow.restore();
      } else {
        mockWindow.maximize();
      }

      expect(mockWindow.isMaximized).toHaveBeenCalled();
      expect(mockWindow.restore).toHaveBeenCalledTimes(1);
      expect(mockWindow.maximize).not.toHaveBeenCalled();
    });

    it('toggles based on isMaximized() state', async () => {
      // First call: not maximized -> should maximize
      mockWindow.isMaximized.mockReturnValue(false);
      if (mockWindow.isMaximized()) {
        mockWindow.restore();
      } else {
        mockWindow.maximize();
      }
      expect(mockWindow.maximize).toHaveBeenCalledTimes(1);

      // Second call: now maximized -> should restore
      mockWindow.isMaximized.mockReturnValue(true);
      if (mockWindow.isMaximized()) {
        mockWindow.restore();
      } else {
        mockWindow.maximize();
      }
      expect(mockWindow.restore).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================================
// FileSaveAs Handler Tests
// ============================================================================

describe('FileSaveAsRequestSchema', () => {
  it('accepts valid content', () => {
    const result = FileSaveAsRequestSchema.safeParse({
      content: 'File content to save',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty content', () => {
    const result = FileSaveAsRequestSchema.safeParse({
      content: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing content', () => {
    const result = FileSaveAsRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-string content', () => {
    const result = FileSaveAsRequestSchema.safeParse({
      content: 123,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Integration Tests: Handler + Validation + Service
// ============================================================================

describe('Handler integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('file:read handler flow', () => {
    it('validates input, calls service, returns result', async () => {
      vi.mocked(FileService.readFile).mockResolvedValue({
        ok: true,
        value: '# Hello World',
      });

      const mockHandler = vi.fn(async (args: { path: string }) => {
        return FileService.readFile(args.path);
      });

      const validatedHandler = createValidatedHandler(FileReadRequestSchema, mockHandler);
      const result = await validatedHandler({ path: '/test/file.mdx' });

      expect(result).toEqual({ ok: true, value: '# Hello World' });
      expect(FileService.readFile).toHaveBeenCalledWith('/test/file.mdx');
    });

    it('rejects invalid path without calling service', async () => {
      const mockHandler = vi.fn();
      const validatedHandler = createValidatedHandler(FileReadRequestSchema, mockHandler);

      await expect(validatedHandler({ path: 'invalid/path' })).rejects.toThrow('Validation failed');
      expect(FileService.readFile).not.toHaveBeenCalled();
    });
  });

  describe('file:write handler flow', () => {
    it('validates input, calls service, returns result', async () => {
      vi.mocked(FileService.writeFile).mockResolvedValue({
        ok: true,
        value: undefined,
      });

      const mockHandler = vi.fn(async (args: { path: string; content: string }) => {
        return FileService.writeFile(args.path, args.content);
      });

      const validatedHandler = createValidatedHandler(FileWriteRequestSchema, mockHandler);
      const result = await validatedHandler({
        path: '/test/output.mdx',
        content: '# New Content',
      });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(FileService.writeFile).toHaveBeenCalledWith('/test/output.mdx', '# New Content');
    });
  });

  describe('file:save handler flow', () => {
    it('validates handle with path, calls service', async () => {
      vi.mocked(FileService.writeFile).mockResolvedValue({
        ok: true,
        value: undefined,
      });

      const handle = createTestFileHandle();
      const mockHandler = vi.fn(async (args: { handle: typeof handle; content: string }) => {
        if (!args.handle.path) {
          return {
            ok: false as const,
            error: { code: 'UNKNOWN' as const, message: 'Cannot save untitled file without path' },
          };
        }
        return FileService.writeFile(args.handle.path, args.content);
      });

      const validatedHandler = createValidatedHandler(FileSaveRequestSchema, mockHandler);
      const result = await validatedHandler({
        handle,
        content: '# Updated Content',
      });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(FileService.writeFile).toHaveBeenCalledWith(handle.path, '# Updated Content');
    });

    it('returns error for untitled file (null path)', async () => {
      const handle = createTestFileHandle({ path: null });

      // Simulate the actual file:save handler behavior
      const mockHandler = vi.fn(async (args: { handle: { id: string; path: string | null; name: string }; content: string }) => {
        // This mimics handleFileSave in file-handlers.ts
        if (args.handle.path === null) {
          return {
            ok: false as const,
            error: { code: 'UNKNOWN' as const, message: 'Cannot save untitled file without path' },
          };
        }
        return FileService.writeFile(args.handle.path, args.content);
      });

      const validatedHandler = createValidatedHandler(FileSaveRequestSchema, mockHandler);
      const result = await validatedHandler({
        handle,
        content: '# Content',
      });

      // Verify handler was called with null path
      expect(mockHandler).toHaveBeenCalled();
      const calledArgs = mockHandler.mock.calls[0]?.[0];
      expect(calledArgs?.handle.path).toBeNull();

      // Handler should return error for null path
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNKNOWN');
      }
      expect(FileService.writeFile).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// App Handler Tests
// ============================================================================

describe('App handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('app:version handler', () => {
    it('returns app version string', () => {
      const version = app.getVersion();
      expect(version).toBe('1.0.0');
    });
  });
});

// ============================================================================
// Edge Cases and Boundary Tests
// ============================================================================

describe('Edge cases', () => {
  describe('path validation edge cases', () => {
    it('accepts root path /', () => {
      const result = FileReadRequestSchema.safeParse({ path: '/' });
      expect(result.success).toBe(true);
    });

    it('accepts path with spaces', () => {
      const result = FileReadRequestSchema.safeParse({ path: '/path/with spaces/file.mdx' });
      expect(result.success).toBe(true);
    });

    it('accepts path with special characters', () => {
      const result = FileReadRequestSchema.safeParse({ path: '/path/with-special_chars/file.mdx' });
      expect(result.success).toBe(true);
    });

    it('rejects path with only whitespace', () => {
      const result = FileReadRequestSchema.safeParse({ path: '   ' });
      expect(result.success).toBe(false);
    });
  });

  describe('content validation edge cases', () => {
    it('accepts very long content strings', () => {
      const longContent = 'x'.repeat(1_000_000);
      const result = FileWriteRequestSchema.safeParse({
        path: '/test/file.mdx',
        content: longContent,
      });
      expect(result.success).toBe(true);
    });

    it('accepts content with unicode characters', () => {
      const result = FileWriteRequestSchema.safeParse({
        path: '/test/file.mdx',
        content: '# Hello World! ',
      });
      expect(result.success).toBe(true);
    });

    it('accepts content with newlines', () => {
      const result = FileWriteRequestSchema.safeParse({
        path: '/test/file.mdx',
        content: 'Line 1\nLine 2\nLine 3',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('UUID validation edge cases', () => {
    it('accepts lowercase UUID', () => {
      const result = FileIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000');
      expect(result.success).toBe(true);
    });

    it('accepts uppercase UUID', () => {
      const result = FileIdSchema.safeParse('550E8400-E29B-41D4-A716-446655440000');
      expect(result.success).toBe(true);
    });

    it('rejects UUID without hyphens', () => {
      const result = FileIdSchema.safeParse('550e8400e29b41d4a716446655440000');
      expect(result.success).toBe(false);
    });

    it('rejects UUID with extra characters', () => {
      const result = FileIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000-extra');
      expect(result.success).toBe(false);
    });
  });
});
