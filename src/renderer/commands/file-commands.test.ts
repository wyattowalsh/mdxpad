/**
 * Tests for file commands.
 *
 * Tests file command execution, document store integration,
 * IPC API calls, and keyboard shortcuts.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { enableMapSet } from 'immer';
import type { CommandContext, CommandId } from '@shared/types/commands';
import type { FileHandle, FileResult, FileError } from '@shared/types/file';
import type { MdxpadAPI } from '../../preload/api';
import { INITIAL_DOCUMENT_STATE } from '@shared/types/document';

// Enable Immer MapSet plugin for Map/Set support in stores
enableMapSet();

// =============================================================================
// MOCKS
// =============================================================================

// Mock document store
const mockNewDocument = vi.fn();
const mockOpenDocument = vi.fn();
const mockMarkSaved = vi.fn();

vi.mock('../stores/document-store', () => ({
  useDocumentStore: {
    getState: () => ({
      newDocument: mockNewDocument,
      openDocument: mockOpenDocument,
      markSaved: mockMarkSaved,
    }),
  },
}));

// Mock command registry
vi.mock('../stores/command-registry-store', () => ({
  useCommandRegistry: {
    getState: () => ({
      register: vi.fn(() => ({ ok: true, command: {} })),
      unregister: vi.fn(() => true),
    }),
  },
}));

// Import after mocking
import {
  FILE_COMMAND_IDS,
  checkDirtyState,
  newFileCommand,
  openFileCommand,
  saveFileCommand,
  saveFileAsCommand,
  closeWindowCommand,
  FILE_COMMANDS,
  registerFileCommands,
} from './file-commands';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a mock MdxpadAPI for testing.
 */
function createMockApi(overrides: Partial<MdxpadAPI> = {}): MdxpadAPI {
  return {
    getVersion: vi.fn().mockResolvedValue('1.0.0'),
    getSecurityInfo: vi.fn().mockResolvedValue({}),
    openFile: vi.fn().mockResolvedValue({ ok: true, value: { id: 'test-id', path: '/test/file.mdx', name: 'file.mdx' } }),
    saveFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveFileAs: vi.fn().mockResolvedValue({ ok: true, value: { id: 'test-id', path: '/test/new-file.mdx', name: 'new-file.mdx' } }),
    readFile: vi.fn().mockResolvedValue({ ok: true, value: '# Test Content' }),
    writeFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    closeWindow: vi.fn().mockResolvedValue(undefined),
    minimizeWindow: vi.fn().mockResolvedValue(undefined),
    maximizeWindow: vi.fn().mockResolvedValue(undefined),
    signalReady: vi.fn().mockResolvedValue(undefined),
    onFileChange: vi.fn(() => () => {}),
    onMenuCommandPalette: vi.fn(() => () => {}),
    onMenuNewFile: vi.fn(() => () => {}),
    onMenuOpenFileDialog: vi.fn(() => () => {}),
    onMenuOpenFile: vi.fn(() => () => {}),
    onMenuSaveFile: vi.fn(() => () => {}),
    onMenuSaveFileAs: vi.fn(() => () => {}),
    platform: { os: 'darwin', arch: 'arm64' },
    // Autosave API (Spec 011)
    recoveryCheck: vi.fn().mockResolvedValue({ hasRecoveryData: false, count: 0 }),
    recoveryList: vi.fn().mockResolvedValue({ entries: [] }),
    recoveryPreview: vi.fn().mockResolvedValue({ ok: true, content: '', conflict: null }),
    recoveryRestore: vi.fn().mockResolvedValue({ ok: true, restored: [] }),
    recoveryDiscard: vi.fn().mockResolvedValue({ discardedCount: 0 }),
    autosaveTrigger: vi.fn().mockResolvedValue({ ok: true, savedAt: Date.now() }),
    autosaveStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
    autosaveSettingsGet: vi.fn().mockResolvedValue({ enabled: true, intervalMs: 30000, retentionDays: 30, maxFiles: 50, maxStorageMB: 100 }),
    autosaveSettingsSet: vi.fn().mockResolvedValue({ enabled: true, intervalMs: 30000, retentionDays: 30, maxFiles: 50, maxStorageMB: 100 }),
    conflictResolve: vi.fn().mockResolvedValue({ ok: true }),
    onAutosaveSettingsChange: vi.fn(() => () => {}),
    ...overrides,
  };
}

/**
 * Create a mock CommandContext for testing.
 */
