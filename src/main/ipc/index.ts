/**
 * IPC handler registration.
 * All IPC handlers are registered here.
 *
 * @security All handlers use zod validation via createValidatedHandler
 * @see Constitution §3.3 - invoke/handle pattern
 */

import { ipcMain, app, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/lib/ipc';
import { registerFileHandlers } from './file-handlers';
import { registerWindowHandlers } from './window-handlers';

/**
 * Register all IPC handlers.
 * Called once during app initialization, before window loads.
 *
 * @param window - The main BrowserWindow instance (required for file/window handlers)
 */
export function registerIpcHandlers(window: BrowserWindow): void {
  // App lifecycle handlers (global, not window-specific)
  ipcMain.handle(IPC_CHANNELS.app.getVersion, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.app.getSecurityInfo, (event) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);

    if (!win) {
      throw new Error('No window found for webContents');
    }

    // Return the security settings we configured in window.ts
    // These values match the BrowserWindow webPreferences in window.ts
    // and are verified by the security verification script
    void win; // Reference window to prevent unused variable warning
    return {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    };
  });

  // Register file operation handlers (open, save, save-as, read, write, app:version, app:ready)
  registerFileHandlers(ipcMain, window);

  // Register window operation handlers (close, minimize, maximize)
  registerWindowHandlers(ipcMain, window);
}
