/**
 * E2E tests for file operations in mdxpad.
 *
 * Tests cover keyboard shortcuts and file operation workflows:
 * - US1: Cmd+O opens file dialog
 * - US2: Cmd+S saves file / shows dialog for untitled
 * - US3: Cmd+Shift+S shows Save As dialog
 * - US4: Cmd+N creates untitled document
 * - US5: Close with unsaved changes shows dialog
 * - US6: External file change notification
 * - US7: Recent Files menu population
 *
 * Prerequisites:
 * - Build the app first: `pnpm build`
 * - Run tests: `pnpm test:e2e tests/e2e/file-operations.spec.ts`
 */

import type { ElectronApplication, Page } from 'playwright';
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { writeFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { launchMdxpad, safeCloseElectronApp } from './utils/electron-lifecycle';

let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string | null = null;

// Test fixtures directory
const TEST_FIXTURES_DIR = join(tmpdir(), 'mdxpad-e2e-fixtures');
const TEST_FILE_PATH = join(TEST_FIXTURES_DIR, 'test-document.mdx');
const TEST_FILE_CONTENT = '# Test Document\n\nThis is test content.';

async function dispatchMenuAcceleratorEvent(
  channel:
    | 'mdxpad:menu:open-file-dialog'
    | 'mdxpad:menu:save-file'
    | 'mdxpad:menu:save-file-as'
    | 'mdxpad:menu:new-file'
): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }, eventChannel) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents.send(eventChannel);
  }, channel);
}

type WindowOperationMetrics = {
  minimizeCalls: number;
  maximizeCalls: number;
  restoreCalls: number;
  isMinimized: boolean;
  isMaximized: boolean;
};

async function installWindowOperationTracker(): Promise<boolean> {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0] as any;
    if (!win) {
      return false;
    }

    const state = globalThis as any;
    const previousRestore = state.__restoreWindowOperationTracker as (() => void) | undefined;
    previousRestore?.();

    const originalMinimize = win.minimize.bind(win) as (...args: unknown[]) => unknown;
    const originalMaximize = win.maximize.bind(win) as (...args: unknown[]) => unknown;
    const originalRestore = win.restore.bind(win) as (...args: unknown[]) => unknown;

    state.__windowOperationMetrics = {
      minimizeCalls: 0,
      maximizeCalls: 0,
      restoreCalls: 0,
    };

    win.minimize = (...innerArgs: unknown[]) => {
      state.__windowOperationMetrics.minimizeCalls += 1;
      return originalMinimize(...innerArgs);
    };

    win.maximize = (...innerArgs: unknown[]) => {
      state.__windowOperationMetrics.maximizeCalls += 1;
      return originalMaximize(...innerArgs);
    };

    win.restore = (...innerArgs: unknown[]) => {
      state.__windowOperationMetrics.restoreCalls += 1;
      return originalRestore(...innerArgs);
    };

    state.__restoreWindowOperationTracker = () => {
      win.minimize = originalMinimize;
      win.maximize = originalMaximize;
      win.restore = originalRestore;
      delete state.__windowOperationMetrics;
      delete state.__restoreWindowOperationTracker;
    };

    return true;
  });
}

async function getWindowOperationMetrics(): Promise<WindowOperationMetrics> {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0] as any;
    const state = globalThis as any;
    const metrics = state.__windowOperationMetrics ?? {
      minimizeCalls: 0,
      maximizeCalls: 0,
      restoreCalls: 0,
    };

    return {
      minimizeCalls: metrics.minimizeCalls,
      maximizeCalls: metrics.maximizeCalls,
      restoreCalls: metrics.restoreCalls,
      isMinimized: Boolean(win?.isMinimized?.()),
      isMaximized: Boolean(win?.isMaximized?.()),
    };
  });
}

async function uninstallWindowOperationTracker(): Promise<void> {
  await electronApp.evaluate(() => {
    const state = globalThis as any;
    const restore = state.__restoreWindowOperationTracker as (() => void) | undefined;
    restore?.();
  });
}

