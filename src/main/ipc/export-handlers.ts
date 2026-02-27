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

import { assertAuthorizedIpcSender } from './ipc-sender-authorization';

export interface ExportCliService {
  invokeExportCli: typeof invokeExportCli;
  generateLlmsFile: typeof generateLlmsFile;
}

interface ExportHandlerDependencies {
  orchestratorService?: ExportOrchestratorService;
  cliService?: ExportCliService;
}

function registerAuthorizedHandler(
  ipcMain: IpcMain,
  window: BrowserWindow,
  channel: string,
  handler: (request: unknown) => unknown
): void {
  ipcMain.handle(channel, (event, request) => {
    assertAuthorizedIpcSender(event, window, channel);
    return handler(request);
  });
}

export function registerExportHandlers(
  ipcMain: IpcMain,
  window: BrowserWindow,
  dependencies: ExportHandlerDependencies = {}
): void {
  const orchestratorService = dependencies.orchestratorService ?? new ExportOrchestratorService();
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

  registerAuthorizedHandler(ipcMain, window, EXPORT_IPC_CHANNELS.jobLifecycle, handleJobLifecycle);
  registerAuthorizedHandler(ipcMain, window, EXPORT_IPC_CHANNELS.presetCrud, handlePresetCrud);
  registerAuthorizedHandler(ipcMain, window, EXPORT_IPC_CHANNELS.cliInvoke, handleCliInvoke);
  registerAuthorizedHandler(ipcMain, window, EXPORT_IPC_CHANNELS.llmsGenerate, handleLlmsGenerate);
}
