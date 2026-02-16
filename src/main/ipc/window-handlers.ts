/**
 * Window IPC handlers.
 * Handles window control operations: close, minimize, maximize.
 *
 * @module window-handlers
 */

import { type IpcMain, type BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/lib/ipc';
import {
  createValidatedHandler,
  WindowCloseRequestSchema,
  WindowMinimizeRequestSchema,
  WindowMaximizeRequestSchema,
} from '@shared/contracts/file-schemas';

/**
 * Register all window-related IPC handlers.
 * Must be called after window is created.
 *
 * @param ipcMain - Electron IpcMain instance
 * @param window - BrowserWindow instance to control
 */
export function registerWindowHandlers(
  ipcMain: IpcMain,
  window: BrowserWindow
): void {
  const handleWindowClose = createValidatedHandler(
    WindowCloseRequestSchema,
    (): Promise<void> => {
      window.close();
      return Promise.resolve();
    }
  );

  const handleWindowMinimize = createValidatedHandler(
    WindowMinimizeRequestSchema,
    (): Promise<void> => {
      window.minimize();
      return Promise.resolve();
    }
  );

  const handleWindowMaximize = createValidatedHandler(
    WindowMaximizeRequestSchema,
    (): Promise<void> => {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
      return Promise.resolve();
    }
  );

  // mdxpad:window:close - Close window (with dirty check in Phase 3)
  ipcMain.handle(IPC_CHANNELS.window.close, (_event, args) => handleWindowClose(args));

  // mdxpad:window:minimize - Minimize window
  ipcMain.handle(IPC_CHANNELS.window.minimize, (_event, args) => handleWindowMinimize(args));

  // mdxpad:window:maximize - Toggle maximize/restore
  ipcMain.handle(IPC_CHANNELS.window.maximize, (_event, args) => handleWindowMaximize(args));
}
