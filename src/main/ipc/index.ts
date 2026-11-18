/**
 * IPC handler registration.
 * All IPC handlers are registered here.
 *
 * @security All handlers use zod validation via createValidatedHandler
 * @see Constitution §3.3 - invoke/handle pattern
 */

import path from 'node:path';
import { app, ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/lib/ipc';
import { AutosaveChannels } from '@shared/contracts/autosave-ipc';
import { getInvokeChannels } from '@shared/ai/ipc-channels';
import { registerFileHandlers } from './file-handlers';
import { registerWindowHandlers } from './window-handlers';
import { registerAutosaveHandlers } from './autosave-handlers';
import { registerAIHandlers } from './ai-handlers';
import { AISessionChannels } from './ai-session-handlers';
import { registerTemplateHandlers } from '@main/services/template-service';
import { registerPlatformHandlers } from './platform-handlers';
import { registerLinkHandlers } from './link-handlers';
import { registerWorkspaceHandlers } from './workspace-handlers';
import { EXPORT_IPC_CHANNELS, registerExportHandlers } from './export-handlers';
import { registerGitHandlers } from '@main/services/git/git-handlers';
import { registerSearchHandlers } from '@main/services/search/search-handlers';
import { registerImportHandlers } from '@main/services/import/import-handlers';
import { registerCitationHandlers } from '@main/services/citation/citation-handlers';
import { registerPluginHandlers, PLUGIN_CHANNELS } from '@main/services/plugin/plugin-handlers';
import { registerShareHandlers } from './share-handlers';
import { registerHistoryHandlers } from './history-handlers';
import { registerNotificationHandlers } from './notification-handlers';
import { ShareChannels } from '@shared/contracts/share-schemas';
import { HistoryChannels } from '@shared/contracts/history-schemas';
import { NotificationChannels } from '@shared/contracts/notification-schemas';
import { ShareLinkService } from '@main/services/share-link-service';
import { VersionHistoryService } from '@main/services/version-history-service';
import { NotificationService } from '@main/services/notification-service';
import { hasWriteCapability } from './document-capability';
import { PluginLoader } from '@main/services/plugin/plugin-loader';
import { GitChannels } from '@shared/contracts/git-schemas';
import { SearchChannels } from '@shared/contracts/search-schemas';
import { ImportChannels } from '@shared/contracts/import-schemas';
import { CitationChannels } from '@shared/contracts/citation-schemas';
import { SemanticSearchChannels } from '@shared/contracts/semantic-search-schemas';
import { AutosaveSettingsService } from '@main/services/autosave-settings';
import { AutosaveService } from '@main/services/autosave-service';
import { RecoveryService } from '@main/services/recovery-service';
import { createAIServices } from '@main/services/ai';
import { WorkspaceService } from '@main/services/workspace-service';
import { registerAuthorizedIpcHandler } from './ipc-sender-authorization';
import { MARKETPLACE_LIST_CHANNEL } from '@shared/contracts/marketplace-schemas';
import { registerMarketplaceHandlers } from '@main/services/template-marketplace-service';

/** Singleton autosave service instances */
const settingsService = new AutosaveSettingsService();
const autosaveService = new AutosaveService(settingsService);
const recoveryService = new RecoveryService(settingsService, autosaveService);
const aiServices = createAIServices();
const workspaceService = new WorkspaceService();
const pluginLoader = new PluginLoader();
const shareLinkService = new ShareLinkService({
  storagePath: path.join(app.getPath('userData'), 'share-links.json'),
});
const versionHistoryService = new VersionHistoryService(hasWriteCapability);
const notificationService = new NotificationService();

const RECREATION_SENSITIVE_CHANNELS = [
  IPC_CHANNELS.app.getSecurityInfo,
  IPC_CHANNELS.file.open,
  IPC_CHANNELS.file.save,
  IPC_CHANNELS.file.saveAs,
  IPC_CHANNELS.file.export,
  IPC_CHANNELS.file.read,
  IPC_CHANNELS.file.write,
  IPC_CHANNELS.app.getVersion,
  IPC_CHANNELS.app.ready,
  IPC_CHANNELS.window.close,
  IPC_CHANNELS.window.minimize,
  IPC_CHANNELS.window.maximize,
  ...Object.values(AutosaveChannels),
  ...Object.values(IPC_CHANNELS.template),
  ...Object.values(IPC_CHANNELS.sync),
  ...Object.values(IPC_CHANNELS.extension),
  ...Object.values(IPC_CHANNELS.workspace),
  ...Object.values(IPC_CHANNELS.publish),
  ...Object.values(EXPORT_IPC_CHANNELS),
  ...getInvokeChannels(),
  ...Object.values(AISessionChannels),
  ...Object.values(GitChannels),
  ...Object.values(SearchChannels),
  ...Object.values(ImportChannels),
  ...Object.values(CitationChannels),
  ...Object.values(PLUGIN_CHANNELS),
  ...Object.values(ShareChannels).filter((channel) => channel !== ShareChannels.PUBLISH_PROGRESS),
  ...Object.values(HistoryChannels),
  ...Object.values(NotificationChannels),
  ...Object.values(SemanticSearchChannels),
  MARKETPLACE_LIST_CHANNEL,
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
  registerAuthorizedIpcHandler(ipcMain, window, IPC_CHANNELS.app.getSecurityInfo, () => {
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

  // Register cloud sync, collaboration, extension, and publish/provenance handlers
  registerPlatformHandlers(ipcMain, window);

  // Register export job, preset, and CLI orchestration handlers
  registerExportHandlers(ipcMain, window);

  // Register workspace model, link graph, and metadata collection handlers
  registerWorkspaceHandlers(ipcMain, window, workspaceService);
  registerLinkHandlers(ipcMain, window, workspaceService);

  // Register git, search, import, and citation handlers (Wave 2)
  registerGitHandlers(ipcMain, window);
  registerSearchHandlers(ipcMain, window);
  registerImportHandlers(ipcMain, window);
  registerCitationHandlers(ipcMain, window);
  registerPluginHandlers(ipcMain, window, pluginLoader);
  registerShareHandlers(ipcMain, shareLinkService, window);
  registerHistoryHandlers(ipcMain, versionHistoryService, window);
  registerNotificationHandlers(ipcMain, notificationService, window);
  registerMarketplaceHandlers(window, process.resourcesPath);
}