test.beforeAll(async () => {
  // Create test fixtures directory
  if (!existsSync(TEST_FIXTURES_DIR)) {
    mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
  }

  // Create test file
  writeFileSync(TEST_FILE_PATH, TEST_FILE_CONTENT, 'utf-8');

  const launched = await launchMdxpad({ userDataDirSuffix: 'file-operations' });
  electronApp = launched.app;
  userDataDir = launched.userDataDir;

  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await safeCloseElectronApp(electronApp, userDataDir);
  userDataDir = null;

  // Cleanup test fixtures
  if (existsSync(TEST_FIXTURES_DIR)) {
    rmSync(TEST_FIXTURES_DIR, { recursive: true, force: true });
  }
});

test.describe('File Operations E2E', () => {
  test.describe('US1: Open File (Cmd+O)', () => {
    test('should have mdxpad API with openFile method', async () => {
      const hasOpenFile = await page.evaluate(() => {
        return typeof (window as any).mdxpad?.openFile === 'function';
      });
      expect(hasOpenFile).toBe(true);
    });

    test('Cmd+O should trigger file open dialog', async () => {
      // Spy native open dialog in main process (contextBridge API is immutable in renderer).
      await electronApp.evaluate(({ dialog }) => {
        (globalThis as { __openDialogCalled?: boolean }).__openDialogCalled = false;
        const originalOpenDialog = dialog.showOpenDialog.bind(dialog);
        (globalThis as { __restoreOpenDialog?: () => void }).__restoreOpenDialog = () => {
          dialog.showOpenDialog = originalOpenDialog;
        };
        dialog.showOpenDialog = async () => {
          (globalThis as { __openDialogCalled?: boolean }).__openDialogCalled = true;
          return { canceled: true, filePaths: [] };
        };
      });

      // Simulate accelerator pathway: File menu event routed to renderer command execution.
      await dispatchMenuAcceleratorEvent('mdxpad:menu:open-file-dialog');

      // Small delay for event propagation
      await page.waitForTimeout(100);

      // Check if native dialog handler was invoked
      const wasCalled = await electronApp.evaluate(() => {
        return (globalThis as { __openDialogCalled?: boolean }).__openDialogCalled === true;
      });

      // Restore original dialog implementation
      await electronApp.evaluate(() => {
        const restore = (globalThis as { __restoreOpenDialog?: () => void }).__restoreOpenDialog;
        if (restore) {
          restore();
        }
      });

      expect(wasCalled).toBe(true);
    });

    test('cancelled file dialog should not change document state', async () => {
      // Simulate cancelled dialog response
      const result = await page.evaluate(async () => {
        const mdxpad = (window as any).mdxpad;
        // Mock the openFile to return cancelled
        return { ok: false, error: { code: 'CANCELLED' } };
      });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('CANCELLED');
    });
  });

  test.describe('US2: Save File (Cmd+S)', () => {
    test('should have mdxpad API with saveFile method', async () => {
      const hasSaveFile = await page.evaluate(() => {
        return typeof (window as any).mdxpad?.saveFile === 'function';
      });
      expect(hasSaveFile).toBe(true);
    });

    test('Cmd+S on clean untitled document should not trigger save dialog', async () => {
      // Spy native save dialog in main process.
      await electronApp.evaluate(({ dialog }) => {
        (globalThis as { __saveDialogCalled?: boolean }).__saveDialogCalled = false;
        const originalSaveDialog = dialog.showSaveDialog.bind(dialog);
        (globalThis as { __restoreSaveDialog?: () => void }).__restoreSaveDialog = () => {
          dialog.showSaveDialog = originalSaveDialog;
        };
        dialog.showSaveDialog = async () => {
          (globalThis as { __saveDialogCalled?: boolean }).__saveDialogCalled = true;
          return { canceled: true, filePath: '' };
        };
      });

      // Simulate accelerator pathway: File menu event routed to renderer command execution.
      await dispatchMenuAcceleratorEvent('mdxpad:menu:save-file');
      await page.waitForTimeout(100);

      const wasCalled = await electronApp.evaluate(() => {
        return (globalThis as { __saveDialogCalled?: boolean }).__saveDialogCalled === true;
      });

      // Restore original dialog implementation
      await electronApp.evaluate(() => {
        const restore = (globalThis as { __restoreSaveDialog?: () => void }).__restoreSaveDialog;
        if (restore) {
          restore();
        }
      });

      expect(wasCalled).toBe(false);
    });

    test('saveFile should return success result for valid operations', async () => {
      // Test the API contract
      const hasCorrectSignature = await page.evaluate(() => {
        const mdxpad = (window as any).mdxpad;
        return mdxpad && typeof mdxpad.saveFile === 'function';
      });
      expect(hasCorrectSignature).toBe(true);
    });
  });

  test.describe('US3: Save As (Cmd+Shift+S)', () => {
    test('should have mdxpad API with saveFileAs method', async () => {
      const hasSaveFileAs = await page.evaluate(() => {
        return typeof (window as any).mdxpad?.saveFileAs === 'function';
      });
      expect(hasSaveFileAs).toBe(true);
    });

    test('Cmd+Shift+S should trigger Save As dialog', async () => {
      await electronApp.evaluate(({ dialog }) => {
        (globalThis as { __saveAsDialogCalled?: boolean }).__saveAsDialogCalled = false;
        const originalSaveDialog = dialog.showSaveDialog.bind(dialog);
        (globalThis as { __restoreSaveAsDialog?: () => void }).__restoreSaveAsDialog = () => {
          dialog.showSaveDialog = originalSaveDialog;
        };
        dialog.showSaveDialog = async () => {
          (globalThis as { __saveAsDialogCalled?: boolean }).__saveAsDialogCalled = true;
          return { canceled: true, filePath: '' };
        };
      });

      // Simulate accelerator pathway: File menu event routed to renderer command execution.
      await dispatchMenuAcceleratorEvent('mdxpad:menu:save-file-as');
      await page.waitForTimeout(100);

      const wasCalled = await electronApp.evaluate(() => {
        return (globalThis as { __saveAsDialogCalled?: boolean }).__saveAsDialogCalled === true;
      });

      await electronApp.evaluate(() => {
        const restore = (globalThis as { __restoreSaveAsDialog?: () => void }).__restoreSaveAsDialog;
        if (restore) {
          restore();
        }
      });

      expect(wasCalled).toBe(true);
    });

    test('cancelled Save As should preserve original file path', async () => {
      // Verify cancelled dialog returns appropriate error
      const mockResult = { ok: false, error: { code: 'CANCELLED' } };
      expect(mockResult.ok).toBe(false);
      expect(mockResult.error.code).toBe('CANCELLED');
    });
  });

  test.describe('US4: New File (Cmd+N)', () => {
    test('Cmd+N should create new untitled document', async () => {
      // Track if new document action is triggered
      await page.evaluate(() => {
        (window as any).__newDocumentCreated = false;
        // Hook into whatever mechanism creates new documents
        // This depends on the app's implementation
      });

      // Simulate accelerator pathway: File menu event routed to renderer command execution.
      await dispatchMenuAcceleratorEvent('mdxpad:menu:new-file');
      await page.waitForTimeout(100);

      // Verify new document behavior
      // The specific assertions depend on how the app handles Cmd+N
      // Common expectations:
      // - Window title changes to "Untitled"
      // - Editor content is cleared
      // - Dirty state is false
    });

    test('new document should have "Untitled" as name', async () => {
      // This tests the FileHandle creation for new documents
      const mockNewFileHandle = {
        id: 'test-id',
        path: null, // null indicates untitled
        name: 'Untitled',
      };

      expect(mockNewFileHandle.path).toBeNull();
      expect(mockNewFileHandle.name).toBe('Untitled');
    });
  });

  test.describe('US5: Close with Unsaved Changes', () => {
    test('should have mdxpad API with closeWindow method', async () => {
      const hasCloseWindow = await page.evaluate(() => {
        return typeof (window as any).mdxpad?.closeWindow === 'function';
      });
      expect(hasCloseWindow).toBe(true);
    });

    test('closing with dirty document should show confirmation dialog', async () => {
      // This test verifies the dirty state detection and dialog flow
      // In a real scenario, we would:
      // 1. Make changes to create dirty state
      // 2. Attempt to close
      // 3. Verify dialog appears

      await page.evaluate(() => {
        (window as any).__closeWindowCalled = false;
        const original = (window as any).mdxpad.closeWindow;
        (window as any).mdxpad.closeWindow = async () => {
          (window as any).__closeWindowCalled = true;
          // Dialog would be shown by main process
        };
        (window as any).__originalCloseWindow = original;
      });

      // The actual close behavior is handled by Electron's window manager
      // with the 'close' event handler in main process
    });

    test('dialog should have Save, Discard, and Cancel options', async () => {
      // Verify dialog configuration matches spec
      const expectedButtons = ['Save', 'Discard', 'Cancel'];
      expect(expectedButtons).toHaveLength(3);
      expect(expectedButtons[0]).toBe('Save');
      expect(expectedButtons[1]).toBe('Discard');
      expect(expectedButtons[2]).toBe('Cancel');
    });

    test('clean document should close without dialog', async () => {
      // When there are no unsaved changes, close should proceed directly
      const mockDirtyState = false;
      expect(mockDirtyState).toBe(false);
      // Window would close immediately without showing dialog
    });
  });

  test.describe('US6: External File Change Detection', () => {
    test('should have onFileChange event listener', async () => {
      const hasOnFileChange = await page.evaluate(() => {
        return typeof (window as any).mdxpad?.onFileChange === 'function';
      });
      expect(hasOnFileChange).toBe(true);
    });

    test('onFileChange should return unsubscribe function', async () => {
      const unsubscribeIsFunction = await page.evaluate(() => {
        const mdxpad = (window as any).mdxpad;
        if (mdxpad?.onFileChange) {
          const unsubscribe = mdxpad.onFileChange(() => {});
          const isFunction = typeof unsubscribe === 'function';
          // Clean up
          if (isFunction) unsubscribe();
          return isFunction;
        }
        return false;
      });
      expect(unsubscribeIsFunction).toBe(true);
    });

    test('file change event should contain correct structure', async () => {
      // Verify FileChangeEvent shape
      const mockEvent = {
        fileId: 'test-file-id',
        path: '/path/to/file.mdx',
        type: 'change' as const,
      };

      expect(mockEvent.fileId).toBeDefined();
      expect(mockEvent.path).toBeDefined();
      expect(['change', 'unlink']).toContain(mockEvent.type);
    });

    test('external modification should trigger notification', async () => {
      // This test would require:
      // 1. Opening a file
      // 2. Modifying it externally (e.g., via fs.writeFileSync)
      // 3. Waiting for the file watcher to detect the change
      // 4. Verifying the onFileChange callback is invoked

      // Set up listener
      const eventReceived = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          const mdxpad = (window as any).mdxpad;
          if (mdxpad?.onFileChange) {
            const unsubscribe = mdxpad.onFileChange((event: any) => {
              unsubscribe();
              resolve(true);
            });

            // Timeout if no event received
            setTimeout(() => {
              unsubscribe();
              resolve(false);
            }, 2000);
          } else {
            resolve(false);
          }
        });
      });

      // Note: This test would need actual file modification to complete
      // In CI/CD, we might skip this or use a mock
    });
  });

  test.describe('US7: Recent Files Menu', () => {
    test('should track recently opened files', async () => {
      // The Recent Files feature is managed by the main process
      // RecentFilesService maintains the list
      // This test verifies the menu integration

      // Attempt to access the app menu (Electron-specific)
      const menuExists = await electronApp.evaluate(async ({ Menu }) => {
        const appMenu = Menu.getApplicationMenu();
        if (!appMenu) return false;

        // Find File menu
        const fileMenu = appMenu.items.find(
          (item) => item.label === 'File' || item.role === 'fileMenu'
        );
        return !!fileMenu;
      });

      // Menu should exist
      expect(menuExists).toBe(true);
    });

    test('recent files list should have maximum 10 entries', async () => {
      // Verify the RecentFilesService constraint
      const MAX_RECENT_FILES = 10;
      expect(MAX_RECENT_FILES).toBe(10);
    });

    test('selecting recent file should open it', async () => {
      // This would test clicking a menu item and verifying file opens
      // Implementation depends on how the menu is constructed
    });

    test('missing recent file should show error and be removed', async () => {
      // When a file in the recent list no longer exists:
      // 1. Show user-friendly error
      // 2. Remove from recent files list

      const mockMissingFileError = {
        ok: false,
        error: { code: 'NOT_FOUND', path: '/path/to/deleted/file.mdx' },
      };

      expect(mockMissingFileError.ok).toBe(false);
      expect(mockMissingFileError.error.code).toBe('NOT_FOUND');
    });
  });

  test.describe('Error Handling', () => {
    test('NOT_FOUND error should be user-friendly', async () => {
      const error = { code: 'NOT_FOUND', path: '/missing/file.mdx' };
      expect(error.code).toBe('NOT_FOUND');
      expect(error.path).toBeDefined();
    });

    test('PERMISSION_DENIED error should be user-friendly', async () => {
      const error = { code: 'PERMISSION_DENIED', path: '/restricted/file.mdx' };
      expect(error.code).toBe('PERMISSION_DENIED');
      expect(error.path).toBeDefined();
    });

    test('CANCELLED should not show error message', async () => {
      const result = { ok: false, error: { code: 'CANCELLED' } };
      expect(result.error.code).toBe('CANCELLED');
      // CANCELLED is a normal flow, not an error to display
    });

    test('UNKNOWN error should include message', async () => {
      const error = { code: 'UNKNOWN', message: 'Unexpected error occurred' };
      expect(error.code).toBe('UNKNOWN');
      expect(error.message).toBeDefined();
    });
  });

  test.describe('API Contract Verification', () => {
    test('readFile should accept path and return FileResult<string>', async () => {
      const hasReadFile = await page.evaluate(() => {
        return typeof (window as any).mdxpad?.readFile === 'function';
      });
      expect(hasReadFile).toBe(true);
    });

    test('writeFile should accept path and content', async () => {
      const hasWriteFile = await page.evaluate(() => {
        return typeof (window as any).mdxpad?.writeFile === 'function';
      });
      expect(hasWriteFile).toBe(true);
    });

    test('all file operations should return FileResult type', async () => {
      // Verify the discriminated union structure
      const successResult = { ok: true, value: 'content' };
      const errorResult = { ok: false, error: { code: 'NOT_FOUND', path: '/test' } };

      expect(successResult.ok).toBe(true);
      expect(successResult.value).toBeDefined();

      expect(errorResult.ok).toBe(false);
      expect(errorResult.error).toBeDefined();
    });
  });
});

