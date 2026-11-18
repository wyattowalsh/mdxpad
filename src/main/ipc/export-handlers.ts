import type { BrowserWindow, IpcMain } from 'electron';

// Re-export for backward compatibility with existing consumers
export { EXPORT_IPC_CHANNELS } from '@shared/contracts/export-schemas';

import {
  EXPORT_IPC_CHANNELS,
  ExportJobLifecycleRequestSchema,
  ExportJobLifecycleResponseSchema,
  ExportPresetCrudRequestSchema,
  ExportPresetCrudResponseSchema,
  ExportCliInvokeRequestSchema,
  ExportCliInvokeResponseSchema,
  LlmsGenerationRequestSchema,
  LlmsGenerationResponseSchema,
} from '@shared/contracts/export-schemas';
import { ExportOrchestratorService } from '@main/services/export-orchestrator';
import { generateLlmsFile, invokeExportCli } from '@main/services/cli-service';

import { registerAuthorizedIpcHandler } from './ipc-sender-authorization';

export interface ExportCliService {
  invokeExportCli: typeof invokeExportCli;
  generateLlmsFile: typeof generateLlmsFile;
}

interface ExportHandlerDependencies {
  orchestratorService?: ExportOrchestratorService;
  cliService?: ExportCliService;
  storagePath?: string;
}

export function registerExportHandlers(
  ipcMain: IpcMain,
  window: BrowserWindow,
  dependencies: ExportHandlerDependencies = {}
): void {
  const orchestratorService =
    dependencies.orchestratorService ??
    new ExportOrchestratorService(
      dependencies.storagePath === undefined ? {} : { storagePath: dependencies.storagePath }
    );
  const cliService = dependencies.cliService ?? { invokeExportCli, generateLlmsFile };

  const handleJobLifecycle = (rawRequest: unknown) => {
    const request = ExportJobLifecycleRequestSchema.parse(rawRequest);
    const response = orchestratorService.handleJobLifecycle(request);
    return ExportJobLifecycleResponseSchema.parse(response);
  };

  const handlePresetCrud = (rawRequest: unknown) => {
    const request = ExportPresetCrudRequestSchema.parse(rawRequest);
    const response = orchestratorService.handlePresetCrud(request);
    return ExportPresetCrudResponseSchema.parse(response);
  };

  const handleCliInvoke = async (rawRequest: unknown) => {
    const request = ExportCliInvokeRequestSchema.parse(rawRequest);
    const response = await cliService.invokeExportCli(request);
    return ExportCliInvokeResponseSchema.parse(response);
  };

  const handleLlmsGenerate = async (rawRequest: unknown) => {
    const request = LlmsGenerationRequestSchema.parse(rawRequest);
    const response = await cliService.generateLlmsFile(request);
    return LlmsGenerationResponseSchema.parse(response);
  };

  registerAuthorizedIpcHandler(ipcMain, window, EXPORT_IPC_CHANNELS.jobLifecycle, (_event, request) =>
    handleJobLifecycle(request)
  );
  registerAuthorizedIpcHandler(ipcMain, window, EXPORT_IPC_CHANNELS.presetCrud, (_event, request) =>
    handlePresetCrud(request)
  );
  registerAuthorizedIpcHandler(ipcMain, window, EXPORT_IPC_CHANNELS.cliInvoke, (_event, request) =>
    handleCliInvoke(request)
  );
  registerAuthorizedIpcHandler(ipcMain, window, EXPORT_IPC_CHANNELS.llmsGenerate, (_event, request) =>
    handleLlmsGenerate(request)
  );
}
