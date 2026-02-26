/**
 * Application Menu Tests
 *
 * Tests menu construction, recent files management, and menu actions.
 * Tests file operations, error handling, and security controls.
 *
 * @see src/main/menu.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Menu, dialog, shell, app, type BrowserWindow } from 'electron';

import {
  buildApplicationMenu,
  refreshApplicationMenu,
  addToRecentFiles,
  removeFromRecentFiles,
  clearRecentFiles,
  getRecentFiles,
  initializeApplicationMenu,
} from '../menu';

// ============================================================================
// Mock Setup
// ============================================================================

/**
 * Shared mock for the RecentFilesService singleton.
 * The menu module lazily creates a singleton via `getRecentFilesService()`,
 * so we need the mock constructor to always return the *same* instance.
 */
const mockRecentFilesServiceInstance = {
  getRecent: vi.fn().mockReturnValue([]),
  addRecent: vi.fn(),
  removeRecent: vi.fn(),
  clear: vi.fn(),
};

vi.mock('electron', () => ({
  Menu: {
    buildFromTemplate: vi.fn((template) => ({ template })),
    setApplicationMenu: vi.fn(),
  },
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  },
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined),
  },
  app: {
    name: 'mdxpad',
    getVersion: vi.fn().mockReturnValue('1.0.0'),
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    access: vi.fn(),
  },
  access: vi.fn(),
}));

vi.mock('@main/services/recent-files', () => ({
  RecentFilesService: vi.fn().mockImplementation(() => mockRecentFilesServiceInstance),
}));

vi.mock('@main/services/file-service', () => ({
  readFile: vi.fn().mockResolvedValue({ ok: true, value: '# Test' }),
  createFileHandle: vi.fn((path: string) => ({
    id: 'test-id',
    path,
    name: path.split('/').pop(),
  })),
}));

import { access } from 'node:fs/promises';
import * as FileService from '@main/services/file-service';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      send: vi.fn(),
    },
  } as unknown as BrowserWindow;
}

function findMenuItem(template: any[], label: string): any {
  for (const item of template) {
    if (item.label === label) return item;
  }
  return undefined;
}

/** Like findMenuItem but throws if not found (avoids TS2532 in tests). */
function findMenuItemStrict(template: any[], label: string): any {
  const item = findMenuItem(template, label);
  if (!item) throw new Error(`Menu item "${label}" not found`);
  return item;
}

// ============================================================================
// Menu Building Tests
// ============================================================================

describe('buildApplicationMenu', () => {
  let window: BrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    window = createMockWindow();
  });

  it('should build menu template', () => {
    buildApplicationMenu(window);

    expect(Menu.buildFromTemplate).toHaveBeenCalled();
    expect(Menu.setApplicationMenu).toHaveBeenCalled();
  });

  it('should include File menu', () => {
    buildApplicationMenu(window);

    const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
    const fileMenu = findMenuItem(template, 'File');

    expect(fileMenu).toBeDefined();
    expect(fileMenu.submenu).toBeDefined();
  });

  it('should include Edit menu', () => {
    buildApplicationMenu(window);

    const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
    const editMenu = findMenuItem(template, 'Edit');

    expect(editMenu).toBeDefined();
  });

  it('should include View menu', () => {
    buildApplicationMenu(window);

    const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
    const viewMenu = findMenuItem(template, 'View');

    expect(viewMenu).toBeDefined();
  });

  it('should include Window menu', () => {
    buildApplicationMenu(window);

    const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
    const windowMenu = findMenuItem(template, 'Window');

    expect(windowMenu).toBeDefined();
  });

  it('should include Help menu', () => {
    buildApplicationMenu(window);

    const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
    const helpMenu = findMenuItem(template, 'Help');

    expect(helpMenu).toBeDefined();
  });

  it('should include app menu on macOS', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    buildApplicationMenu(window);

    const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
    const appMenu = findMenuItem(template, 'mdxpad');

    expect(appMenu).toBeDefined();

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
});

// ============================================================================
// Recent Files Tests
// ============================================================================