function createMockContext(overrides: Partial<CommandContext> = {}): CommandContext {
  const mockNotify = vi.fn();
  return {
    editor: null,
    document: {
      fileId: null,
      filePath: null,
      content: '',
      isDirty: false,
    },
    ui: {
      previewVisible: true,
      sidebarVisible: true,
      zoomLevel: 100,
    },
    platform: {
      isMac: true,
      isWindows: false,
      isLinux: false,
    },
    api: createMockApi(),
    notify: mockNotify,
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('FILE_COMMAND_IDS', () => {
  it('should have correct command IDs', () => {
    expect(FILE_COMMAND_IDS.new).toBe('file.new');
    expect(FILE_COMMAND_IDS.open).toBe('file.open');
    expect(FILE_COMMAND_IDS.save).toBe('file.save');
    expect(FILE_COMMAND_IDS.saveAs).toBe('file.saveAs');
    expect(FILE_COMMAND_IDS.close).toBe('file.close');
  });
});

describe('checkDirtyState', () => {
  it('should return true (placeholder always proceeds)', () => {
    expect(checkDirtyState()).toBe(true);
  });
});

describe('newFileCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct command ID', () => {
    expect(newFileCommand.id).toBe(FILE_COMMAND_IDS.new);
  });

  it('should have correct keyboard shortcut (Cmd+N)', () => {
    expect(newFileCommand.shortcut).toEqual({ key: 'n', modifiers: ['Mod'] });
  });

  it('should create untitled document', () => {
    const ctx = createMockContext();
    const result = newFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockNewDocument).toHaveBeenCalledTimes(1);
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'New file created',
    });
  });

  it('should always be enabled', () => {
    const ctx = createMockContext();
    expect(newFileCommand.enabled?.(ctx)).toBe(true);
  });
});

describe('openFileCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct command ID', () => {
    expect(openFileCommand.id).toBe(FILE_COMMAND_IDS.open);
  });

  it('should have correct keyboard shortcut (Cmd+O)', () => {
    expect(openFileCommand.shortcut).toEqual({ key: 'o', modifiers: ['Mod'] });
  });

  it('should load file via IPC', async () => {
    const mockApi = createMockApi();
    const ctx = createMockContext({ api: mockApi });

    const result = await openFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockApi.openFile).toHaveBeenCalledTimes(1);
    expect(mockApi.readFile).toHaveBeenCalledWith('/test/file.mdx');
    expect(mockOpenDocument).toHaveBeenCalledTimes(1);
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'success',
      message: 'Opened: file.mdx',
    });
  });

  it('should handle cancelled dialog', async () => {
    const mockApi = createMockApi({
      openFile: vi.fn().mockResolvedValue({ ok: false, error: { code: 'CANCELLED' } }),
    });
    const ctx = createMockContext({ api: mockApi });

    const result = await openFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true }); // Cancelled is not an error
    expect(mockOpenDocument).not.toHaveBeenCalled();
  });

  it('should handle file not found error', async () => {
    const mockApi = createMockApi({
      openFile: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'NOT_FOUND', path: '/test/missing.mdx' },
      }),
    });
    const ctx = createMockContext({ api: mockApi });

    const result = await openFileCommand.execute(ctx);

    expect(result.ok).toBe(false);
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'error',
      message: expect.stringContaining('File not found'),
    });
  });

  it('should always be enabled', () => {
    const ctx = createMockContext();
    expect(openFileCommand.enabled?.(ctx)).toBe(true);
  });
});

describe('saveFileCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct command ID', () => {
    expect(saveFileCommand.id).toBe(FILE_COMMAND_IDS.save);
  });

  it('should have correct keyboard shortcut (Cmd+S)', () => {
    expect(saveFileCommand.shortcut).toEqual({ key: 's', modifiers: ['Mod'] });
  });

  it('should call IPC saveFile for saved documents', async () => {
    const mockApi = createMockApi();
    const ctx = createMockContext({
      api: mockApi,
      document: {
        fileId: 'test-file-id',
        filePath: '/test/document.mdx',
        content: '# Modified Content',
        isDirty: true,
      },
    });

    const result = await saveFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockApi.saveFile).toHaveBeenCalledTimes(1);
    expect(mockApi.saveFile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-file-id',
        path: '/test/document.mdx',
      }),
      '# Modified Content'
    );
    expect(mockMarkSaved).toHaveBeenCalledTimes(1);
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'success',
      message: 'File saved',
    });
  });

  it('should delegate to saveAs for untitled documents', async () => {
    const mockApi = createMockApi();
    const ctx = createMockContext({
      api: mockApi,
      document: {
        fileId: null,
        filePath: null,
        content: '# New Content',
        isDirty: true,
      },
    });

    const result = await saveFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    // saveAs should have been called, not saveFile
    expect(mockApi.saveFileAs).toHaveBeenCalledTimes(1);
    expect(mockApi.saveFile).not.toHaveBeenCalled();
  });

  it('should be enabled only when document is dirty', () => {
    const cleanCtx = createMockContext({
      document: { fileId: null, filePath: null, content: '', isDirty: false },
    });
    expect(saveFileCommand.enabled?.(cleanCtx)).toBe(false);

    const dirtyCtx = createMockContext({
      document: { fileId: null, filePath: null, content: 'changed', isDirty: true },
    });
    expect(saveFileCommand.enabled?.(dirtyCtx)).toBe(true);
  });
});

