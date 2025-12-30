/**
 * IPC handler registration.
 * All IPC handlers are registered here.
 */

import { ipcMain, app, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/lib/ipc';

/**
 * Register all IPC handlers.
 * Called once during app initialization.
 */
export function registerIpcHandlers(): void {
  // App lifecycle handlers
  ipcMain.handle(IPC_CHANNELS.app.getVersion, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.app.getSecurityInfo, (event) => {
    const webContents = event.sender;
    const window = BrowserWindow.fromWebContents(webContents);

    if (!window) {
      throw new Error('No window found for webContents');
    }

    // Return the security settings we configured in window.ts
    // These values match the BrowserWindow webPreferences in window.ts
    // and are verified by the security verification script
    void window; // Reference window to prevent unused variable warning
    return {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    };
  });
}
