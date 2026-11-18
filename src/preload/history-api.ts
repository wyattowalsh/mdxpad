/**
 * History Preload API
 *
 * Provides the version history API surface exposed to renderer via contextBridge.
 * All methods use IPC invoke/handle pattern with zod validation.
 *
 * @module preload/history-api
 */

import { ipcRenderer } from 'electron';
import {
  HistoryChannels,
  VersionHistoryRequestSchema,
  GetVersionRequestSchema,
  RestoreVersionRequestSchema,
  CreateSnapshotRequestSchema,
  VersionHistoryResponseSchema,
  GetVersionResponseSchema,
  RestoreVersionResponseSchema,
  CreateSnapshotResponseSchema,
  type VersionHistoryResponse,
  type GetVersionResponse,
  type RestoreVersionResponse,
  type CreateSnapshotResponse,
} from '@shared/contracts/history-schemas';

// ============================================================================
// Types
// ============================================================================

/**
 * History API exposed to renderer process.
 */
export interface HistoryApi {
  /**
   * Get version history for a file.
   * @param filePath - Absolute path to the file
   * @returns Version history with sorted entries
   */
  readonly getHistory: (filePath: string) => Promise<VersionHistoryResponse>;

  /**
   * Get the content of a specific version.
   * @param id - Version identifier
   * @param filePath - File path for context
   * @returns Version content and metadata
   */
  readonly getVersion: (id: string, filePath: string) => Promise<GetVersionResponse>;

  /**
   * Restore a specific version.
   * @param id - Version identifier
   * @param filePath - File path to restore to
   * @param createBackup - Whether to backup current content first
   * @returns Restore result
   */
  readonly restore: (
    id: string,
    filePath: string,
    createBackup?: boolean,
    backupContent?: string
  ) => Promise<RestoreVersionResponse>;

  /**
   * Create a manual snapshot of the current file.
   * @param filePath - File path to snapshot
   * @param label - Optional label for the snapshot
   * @returns Snapshot creation result
   */
  readonly createSnapshot: (
    filePath: string,
    label?: string,
    content?: string
  ) => Promise<CreateSnapshotResponse>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * History API implementation for preload context.
 */
export const historyApi: HistoryApi = {
  getHistory: async (filePath) => {
    const request = { filePath };
    const parsed = VersionHistoryRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw new Error(`Invalid history request: ${parsed.error.message}`);
    }

    const response: unknown = await ipcRenderer.invoke(HistoryChannels.GET_HISTORY, parsed.data);

    const responseParsed = VersionHistoryResponseSchema.safeParse(response);
    if (!responseParsed.success) {
      throw new Error(`Invalid history response: ${responseParsed.error.message}`);
    }

    return responseParsed.data;
  },

  getVersion: async (id, filePath) => {
    const request = { id, filePath };
    const parsed = GetVersionRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw new Error(`Invalid get version request: ${parsed.error.message}`);
    }

    const response: unknown = await ipcRenderer.invoke(HistoryChannels.GET_VERSION, parsed.data);

    const responseParsed = GetVersionResponseSchema.safeParse(response);
    if (!responseParsed.success) {
      throw new Error(`Invalid get version response: ${responseParsed.error.message}`);
    }

    return responseParsed.data;
  },

  restore: async (id, filePath, createBackup = true, backupContent?: string) => {
    const request = {
      id,
      filePath,
      createBackup,
      ...(backupContent !== undefined ? { backupContent } : {}),
    };
    const parsed = RestoreVersionRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw new Error(`Invalid restore request: ${parsed.error.message}`);
    }

    const response: unknown = await ipcRenderer.invoke(
      HistoryChannels.RESTORE_VERSION,
      parsed.data
    );

    const responseParsed = RestoreVersionResponseSchema.safeParse(response);
    if (!responseParsed.success) {
      throw new Error(`Invalid restore response: ${responseParsed.error.message}`);
    }

    return responseParsed.data;
  },

  createSnapshot: async (filePath, label, content) => {
    const request = {
      filePath,
      ...(label !== undefined ? { label } : {}),
      ...(content !== undefined ? { content } : {}),
    };
    const parsed = CreateSnapshotRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw new Error(`Invalid create snapshot request: ${parsed.error.message}`);
    }

    const response: unknown = await ipcRenderer.invoke(
      HistoryChannels.CREATE_SNAPSHOT,
      parsed.data
    );

    const responseParsed = CreateSnapshotResponseSchema.safeParse(response);
    if (!responseParsed.success) {
      throw new Error(`Invalid create snapshot response: ${responseParsed.error.message}`);
    }

    return responseParsed.data;
  },
};
