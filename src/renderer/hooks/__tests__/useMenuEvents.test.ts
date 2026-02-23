/**
 * Tests for useMenuEvents hook.
 *
 * Tests menu event wiring, native menu bridging,
 * external file change handling, and command registration.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Track registered event listeners
const menuListeners: Record<string, (() => void)[]> = {};
const mockUnsubscribers: (() => void)[] = [];

function createMockUnsub(): () => void {
  const unsub = vi.fn();
  mockUnsubscribers.push(unsub);
  return unsub;
}

// Mock mdxpad API on window
const mockMdxpadApi = {
  getVersion: vi.fn().mockResolvedValue('1.0.0'),
  getSecurityInfo: vi.fn().mockResolvedValue({
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
  }),
  openFile: vi.fn(),
  saveFile: vi.fn(),
  saveFileAs: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  closeWindow: vi.fn(),
  minimizeWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  signalReady: vi.fn(),
  onFileChange: vi.fn((cb: (event: unknown) => void) => {
    menuListeners['fileChange'] = menuListeners['fileChange'] || [];
    menuListeners['fileChange'].push(cb as () => void);
    return createMockUnsub();
  }),
  onMenuCommandPalette: vi.fn((cb: () => void) => {
    menuListeners['commandPalette'] = menuListeners['commandPalette'] || [];
    menuListeners['commandPalette'].push(cb);
    return createMockUnsub();
  }),
  onMenuNewFile: vi.fn((cb: () => void) => {
    menuListeners['newFile'] = menuListeners['newFile'] || [];
    menuListeners['newFile'].push(cb);
    return createMockUnsub();
  }),
  onMenuOpenFileDialog: vi.fn((cb: () => void) => {
    menuListeners['openFile'] = menuListeners['openFile'] || [];
    menuListeners['openFile'].push(cb);
    return createMockUnsub();
  }),
  onMenuOpenFile: vi.fn(() => createMockUnsub()),
  onMenuSaveFile: vi.fn((cb: () => void) => {
    menuListeners['saveFile'] = menuListeners['saveFile'] || [];
    menuListeners['saveFile'].push(cb);
    return createMockUnsub();
  }),
  onMenuSaveFileAs: vi.fn((cb: () => void) => {
    menuListeners['saveFileAs'] = menuListeners['saveFileAs'] || [];
    menuListeners['saveFileAs'].push(cb);
    return createMockUnsub();
  }),
  onEditorDirtyCheck: vi.fn((cb: () => boolean) => {
    menuListeners['dirtyCheck'] = menuListeners['dirtyCheck'] || [];
    menuListeners['dirtyCheck'].push(cb as unknown as () => void);
    return createMockUnsub();
  }),
  platform: { os: 'darwin' as const, arch: 'arm64' as const },
};

// Mock command-related modules
const mockToggle = vi.fn();
const mockExecuteCommand = vi.fn();

vi.mock('../useCommandPalette', () => ({
  useCommandPalette: () => ({
    isOpen: false,
    toggle: mockToggle,
    executeCommand: mockExecuteCommand,
    query: '',
    setQuery: vi.fn(),
    results: [],
    selectedIndex: 0,
    setSelectedIndex: vi.fn(),
  }),
  buildCommandContext: vi.fn(
    (
      _editor: unknown,
      _api: unknown,
      doc: { fileId: string; filePath: string; content: string; isDirty: boolean },
      _notify: unknown
    ) => ({
      editor: null,
      api: _api,
      document: doc,
      notify: _notify,
    })
  ),
}));

vi.mock('../useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

const { mockRegister, mockRegisterAllCommands } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockRegisterAllCommands: vi.fn(() => vi.fn()),
}));

vi.mock('../../stores/command-registry-store', () => ({
  useCommandRegistry: {
    getState: () => ({ register: mockRegister }),
  },
}));

vi.mock('../../stores/document-store', () => {
  const state = {
    fileId: 'file-1',
    filePath: '/test/file.mdx',
    isDirty: false,
    content: '# Hello',
    handleExternalChange: vi.fn(),
  };
  return {
    useDocumentStore: (selector: (s: typeof state) => unknown) => selector(state),
  };
});

vi.mock('../../commands', () => ({
  registerAllCommands: () => mockRegisterAllCommands(),
}));

vi.mock('../../commands/file-commands', () => ({
  FILE_COMMAND_IDS: {
    new: 'file.new',
    open: 'file.open',
    save: 'file.save',
    saveAs: 'file.saveAs',
  },
}));

import { useMenuEvents } from '../useMenuEvents';

describe('useMenuEvents', () => {
  const editorRef = { current: null };
  const handleNotification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(menuListeners).forEach((key) => delete menuListeners[key]);
    mockUnsubscribers.length = 0;
    Object.defineProperty(window, 'mdxpad', {
      value: mockMdxpadApi,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (window as unknown as { mdxpad?: unknown }).mdxpad;
  });

  describe('initialization', () => {
    it('should return palette, version, platform, and getCommandContext', async () => {
      const { result } = renderHook(() => useMenuEvents(editorRef as never, handleNotification));

      expect(result.current.palette).toBeDefined();
      expect(result.current.platform).toEqual({ os: 'darwin', arch: 'arm64' });
      expect(result.current.getCommandContext).toBeInstanceOf(Function);
    });

    it('should register built-in commands on mount', () => {
      renderHook(() => useMenuEvents(editorRef as never, handleNotification));
      expect(mockRegister).toHaveBeenCalled();
      expect(mockRegisterAllCommands).toHaveBeenCalled();
    });
  });

  describe('native menu bridging', () => {
    it('should subscribe to menu events on mount', () => {
      renderHook(() => useMenuEvents(editorRef as never, handleNotification));

      expect(mockMdxpadApi.onMenuNewFile).toHaveBeenCalled();
      expect(mockMdxpadApi.onMenuOpenFileDialog).toHaveBeenCalled();
      expect(mockMdxpadApi.onMenuSaveFile).toHaveBeenCalled();
      expect(mockMdxpadApi.onMenuSaveFileAs).toHaveBeenCalled();
    });

    it('should unsubscribe from menu events on unmount', () => {
      const { unmount } = renderHook(() => useMenuEvents(editorRef as never, handleNotification));

      unmount();

      // Check that unsubscribers were called
      const calledUnsubs = mockUnsubscribers.filter(
        (u) => (u as ReturnType<typeof vi.fn>).mock.calls.length > 0
      );
      expect(calledUnsubs.length).toBeGreaterThan(0);
    });
  });

  describe('external file change', () => {
    it('should subscribe to file change events', () => {
      renderHook(() => useMenuEvents(editorRef as never, handleNotification));
      expect(mockMdxpadApi.onFileChange).toHaveBeenCalled();
    });
  });

  describe('dirty-state responder', () => {
    it('should subscribe to dirty-state checks on mount', () => {
      renderHook(() => useMenuEvents(editorRef as never, handleNotification));
      expect(mockMdxpadApi.onEditorDirtyCheck).toHaveBeenCalled();
    });
  });

  describe('command context', () => {
    it('should build command context with current document state', () => {
      const { result } = renderHook(() => useMenuEvents(editorRef as never, handleNotification));

      const context = result.current.getCommandContext();
      expect(context).toBeDefined();
    });
  });

  describe('command palette menu event', () => {
    it('should subscribe to command palette menu event', () => {
      renderHook(() => useMenuEvents(editorRef as never, handleNotification));
      expect(mockMdxpadApi.onMenuCommandPalette).toHaveBeenCalled();
    });
  });
});