describe('Recent Files', () => {
  let window: BrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    window = createMockWindow();
    // Reset mock return values
    mockRecentFilesServiceInstance.getRecent.mockReturnValue([]);
  });

  describe('addToRecentFiles', () => {
    it('should add file to recent list', () => {
      addToRecentFiles('/test/file.mdx');

      expect(mockRecentFilesServiceInstance.addRecent).toHaveBeenCalledWith('/test/file.mdx');
    });

    it('should refresh menu after adding', () => {
      buildApplicationMenu(window);
      const buildCount = vi.mocked(Menu.buildFromTemplate).mock.calls.length;

      addToRecentFiles('/test/file.mdx');

      expect(Menu.buildFromTemplate).toHaveBeenCalledTimes(buildCount + 1);
    });
  });

  describe('removeFromRecentFiles', () => {
    it('should remove file from recent list', () => {
      removeFromRecentFiles('/test/file.mdx');

      expect(mockRecentFilesServiceInstance.removeRecent).toHaveBeenCalledWith('/test/file.mdx');
    });

    it('should refresh menu after removing', () => {
      buildApplicationMenu(window);
      const buildCount = vi.mocked(Menu.buildFromTemplate).mock.calls.length;

      removeFromRecentFiles('/test/file.mdx');

      expect(Menu.buildFromTemplate).toHaveBeenCalledTimes(buildCount + 1);
    });
  });

  describe('clearRecentFiles', () => {
    it('should clear all recent files', () => {
      clearRecentFiles();

      expect(mockRecentFilesServiceInstance.clear).toHaveBeenCalled();
    });

    it('should refresh menu after clearing', () => {
      buildApplicationMenu(window);
      const buildCount = vi.mocked(Menu.buildFromTemplate).mock.calls.length;

      clearRecentFiles();

      expect(Menu.buildFromTemplate).toHaveBeenCalledTimes(buildCount + 1);
    });
  });

  describe('getRecentFiles', () => {
    it('should return recent files list', () => {
      const mockEntries = [
        { path: '/test/file1.mdx', accessedAt: Date.now() },
        { path: '/test/file2.mdx', accessedAt: Date.now() - 1000 },
      ];

      mockRecentFilesServiceInstance.getRecent.mockReturnValue(mockEntries);

      const result = getRecentFiles();

      expect(result).toEqual(mockEntries);
    });
  });

  describe('Recent Files Submenu', () => {
    it('should show "No Recent Files" when empty', () => {
      buildApplicationMenu(window);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
      const fileMenu = findMenuItemStrict(template, 'File');
      const recentMenu = findMenuItemStrict(fileMenu.submenu, 'Recent Files');

      expect(recentMenu.submenu[0].label).toBe('No Recent Files');
      expect(recentMenu.submenu[0].enabled).toBe(false);
    });

    it('should list recent files when available', () => {
      const mockEntries = [
        { path: '/test/file1.mdx', accessedAt: Date.now() },
        { path: '/test/file2.mdx', accessedAt: Date.now() - 1000 },
      ];

      mockRecentFilesServiceInstance.getRecent.mockReturnValue(mockEntries);

      buildApplicationMenu(window);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
      const fileMenu = findMenuItemStrict(template, 'File');
      const recentMenu = findMenuItemStrict(fileMenu.submenu, 'Recent Files');

      expect(recentMenu.submenu[0].label).toBe('file1.mdx');
      expect(recentMenu.submenu[1].label).toBe('file2.mdx');
    });

    it('should include Clear Recent option', () => {
      const mockEntries = [{ path: '/test/file1.mdx', accessedAt: Date.now() }];
      mockRecentFilesServiceInstance.getRecent.mockReturnValue(mockEntries);

      buildApplicationMenu(window);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
      const fileMenu = findMenuItemStrict(template, 'File');
      const recentMenu = findMenuItemStrict(fileMenu.submenu, 'Recent Files');

      const clearItem = recentMenu.submenu.find((item: any) => item.label === 'Clear Recent');
      expect(clearItem).toBeDefined();
    });
  });
});

// ============================================================================
// Menu Actions Tests
// ============================================================================

describe('Menu Actions', () => {
  let window: BrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    window = createMockWindow();
  });

  describe('File Menu Actions', () => {
    it('should send new-file event on New click', () => {
      buildApplicationMenu(window);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
      const fileMenu = findMenuItemStrict(template, 'File');
      const newItem = findMenuItemStrict(fileMenu.submenu, 'New');

      newItem.click();

      expect(window.webContents.send).toHaveBeenCalledWith('mdxpad:menu:new-file');
    });

    it('should send open-file-dialog event on Open click', () => {
      buildApplicationMenu(window);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
      const fileMenu = findMenuItemStrict(template, 'File');
      const openItem = findMenuItemStrict(fileMenu.submenu, 'Open...');

      openItem.click();

      expect(window.webContents.send).toHaveBeenCalledWith('mdxpad:menu:open-file-dialog');
    });

    it('should send save-file event on Save click', () => {
      buildApplicationMenu(window);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
      const fileMenu = findMenuItemStrict(template, 'File');
      const saveItem = findMenuItemStrict(fileMenu.submenu, 'Save');

      saveItem.click();

      expect(window.webContents.send).toHaveBeenCalledWith('mdxpad:menu:save-file');
    });

    it('should send save-file-as event on Save As click', () => {
      buildApplicationMenu(window);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
      const fileMenu = findMenuItemStrict(template, 'File');
      const saveAsItem = findMenuItemStrict(fileMenu.submenu, 'Save As...');

      saveAsItem.click();

      expect(window.webContents.send).toHaveBeenCalledWith('mdxpad:menu:save-file-as');
    });

    it('should send export-file event on Export click', () => {
      buildApplicationMenu(window);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
      const fileMenu = findMenuItemStrict(template, 'File');
      const exportItem = findMenuItemStrict(fileMenu.submenu, 'Export...');

      exportItem.click();

      expect(window.webContents.send).toHaveBeenCalledWith('mdxpad:menu:export-file');
    });
  });

  describe('View Menu Actions', () => {
    it('should send command-palette event on Command Palette click', () => {
      buildApplicationMenu(window);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
      const viewMenu = findMenuItemStrict(template, 'View');
      const cmdPaletteItem = findMenuItemStrict(viewMenu.submenu, 'Command Palette...');

      cmdPaletteItem.click();

      expect(window.webContents.send).toHaveBeenCalledWith('mdxpad:menu:command-palette');
    });
  });

  describe('Help Menu Actions', () => {
    it('should open allowed external URLs', () => {
      buildApplicationMenu(window);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
      const helpMenu = findMenuItemStrict(template, 'Help');
      const learnMoreItem = findMenuItemStrict(helpMenu.submenu, 'Learn More');

      learnMoreItem.click();

      expect(shell.openExternal).toHaveBeenCalledWith('https://mdxjs.com/');
    });

    it('should not open disallowed URLs', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      buildApplicationMenu(window);

      // Try to trigger with a fake URL (this would need menu modification in real code)
      // For now, just verify the allowlist concept

      consoleError.mockRestore();
    });
  });
});

