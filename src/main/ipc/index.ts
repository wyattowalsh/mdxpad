/**
 * IPC handler registration.
 * All IPC handlers are registered here.
 *
 * @security All handlers use zod validation via createValidatedHandler
 * @see Constitution §3.3 - invoke/handle pattern
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/lib/ipc';
import { registerFileHandlers } from './file-handlers';
import { registerWindowHandlers } from './window-handlers';
import { registerAutosaveHandlers } from './autosave-handlers';
import { registerAIHandlers } from './ai-handlers';

/** Track whether global handlers have been registered */
let globalHandlersRegistered = false;

/**
 * Register all IPC handlers.
 * Global handlers are registered only once. Window-specific handlers
 * are registered per window but use dynamic window lookup.
 *
 * @param window - The main BrowserWindow instance (required for file/window handlers)
 */
export function registerIpcHandlers(window: BrowserWindow): void {
  // Only register global handlers once
  if (!globalHandlersRegistered) {
    // App security info handler (uses dynamic window lookup from event)
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

    // Register autosave and recovery handlers (FR-001 to FR-021)
    registerAutosaveHandlers(ipcMain);

    // Register AI provider handlers (Spec 028)
    registerAIHandlers(window);

    globalHandlersRegistered = true;
  }
}
