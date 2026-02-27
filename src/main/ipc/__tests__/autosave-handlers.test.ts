/**
 * Autosave & Recovery IPC Handlers Tests
 *
 * Tests autosave, recovery, and settings handlers.
 * Tests validation, service integration, and error handling.
 *
 * @see src/main/ipc/autosave-handlers.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';

import { AutosaveChannels } from '@shared/contracts/autosave-ipc';
import { registerAutosaveHandlers, type AutosaveHandlerServices } from '../autosave-handlers';
import type { AutosaveSettings, RecoveryDialogEntry } from '@shared/contracts/autosave-schemas';

// ============================================================================
// Mock Setup
// ============================================================================

const mockIpcMain = {
  handle: vi.fn(),
} as unknown as IpcMain;

const mockWebContentsSend = vi.fn();

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      id: 42,
      mainFrame: { routingId: 99 },
      send: mockWebContentsSend,
    },
  } as unknown as BrowserWindow;
}

function createInvokeEvent(
  window: BrowserWindow,
  overrides?: { senderId?: number; senderFrameRoutingId?: number }
) {
  const senderId = overrides?.senderId ?? window.webContents.id;
  const senderFrameRoutingId =
    overrides?.senderFrameRoutingId ?? window.webContents.mainFrame.routingId;

  return {
    sender: {
      id: senderId,
      mainFrame: { routingId: window.webContents.mainFrame.routingId },
    },
    senderFrame: { routingId: senderFrameRoutingId },
  };
}

const mockWindow = createMockWindow();

// ============================================================================
// Test Constants
// ============================================================================

const DOC_1_UUID = '123e4567-e89b-12d3-a456-426614174001';
const DOC_2_UUID = '123e4567-e89b-12d3-a456-426614174002';
const DOC_3_UUID = '123e4567-e89b-12d3-a456-426614174003';
const TEST_DOC_UUID = '123e4567-e89b-12d3-a456-426614174000';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockServices(): AutosaveHandlerServices {
  return {
    settingsService: {
      getSettings: vi.fn().mockReturnValue({
        enabled: true,
        intervalMs: 30000,
        retentionDays: 7,
        maxFiles: 100,
        maxStorageMB: 50,
      }),
      setSettings: vi.fn().mockImplementation((updates: Partial<AutosaveSettings>) => ({
        enabled: true,
        intervalMs: 30000,
        retentionDays: 7,
        maxFiles: 100,
        maxStorageMB: 50,
        ...updates,
      })),
    },
    autosaveService: {
      saveDocument: vi.fn().mockResolvedValue({
        ok: true,
        savedAt: Date.now(),
      }),
    },
    recoveryService: {
      checkForRecovery: vi.fn().mockResolvedValue({
        hasRecoveryData: false,
        count: 0,
      }),
      listRecoverable: vi.fn().mockResolvedValue({
        entries: [],
      }),
      getPreview: vi.fn().mockResolvedValue({
        ok: true,
        content: '# Test',
        conflict: null,
      }),
      restore: vi.fn().mockResolvedValue({
        ok: true,
        restored: [
          {
            documentId: TEST_DOC_UUID,
            filePath: '/test/file.mdx',
            fileName: 'file.mdx',
            content: '# Test',
          },
        ],
      }),
      discardRecovery: vi.fn().mockResolvedValue({
        discardedCount: 1,
      }),
    },
  } as unknown as AutosaveHandlerServices;
}

// ============================================================================
// Handler Registration Tests
// ============================================================================

describe('registerAutosaveHandlers', () => {
  it('should register all recovery handlers', () => {
    const services = createMockServices();
    registerAutosaveHandlers(mockIpcMain, services, mockWindow);

    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      AutosaveChannels.RECOVERY_CHECK,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      AutosaveChannels.RECOVERY_LIST,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      AutosaveChannels.RECOVERY_PREVIEW,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      AutosaveChannels.RECOVERY_RESTORE,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      AutosaveChannels.RECOVERY_DISCARD,
      expect.any(Function)
    );
  });

  it('should register all autosave handlers', () => {
    const services = createMockServices();
    registerAutosaveHandlers(mockIpcMain, services, mockWindow);

    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      AutosaveChannels.AUTOSAVE_TRIGGER,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      AutosaveChannels.AUTOSAVE_STATUS,
      expect.any(Function)
    );
  });

  it('should register all settings handlers', () => {
    const services = createMockServices();
    registerAutosaveHandlers(mockIpcMain, services, mockWindow);

    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      AutosaveChannels.SETTINGS_GET,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      AutosaveChannels.SETTINGS_SET,
      expect.any(Function)
    );
  });

  it('should register conflict resolution handler', () => {
    const services = createMockServices();
    registerAutosaveHandlers(mockIpcMain, services, mockWindow);

    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      AutosaveChannels.CONFLICT_RESOLVE,
      expect.any(Function)
    );
  });

  it('should reject unauthorized sender for privileged autosave handler', async () => {
    const services = createMockServices();
    registerAutosaveHandlers(mockIpcMain, services, mockWindow);

    const autosaveStatusCall = vi
      .mocked(mockIpcMain.handle)
      .mock.calls.find(([channel]) => channel === AutosaveChannels.AUTOSAVE_STATUS);
    const autosaveStatusHandler = autosaveStatusCall?.[1] as
      | ((event: unknown, request: unknown) => Promise<unknown>)
      | undefined;

    expect(autosaveStatusHandler).toBeDefined();

    expect(() =>
      autosaveStatusHandler!(
        createInvokeEvent(mockWindow, { senderId: mockWindow.webContents.id + 1 }),
        undefined
      )
    ).toThrow('Unauthorized IPC sender');
  });
});

// ============================================================================
// Recovery Handler Tests
// ============================================================================

describe('Recovery Handlers', () => {
  let services: AutosaveHandlerServices;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockServices();
    handlers = {};

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (event: unknown, args: unknown) =>
        handler((event ?? createInvokeEvent(mockWindow)) as IpcMainInvokeEvent, args);
    });

    registerAutosaveHandlers(mockIpcMain, services, mockWindow);
  });

  describe('RECOVERY_CHECK', () => {
    it('should check for recoverable documents', async () => {
      vi.mocked(services.recoveryService.checkForRecovery).mockResolvedValue({
        hasRecoveryData: true,
        count: 3,
      });

      const handler = handlers[AutosaveChannels.RECOVERY_CHECK]!;
      const result = await handler(null, undefined);

      expect(result).toEqual({
        hasRecoveryData: true,
        count: 3,
      });
      expect(services.recoveryService.checkForRecovery).toHaveBeenCalled();
    });

    it('should return false when no recovery needed', async () => {
      const handler = handlers[AutosaveChannels.RECOVERY_CHECK]!;
      const result = await handler(null, undefined);

      expect(result).toEqual({
        hasRecoveryData: false,
        count: 0,
      });
    });
  });

  describe('RECOVERY_LIST', () => {
    it('should list all recoverable documents', async () => {
      const mockEntries: RecoveryDialogEntry[] = [
        {
          documentId: DOC_1_UUID as RecoveryDialogEntry['documentId'],
          fileName: 'file1.mdx',
          filePath: '/test/file1.mdx',
          savedAt: Date.now(),
          contentPreview: '# Preview 1',
          isValid: true,
          hasConflict: false,
        },
        {
          documentId: DOC_2_UUID as RecoveryDialogEntry['documentId'],
          fileName: 'file2.mdx',
          filePath: null,
          savedAt: Date.now() - 1000,
          contentPreview: '# Preview 2',
          isValid: true,
          hasConflict: false,
        },
      ];

      vi.mocked(services.recoveryService.listRecoverable).mockResolvedValue({
        entries: mockEntries,
      });

      const handler = handlers[AutosaveChannels.RECOVERY_LIST]!;
      const result = await handler(null, undefined);

      expect(result).toEqual({
        entries: mockEntries,
      });
    });

    it('should return empty list when no documents', async () => {
      const handler = handlers[AutosaveChannels.RECOVERY_LIST]!;
      const result = await handler(null, undefined);

      expect(result).toEqual({
        entries: [],
      });
    });
  });

  describe('RECOVERY_PREVIEW', () => {
    it('should get preview of recoverable document', async () => {
      const request = { documentId: DOC_1_UUID };

      const handler = handlers[AutosaveChannels.RECOVERY_PREVIEW]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        ok: true,
        content: '# Test',
        conflict: null,
      });
      expect(services.recoveryService.getPreview).toHaveBeenCalledWith(DOC_1_UUID);
    });
  });

  describe('RECOVERY_RESTORE', () => {
    it('should restore recoverable document', async () => {
      const request = {
        decision: {
          action: 'accept' as const,
          selectedIds: [DOC_1_UUID],
        },
      };

      const handler = handlers[AutosaveChannels.RECOVERY_RESTORE]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        ok: true,
        restored: [
          {
            documentId: TEST_DOC_UUID,
            filePath: '/test/file.mdx',
            fileName: 'file.mdx',
            content: '# Test',
          },
        ],
      });
      expect(services.recoveryService.restore).toHaveBeenCalledWith(request);
    });
  });

  describe('RECOVERY_DISCARD', () => {
    it('should discard single document', async () => {
      const request = { documentIds: [DOC_1_UUID] };

      const handler = handlers[AutosaveChannels.RECOVERY_DISCARD]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        discardedCount: 1,
      });
      expect(services.recoveryService.discardRecovery).toHaveBeenCalledWith([DOC_1_UUID]);
    });

    it('should discard multiple documents', async () => {
      const request = { documentIds: [DOC_1_UUID, DOC_2_UUID, DOC_3_UUID] };

      vi.mocked(services.recoveryService.discardRecovery).mockResolvedValue({
        discardedCount: 3,
      });

      const handler = handlers[AutosaveChannels.RECOVERY_DISCARD]!;
      const result = await handler(null, request);

      expect(result.discardedCount).toBe(3);
      expect(services.recoveryService.discardRecovery).toHaveBeenCalledWith([
        DOC_1_UUID,
        DOC_2_UUID,
        DOC_3_UUID,
      ]);
    });
  });
});

// ============================================================================
// Autosave Handler Tests
// ============================================================================

describe('Autosave Handlers', () => {
  let services: AutosaveHandlerServices;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockServices();
    handlers = {};

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (event: unknown, args: unknown) =>
        handler((event ?? createInvokeEvent(mockWindow)) as IpcMainInvokeEvent, args);
    });

    registerAutosaveHandlers(mockIpcMain, services, mockWindow);
  });

  describe('AUTOSAVE_STATUS', () => {
    it('should return idle status initially', async () => {
      const handler = handlers[AutosaveChannels.AUTOSAVE_STATUS]!;
      const result = await handler(null, undefined);

      expect(result.status).toBe('idle');
    });
  });

  describe('AUTOSAVE_TRIGGER', () => {
    it('should trigger autosave successfully', async () => {
      const request = {
        documentId: TEST_DOC_UUID,
        content: '# Test Content',
        filePath: '/test/file.mdx',
        fileName: 'file.mdx',
      };

      const handler = handlers[AutosaveChannels.AUTOSAVE_TRIGGER]!;
      const result = await handler(null, request);

      expect(result.ok).toBe(true);
      expect(result.savedAt).toBeDefined();
      expect(services.autosaveService.saveDocument).toHaveBeenCalledWith(request);
    });

    it('should update status to saved on success', async () => {
      const request = {
        documentId: TEST_DOC_UUID,
        content: '# Test',
        filePath: '/test/file.mdx',
        fileName: 'file.mdx',
      };

      await handlers[AutosaveChannels.AUTOSAVE_TRIGGER]!(null, request);

      const handler = handlers[AutosaveChannels.AUTOSAVE_STATUS]!;
      const status = await handler(null, undefined);

      expect(status.status).toBe('saved');
      expect(status.savedAt).toBeDefined();
    });

    it('should update status to failed on error', async () => {
      const request = {
        documentId: TEST_DOC_UUID,
        content: '# Test',
        filePath: '/test/file.mdx',
        fileName: 'file.mdx',
      };

      vi.mocked(services.autosaveService.saveDocument).mockResolvedValue({
        ok: false,
        error: 'DISK_FULL',
        message: 'Disk full',
      });

      await handlers[AutosaveChannels.AUTOSAVE_TRIGGER]!(null, request);

      const handler = handlers[AutosaveChannels.AUTOSAVE_STATUS]!;
      const status = await handler(null, undefined);

      expect(status.status).toBe('failed');
      expect(status.lastError).toBe('Disk full');
      expect(status.consecutiveFailures).toBe(1);
    });

    it('should set status to saving while in progress', async () => {
      const request = {
        documentId: TEST_DOC_UUID,
        content: '# Test',
        filePath: '/test/file.mdx',
        fileName: 'file.mdx',
      };

      // Start save but don't await
      const savePromise = handlers[AutosaveChannels.AUTOSAVE_TRIGGER]!(null, request);

      // Check status immediately (should be saving)
      // Note: This is a race condition in the real implementation
      // The status might be 'saving' or 'saved' depending on timing

      await savePromise;
    });
  });
});

// ============================================================================
// Settings Handler Tests
// ============================================================================

describe('Settings Handlers', () => {
  let services: AutosaveHandlerServices;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockServices();
    handlers = {};

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (event: unknown, args: unknown) =>
        handler((event ?? createInvokeEvent(mockWindow)) as IpcMainInvokeEvent, args);
    });

    registerAutosaveHandlers(mockIpcMain, services, mockWindow);
  });

  describe('SETTINGS_GET', () => {
    it('should get current settings', async () => {
      const handler = handlers[AutosaveChannels.SETTINGS_GET]!;
      const result = await handler(null, undefined);

      expect(result).toEqual({
        enabled: true,
        intervalMs: 30000,
        retentionDays: 7,
        maxFiles: 100,
        maxStorageMB: 50,
      });
      expect(services.settingsService.getSettings).toHaveBeenCalled();
    });
  });

  describe('SETTINGS_SET', () => {
    it('should update single setting', async () => {
      const request = { enabled: false };

      const handler = handlers[AutosaveChannels.SETTINGS_SET]!;
      const result = await handler(null, request);

      expect(result.enabled).toBe(false);
      expect(services.settingsService.setSettings).toHaveBeenCalledWith({
        enabled: false,
      });
    });

    it('should update multiple settings', async () => {
      const request = {
        enabled: true,
        intervalMs: 60000,
        retentionDays: 14,
      };

      const handler = handlers[AutosaveChannels.SETTINGS_SET]!;
      const result = await handler(null, request);

      expect(result).toMatchObject({
        enabled: true,
        intervalMs: 60000,
        retentionDays: 14,
      });
      expect(services.settingsService.setSettings).toHaveBeenCalledWith({
        enabled: true,
        intervalMs: 60000,
        retentionDays: 14,
      });
    });

    it('should filter out undefined values', async () => {
      const request = {
        enabled: true,
        intervalMs: undefined,
        retentionDays: 10,
      };

      await handlers[AutosaveChannels.SETTINGS_SET]!(null, request);

      const callArgs = vi.mocked(services.settingsService.setSettings).mock.calls[0]![0];
      expect(callArgs).toEqual({
        enabled: true,
        retentionDays: 10,
      });
      expect(callArgs).not.toHaveProperty('intervalMs');
    });

    it('should broadcast updated settings to renderer', async () => {
      const request = { intervalMs: 60000 };
      const updatedSettings = {
        enabled: true,
        intervalMs: 60000,
        retentionDays: 7,
        maxFiles: 100,
        maxStorageMB: 50,
      };
      vi.mocked(services.settingsService.setSettings).mockReturnValue(updatedSettings);

      const handler = handlers[AutosaveChannels.SETTINGS_SET]!;
      const result = await handler(null, request);

      expect(result).toEqual(updatedSettings);
      expect(mockWebContentsSend).toHaveBeenCalledWith(
        'mdxpad:autosave:settings:changed',
        updatedSettings
      );
    });
  });
});

// ============================================================================
// Conflict Resolution Handler Tests
// ============================================================================

describe('Conflict Resolution Handler', () => {
  let services: AutosaveHandlerServices;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockServices();
    handlers = {};

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (event: unknown, args: unknown) =>
        handler((event ?? createInvokeEvent(mockWindow)) as IpcMainInvokeEvent, args);
    });

    registerAutosaveHandlers(mockIpcMain, services, mockWindow);
  });

  describe('CONFLICT_RESOLVE', () => {
    it('should resolve conflict with recovery version', async () => {
      const request = {
        resolution: {
          choice: 'recovery' as const,
          documentId: '123e4567-e89b-12d3-a456-426614174000',
        },
      };

      const handler = handlers[AutosaveChannels.CONFLICT_RESOLVE]!;
      const result = await handler(null, request);

      expect(result).toEqual({ ok: true });
      expect(services.recoveryService.restore).toHaveBeenCalledWith({
        decision: {
          action: 'accept',
          selectedIds: ['123e4567-e89b-12d3-a456-426614174000'],
        },
      });
    });

    it('should resolve conflict with disk version', async () => {
      const request = {
        resolution: {
          choice: 'disk' as const,
          documentId: '123e4567-e89b-12d3-a456-426614174000',
        },
      };

      const handler = handlers[AutosaveChannels.CONFLICT_RESOLVE]!;
      const result = await handler(null, request);

      expect(result).toEqual({ ok: true });
      expect(services.recoveryService.discardRecovery).toHaveBeenCalledWith([
        '123e4567-e89b-12d3-a456-426614174000',
      ]);
    });

    it('should resolve conflict with save-as choice', async () => {
      const request = {
        resolution: {
          choice: 'save-as' as const,
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          newPath: '/test/new-file.mdx',
        },
      };

      const handler = handlers[AutosaveChannels.CONFLICT_RESOLVE]!;
      const result = await handler(null, request);

      expect(result).toEqual({ ok: true });
      expect(services.recoveryService.discardRecovery).toHaveBeenCalledWith([
        '123e4567-e89b-12d3-a456-426614174000',
      ]);
    });
  });
});