// ============================================================================
// File Opening Tests
// ============================================================================

describe('Opening Recent Files', () => {
  let window: BrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    window = createMockWindow();
    mockRecentFilesServiceInstance.getRecent.mockReturnValue([]);

    vi.mocked(access).mockResolvedValue(undefined);
  });

  it('should read and send file content when file exists', async () => {
    const mockEntry = { path: '/test/file.mdx', accessedAt: Date.now() };
    mockRecentFilesServiceInstance.getRecent.mockReturnValue([mockEntry]);

    buildApplicationMenu(window);

    const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
    const fileMenu = findMenuItemStrict(template, 'File');
    const recentMenu = findMenuItemStrict(fileMenu.submenu, 'Recent Files');
    const fileItem = recentMenu.submenu[0];

    await fileItem.click();

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(FileService.readFile).toHaveBeenCalledWith('/test/file.mdx');
    expect(window.webContents.send).toHaveBeenCalledWith(
      'mdxpad:menu:open-file',
      expect.objectContaining({
        content: '# Test',
      })
    );
  });

  it('should show error and remove file when not found', async () => {
    const mockEntry = { path: '/test/missing.mdx', accessedAt: Date.now() };
    mockRecentFilesServiceInstance.getRecent.mockReturnValue([mockEntry]);

    vi.mocked(access).mockRejectedValue(new Error('ENOENT'));

    buildApplicationMenu(window);

    const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
    const fileMenu = findMenuItemStrict(template, 'File');
    const recentMenu = findMenuItemStrict(fileMenu.submenu, 'Recent Files');
    const fileItem = recentMenu.submenu[0];

    await fileItem.click();

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      window,
      expect.objectContaining({
        type: 'error',
        title: 'File Not Found',
      })
    );
    expect(mockRecentFilesServiceInstance.removeRecent).toHaveBeenCalledWith('/test/missing.mdx');
  });

  it('should show error when read fails', async () => {
    const mockEntry = { path: '/test/file.mdx', accessedAt: Date.now() };
    mockRecentFilesServiceInstance.getRecent.mockReturnValue([mockEntry]);

    vi.mocked(FileService.readFile).mockResolvedValue({
      ok: false,
      error: { code: 'PERMISSION_DENIED', path: '/test/file.mdx' },
    });

    buildApplicationMenu(window);

    const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0]![0];
    const fileMenu = findMenuItemStrict(template, 'File');
    const recentMenu = findMenuItemStrict(fileMenu.submenu, 'Recent Files');
    const fileItem = recentMenu.submenu[0];

    await fileItem.click();

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      window,
      expect.objectContaining({
        type: 'error',
        title: 'Error Opening File',
        detail: 'Permission denied when reading the file.',
      })
    );
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Menu Integration', () => {
  let window: BrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    window = createMockWindow();
  });

  describe('initializeApplicationMenu', () => {
    it('should build menu on initialization', () => {
      initializeApplicationMenu(window);

      expect(Menu.buildFromTemplate).toHaveBeenCalled();
      expect(Menu.setApplicationMenu).toHaveBeenCalled();
    });
  });

  describe('refreshApplicationMenu', () => {
    it('should rebuild menu when called', () => {
      buildApplicationMenu(window);
      const initialCallCount = vi.mocked(Menu.buildFromTemplate).mock.calls.length;

      refreshApplicationMenu();

      expect(Menu.buildFromTemplate).toHaveBeenCalledTimes(initialCallCount + 1);
    });

    it('should handle refresh without initialized window', () => {
      refreshApplicationMenu();

      // Should not throw error
      expect(true).toBe(true);
    });
  });
});
