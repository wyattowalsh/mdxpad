/**
 * Window IPC handlers.
 * Handles window control operations: close, minimize, maximize.
 *
 * @module window-handlers
 */

import { type IpcMain, type BrowserWindow, dialog } from 'electron';
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
  // mdxpad:window:close - Close window (with dirty check in Phase 3)
  ipcMain.handle(
    IPC_CHANNELS.window.close,
    createValidatedHandler(WindowCloseRequestSchema, (): Promise<void> => {
      // TODO: Phase 3 - Check dirty state via IPC before closing
      // For now, just close the window
      // Future implementation:
      // 1. Query renderer for dirty state
      // 2. If dirty, show confirmation dialog:
      //    const { response } = await dialog.showMessageBox(window, {
      //      type: 'question',
      //      buttons: ['Save', 'Discard', 'Cancel'],
      //      defaultId: 0,
      //      cancelId: 2,
      //      title: 'Unsaved Changes',
      //      message: 'Do you want to save your changes?',
      //    });
      //    // response: 0=Save, 1=Discard, 2=Cancel
      // 3. Handle response accordingly

      // Suppress unused import warning - dialog will be used in Phase 3
      void dialog;

      window.close();
      return Promise.resolve();
    })
  );

  // mdxpad:window:minimize - Minimize window
  ipcMain.handle(
    IPC_CHANNELS.window.minimize,
    createValidatedHandler(WindowMinimizeRequestSchema, (): Promise<void> => {
      window.minimize();
      return Promise.resolve();
    })
  );

  // mdxpad:window:maximize - Toggle maximize/restore
  ipcMain.handle(
    IPC_CHANNELS.window.maximize,
    createValidatedHandler(WindowMaximizeRequestSchema, (): Promise<void> => {
      if (window.isMaximized()) {
        window.restore();
      } else {
        window.maximize();
      }
      return Promise.resolve();
    })
  );
}