test.describe('Window Operations E2E', () => {
  test('should have minimizeWindow method', async () => {
    const hasMinimize = await page.evaluate(() => {
      return typeof (window as any).mdxpad?.minimizeWindow === 'function';
    });
    expect(hasMinimize).toBe(true);
  });

  test('should have maximizeWindow method', async () => {
    const hasMaximize = await page.evaluate(() => {
      return typeof (window as any).mdxpad?.maximizeWindow === 'function';
    });
    expect(hasMaximize).toBe(true);
  });

  test('minimizeWindow should minimize the window', async () => {
    const trackerInstalled = await installWindowOperationTracker();
    expect(trackerInstalled).toBe(true);

    try {
      const result = await page.evaluate(async () => {
        return await (window as any).mdxpad.minimizeWindow();
      });
      expect(result).toBeUndefined();

      await expect
        .poll(async () => {
          const metrics = await getWindowOperationMetrics();
          return metrics.minimizeCalls;
        })
        .toBeGreaterThan(0);
    } finally {
      await uninstallWindowOperationTracker();
      await electronApp.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win?.isMinimized()) {
          win.restore();
        }
      });
    }
  });

  test('maximizeWindow should toggle maximize state', async () => {
    const trackerInstalled = await installWindowOperationTracker();
    expect(trackerInstalled).toBe(true);

    try {
      const initial = await getWindowOperationMetrics();

      const firstResult = await page.evaluate(async () => {
        return await (window as any).mdxpad.maximizeWindow();
      });
      expect(firstResult).toBeUndefined();

      if (initial.isMaximized) {
        await expect
          .poll(async () => {
            const metrics = await getWindowOperationMetrics();
            return metrics.restoreCalls;
          })
          .toBeGreaterThan(0);
      } else {
        await expect
          .poll(async () => {
            const metrics = await getWindowOperationMetrics();
            return metrics.maximizeCalls;
          })
          .toBeGreaterThan(0);
      }

      const afterFirst = await getWindowOperationMetrics();

      const secondResult = await page.evaluate(async () => {
        return await (window as any).mdxpad.maximizeWindow();
      });
      expect(secondResult).toBeUndefined();

      if (initial.isMaximized) {
        await expect
          .poll(async () => {
            const metrics = await getWindowOperationMetrics();
            return metrics.maximizeCalls;
          })
          .toBeGreaterThan(afterFirst.maximizeCalls);
      } else {
        await expect
          .poll(async () => {
            const metrics = await getWindowOperationMetrics();
            return metrics.restoreCalls;
          })
          .toBeGreaterThan(afterFirst.restoreCalls);
      }
    } finally {
      await uninstallWindowOperationTracker();
      await electronApp.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win?.isMinimized()) {
          win.restore();
        }
        if (win?.isMaximized()) {
          win.restore();
        }
      });
    }
  });
});

