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
import { registerTemplateHandlers } from '@main/services/template-service';
import { AutosaveSettingsService } from '@main/services/autosave-settings';
import { AutosaveService } from '@main/services/autosave-service';
import { RecoveryService } from '@main/services/recovery-service';
import { createAIServices } from '@main/services/ai';

/** Track whether global handlers have been registered */
let globalHandlersRegistered = false;

/** Singleton autosave service instances */
const settingsService = new AutosaveSettingsService();
const autosaveService = new AutosaveService(settingsService);
const recoveryService = new RecoveryService(settingsService, autosaveService);

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
    // App security info handler
    ipcMain.handle(IPC_CHANNELS.app.getSecurityInfo, () => {
      // Return security configuration matching window.ts BrowserWindow webPreferences
      // These values are verified by scripts/verify-security.ts
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
    registerAutosaveHandlers(ipcMain, {
      settingsService,
      autosaveService,
      recoveryService,
    });

    // Register AI provider handlers (Spec 028)
    registerAIHandlers(window, createAIServices());

    // Register template operation handlers (list, get, save, delete, import, export, validate, createFromTemplate)
    registerTemplateHandlers(ipcMain);

    globalHandlersRegistered = true;
  }
}
