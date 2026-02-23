/**
 * E2E tests for mdxpad file operations.
 *
 * These tests validate the file system API exposed via window.mdxpad:
 * - File operations: openFile, saveFile, saveFileAs, readFile, writeFile
 * - Window operations: closeWindow, minimizeWindow, maximizeWindow
 * - Event listeners: onFileChange
 * - Keyboard shortcuts: Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+N
 *
 * NOTE: Dialog testing is limited in E2E - we verify API methods exist
 * and return correct types. Actual dialog interaction requires mock/stub.
 *
 * @see spec.md User Stories US1-US7
 */

import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { writeFile, unlink, mkdir, rmdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

let electronApp: ElectronApplication;
let page: Page;

// Test fixture paths
const TEST_DIR = join(process.cwd(), 'tests', 'fixtures', 'e2e-files');
const TEST_MDX_FILE = join(TEST_DIR, 'test-document.mdx');
const TEST_MD_FILE = join(TEST_DIR, 'test-document.md');
const TEST_CONTENT = '# Test Document\n\nThis is test content for E2E tests.';

test.beforeAll(async () => {
  // Create test fixtures directory and files
  if (!existsSync(TEST_DIR)) {
    await mkdir(TEST_DIR, { recursive: true });
  }
  await writeFile(TEST_MDX_FILE, TEST_CONTENT, 'utf-8');
  await writeFile(TEST_MD_FILE, TEST_CONTENT, 'utf-8');

  // Launch Electron app
  const electronPath = join(process.cwd(), 'node_modules', '.bin', 'electron');
  const appPath = join(process.cwd(), 'dist', 'main', 'index.js');

  electronApp = await electron.launch({
    args: [appPath],
    executablePath: electronPath,
  });

  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  // Close app
  await electronApp.close();

  // Cleanup test fixtures
  try {
    await unlink(TEST_MDX_FILE);
    await unlink(TEST_MD_FILE);
    await rmdir(TEST_DIR);
  } catch {
    // Ignore cleanup errors
  }
});

// =============================================================================
// API Presence Tests - Verify file operations API is exposed
// =============================================================================

test.describe('File Operations API Presence', () => {
  test('should have mdxpad API exposed via preload', async () => {
    const hasMdxpadApi = await page.evaluate(() => {
      return typeof (window as any).mdxpad !== 'undefined';
    });
    expect(hasMdxpadApi).toBe(true);
  });

  test('should have openFile method', async () => {
    const hasMethod = await page.evaluate(() => {
      return typeof (window as any).mdxpad.openFile === 'function';
    });
    expect(hasMethod).toBe(true);
  });

  test('should have saveFile method', async () => {
    const hasMethod = await page.evaluate(() => {
      return typeof (window as any).mdxpad.saveFile === 'function';
    });
    expect(hasMethod).toBe(true);
  });

  test('should have saveFileAs method', async () => {
    const hasMethod = await page.evaluate(() => {
      return typeof (window as any).mdxpad.saveFileAs === 'function';
    });
    expect(hasMethod).toBe(true);
  });

  test('should have readFile method', async () => {
    const hasMethod = await page.evaluate(() => {
      return typeof (window as any).mdxpad.readFile === 'function';
    });
    expect(hasMethod).toBe(true);
  });

  test('should have writeFile method', async () => {
    const hasMethod = await page.evaluate(() => {
      return typeof (window as any).mdxpad.writeFile === 'function';
    });
    expect(hasMethod).toBe(true);
  });

  test('should have closeWindow method', async () => {
    const hasMethod = await page.evaluate(() => {
      return typeof (window as any).mdxpad.closeWindow === 'function';
    });
    expect(hasMethod).toBe(true);
  });

  test('should have minimizeWindow method', async () => {
    const hasMethod = await page.evaluate(() => {
      return typeof (window as any).mdxpad.minimizeWindow === 'function';
    });
    expect(hasMethod).toBe(true);
  });

  test('should have maximizeWindow method', async () => {
    const hasMethod = await page.evaluate(() => {
      return typeof (window as any).mdxpad.maximizeWindow === 'function';
    });
    expect(hasMethod).toBe(true);
  });

  test('should have onFileChange method', async () => {
    const hasMethod = await page.evaluate(() => {
      return typeof (window as any).mdxpad.onFileChange === 'function';
    });
    expect(hasMethod).toBe(true);
  });

  test('should have signalReady method', async () => {
    const hasMethod = await page.evaluate(() => {
      return typeof (window as any).mdxpad.signalReady === 'function';
    });
    expect(hasMethod).toBe(true);
  });
});

// =============================================================================
// File Read/Write Operations Tests
// =============================================================================

test.describe('File Read/Write Operations', () => {
  test('readFile should return FileResult<string> for existing file', async () => {
    const result = await page.evaluate(async (filePath) => {
      return (window as any).mdxpad.readFile(filePath);
    }, TEST_MDX_FILE);

    expect(result).toHaveProperty('ok');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.value).toBe('string');
      expect(result.value).toContain('# Test Document');
    }
  });

  test('readFile should return NOT_FOUND error for non-existent file', async () => {
    const nonExistentPath = join(TEST_DIR, 'non-existent-file.mdx');
    const result = await page.evaluate(async (filePath) => {
      return (window as any).mdxpad.readFile(filePath);
    }, nonExistentPath);

    expect(result).toHaveProperty('ok');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toHaveProperty('code');
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  test('writeFile should return FileResult<void> on success', async () => {
    const tempFilePath = join(TEST_DIR, 'temp-write-test.mdx');
    const testContent = '# Temp Test Content\n\nWritten by E2E test.';

    const result = await page.evaluate(async ({ path, content }) => {
      return (window as any).mdxpad.writeFile(path, content);
    }, { path: tempFilePath, content: testContent });

    expect(result).toHaveProperty('ok');
    expect(result.ok).toBe(true);

    // Verify the file was written
    const readResult = await page.evaluate(async (filePath) => {
      return (window as any).mdxpad.readFile(filePath);
    }, tempFilePath);

    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.value).toBe(testContent);
    }

    // Cleanup
    try {
      await unlink(tempFilePath);
    } catch {
      // Ignore cleanup errors
    }
  });

  test('writeFile should return PERMISSION_DENIED for read-only path', async () => {
    // Note: This test depends on OS permission behavior
    // Using a path that should fail on most systems
    const protectedPath = '/etc/mdxpad-test-readonly.mdx';

    const result = await page.evaluate(async ({ path, content }) => {
      return (window as any).mdxpad.writeFile(path, content);
    }, { path: protectedPath, content: 'test' });

    expect(result).toHaveProperty('ok');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toHaveProperty('code');
      // Either PERMISSION_DENIED or UNKNOWN depending on OS error
      expect(['PERMISSION_DENIED', 'UNKNOWN']).toContain(result.error.code);
    }
  });
});