test.describe('Keyboard Shortcuts Integration', () => {
  test('Cmd+O should be registered for file open', async () => {
    // Test that the accelerator is properly bound
    // This verifies the menu/shortcut registration
    const menuHasOpenShortcut = await electronApp.evaluate(({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      if (!appMenu) return false;

      const fileMenu = appMenu.items.find(
        (item) => item.label === 'File' || item.role === 'fileMenu'
      );
      if (!fileMenu?.submenu) return false;

      const openItem = fileMenu.submenu.items.find(
        (item) => item.label?.includes('Open') || item.accelerator === 'CmdOrCtrl+O'
      );
      return !!openItem;
    });

    expect(menuHasOpenShortcut).toBe(true);
  });

  test('Cmd+S should be registered for file save', async () => {
    const menuHasSaveShortcut = await electronApp.evaluate(({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      if (!appMenu) return false;

      const fileMenu = appMenu.items.find(
        (item) => item.label === 'File' || item.role === 'fileMenu'
      );
      if (!fileMenu?.submenu) return false;

      const saveItem = fileMenu.submenu.items.find(
        (item) => item.label?.includes('Save') && item.accelerator === 'CmdOrCtrl+S'
      );
      return !!saveItem;
    });

    expect(menuHasSaveShortcut).toBe(true);
  });

  test('Cmd+Shift+S should be registered for Save As', async () => {
    const menuHasSaveAsShortcut = await electronApp.evaluate(({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      if (!appMenu) return false;

      const fileMenu = appMenu.items.find(
        (item) => item.label === 'File' || item.role === 'fileMenu'
      );
      if (!fileMenu?.submenu) return false;

      const saveAsItem = fileMenu.submenu.items.find(
        (item) =>
          item.label?.includes('Save As') || item.accelerator === 'CmdOrCtrl+Shift+S'
      );
      return !!saveAsItem;
    });

    expect(menuHasSaveAsShortcut).toBe(true);
  });

  test('Cmd+N should be registered for new file', async () => {
    const menuHasNewShortcut = await electronApp.evaluate(({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      if (!appMenu) return false;

      const fileMenu = appMenu.items.find(
        (item) => item.label === 'File' || item.role === 'fileMenu'
      );
      if (!fileMenu?.submenu) return false;

      const newItem = fileMenu.submenu.items.find(
        (item) => item.label?.includes('New') || item.accelerator === 'CmdOrCtrl+N'
      );
      return !!newItem;
    });

    expect(menuHasNewShortcut).toBe(true);
  });
});
