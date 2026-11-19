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
import type { AIApi } from '../../preload/ai-api';
import { INITIAL_DOCUMENT_STATE } from '@shared/types/document';
import { useFeatureFlagsStore } from '../stores/feature-flags-store';
import { useUtilityPanelStore } from '../stores/utility-panel-store';
import { useTabStore } from '../stores/tab-store';

// Enable Immer MapSet plugin for Map/Set support in stores
enableMapSet();

// =============================================================================
// MOCKS
// =============================================================================

// Mock document store
const mockNewDocument = vi.fn();
const mockOpenDocument = vi.fn();
const mockMarkSaved = vi.fn();
const documentStoreState = {
  newDocument: mockNewDocument,
  openDocument: mockOpenDocument,
  markSaved: mockMarkSaved,
  setContent: (content: string) => {
    documentStoreState.content = content;
  },
  externalChangeDetected: false,
  fileMissing: false,
  filePath: null as string | null,
  content: '',
  savedContent: '',
  isDirty: false,
};

vi.mock('../stores/document-store', () => ({
  useDocumentStore: {
    getState: () => documentStoreState,
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
  exportFileCommand,
  managePluginsCommand,
  closeWindowCommand,
  FILE_COMMANDS,
  registerFileCommands,
} from './file-commands';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a mock AIApi for testing.
 */
function createMockAIApi(overrides: Partial<AIApi> = {}): AIApi {
  return {
    // Provider Management
    listProviders: vi.fn().mockResolvedValue({ providers: [], activeProviderId: null }),
    addProvider: vi.fn().mockResolvedValue({ success: true, providerId: 'test-provider' }),
    updateProvider: vi.fn().mockResolvedValue({ success: true }),
    removeProvider: vi.fn().mockResolvedValue({ success: true }),
    setActiveProvider: vi.fn().mockResolvedValue({ success: true }),
    validateProvider: vi.fn().mockResolvedValue({ valid: true, error: null }),
    configureSidecar: vi.fn().mockResolvedValue({ success: true, status: 'running' }),
    getSidecarStatus: vi.fn().mockResolvedValue({ success: true, status: 'stopped' }),
    startSidecar: vi.fn().mockResolvedValue({ success: true, status: 'running' }),
    stopSidecar: vi.fn().mockResolvedValue({ success: true, status: 'stopped' }),
    // Credential Management
    setCredential: vi.fn().mockResolvedValue({ success: true }),
    hasCredential: vi.fn().mockResolvedValue({ hasCredential: false }),
    clearCredential: vi.fn().mockResolvedValue({ success: true }),
    // AI Generation
    generateText: vi.fn().mockResolvedValue({ text: 'Generated text', usage: null }),
    generateStream: vi.fn().mockResolvedValue({ streamId: 'test-stream' }),
    cancelStream: vi.fn().mockResolvedValue({ success: true }),
    generateEmbed: vi.fn().mockResolvedValue({ embedding: [], usage: null }),
    generateImage: vi.fn().mockResolvedValue({ url: 'data:image/png;base64,...', usage: null }),
    // Usage Statistics
    queryUsage: vi.fn().mockResolvedValue({ entries: [], totalTokens: 0, totalCost: 0 }),
    exportUsage: vi.fn().mockResolvedValue({ path: '/tmp/usage.csv' }),
    clearUsage: vi.fn().mockResolvedValue({ success: true, count: 0 }),
    // Capability Detection
    getCapability: vi.fn().mockResolvedValue({ capabilities: [], modelInfo: null }),
    listModels: vi.fn().mockResolvedValue({ models: [] }),
    refreshCapabilities: vi.fn().mockResolvedValue({ success: true }),
    // Session + Prompt + Instruction Management
    createSession: vi.fn().mockResolvedValue({ success: true }),
    listSessions: vi.fn().mockResolvedValue({ sessions: [] }),
    getSession: vi.fn().mockResolvedValue({ session: null }),
    archiveSession: vi.fn().mockResolvedValue({ success: true }),
    restoreSession: vi.fn().mockResolvedValue({ session: null }),
    listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
    attachPrompt: vi.fn().mockResolvedValue({ success: true }),
    listInstructions: vi.fn().mockResolvedValue({ instructions: [] }),
    loadInstruction: vi.fn().mockResolvedValue({ instruction: null }),
    attachInstruction: vi.fn().mockResolvedValue({ success: true }),
    // Streaming Events
    onStreamChunk: vi.fn(() => () => {}),
    onStreamComplete: vi.fn(() => () => {}),
    onStreamError: vi.fn(() => () => {}),
    ...overrides,
  };
}

/**
 * Create a mock MdxpadAPI for testing.
 */
function createMockApi(overrides: Partial<MdxpadAPI> = {}): MdxpadAPI {
  return {
    getVersion: vi.fn().mockResolvedValue('1.0.0'),
    getSecurityInfo: vi.fn().mockResolvedValue({}),
    openFile: vi.fn().mockResolvedValue({
      ok: true,
      value: { id: 'test-id', path: '/test/file.mdx', name: 'file.mdx' },
    }),
    saveFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveFileAs: vi.fn().mockResolvedValue({
      ok: true,
      value: { id: 'test-id', path: '/test/new-file.mdx', name: 'new-file.mdx' },
    }),
    exportFile: vi.fn().mockResolvedValue({
      ok: true,
      value: { path: '/test/new-file.html', format: 'html', warnings: [] },
    }),
    readFile: vi.fn().mockResolvedValue({ ok: true, value: '# Test Content' }),
    listDirectory: vi.fn().mockResolvedValue({ ok: true, files: [] }),
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
    onDroppedFile: vi.fn(() => () => {}),
    onMenuSaveFile: vi.fn(() => () => {}),
    onMenuSaveFileAs: vi.fn(() => () => {}),
    onMenuExportFile: vi.fn(() => () => {}),
    onMenuCloseTab: vi.fn(() => () => {}),
    onMenuReopenTab: vi.fn(() => () => {}),
    onMenuNextTab: vi.fn(() => () => {}),
    onMenuPreviousTab: vi.fn(() => () => {}),
    onMenuSwitchTab: vi.fn(() => () => {}),
    onShareOpen: vi.fn(() => () => {}),
    onRecoveryRestore: vi.fn(() => () => {}),
    platform: { os: 'darwin', arch: 'arm64' },
    // Autosave API (Spec 011)
    recoveryCheck: vi.fn().mockResolvedValue({ hasRecoveryData: false, count: 0 }),
    recoveryList: vi.fn().mockResolvedValue({ entries: [] }),
    recoveryPreview: vi.fn().mockResolvedValue({ ok: true, content: '', conflict: null }),
    recoveryRestore: vi.fn().mockResolvedValue({ ok: true, restored: [] }),
    recoveryDiscard: vi.fn().mockResolvedValue({ discardedCount: 0 }),
    autosaveTrigger: vi.fn().mockResolvedValue({ ok: true, savedAt: Date.now() }),
    autosaveStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
    autosaveSettingsGet: vi.fn().mockResolvedValue({
      enabled: true,
      intervalMs: 30000,
      retentionDays: 30,
      maxFiles: 50,
      maxStorageMB: 100,
    }),
    autosaveSettingsSet: vi.fn().mockResolvedValue({
      enabled: true,
      intervalMs: 30000,
      retentionDays: 30,
      maxFiles: 50,
      maxStorageMB: 100,
    }),
    conflictResolve: vi.fn().mockResolvedValue({ ok: true }),
    onAutosaveSettingsChange: vi.fn(() => () => {}),
    settings: {
      get: vi.fn().mockResolvedValue({
        enabled: true,
        intervalMs: 30000,
        retentionDays: 30,
        maxFiles: 50,
        maxStorageMB: 100,
      }),
      set: vi.fn().mockResolvedValue({
        enabled: true,
        intervalMs: 30000,
        retentionDays: 30,
        maxFiles: 50,
        maxStorageMB: 100,
      }),
      onChange: vi.fn(() => () => {}),
    },
    // AI API (Spec 028)
    ai: createMockAIApi(),
    // Template API (Spec 016)
    template: {
      list: vi.fn().mockResolvedValue({ success: true, data: [] }),
      get: vi.fn().mockResolvedValue({ success: true, data: {} }),
      save: vi.fn().mockResolvedValue({ success: true, data: {} }),
      delete: vi.fn().mockResolvedValue({ success: true, data: { id: 'test' } }),
      import: vi.fn().mockResolvedValue({ success: true, data: {} }),
      export: vi.fn().mockResolvedValue({ success: true, data: { path: '/test/path' } }),
      validate: vi.fn().mockResolvedValue({ success: true, data: { valid: true, errors: [] } }),
      createFromTemplate: vi.fn().mockResolvedValue({ success: true, data: { content: '' } }),
      showOpenDialog: vi
        .fn()
        .mockResolvedValue({ success: true, data: { path: null, canceled: true } }),
      showSaveDialog: vi
        .fn()
        .mockResolvedValue({ success: true, data: { path: null, canceled: true } }),
    },
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
  beforeEach(() => {
    useFeatureFlagsStore.getState().reset();
    useFeatureFlagsStore.getState().setFlag('export', true);
  });

  it('should have correct command IDs', () => {
    expect(FILE_COMMAND_IDS.new).toBe('file.new');
    expect(FILE_COMMAND_IDS.open).toBe('file.open');
    expect(FILE_COMMAND_IDS.save).toBe('file.save');
    expect(FILE_COMMAND_IDS.saveAs).toBe('file.save-as');
    expect(FILE_COMMAND_IDS.export).toBe('file.export');
    expect(FILE_COMMAND_IDS.plugins).toBe('file.plugins');
    expect(FILE_COMMAND_IDS.close).toBe('file.close');
  });
});

describe('checkDirtyState', () => {
  it('should return false when user cancels', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    expect(checkDirtyState()).toBe(false);

    confirmSpy.mockRestore();
  });

  it('should return true when user confirms', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    expect(checkDirtyState()).toBe(true);

    confirmSpy.mockRestore();
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

  it('should create untitled document', async () => {
    const ctx = createMockContext();
    const result = await newFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockNewDocument).toHaveBeenCalledTimes(1);
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'New file created',
    });
  });

  it('starts a new document while an untitled document still has edits', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const ctx = createMockContext({
      document: {
        fileId: null,
        filePath: null,
        content: '# Unsaved',
        isDirty: true,
      },
    });

    const result = await newFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockNewDocument).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
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

  it('opens a file while the current document still has edits', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const mockApi = createMockApi();
    const ctx = createMockContext({
      api: mockApi,
      document: {
        fileId: null,
        filePath: null,
        content: '# Unsaved',
        isDirty: true,
      },
    });

    const result = await openFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockApi.openFile).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it('does not replace a file opened while the chosen file was still being read', async () => {
    documentStoreState.filePath = null;
    documentStoreState.content = '';
    const mockApi = createMockApi({
      readFile: vi.fn().mockImplementation(async () => {
        documentStoreState.filePath = '/docs/other.mdx';
        documentStoreState.content = 'other';
        return { ok: true, value: '# Chosen' };
      }),
    });
    const ctx = createMockContext({ api: mockApi });

    const result = await openFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockOpenDocument).not.toHaveBeenCalled();
    expect(ctx.notify).not.toHaveBeenCalled();
    documentStoreState.filePath = null;
    documentStoreState.content = '';
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
    documentStoreState.externalChangeDetected = false;
    documentStoreState.filePath = null;
    documentStoreState.content = '';
  });

  it('should have correct command ID', () => {
    expect(saveFileCommand.id).toBe(FILE_COMMAND_IDS.save);
  });

  it('should have correct keyboard shortcut (Cmd+S)', () => {
    expect(saveFileCommand.shortcut).toEqual({ key: 's', modifiers: ['Mod'] });
  });

  it('saves keystrokes that have not reached the document store', async () => {
    documentStoreState.filePath = '/test/document.mdx';
    documentStoreState.content = 'Hello';
    documentStoreState.savedContent = 'Hello';
    documentStoreState.isDirty = false;
    const mockApi = createMockApi();
    const ctx = createMockContext({
      api: mockApi,
      editor: {
        state: { doc: { toString: () => 'Hello!' } },
        isDestroyed: false,
      } as unknown as CommandContext['editor'],
      document: {
        fileId: 'test-file-id',
        filePath: '/test/document.mdx',
        content: 'Hello',
        isDirty: false,
      },
    });

    const result = await saveFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockApi.saveFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/test/document.mdx' }),
      'Hello!'
    );
    expect(mockMarkSaved).toHaveBeenCalled();
    expect(documentStoreState.content).toBe('Hello!');
  });

  it('should call IPC saveFile for saved documents', async () => {
    documentStoreState.filePath = '/test/document.mdx';
    documentStoreState.content = '# Modified Content';
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

  it('saves the editor text when the command snapshot is older', async () => {
    documentStoreState.filePath = '/test/document.mdx';
    documentStoreState.content = '# Live edit';
    const mockApi = createMockApi();
    const ctx = createMockContext({
      api: mockApi,
      document: {
        fileId: 'test-file-id',
        filePath: '/test/document.mdx',
        content: '# Old snapshot',
        isDirty: true,
      },
    });

    await saveFileCommand.execute(ctx);

    expect(mockApi.saveFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/test/document.mdx' }),
      '# Live edit'
    );
  });

  it('does not mark a different open file saved', async () => {
    documentStoreState.filePath = '/test/document.mdx';
    documentStoreState.content = '# Modified Content';
    const mockApi = createMockApi({
      saveFile: vi.fn().mockImplementation(async () => {
        documentStoreState.filePath = '/docs/other.mdx';
        documentStoreState.content = 'other edits';
        return { ok: true, value: undefined };
      }),
    });
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
    expect(mockMarkSaved).not.toHaveBeenCalled();
    expect(ctx.notify).not.toHaveBeenCalled();
  });

  it('leaves newer keystrokes unsaved', async () => {
    documentStoreState.filePath = '/test/document.mdx';
    documentStoreState.content = '# Modified Content';
    const mockApi = createMockApi({
      saveFile: vi.fn().mockImplementation(async () => {
        documentStoreState.content = '# Modified Content!';
        return { ok: true, value: undefined };
      }),
    });
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
    expect(mockMarkSaved).not.toHaveBeenCalled();
    expect(ctx.notify).not.toHaveBeenCalled();
  });

  it('saves a conflicted file to a new location', async () => {
    documentStoreState.externalChangeDetected = true;
    const mockApi = createMockApi();
    const ctx = createMockContext({
      api: mockApi,
      document: {
        fileId: 'test-file-id',
        filePath: '/test/document.mdx',
        content: '# Local edits',
        isDirty: true,
      },
    });

    const result = await saveFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockApi.saveFile).not.toHaveBeenCalled();
    expect(mockApi.saveFileAs).toHaveBeenCalledWith('# Local edits');
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'This file changed on disk. Choose a new location so that copy stays intact.',
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

  it('saves another open file before the active document', async () => {
    useTabStore.getState().reset();
    const activeId = useTabStore.getState().addTab({
      filePath: '/docs/active.mdx',
      fileName: 'active.mdx',
      isDirty: true,
      content: 'active',
      savedContent: '',
    });
    useTabStore.getState().addTab({
      filePath: '/docs/other.mdx',
      fileName: 'other.mdx',
      isDirty: true,
      content: 'other',
      savedContent: '',
    });
    useTabStore.getState().setActiveTab(activeId);
    const mockApi = createMockApi();
    const ctx = createMockContext({
      api: mockApi,
      document: {
        fileId: '11111111-1111-4111-8111-111111111111',
        filePath: '/docs/active.mdx',
        content: 'active',
        isDirty: true,
      },
    });

    const result = await saveFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockApi.writeFile).toHaveBeenCalledWith('/docs/other.mdx', 'other');
    expect(mockApi.saveFile).toHaveBeenCalled();
    expect(
      useTabStore.getState().tabs.find((tab) => tab.filePath === '/docs/other.mdx')?.isDirty
    ).toBe(false);
    useTabStore.getState().reset();
  });

  it('leaves newer edits in another tab unsaved', async () => {
    useTabStore.getState().reset();
    const activeId = useTabStore.getState().addTab({
      filePath: '/docs/active.mdx',
      fileName: 'active.mdx',
      isDirty: true,
      content: 'active',
      savedContent: '',
    });
    const otherId = useTabStore.getState().addTab({
      filePath: '/docs/other.mdx',
      fileName: 'other.mdx',
      isDirty: true,
      content: 'other',
      savedContent: '',
    });
    useTabStore.getState().setActiveTab(activeId);
    const mockApi = createMockApi({
      writeFile: vi.fn().mockImplementation(async () => {
        useTabStore.getState().updateTab(otherId, { content: 'other more', isDirty: true });
        return { ok: true, value: undefined };
      }),
    });
    const ctx = createMockContext({
      api: mockApi,
      document: {
        fileId: '11111111-1111-4111-8111-111111111111',
        filePath: '/docs/active.mdx',
        content: 'active',
        isDirty: true,
      },
    });

    const result = await saveFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockApi.writeFile).toHaveBeenCalledWith('/docs/other.mdx', 'other');
    const other = useTabStore.getState().tabs.find((tab) => tab.id === otherId);
    expect(other?.content).toBe('other more');
    expect(other?.isDirty).toBe(true);
    useTabStore.getState().reset();
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
    documentStoreState.filePath = null;
    documentStoreState.content = '';
  });

  it('should have correct command ID', () => {
    expect(saveFileAsCommand.id).toBe(FILE_COMMAND_IDS.saveAs);
  });

  it('should have correct keyboard shortcut (Cmd+Shift+S)', () => {
    expect(saveFileAsCommand.shortcut).toEqual({ key: 's', modifiers: ['Mod', 'Shift'] });
  });

  it('should call IPC saveFileAs', async () => {
    documentStoreState.content = '# New Document';
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

  it('does not retarget a different open file', async () => {
    documentStoreState.content = '# New Document';
    const mockApi = createMockApi({
      saveFileAs: vi.fn().mockImplementation(async () => {
        documentStoreState.filePath = '/docs/other.mdx';
        documentStoreState.content = 'other';
        return {
          ok: true,
          value: { id: 'test-id', path: '/test/new-file.mdx', name: 'new-file.mdx' },
        };
      }),
    });
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
    expect(mockApi.saveFileAs).toHaveBeenCalledWith('# New Document');
    expect(mockMarkSaved).not.toHaveBeenCalled();
    expect(ctx.notify).not.toHaveBeenCalled();
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

  it('leaves Cmd+W for Close Tab', () => {
    expect(closeWindowCommand.shortcut).toBeUndefined();
  });

  it('should call IPC closeWindow', async () => {
    const mockApi = createMockApi();
    const ctx = createMockContext({ api: mockApi });

    const result = await closeWindowCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockApi.closeWindow).toHaveBeenCalledTimes(1);
  });

  it('asks the window to close so it can offer save, discard, or cancel', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const mockApi = createMockApi();
    const ctx = createMockContext({
      api: mockApi,
      document: {
        fileId: null,
        filePath: null,
        content: '# Unsaved',
        isDirty: true,
      },
    });

    const result = await closeWindowCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockApi.closeWindow).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it('should always be enabled', () => {
    const ctx = createMockContext();
    expect(closeWindowCommand.enabled?.(ctx)).toBe(true);
  });
});

describe('exportFileCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentStoreState.filePath = null;
    documentStoreState.content = '';
    useFeatureFlagsStore.getState().setFlag('export', true);
  });

  it('should have correct command ID', () => {
    expect(exportFileCommand.id).toBe(FILE_COMMAND_IDS.export);
  });

  it('should call IPC exportFile', async () => {
    const mockApi = createMockApi();
    const ctx = createMockContext({
      api: mockApi,
      document: {
        ...INITIAL_DOCUMENT_STATE,
        content: '# Export me',
        filePath: '/test/new-file.mdx',
      },
    });

    const result = await exportFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockApi.exportFile).toHaveBeenCalledWith('# Export me', {
      sourcePath: '/test/new-file.mdx',
    });
  });

  it('exports the editor text when the command snapshot is older', async () => {
    documentStoreState.filePath = '/test/new-file.mdx';
    documentStoreState.content = '# Live export';
    const mockApi = createMockApi();
    const ctx = createMockContext({
      api: mockApi,
      document: {
        ...INITIAL_DOCUMENT_STATE,
        content: '# Export me',
        filePath: '/test/new-file.mdx',
      },
    });

    await exportFileCommand.execute(ctx);

    expect(mockApi.exportFile).toHaveBeenCalledWith('# Live export', {
      sourcePath: '/test/new-file.mdx',
    });
  });

  it('does not announce an export on a different open file', async () => {
    documentStoreState.filePath = '/test/new-file.mdx';
    documentStoreState.content = '# Export me';
    const mockApi = createMockApi({
      exportFile: vi.fn().mockImplementation(async () => {
        documentStoreState.filePath = '/docs/other.mdx';
        return {
          ok: true,
          value: { path: '/test/new-file.html', format: 'html', warnings: ['Used a text PDF'] },
        };
      }),
    });
    const ctx = createMockContext({
      api: mockApi,
      document: {
        ...INITIAL_DOCUMENT_STATE,
        content: '# Export me',
        filePath: '/test/new-file.mdx',
      },
    });

    const result = await exportFileCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(ctx.notify).not.toHaveBeenCalled();
  });

  it('should be disabled when export feature flag is off', () => {
    useFeatureFlagsStore.getState().setFlag('export', false);
    const ctx = createMockContext();

    expect(exportFileCommand.enabled?.(ctx)).toBe(false);
  });

  it('should return an error when export feature flag is off', async () => {
    useFeatureFlagsStore.getState().setFlag('export', false);
    const mockApi = createMockApi();
    const ctx = createMockContext({
      api: mockApi,
      document: {
        ...INITIAL_DOCUMENT_STATE,
        content: '# Export me',
        filePath: '/test/new-file.mdx',
      },
    });

    const result = await exportFileCommand.execute(ctx);

    expect(result).toEqual({ ok: false, error: 'Export feature is disabled' });
    expect(mockApi.exportFile).not.toHaveBeenCalled();
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'Export feature is disabled',
    });
  });
});

