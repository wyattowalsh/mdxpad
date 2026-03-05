/**
 * Electron main process entry point.
 * Handles app lifecycle, window creation, and IPC registration.
 */

import { app, BrowserWindow, dialog } from 'electron';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createWindow, loadContent } from './window';
import { registerIpcHandlers } from './ipc';
import { initializeApplicationMenu } from './menu';
import { registerPreviewFrameProtocol } from './preview-frame-protocol';
import { AutoSaveManager } from './services/auto-save';

/** Global AutoSaveManager instance for crash recovery and auto-saving */
const autoSaveManager = new AutoSaveManager();

/** Stores recovered file entries to be sent to renderer after window creation */
let pendingRecoveryEntries: { displayName: string; content: string; savedAt: number }[] = [];

/**
 * Formats a Unix timestamp to a human-readable time string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date/time string
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Checks for recoverable auto-saved files from a previous session.
 * If found, prompts the user to recover or discard them.
 *
 * Implements FR-015: On app launch detect recoverable auto-saved files.
 *
 * @returns Promise that resolves when recovery handling is complete
 */
async function checkCrashRecovery(): Promise<void> {
  const entries = await autoSaveManager.findRecoverable();

  if (entries.length === 0) {
    return;
  }

  console.log(`Found ${entries.length} recoverable auto-saved file(s):`);
  entries.forEach((e) => {
    console.log(`  - ${e.displayName} (${formatTime(e.savedAt)})`);
  });

  // Show recovery dialog to the user
  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Recover', 'Discard'],
    defaultId: 0,
    cancelId: 1,
    title: 'Recover Unsaved Work',
    message: 'Found unsaved work from a previous session:',
    detail: entries.map((e) => `\u2022 ${e.displayName} (${formatTime(e.savedAt)})`).join('\n'),
  });

  if (response === 0) {
    // User chose "Recover" - read temp files and store for window creation
    for (const entry of entries) {
      try {
        const content = await fs.readFile(entry.tempPath, 'utf-8');
        pendingRecoveryEntries.push({
          displayName: entry.displayName,
          content,
          savedAt: entry.savedAt,
        });
      } catch (err) {
        console.error(`Failed to read recovered file ${entry.tempPath}:`, err);
      }
    }
  } else {
    // User chose "Discard" - clean up all temp files
    for (const entry of entries) {
      await autoSaveManager.cleanupEntry(entry.fileId);
    }
  }
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let hasCreatedInitialWindow = false;

function getActiveMainWindow(): BrowserWindow | null {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  const fallbackWindow =
    BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()) ?? null;

  mainWindow = fallbackWindow;
  return fallbackWindow;
}

/**
 * Create main window, register IPC handlers, initialize menu, and load content.
 * IPC handlers must be registered BEFORE content loads.
 */
function createMainWindow(): void {
  mainWindow = createWindow();
  hasCreatedInitialWindow = true;
  registerIpcHandlers(mainWindow);
  initializeApplicationMenu(mainWindow);
  loadContent(mainWindow);

  // Send pending recovery entries to renderer after window is ready
  if (pendingRecoveryEntries.length > 0) {
    mainWindow.webContents.once('did-finish-load', () => {
      if (mainWindow) {
        mainWindow.webContents.send('mdxpad:recovery:restore', pendingRecoveryEntries);
        // Clear the pending entries after sending
        pendingRecoveryEntries = [];
      }
    });
  }
}

if (gotTheLock) {
  // App ready - check for crash recovery, then create window
  void app.whenReady().then(async () => {
    // Check for recoverable files BEFORE creating the main window
    try {
      await checkCrashRecovery();
    } catch (error) {
      console.error('Crash recovery check failed, continuing launch:', error);
    }

    registerPreviewFrameProtocol(fileURLToPath(new URL('../renderer', import.meta.url)));
    createMainWindow();

    // Start auto-save manager for this session
    autoSaveManager.start();

    // macOS: Re-create window when dock icon clicked and no windows open
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  // Quit when all windows are closed (except macOS)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Stop auto-save manager before quitting
  app.on('before-quit', () => {
    autoSaveManager.stop();
  });

  // Handle second instance attempt
  app.on('second-instance', () => {
    const targetWindow = getActiveMainWindow();

    if (!targetWindow) {
      if (!hasCreatedInitialWindow) {
        return;
      }
      createMainWindow();
      return;
    }

    if (targetWindow.isMinimized()) {
      targetWindow.restore();
    }

    targetWindow.focus();
  });
}

console.log('mdxpad main process starting...');
