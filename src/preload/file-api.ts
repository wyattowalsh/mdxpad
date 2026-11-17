/**
 * File Operations API Module
 *
 * Provides file operation bridge functions for the renderer process.
 * All methods use validated invoke with schema validation on both ends.
 *
 * @security Uses invoke/handle pattern for all file operations
 * @security All payloads validated with zod on both ends per Constitution III.3
 * @module src/preload/file-api
 */

import { IPC_CHANNELS } from '@shared/lib/ipc';
import {
  FileSaveRequestSchema,
  FileSaveAsRequestSchema,
  FileListDirectoryRequestSchema,
  FileListDirectoryResponseSchema,
  FileReadRequestSchema,
  FileWriteRequestSchema,
  FileExportRequestSchema,
  FileOpenResponseSchema,
  FileSaveResponseSchema,
  FileSaveAsResponseSchema,
  FileReadResponseSchema,
  FileWriteResponseSchema,
  FileExportResponseSchema,
  WindowCloseResponseSchema,
  WindowMinimizeResponseSchema,
  WindowMaximizeResponseSchema,
  AppVersionResponseSchema,
  AppReadyResponseSchema,
} from '@shared/contracts/file-schemas';
import { validatedInvoke } from './validated-invoke';
import type { FileResult, FileHandle } from '@shared/types/file';
import type { ExportFormat, FileExportResult } from '@shared/contracts/file-schemas';
import { z } from 'zod';

// ============================================================================
// Security Info Schema
// ============================================================================

/**
 * SecurityInfo response schema.
 * Validates the security configuration returned by getSecurityInfo.
 */
const SecurityInfoResponseSchema = z.object({
  contextIsolation: z.boolean(),
  sandbox: z.boolean(),
  nodeIntegration: z.boolean(),
  webSecurity: z.boolean(),
});

// ============================================================================
// App Info Operations
// ============================================================================

export const appInfo = {
  getVersion: () =>
    validatedInvoke(
      IPC_CHANNELS.app.getVersion,
      null, // void request
      AppVersionResponseSchema
    ),

  getSecurityInfo: () =>
    validatedInvoke(
      IPC_CHANNELS.app.getSecurityInfo,
      null, // void request
      SecurityInfoResponseSchema
    ),

  signalReady: () =>
    validatedInvoke(
      IPC_CHANNELS.app.ready,
      null, // void request
      AppReadyResponseSchema
    ),
};

// ============================================================================
// File Operations
// ============================================================================

export const fileOperations = {
  openFile: (): Promise<FileResult<FileHandle>> =>
    validatedInvoke(
      IPC_CHANNELS.file.open,
      null, // void request
      FileOpenResponseSchema
    ) as Promise<FileResult<FileHandle>>,

  saveFile: (handle: unknown, content: string): Promise<FileResult<void>> =>
    validatedInvoke(IPC_CHANNELS.file.save, FileSaveRequestSchema, FileSaveResponseSchema, {
      handle,
      content,
    }) as Promise<FileResult<void>>,

  saveFileAs: (content: string): Promise<FileResult<FileHandle>> =>
    validatedInvoke(IPC_CHANNELS.file.saveAs, FileSaveAsRequestSchema, FileSaveAsResponseSchema, {
      content,
    }) as Promise<FileResult<FileHandle>>,

  readFile: (path: string): Promise<FileResult<string>> =>
    validatedInvoke(IPC_CHANNELS.file.read, FileReadRequestSchema, FileReadResponseSchema, {
      path,
    }) as Promise<FileResult<string>>,

  listDirectory: (directory: string) =>
    validatedInvoke(
      IPC_CHANNELS.file.list,
      FileListDirectoryRequestSchema,
      FileListDirectoryResponseSchema,
      { directory }
    ),

  writeFile: (path: string, content: string): Promise<FileResult<void>> =>
    validatedInvoke(IPC_CHANNELS.file.write, FileWriteRequestSchema, FileWriteResponseSchema, {
      path,
      content,
    }) as Promise<FileResult<void>>,

  exportFile: (
    content: string,
    options?: { sourcePath?: string | null; format?: ExportFormat }
  ): Promise<FileExportResult> =>
    validatedInvoke(IPC_CHANNELS.file.export, FileExportRequestSchema, FileExportResponseSchema, {
      content,
      sourcePath: options?.sourcePath ?? null,
      ...(options?.format !== undefined && { format: options.format }),
    }),
};

// ============================================================================
// Window Operations
// ============================================================================

export const windowOperations = {
  closeWindow: () =>
    validatedInvoke(
      IPC_CHANNELS.window.close,
      null, // void request
      WindowCloseResponseSchema
    ),

  minimizeWindow: () =>
    validatedInvoke(
      IPC_CHANNELS.window.minimize,
      null, // void request
      WindowMinimizeResponseSchema
    ),

  maximizeWindow: () =>
    validatedInvoke(
      IPC_CHANNELS.window.maximize,
      null, // void request
      WindowMaximizeResponseSchema
    ),
};
