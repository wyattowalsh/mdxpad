/**
 * Version History IPC Handlers
 *
 * IPC handlers for version history operations.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module main/ipc/history-handlers
 */

import type { BrowserWindow, IpcMain } from 'electron';
import {
  HistoryChannels,
  VersionHistoryRequestSchema,
  GetVersionRequestSchema,
  RestoreVersionRequestSchema,
  CreateSnapshotRequestSchema,
  type VersionHistoryResponse,
  type GetVersionResponse,
  type RestoreVersionResponse,
  type CreateSnapshotResponse,
} from '@shared/contracts/history-schemas';
import { createValidatedHandler } from '@shared/contracts/file-schemas';
import type { VersionHistoryService } from '@main/services/version-history-service';
import { registerAuthorizedIpcHandler } from './ipc-sender-authorization';

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Registers all version history IPC handlers.
 *
 * @param ipcMainInstance - The Electron IpcMain instance
 * @param service - The VersionHistoryService instance
 */
function createHistoryHandlers(service: VersionHistoryService) {
  return {
    getHistory: createValidatedHandler(
      VersionHistoryRequestSchema,
      async (args): Promise<VersionHistoryResponse> => service.getHistory(args.filePath)
    ),
    getVersion: createValidatedHandler(
      GetVersionRequestSchema,
      async (args): Promise<GetVersionResponse> => service.getVersion(args.id, args.filePath)
    ),
    restoreVersion: createValidatedHandler(
      RestoreVersionRequestSchema,
      async (args): Promise<RestoreVersionResponse> =>
        service.restoreVersion(args.id, args.filePath, args.createBackup)
    ),
    createSnapshot: createValidatedHandler(
      CreateSnapshotRequestSchema,
      async (args): Promise<CreateSnapshotResponse> =>
        service.createSnapshot(args.filePath, args.label)
    ),
  };
}

export function registerHistoryHandlers(
  ipcMainInstance: IpcMain,
  service: VersionHistoryService,
  window: BrowserWindow
): void {
  const handlers = createHistoryHandlers(service);

  registerAuthorizedIpcHandler(
    ipcMainInstance,
    window,
    HistoryChannels.GET_HISTORY,
    (_event, args) => handlers.getHistory(args)
  );
  registerAuthorizedIpcHandler(
    ipcMainInstance,
    window,
    HistoryChannels.GET_VERSION,
    (_event, args) => handlers.getVersion(args)
  );
  registerAuthorizedIpcHandler(
    ipcMainInstance,
    window,
    HistoryChannels.RESTORE_VERSION,
    (_event, args) => handlers.restoreVersion(args)
  );
  registerAuthorizedIpcHandler(
    ipcMainInstance,
    window,
    HistoryChannels.CREATE_SNAPSHOT,
    (_event, args) => handlers.createSnapshot(args)
  );

  console.log('[HistoryHandlers] All history handlers registered');
}