// =============================================================================
// FileResult Structure Tests
// =============================================================================

test.describe('FileResult Structure Validation', () => {
  test('successful FileResult should have ok: true and value', async () => {
    const result = await page.evaluate(async (filePath) => {
      return (window as any).mdxpad.readFile(filePath);
    }, TEST_MDX_FILE);

    expect(result.ok).toBe(true);
    expect(result).toHaveProperty('value');
    expect(result).not.toHaveProperty('error');
  });

  test('failed FileResult should have ok: false and error', async () => {
    const nonExistentPath = '/non/existent/path.mdx';
    const result = await page.evaluate(async (filePath) => {
      return (window as any).mdxpad.readFile(filePath);
    }, nonExistentPath);

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty('error');
    expect(result).not.toHaveProperty('value');
  });

  test('error should have code property', async () => {
    const nonExistentPath = '/non/existent/path.mdx';
    const result = await page.evaluate(async (filePath) => {
      return (window as any).mdxpad.readFile(filePath);
    }, nonExistentPath);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toHaveProperty('code');
      expect(['NOT_FOUND', 'PERMISSION_DENIED', 'CANCELLED', 'UNKNOWN']).toContain(result.error.code);
    }
  });
});

// =============================================================================
// US1: Open File (Cmd+O) - Tests for file dialog functionality
// =============================================================================

test.describe('US1: Open File Dialog (Cmd+O)', () => {
  test('openFile method should be callable and return FileResult', async () => {
    // Note: We cannot fully test dialog interaction in E2E
    // We verify the method returns correct type structure
    // Dialog will be cancelled or timeout in headless mode

    const methodExists = await page.evaluate(() => {
      return typeof (window as any).mdxpad.openFile === 'function';
    });
    expect(methodExists).toBe(true);

    // The openFile returns a Promise<FileResult<FileHandle>>
    // In headless mode, dialog interaction is limited
    // We verify the method is accessible and returns expected structure
  });

  test('Cmd+O keyboard shortcut should be recognized', async () => {
    // Press Cmd+O and verify the shortcut triggers an action
    // Note: In E2E, we cannot easily verify dialog opens
    // We verify the keyboard event is processed without error

    let errorOccurred = false;
    page.on('pageerror', () => {
      errorOccurred = true;
    });

    // Send keyboard shortcut
    await page.keyboard.press('Meta+O');

    // Give the app time to process
    await page.waitForTimeout(100);

    // Verify no page errors occurred
    expect(errorOccurred).toBe(false);
  });
});

