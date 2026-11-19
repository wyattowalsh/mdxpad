/**
 * Event Subscription API Preload Bridge Tests
 *
 * Tests for event subscription/unsubscription pattern and
 * event listener dispatch for file change, menu, and settings events.
 *
 * @module tests/unit/preload/event-api
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

type IpcCallback = (event: unknown, data?: unknown) => void;

const { registeredListeners, mockOn, mockSend } = vi.hoisted(() => {
  const registeredListeners = new Map<string, IpcCallback[]>();
  const mockOn = vi.fn((channel: string, callback: IpcCallback) => {
    if (!registeredListeners.has(channel)) {
      registeredListeners.set(channel, []);
    }
    registeredListeners.get(channel)!.push(callback);
  });
  const mockSend = vi.fn();
  return { registeredListeners, mockOn, mockSend };
});

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: (...args: unknown[]) => mockOn(args[0] as string, args[1] as IpcCallback),
    send: (...args: unknown[]) => mockSend(args[0], args[1]),
  },
}));

// Helper to simulate IPC event emission
function emitIpcEvent(channel: string, data?: unknown) {
  const listeners = registeredListeners.get(channel) ?? [];
  for (const listener of listeners) {
    listener({}, data);
  }
}

import { eventSubscriptions } from '../event-api';
import { IPC_CHANNELS, IPC_EVENTS } from '@shared/lib/ipc';

// Valid UUID for use in test data
const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';

// ============================================================================
// Tests
// ============================================================================

describe('eventSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockClear();
  });

  // --------------------------------------------------------------------------
  // onFileChange
  // --------------------------------------------------------------------------

  describe('onFileChange', () => {
    it('should register a callback and receive validated events', () => {
      const callback = vi.fn();
      eventSubscriptions.onFileChange(callback);

      emitIpcEvent('mdxpad:file:change', {
        fileId: TEST_UUID,
        path: '/test/file.mdx',
        type: 'change',
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: TEST_UUID,
          path: '/test/file.mdx',
          type: 'change',
        })
      );
    });

    it('should not call callback for invalid event data', () => {
      const callback = vi.fn();
      eventSubscriptions.onFileChange(callback);

      emitIpcEvent('mdxpad:file:change', 'invalid');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = eventSubscriptions.onFileChange(callback);

      unsubscribe();

      const callback2 = vi.fn();
      eventSubscriptions.onFileChange(callback2);
      emitIpcEvent('mdxpad:file:change', {
        fileId: TEST_UUID,
        path: '/test.mdx',
        type: 'change',
      });

      expect(callback).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Menu Events (void callbacks)
  // --------------------------------------------------------------------------

  describe('onMenuCommandPalette', () => {
    it('should register and call callback on menu event', () => {
      const callback = vi.fn();
      eventSubscriptions.onMenuCommandPalette(callback);

      emitIpcEvent(IPC_EVENTS.menuCommandPalette);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = eventSubscriptions.onMenuCommandPalette(callback);

      unsubscribe();

      emitIpcEvent(IPC_EVENTS.menuCommandPalette);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('tab menu events', () => {
    it('closes, reopens, and switches tabs from the menu', () => {
      const closeTab = vi.fn();
      const reopenTab = vi.fn();
      const nextTab = vi.fn();
      const previousTab = vi.fn();
      const switchTab = vi.fn();
      eventSubscriptions.onMenuCloseTab(closeTab);
      eventSubscriptions.onMenuReopenTab(reopenTab);
      eventSubscriptions.onMenuNextTab(nextTab);
      eventSubscriptions.onMenuPreviousTab(previousTab);
      eventSubscriptions.onMenuSwitchTab(switchTab);

      emitIpcEvent(IPC_EVENTS.menuCloseTab);
      emitIpcEvent(IPC_EVENTS.menuReopenTab);
      emitIpcEvent(IPC_EVENTS.menuNextTab);
      emitIpcEvent(IPC_EVENTS.menuPreviousTab);
      emitIpcEvent(IPC_EVENTS.menuSwitchTab, 2);
      emitIpcEvent(IPC_EVENTS.menuSwitchTab, 0);

      expect(closeTab).toHaveBeenCalledTimes(1);
      expect(reopenTab).toHaveBeenCalledTimes(1);
      expect(nextTab).toHaveBeenCalledTimes(1);
      expect(previousTab).toHaveBeenCalledTimes(1);
      expect(switchTab).toHaveBeenCalledTimes(1);
      expect(switchTab).toHaveBeenCalledWith(2);
    });
  });

  describe('onMenuNewFile', () => {
    it('should register and call callback', () => {
      const callback = vi.fn();
      eventSubscriptions.onMenuNewFile(callback);

      emitIpcEvent(IPC_EVENTS.menuNewFile);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('onMenuOpenFileDialog', () => {
    it('should register and call callback', () => {
      const callback = vi.fn();
      eventSubscriptions.onMenuOpenFileDialog(callback);

      emitIpcEvent(IPC_EVENTS.menuOpenFileDialog);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('onMenuSaveFile', () => {
    it('should register and call callback', () => {
      const callback = vi.fn();
      eventSubscriptions.onMenuSaveFile(callback);

      emitIpcEvent(IPC_EVENTS.menuSaveFile);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('onMenuSaveFileAs', () => {
    it('should register and call callback', () => {
      const callback = vi.fn();
      eventSubscriptions.onMenuSaveFileAs(callback);

      emitIpcEvent(IPC_EVENTS.menuSaveFileAs);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('onMenuExportFile', () => {
    it('should register and call callback', () => {
      const callback = vi.fn();
      eventSubscriptions.onMenuExportFile(callback);

      emitIpcEvent(IPC_EVENTS.menuExportFile);

      expect(callback).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // onMenuOpenFile (with data)
  // --------------------------------------------------------------------------

  describe('onMenuOpenFile', () => {
    it('should register and call callback with validated event data', () => {
      const callback = vi.fn();
      eventSubscriptions.onMenuOpenFile(callback);

      emitIpcEvent(IPC_EVENTS.menuOpenFile, {
        handle: { id: TEST_UUID, path: '/test/file.mdx', name: 'file.mdx' },
        content: '# Hello',
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          handle: expect.objectContaining({ id: TEST_UUID }),
          content: '# Hello',
        })
      );
    });

    it('should not call callback for invalid data', () => {
      const callback = vi.fn();
      eventSubscriptions.onMenuOpenFile(callback);

      emitIpcEvent(IPC_EVENTS.menuOpenFile, { invalid: true });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // onAutosaveSettingsChange
  // --------------------------------------------------------------------------

  describe('onRecoveryRestore', () => {
    it('opens recovered autosave entries and ignores an invalid payload', () => {
      const callback = vi.fn();
      eventSubscriptions.onRecoveryRestore(callback);

      emitIpcEvent('mdxpad:recovery:restore', [
        { displayName: 'Recovered: note', content: '# Hi', savedAt: 10 },
      ]);
      emitIpcEvent('mdxpad:recovery:restore', { content: 'nope' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith([
        { displayName: 'Recovered: note', content: '# Hi', savedAt: 10 },
      ]);
    });
  });

  describe('onAutosaveSettingsChange', () => {
    it('should register and call callback with validated settings', () => {
      const callback = vi.fn();
      eventSubscriptions.onAutosaveSettingsChange(callback);

      emitIpcEvent('mdxpad:autosave:settings:changed', {
        enabled: true,
        intervalMs: 30000,
        retentionDays: 30,
        maxFiles: 50,
        maxStorageMB: 100,
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          intervalMs: 30000,
        })
      );
    });

    it('should not call callback for invalid settings data', () => {
      const callback = vi.fn();
      eventSubscriptions.onAutosaveSettingsChange(callback);

      emitIpcEvent('mdxpad:autosave:settings:changed', 'not-an-object');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // onEditorDirtyCheck
  // --------------------------------------------------------------------------

  describe('onEditorDirtyCheck', () => {
    it('should send dirty response when callback reports dirty', () => {
      const unsubscribe = eventSubscriptions.onEditorDirtyCheck(() => true);

      emitIpcEvent(IPC_CHANNELS.editor.isDirty);

      expect(mockSend).toHaveBeenCalledWith(
        IPC_CHANNELS.editor.isDirtyResponse,
        expect.objectContaining({ isDirty: true })
      );

      unsubscribe();
    });

    it('should send clean response when no callback reports dirty', () => {
      const unsubscribe = eventSubscriptions.onEditorDirtyCheck(() => false);

      emitIpcEvent(IPC_CHANNELS.editor.isDirty);

      expect(mockSend).toHaveBeenCalledWith(
        IPC_CHANNELS.editor.isDirtyResponse,
        expect.objectContaining({ isDirty: false })
      );

      unsubscribe();
    });
  });
});
