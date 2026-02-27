/**
 * Version History IPC Handlers
 *
 * IPC handlers for version history operations.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module main/ipc/history-handlers
 */

import type { IpcMain } from 'electron';
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
  service: VersionHistoryService
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

  // Register handlers
  ipcMainInstance.handle(HistoryChannels.GET_HISTORY, (_, args) => handleGetHistory(args));

  ipcMainInstance.handle(HistoryChannels.GET_VERSION, (_, args) => handleGetVersion(args));

  ipcMainInstance.handle(HistoryChannels.RESTORE_VERSION, (_, args) => handleRestoreVersion(args));

  ipcMainInstance.handle(HistoryChannels.CREATE_SNAPSHOT, (_, args) => handleCreateSnapshot(args));

  console.log('[HistoryHandlers] All history handlers registered');
}
