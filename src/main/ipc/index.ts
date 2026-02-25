/**
 * IPC handler registration.
 * All IPC handlers are registered here.
 *
 * @security All handlers use zod validation via createValidatedHandler
 * @see Constitution §3.3 - invoke/handle pattern
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/lib/ipc';
import { AutosaveChannels } from '@shared/contracts/autosave-ipc';
import { getInvokeChannels } from '@shared/ai/ipc-channels';
import { registerFileHandlers } from './file-handlers';
import { registerWindowHandlers } from './window-handlers';
import { registerAutosaveHandlers } from './autosave-handlers';
import { registerAIHandlers } from './ai-handlers';
import { registerTemplateHandlers } from '@main/services/template-service';
import { AutosaveSettingsService } from '@main/services/autosave-settings';
import { AutosaveService } from '@main/services/autosave-service';
import { RecoveryService } from '@main/services/recovery-service';
import { createAIServices } from '@main/services/ai';
import { assertAuthorizedIpcSender } from './ipc-sender-authorization';

/** Singleton autosave service instances */
const settingsService = new AutosaveSettingsService();
const autosaveService = new AutosaveService(settingsService);
const recoveryService = new RecoveryService(settingsService, autosaveService);
const aiServices = createAIServices();

const RECREATION_SENSITIVE_CHANNELS = [
  IPC_CHANNELS.app.getSecurityInfo,
  IPC_CHANNELS.file.open,
  IPC_CHANNELS.file.save,
  IPC_CHANNELS.file.saveAs,
  IPC_CHANNELS.file.read,
  IPC_CHANNELS.file.write,
  IPC_CHANNELS.app.getVersion,
  IPC_CHANNELS.app.ready,
  IPC_CHANNELS.window.close,
  IPC_CHANNELS.window.minimize,
  IPC_CHANNELS.window.maximize,
  ...Object.values(AutosaveChannels),
  ...Object.values(IPC_CHANNELS.template),
  ...getInvokeChannels(),
] as const;

function removeLifecycleBoundHandlers(): void {
  for (const channel of RECREATION_SENSITIVE_CHANNELS) {
    ipcMain.removeHandler(channel);
  }
}

/**
 * Register all IPC handlers.
 * Handlers are rebound for each newly created window so sender authorization
 * and BrowserWindow-bound lifecycles remain correct after macOS recreation.
 *
 * @param window - The main BrowserWindow instance (required for file/window handlers)
 */
export function registerIpcHandlers(window: BrowserWindow): void {
  removeLifecycleBoundHandlers();

  // App security info handler
  ipcMain.handle(IPC_CHANNELS.app.getSecurityInfo, (event) => {
    assertAuthorizedIpcSender(event, window, IPC_CHANNELS.app.getSecurityInfo);
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
  registerAutosaveHandlers(
    ipcMain,
    {
      settingsService,
      autosaveService,
      recoveryService,
    },
    window
  );

  // Register AI provider handlers (Spec 028)
  registerAIHandlers(aiServices, window);

  // Register template operation handlers (list, get, save, delete, import, export, validate, createFromTemplate)
  registerTemplateHandlers(ipcMain, window);
}
