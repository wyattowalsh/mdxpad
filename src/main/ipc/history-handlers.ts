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
export function registerHistoryHandlers(
  ipcMainInstance: IpcMain,
  service: VersionHistoryService,
  window: BrowserWindow
): void {
  // Get history handler
  const handleGetHistory = createValidatedHandler(
    VersionHistoryRequestSchema,
    async (args): Promise<VersionHistoryResponse> => {
      return service.getHistory(args.filePath);
    }
  );

  // Get version handler
  const handleGetVersion = createValidatedHandler(
    GetVersionRequestSchema,
    async (args): Promise<GetVersionResponse> => {
      return service.getVersion(args.id, args.filePath);
    }
  );

  // Restore version handler
  const handleRestoreVersion = createValidatedHandler(
    RestoreVersionRequestSchema,
    async (args): Promise<RestoreVersionResponse> => {
      return service.restoreVersion(args.id, args.filePath, args.createBackup);
    }
  );

  // Create snapshot handler
  const handleCreateSnapshot = createValidatedHandler(
    CreateSnapshotRequestSchema,
    async (args): Promise<CreateSnapshotResponse> => {
      return service.createSnapshot(args.filePath, args.label);
    }
  );

  registerAuthorizedIpcHandler(
    ipcMainInstance,
    window,
    HistoryChannels.GET_HISTORY,
    (_event, args) => handleGetHistory(args)
  );
  registerAuthorizedIpcHandler(
    ipcMainInstance,
    window,
    HistoryChannels.GET_VERSION,
    (_event, args) => handleGetVersion(args)
  );
  registerAuthorizedIpcHandler(
    ipcMainInstance,
    window,
    HistoryChannels.RESTORE_VERSION,
    (_event, args) => handleRestoreVersion(args)
  );
  registerAuthorizedIpcHandler(
    ipcMainInstance,
    window,
    HistoryChannels.CREATE_SNAPSHOT,
    (_event, args) => handleCreateSnapshot(args)
  );

  console.log('[HistoryHandlers] All history handlers registered');
}
