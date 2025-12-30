/**
 * Electron main process entry point.
 * Handles app lifecycle, window creation, and IPC registration.
 */

import { app, BrowserWindow } from 'electron';
import { createWindow, loadContent } from './window';
import { registerIpcHandlers } from './ipc';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

/**
 * Create main window and load content.
 */
function createMainWindow(): void {
  mainWindow = createWindow();
  loadContent(mainWindow);
}

// App ready - create window
void app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

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

// Handle second instance attempt
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

console.log('mdxpad main process starting...');
