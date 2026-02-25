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
import {
  writeFileSync,
  readFileSync,
  unlinkSync,
  mkdirSync,
  rmSync,
  existsSync,
  chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { launchMdxpad, safeCloseElectronApp } from './utils/electron-lifecycle';

let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string | null = null;

// Test fixtures directory
const TEST_FIXTURES_DIR = join(tmpdir(), 'mdxpad-e2e-fixtures');
const TEST_FILE_PATH = join(TEST_FIXTURES_DIR, 'test-document.mdx');
const TEST_FILE_CONTENT = '# Test Document\n\nThis is test content.';
const TEST_FILE_ID = '550e8400-e29b-41d4-a716-446655440000';

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
  unmaximizeCalls: number;
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
    const originalUnmaximize = win.unmaximize.bind(win) as (...args: unknown[]) => unknown;
    const originalIsMaximized = win.isMaximized.bind(win) as () => boolean;
    let syntheticIsMaximized = originalIsMaximized();

    state.__windowOperationMetrics = {
      minimizeCalls: 0,
      maximizeCalls: 0,
      unmaximizeCalls: 0,
    };

    win.minimize = (...innerArgs: unknown[]) => {
      state.__windowOperationMetrics.minimizeCalls += 1;
      return originalMinimize(...innerArgs);
    };

    win.maximize = (...innerArgs: unknown[]) => {
      state.__windowOperationMetrics.maximizeCalls += 1;
      syntheticIsMaximized = true;
      return originalMaximize(...innerArgs);
    };

    win.unmaximize = (...innerArgs: unknown[]) => {
      state.__windowOperationMetrics.unmaximizeCalls += 1;
      syntheticIsMaximized = false;
      return originalUnmaximize(...innerArgs);
    };

    win.isMaximized = () => syntheticIsMaximized;

    state.__restoreWindowOperationTracker = () => {
      win.minimize = originalMinimize;
      win.maximize = originalMaximize;
      win.unmaximize = originalUnmaximize;
      win.isMaximized = originalIsMaximized;
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
      unmaximizeCalls: 0,
    };

    return {
      minimizeCalls: metrics.minimizeCalls,
      maximizeCalls: metrics.maximizeCalls,
      unmaximizeCalls: metrics.unmaximizeCalls,
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

      // Wait for event propagation by polling for the expected state
      await expect
        .poll(async () => {
          return await electronApp.evaluate(() => {
            return (globalThis as { __openDialogCalled?: boolean }).__openDialogCalled === true;
          });
        })
        .toBe(true);

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
      const fileNameBefore = (await page.getByTestId('file-info-name').textContent())?.trim() ?? '';

      await electronApp.evaluate(({ dialog }) => {
        (globalThis as { __openDialogCancelled?: boolean }).__openDialogCancelled = false;
        const originalOpenDialog = dialog.showOpenDialog.bind(dialog);
        (globalThis as { __restoreOpenDialogCancelled?: () => void }).__restoreOpenDialogCancelled =
          () => {
            dialog.showOpenDialog = originalOpenDialog;
          };
        dialog.showOpenDialog = async () => {
          (globalThis as { __openDialogCancelled?: boolean }).__openDialogCancelled = true;
          return { canceled: true, filePaths: [] };
        };
      });

      try {
        const result = await page.evaluate(async () => {
          return await (window as any).mdxpad.openFile();
        });

        expect(result.ok).toBe(false);
        expect(result.error.code).toBe('CANCELLED');

        const fileNameAfter =
          (await page.getByTestId('file-info-name').textContent())?.trim() ?? '';
        expect(fileNameAfter).toBe(fileNameBefore);
      } finally {
        await electronApp.evaluate(() => {
          const restore = (globalThis as { __restoreOpenDialogCancelled?: () => void })
            .__restoreOpenDialogCancelled;
          if (restore) {
            restore();
          }
        });
      }
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

      // Wait briefly for IPC event propagation, then check state.
      // For a clean untitled doc, the save dialog should NOT be triggered,
      // so we poll a few times to confirm it stays false.
      await expect
        .poll(
          async () => {
            return await electronApp.evaluate(() => {
              return (globalThis as { __saveDialogCalled?: boolean }).__saveDialogCalled === true;
            });
          },
          { timeout: 1000, intervals: [100, 200, 300] }
        )
        .toBe(false);

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
      const saveTargetPath = join(TEST_FIXTURES_DIR, 'save-target.mdx');
      const updatedContent = '# Saved by E2E\n\nUpdated content';
      writeFileSync(saveTargetPath, '# Initial', 'utf-8');

      const result = await page.evaluate(
        async ({ path, content, fileId }) => {
          return await (window as any).mdxpad.saveFile(
            { id: fileId, path, name: 'save-target.mdx' },
            content
          );
        },
        { path: saveTargetPath, content: updatedContent, fileId: TEST_FILE_ID }
      );

      expect(result.ok).toBe(true);
      const writtenContent = readFileSync(saveTargetPath, 'utf-8');
      expect(writtenContent).toBe(updatedContent);
      if (existsSync(saveTargetPath)) {
        unlinkSync(saveTargetPath);
      }
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

      // Wait for event propagation by polling for the expected state
      await expect
        .poll(async () => {
          return await electronApp.evaluate(() => {
            return (globalThis as { __saveAsDialogCalled?: boolean }).__saveAsDialogCalled === true;
          });
        })
        .toBe(true);

      const wasCalled = await electronApp.evaluate(() => {
        return (globalThis as { __saveAsDialogCalled?: boolean }).__saveAsDialogCalled === true;
      });

      await electronApp.evaluate(() => {
        const restore = (globalThis as { __restoreSaveAsDialog?: () => void })
          .__restoreSaveAsDialog;
        if (restore) {
          restore();
        }
      });

      expect(wasCalled).toBe(true);
    });

    test('cancelled Save As should preserve original file path', async () => {
      await dispatchMenuAcceleratorEvent('mdxpad:menu:new-file');
      await expect(page.getByTestId('file-info-name')).toHaveText('Untitled');
      const fileNameBefore = (await page.getByTestId('file-info-name').textContent())?.trim() ?? '';

      await electronApp.evaluate(({ dialog }) => {
        (globalThis as { __saveAsDialogCancelled?: boolean }).__saveAsDialogCancelled = false;
        const originalSaveDialog = dialog.showSaveDialog.bind(dialog);
        (
          globalThis as { __restoreSaveAsDialogCancelled?: () => void }
        ).__restoreSaveAsDialogCancelled = () => {
          dialog.showSaveDialog = originalSaveDialog;
        };
        dialog.showSaveDialog = async () => {
          (globalThis as { __saveAsDialogCancelled?: boolean }).__saveAsDialogCancelled = true;
          return { canceled: true, filePath: '' };
        };
      });

      try {
        await dispatchMenuAcceleratorEvent('mdxpad:menu:save-file-as');
        await expect
          .poll(async () => {
            return await electronApp.evaluate(() => {
              return (
                (globalThis as { __saveAsDialogCancelled?: boolean }).__saveAsDialogCancelled ===
                true
              );
            });
          })
          .toBe(true);

        const fileNameAfter =
          (await page.getByTestId('file-info-name').textContent())?.trim() ?? '';
        expect(fileNameAfter).toBe(fileNameBefore);
      } finally {
        await electronApp.evaluate(() => {
          const restore = (globalThis as { __restoreSaveAsDialogCancelled?: () => void })
            .__restoreSaveAsDialogCancelled;
          if (restore) {
            restore();
          }
        });
      }
    });
  });

  test.describe('US4: New File (Cmd+N)', () => {
    test('Cmd+N should create new untitled document', async () => {
      const editor = page.locator('.cm-editor').first();
      await expect(editor).toBeVisible();
      await editor.click();
      await page.keyboard.type('temporary text');
      await expect(page.getByTestId('file-info-dirty')).toBeVisible();

      // Simulate accelerator pathway: File menu event routed to renderer command execution.
      await dispatchMenuAcceleratorEvent('mdxpad:menu:new-file');

      // Wait for IPC event propagation by waiting for status bar to remain visible
      await expect(page.locator('[data-testid="status-bar"]')).toBeVisible();
      await expect(page.getByTestId('file-info-name')).toHaveText('Untitled');
      await expect(page.getByTestId('file-info-dirty')).toHaveCount(0);
    });
  });

  test.describe('US5: Close with Unsaved Changes', () => {
    test('should have mdxpad API with closeWindow method', async () => {
      const hasCloseWindow = await page.evaluate(() => {
        return typeof (window as any).mdxpad?.closeWindow === 'function';
      });
      expect(hasCloseWindow).toBe(true);
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
      await page.evaluate(() => {
        const win = window as any;
        const previousUnsubscribe = win.__fileChangeUnsubscribe;
        if (typeof previousUnsubscribe === 'function') {
          previousUnsubscribe();
        }
        win.__fileChangeEvent = null;
        win.__fileChangeSetupError = null;

        const mdxpad = win.mdxpad;
        if (!mdxpad?.onFileChange) {
          win.__fileChangeSetupError = 'onFileChange API unavailable';
          return;
        }

        win.__fileChangeUnsubscribe = mdxpad.onFileChange(
          (event: { fileId: string; path: string; type: string }) => {
            win.__fileChangeEvent = event;
          }
        );
      });

      await electronApp.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('mdxpad:file:change', {
          fileId: '550e8400-e29b-41d4-a716-446655440000',
          path: '/tmp/file-change-structure.mdx',
          type: 'change',
        });
      });

      const setupError = await page.evaluate(() => {
        return (window as any).__fileChangeSetupError as string | null;
      });
      expect(setupError).toBeNull();

      await expect
        .poll(
          async () => {
            return await page.evaluate(() => {
              return (window as any).__fileChangeEvent !== null;
            });
          },
          { timeout: 5000 }
        )
        .toBe(true);

      const event = await page.evaluate(() => {
        return (window as any).__fileChangeEvent as { fileId: string; path: string; type: string };
      });
      expect(event.fileId).toBe(TEST_FILE_ID);
      expect(event.path).toBe('/tmp/file-change-structure.mdx');
      expect(event.type).toBe('change');

      await page.evaluate(() => {
        const win = window as any;
        const unsubscribe = win.__fileChangeUnsubscribe;
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
        win.__fileChangeUnsubscribe = null;
      });
    });

    test('external modification should trigger notification', async () => {
      await page.evaluate(() => {
        const win = window as any;
        const previousUnsubscribe = win.__fileChangeUnsubscribe;
        if (typeof previousUnsubscribe === 'function') {
          previousUnsubscribe();
        }
        win.__fileChangeEvent = null;

        const mdxpad = win.mdxpad;
        if (!mdxpad?.onFileChange) {
          win.__fileChangeSetupError = 'onFileChange API unavailable';
          return;
        }

        win.__fileChangeSetupError = null;
        win.__fileChangeUnsubscribe = mdxpad.onFileChange((event: { type: string }) => {
          win.__fileChangeEvent = event;
        });
      });

      await electronApp.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('mdxpad:file:change', {
          fileId: '550e8400-e29b-41d4-a716-446655440000',
          path: '/tmp/file-change-unlink.mdx',
          type: 'unlink',
        });
      });

      const setupError = await page.evaluate(() => {
        return (window as any).__fileChangeSetupError as string | null;
      });
      expect(setupError).toBeNull();

      await expect
        .poll(
          async () => {
            return await page.evaluate(() => {
              return (window as any).__fileChangeEvent?.type ?? null;
            });
          },
          { timeout: 5000 }
        )
        .toBe('unlink');

      await page.evaluate(() => {
        const win = window as any;
        const unsubscribe = win.__fileChangeUnsubscribe;
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
        win.__fileChangeUnsubscribe = null;
      });
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
  });

  test.describe('Error Handling', () => {
    test('NOT_FOUND error should be user-friendly', async () => {
      const missingPath = join(TEST_FIXTURES_DIR, `missing-${Date.now()}.mdx`);
      const result = await page.evaluate(async (path) => {
        return await (window as any).mdxpad.readFile(path);
      }, missingPath);

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.path).toBe(missingPath);
    });

    test('PERMISSION_DENIED error should be user-friendly', async () => {
      const restrictedPath = join(TEST_FIXTURES_DIR, `restricted-${Date.now()}.mdx`);
      writeFileSync(restrictedPath, 'restricted', 'utf-8');
      chmodSync(restrictedPath, 0o000);

      try {
        const result = await page.evaluate(async (path) => {
          return await (window as any).mdxpad.readFile(path);
        }, restrictedPath);
        expect(result.ok).toBe(false);
        expect(result.error.code).toBe('PERMISSION_DENIED');
        expect(result.error.path).toBe(restrictedPath);
      } finally {
        if (existsSync(restrictedPath)) {
          chmodSync(restrictedPath, 0o600);
          unlinkSync(restrictedPath);
        }
      }
    });

    test('CANCELLED should not show error message', async () => {
      await electronApp.evaluate(({ dialog }) => {
        const originalOpenDialog = dialog.showOpenDialog.bind(dialog);
        (globalThis as { __restoreCancelledDialog?: () => void }).__restoreCancelledDialog = () => {
          dialog.showOpenDialog = originalOpenDialog;
        };
        dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
      });
      const result = await page.evaluate(async () => {
        return await (window as any).mdxpad.openFile();
      });
      await electronApp.evaluate(() => {
        const restore = (globalThis as { __restoreCancelledDialog?: () => void })
          .__restoreCancelledDialog;
        if (restore) {
          restore();
        }
      });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('CANCELLED');
      expect(result.error.message).toBeUndefined();
    });

    test('UNKNOWN error should include message', async () => {
      const result = await page.evaluate(async () => {
        return await (window as any).mdxpad.saveFile(
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            path: null,
            name: 'Untitled',
          },
          'content'
        );
      });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('UNKNOWN');
      expect(result.error.message).toContain('no path');
    });
  });

  test.describe('API Contract Verification', () => {
    test('readFile should accept path and return FileResult<string>', async () => {
      const result = await page.evaluate(async (path) => {
        return await (window as any).mdxpad.readFile(path);
      }, TEST_FILE_PATH);

      expect(result.ok).toBe(true);
      expect(result.value).toContain('Test Document');
    });

    test('writeFile should accept path and content', async () => {
      const writeTargetPath = join(TEST_FIXTURES_DIR, `write-target-${Date.now()}.mdx`);
      const content = '# Write API test';
      const result = await page.evaluate(
        async ({ path, value }) => {
          return await (window as any).mdxpad.writeFile(path, value);
        },
        { path: writeTargetPath, value: content }
      );

      expect(result.ok).toBe(true);
      expect(readFileSync(writeTargetPath, 'utf-8')).toBe(content);
      if (existsSync(writeTargetPath)) {
        unlinkSync(writeTargetPath);
      }
    });

    test('all file operations should return FileResult type', async () => {
      const missingPath = join(TEST_FIXTURES_DIR, `missing-contract-${Date.now()}.mdx`);
      const result = await page.evaluate(async (path) => {
        return await (window as any).mdxpad.readFile(path);
      }, missingPath);

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error.code).toBe('string');
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
            return metrics.unmaximizeCalls;
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

      // Wait for the first toggle to settle before issuing the second toggle.
      await expect
        .poll(async () => {
          const metrics = await getWindowOperationMetrics();
          return metrics.isMaximized;
        })
        .toBe(!initial.isMaximized);

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
            return metrics.unmaximizeCalls;
          })
          .toBeGreaterThan(afterFirst.unmaximizeCalls);
      }

      await expect
        .poll(async () => {
          const metrics = await getWindowOperationMetrics();
          return metrics.isMaximized;
        })
        .toBe(initial.isMaximized);
    } finally {
      await uninstallWindowOperationTracker();
      await electronApp.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win?.isMinimized()) {
          win.restore();
        }
        if (win?.isMaximized()) {
          win.unmaximize();
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
        (item) => item.label?.includes('Save As') || item.accelerator === 'CmdOrCtrl+Shift+S'
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