describe('managePluginsCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFeatureFlagsStore.getState().setFlag('plugin', true);
  });

  it('opens the plugin marketplace when the plugin surface is enabled', async () => {
    useUtilityPanelStore.setState({ activeUtilityPanel: null });
    const ctx = createMockContext();

    const result = await managePluginsCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(useUtilityPanelStore.getState().activeUtilityPanel).toBe('plugins');
  });

  it('returns an error when plugin surface is disabled', async () => {
    useFeatureFlagsStore.getState().setFlag('plugin', false);
    const ctx = createMockContext();

    const result = await managePluginsCommand.execute(ctx);

    expect(result).toEqual({ ok: false, error: 'Plugin surface is disabled' });
  });
});

describe('FILE_COMMANDS', () => {
  it('should contain all file commands', () => {
    expect(FILE_COMMANDS).toHaveLength(7);
    expect(FILE_COMMANDS).toContain(newFileCommand);
    expect(FILE_COMMANDS).toContain(openFileCommand);
    expect(FILE_COMMANDS).toContain(saveFileCommand);
    expect(FILE_COMMANDS).toContain(saveFileAsCommand);
    expect(FILE_COMMANDS).toContain(exportFileCommand);
    expect(FILE_COMMANDS).toContain(managePluginsCommand);
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

  it('file.save-as should have Cmd+Shift+S shortcut', () => {
    expect(saveFileAsCommand.shortcut).toEqual({ key: 's', modifiers: ['Mod', 'Shift'] });
  });

  it('file.close leaves Cmd+W for Close Tab', () => {
    expect(closeWindowCommand.shortcut).toBeUndefined();
  });

  it('file.export should have Cmd+Shift+E shortcut', () => {
    expect(exportFileCommand.shortcut).toEqual({ key: 'e', modifiers: ['Mod', 'Shift'] });
  });
});

describe('registerFileCommands', () => {
  it('should return an unregister function', () => {
    const unregister = registerFileCommands();
    expect(typeof unregister).toBe('function');
  });
});