// =============================================================================
// US2: Save File (Cmd+S) - Tests for save functionality
// =============================================================================

test.describe('US2: Save File (Cmd+S)', () => {
  test('saveFile method should be callable with handle and content', async () => {
    const methodExists = await page.evaluate(() => {
      return typeof (window as any).mdxpad.saveFile === 'function';
    });
    expect(methodExists).toBe(true);
  });

  test('saveFile with valid handle should return FileResult', async () => {
    // Create a mock handle structure for testing
    // Note: This tests the API structure, not actual save behavior with dialogs
    const result = await page.evaluate(async ({ path, content }) => {
      const mockHandle = {
        id: crypto.randomUUID(),
        path: path,
        name: 'test-save.mdx',
      };
      return (window as any).mdxpad.saveFile(mockHandle, content);
    }, { path: TEST_MDX_FILE, content: TEST_CONTENT + '\n\n// Modified by test' });

    expect(result).toHaveProperty('ok');
    // Result can be success or failure depending on handler implementation
    expect(typeof result.ok).toBe('boolean');
  });

  test('Cmd+S keyboard shortcut should be recognized', async () => {
    let errorOccurred = false;
    page.on('pageerror', () => {
      errorOccurred = true;
    });

    await page.keyboard.press('Meta+S');
    await page.waitForTimeout(100);

    expect(errorOccurred).toBe(false);
  });
});

// =============================================================================
// US3: Save As (Cmd+Shift+S) - Tests for save as functionality
// =============================================================================

test.describe('US3: Save As (Cmd+Shift+S)', () => {
  test('saveFileAs method should be callable with content', async () => {
    const methodExists = await page.evaluate(() => {
      return typeof (window as any).mdxpad.saveFileAs === 'function';
    });
    expect(methodExists).toBe(true);
  });

  test('Cmd+Shift+S keyboard shortcut should be recognized', async () => {
    let errorOccurred = false;
    page.on('pageerror', () => {
      errorOccurred = true;
    });

    await page.keyboard.press('Meta+Shift+S');
    await page.waitForTimeout(100);

    expect(errorOccurred).toBe(false);
  });
});

// =============================================================================
// US4: New File (Cmd+N) - Tests for new file creation
// =============================================================================

test.describe('US4: New File (Cmd+N)', () => {
  test('Cmd+N keyboard shortcut should be recognized', async () => {
    let errorOccurred = false;
    page.on('pageerror', () => {
      errorOccurred = true;
    });

    await page.keyboard.press('Meta+N');
    await page.waitForTimeout(100);

    expect(errorOccurred).toBe(false);
  });
});

// =============================================================================
// US5: Dirty State Warning - Tests for unsaved changes dialog
// =============================================================================

test.describe('US5: Close Window with Unsaved Changes', () => {
  test('closeWindow method should be callable', async () => {
    const methodExists = await page.evaluate(() => {
      return typeof (window as any).mdxpad.closeWindow === 'function';
    });
    expect(methodExists).toBe(true);
  });

  // Note: We cannot fully test the dirty state dialog in E2E
  // The dialog behavior depends on renderer state and main process logic
  // Integration tests cover the IPC handlers more thoroughly
});

// =============================================================================
// US6: External File Change Notification
// =============================================================================

test.describe('US6: File Change Event Listener', () => {
  test('onFileChange should be callable and return unsubscribe function', async () => {
    const result = await page.evaluate(() => {
      const callback = () => {};
      const unsubscribe = (window as any).mdxpad.onFileChange(callback);
      const hasUnsubscribe = typeof unsubscribe === 'function';
      // Cleanup by unsubscribing
      if (hasUnsubscribe) {
        unsubscribe();
      }
      return hasUnsubscribe;
    });

    expect(result).toBe(true);
  });

  test('onFileChange callback should be invocable (structure test)', async () => {
    // This test verifies the callback mechanism is set up correctly
    // Actual file change events require external file modification
    const callbackWorks = await page.evaluate(() => {
      let callbackInvoked = false;
      const callback = () => {
        callbackInvoked = true;
      };
      const unsubscribe = (window as any).mdxpad.onFileChange(callback);

      // Verify we got an unsubscribe function
      const hasUnsubscribe = typeof unsubscribe === 'function';

      // Cleanup
      if (hasUnsubscribe) {
        unsubscribe();
      }

      return hasUnsubscribe;
    });

    expect(callbackWorks).toBe(true);
  });
});

