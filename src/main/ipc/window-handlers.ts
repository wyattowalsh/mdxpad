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
import { assertAuthorizedIpcSender } from './ipc-sender-authorization';

function registerAuthorizedWindowHandler(
  ipcMain: IpcMain,
  window: BrowserWindow,
  channel: string,
  handler: (args: unknown) => Promise<void>
): void {
  ipcMain.handle(channel, (event, args) => {
    assertAuthorizedIpcSender(event, window, channel);
    return handler(args);
  });
}

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
  registerAuthorizedWindowHandler(
    ipcMain,
    window,
    IPC_CHANNELS.window.close,
    handleWindowClose
  );

  // mdxpad:window:minimize - Minimize window
  registerAuthorizedWindowHandler(
    ipcMain,
    window,
    IPC_CHANNELS.window.minimize,
    handleWindowMinimize
  );

  // mdxpad:window:maximize - Toggle maximize/restore
  registerAuthorizedWindowHandler(
    ipcMain,
    window,
    IPC_CHANNELS.window.maximize,
    handleWindowMaximize
  );
}