describe('saveFileAsCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct command ID', () => {
    expect(saveFileAsCommand.id).toBe(FILE_COMMAND_IDS.saveAs);
  });

  it('should have correct keyboard shortcut (Cmd+Shift+S)', () => {
    expect(saveFileAsCommand.shortcut).toEqual({ key: 's', modifiers: ['Mod', 'Shift'] });
  });

  it('should call IPC saveFileAs', async () => {
    const mockApi = createMockApi();
    const ctx = createMockContext({
      api: mockApi,
      document: {
        fileId: null,
        filePath: null,
        content: '# New Document',
        isDirty: true,
      },
    });

    const result = await saveFileAsCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockApi.saveFileAs).toHaveBeenCalledTimes(1);
    expect(mockApi.saveFileAs).toHaveBeenCalledWith('# New Document');
    expect(mockMarkSaved).toHaveBeenCalledTimes(1);
    expect(mockMarkSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/test/new-file.mdx',
      })
    );
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'success',
      message: 'Saved as: new-file.mdx',
    });
  });

  it('should handle cancelled dialog', async () => {
    const mockApi = createMockApi({
      saveFileAs: vi.fn().mockResolvedValue({ ok: false, error: { code: 'CANCELLED' } }),
    });
    const ctx = createMockContext({ api: mockApi });

    const result = await saveFileAsCommand.execute(ctx);

    expect(result).toEqual({ ok: true }); // Cancelled is not an error
    expect(mockMarkSaved).not.toHaveBeenCalled();
  });

  it('should always be enabled', () => {
    const ctx = createMockContext();
    expect(saveFileAsCommand.enabled?.(ctx)).toBe(true);
  });
});

describe('closeWindowCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct command ID', () => {
    expect(closeWindowCommand.id).toBe(FILE_COMMAND_IDS.close);
  });

  it('should have correct keyboard shortcut (Cmd+W)', () => {
    expect(closeWindowCommand.shortcut).toEqual({ key: 'w', modifiers: ['Mod'] });
  });

  it('should call IPC closeWindow', async () => {
    const mockApi = createMockApi();
    const ctx = createMockContext({ api: mockApi });

    const result = await closeWindowCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockApi.closeWindow).toHaveBeenCalledTimes(1);
  });

  it('should always be enabled', () => {
    const ctx = createMockContext();
    expect(closeWindowCommand.enabled?.(ctx)).toBe(true);
  });
});

describe('FILE_COMMANDS', () => {
  it('should contain all file commands', () => {
    expect(FILE_COMMANDS).toHaveLength(5);
    expect(FILE_COMMANDS).toContain(newFileCommand);
    expect(FILE_COMMANDS).toContain(openFileCommand);
    expect(FILE_COMMANDS).toContain(saveFileCommand);
    expect(FILE_COMMANDS).toContain(saveFileAsCommand);
    expect(FILE_COMMANDS).toContain(closeWindowCommand);
  });
});

describe('Keyboard Shortcuts', () => {
  it('file.new should have Cmd+N shortcut', () => {
    expect(newFileCommand.shortcut).toEqual({ key: 'n', modifiers: ['Mod'] });
  });

  it('file.open should have Cmd+O shortcut', () => {
    expect(openFileCommand.shortcut).toEqual({ key: 'o', modifiers: ['Mod'] });
  });

  it('file.save should have Cmd+S shortcut', () => {
    expect(saveFileCommand.shortcut).toEqual({ key: 's', modifiers: ['Mod'] });
  });

  it('file.saveAs should have Cmd+Shift+S shortcut', () => {
    expect(saveFileAsCommand.shortcut).toEqual({ key: 's', modifiers: ['Mod', 'Shift'] });
  });

  it('file.close should have Cmd+W shortcut', () => {
    expect(closeWindowCommand.shortcut).toEqual({ key: 'w', modifiers: ['Mod'] });
  });
});

describe('registerFileCommands', () => {
  it('should return an unregister function', () => {
    const unregister = registerFileCommands();
    expect(typeof unregister).toBe('function');
  });
});