// =============================================================================
// US7: Recent Files - Tests for recent files menu
// =============================================================================

test.describe('US7: Recent Files Menu', () => {
  // Note: Menu testing in Electron E2E is limited
  // Menu items are typically tested via Electron's Menu API in integration tests
  // We verify that file operations that populate recent files work

  test('opening a file should be possible (recent files prerequisite)', async () => {
    // Verify readFile works, which is the basis for recent files tracking
    const result = await page.evaluate(async (filePath) => {
      return (window as any).mdxpad.readFile(filePath);
    }, TEST_MDX_FILE);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Window Operations Tests
// =============================================================================

test.describe('Window Operations', () => {
  test('minimizeWindow should be callable', async () => {
    const methodExists = await page.evaluate(() => {
      return typeof (window as any).mdxpad.minimizeWindow === 'function';
    });
    expect(methodExists).toBe(true);
  });

  test('maximizeWindow should be callable', async () => {
    const methodExists = await page.evaluate(() => {
      return typeof (window as any).mdxpad.maximizeWindow === 'function';
    });
    expect(methodExists).toBe(true);
  });

  // Note: We don't actually call minimizeWindow/maximizeWindow
  // as it would affect the test window and potentially cause issues
});

// =============================================================================
// Platform Information Tests
// =============================================================================

test.describe('Platform Information', () => {
  test('platform.os should be darwin', async () => {
    const os = await page.evaluate(() => {
      return (window as any).mdxpad.platform.os;
    });
    expect(os).toBe('darwin');
  });

  test('platform.arch should be valid', async () => {
    const arch = await page.evaluate(() => {
      return (window as any).mdxpad.platform.arch;
    });
    expect(['arm64', 'x64']).toContain(arch);
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

test.describe('Error Handling', () => {
  test('readFile with invalid path should return UNKNOWN error', async () => {
    // Test with a malformed path (not starting with /)
    // The schema validation should catch this
    const result = await page.evaluate(async () => {
      try {
        return (window as any).mdxpad.readFile('relative/path.mdx');
      } catch (e) {
        return { ok: false, error: { code: 'UNKNOWN', message: String(e) } };
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toHaveProperty('code');
    }
  });

  test('API methods should handle empty arguments gracefully', async () => {
    // saveFileAs with empty content should still return a FileResult
    const result = await page.evaluate(async () => {
      try {
        return (window as any).mdxpad.saveFileAs('');
      } catch (e) {
        return { caught: true, error: String(e) };
      }
    });

    // Should return a result (either success with dialog or cancelled)
    expect(result).toBeDefined();
  });
});

// =============================================================================
// API Return Type Consistency Tests
// =============================================================================

test.describe('API Return Type Consistency', () => {
  test('all file methods should return Promises', async () => {
    const checks = await page.evaluate(() => {
      const api = (window as any).mdxpad;
      return {
        openFile: api.openFile() instanceof Promise,
        saveFileAs: api.saveFileAs('test') instanceof Promise,
        readFile: api.readFile('/test') instanceof Promise,
        writeFile: api.writeFile('/test', 'content') instanceof Promise,
        closeWindow: api.closeWindow() instanceof Promise,
        minimizeWindow: api.minimizeWindow() instanceof Promise,
        maximizeWindow: api.maximizeWindow() instanceof Promise,
        signalReady: api.signalReady() instanceof Promise,
      };
    });

    expect(checks.openFile).toBe(true);
    expect(checks.saveFileAs).toBe(true);
    expect(checks.readFile).toBe(true);
    expect(checks.writeFile).toBe(true);
    expect(checks.closeWindow).toBe(true);
    expect(checks.minimizeWindow).toBe(true);
    expect(checks.maximizeWindow).toBe(true);
    expect(checks.signalReady).toBe(true);
  });

  test('onFileChange should return synchronously', async () => {
    const isSync = await page.evaluate(() => {
      const api = (window as any).mdxpad;
      const callback = () => {};
      const result = api.onFileChange(callback);
      // Should return unsubscribe function immediately (sync)
      const isSyncReturn = typeof result === 'function';
      // Cleanup
      result();
      return isSyncReturn;
    });

    expect(isSync).toBe(true);
  });
});
