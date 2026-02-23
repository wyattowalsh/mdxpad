/**
 * File and app IPC handlers.
 * Handles all file operations and app lifecycle IPC communication.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module file-handlers
 */

import { app, dialog, type IpcMain, type BrowserWindow } from 'electron';

import { IPC_CHANNELS } from '@shared/lib/ipc';
import {
  FileOpenRequestSchema,
  FileSaveRequestSchema,
  FileSaveAsRequestSchema,
  FileReadRequestSchema,
  FileWriteRequestSchema,
  AppVersionRequestSchema,
  AppReadyRequestSchema,
  createValidatedHandler,
  type FileResultHandle,
  type FileResultVoid,
  type FileResultString,
} from '@shared/contracts/file-schemas';
import {
  readFile,
  writeFile,
  createFileHandle,
  createFileServiceIntegration,
  type FileServiceIntegration,
} from '@main/services/file-service';
import { addToRecentFiles } from '@main/menu';
import type { FileHandle as SchemaFileHandle } from '@shared/contracts/file-schemas';
import type { FileId } from '@shared/types/file';
import { assertAuthorizedIpcSender } from './ipc-sender-authorization';

/** File dialog filters for MDX and Markdown files */
const MDX_FILTERS = [
  { name: 'MDX/Markdown', extensions: ['mdx', 'md'] },
];

/** File lifecycle integration for watcher/recent-file wiring. */
let fileIntegration: FileServiceIntegration | null = null;
let integrationWindow: BrowserWindow | null = null;

/**
 * Ensure file integration is initialized for the active BrowserWindow.
 */
function ensureFileIntegration(window: BrowserWindow): FileServiceIntegration {
  if (
    fileIntegration === null ||
    integrationWindow?.webContents.id !== window.webContents.id
  ) {
    fileIntegration?.close();
    fileIntegration = createFileServiceIntegration(window);
    integrationWindow = window;
  }
  return fileIntegration;
}

/**
 * Get currently active file integration (if initialized).
 */
function getFileIntegration(): FileServiceIntegration | null {
  return integrationWindow ? ensureFileIntegration(integrationWindow) : null;
}

/**
 * Handler for mdxpad:file:open.
 * Shows open dialog, reads file, and returns FileHandle.
 * @returns FileResult<FileHandle> with file handle or CANCELLED error
 */
const handleFileOpen = createValidatedHandler(
  FileOpenRequestSchema,
  async (): Promise<FileResultHandle> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: MDX_FILTERS,
    });

    const filePath = result.filePaths[0];
    if (result.canceled || filePath === undefined) {
      return { ok: false, error: { code: 'CANCELLED' } };
    }

    const readResult = await readFile(filePath);

    if (!readResult.ok) {
      return { ok: false, error: readResult.error };
    }

    // Add to recent files list
    addToRecentFiles(filePath);

    const handle = createFileHandle(filePath);
    getFileIntegration()?.onFileOpened(handle);
    // Cast to schema FileHandle type (FileId branded types are compatible at runtime)
    return { ok: true, value: handle as unknown as SchemaFileHandle };
  }
);

/**
 * Handler for mdxpad:file:save.
 * Writes content to existing file path from handle.
 * @param args - { handle: FileHandle, content: string }
 * @returns FileResult<void> indicating success or error
 */
const handleFileSave = createValidatedHandler(
  FileSaveRequestSchema,
  async (args): Promise<FileResultVoid> => {
    const { handle, content } = args;

    // Handle must have a path for save (not save-as)
    if (handle.path === null) {
      return {
        ok: false,
        error: { code: 'UNKNOWN', message: 'Cannot save: file has no path' },
      };
    }

    const result = await writeFile(handle.path, content);
    if (!result.ok) {
      return result;
    }

    const integration = getFileIntegration();
    if (integration) {
      try {
        await integration.onFileSaved(handle.id as unknown as FileId);
      } catch (error) {
        console.error('[FileHandlers] File save lifecycle hook failed:', error);
      }
    }

    return result;
  }
);

/**
 * Handler for mdxpad:file:save-as.
 * Shows save dialog, writes content to new path, returns new FileHandle.
 * @param args - { content: string }
 * @returns FileResult<FileHandle> with new handle or CANCELLED error
 */
const handleFileSaveAs = createValidatedHandler(
  FileSaveAsRequestSchema,
  async (args): Promise<FileResultHandle> => {
    const { content } = args;

    const result = await dialog.showSaveDialog({
      filters: MDX_FILTERS,
      defaultPath: 'untitled.mdx',
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, error: { code: 'CANCELLED' } };
    }

    const saveFilePath = result.filePath;
    const writeResult = await writeFile(saveFilePath, content);

    if (!writeResult.ok) {
      return { ok: false, error: writeResult.error };
    }

    // Add to recent files list
    addToRecentFiles(saveFilePath);

    const handle = createFileHandle(saveFilePath);
    getFileIntegration()?.onFileOpened(handle);
    // Cast to schema FileHandle type (FileId branded types are compatible at runtime)
    return { ok: true, value: handle as unknown as SchemaFileHandle };
  }
);

/**
 * Handler for mdxpad:file:read.
 * Reads file contents from path using FileService.
 * @param args - { path: string }
 * @returns FileResult<string> with file contents or error
 */
const handleFileRead = createValidatedHandler(
  FileReadRequestSchema,
  async (args): Promise<FileResultString> => {
    return readFile(args.path);
  }
);

/**
 * Handler for mdxpad:file:write.
 * Writes content to path using FileService.
 * @param args - { path: string, content: string }
 * @returns FileResult<void> indicating success or error
 */
const handleFileWrite = createValidatedHandler(
  FileWriteRequestSchema,
  async (args): Promise<FileResultVoid> => {
    return writeFile(args.path, args.content);
  }
);

/**
 * Handler for mdxpad:app:version.
 * Returns the application version from package.json.
 * @returns Application version string
 */
const handleAppVersion = createValidatedHandler(
  AppVersionRequestSchema,
  (): Promise<string> => {
    return Promise.resolve(app.getVersion());
  }
);

/**
 * Handler for mdxpad:app:ready.
 * Signals that the renderer process is ready.
 * @returns void
 */
const handleAppReady = createValidatedHandler(
  AppReadyRequestSchema,
  (): Promise<void> => {
    // Signal acknowledged - can be used to trigger main process actions
    // when renderer is ready (e.g., opening a file passed via CLI)
    console.log('[FileHandlers] Renderer signaled ready');
    return Promise.resolve();
  }
);

/**
 * Registers all file and app IPC handlers.
 * Called during app initialization.
 *
 * @param ipcMainInstance - The Electron IpcMain instance
 * @param window - The authorized BrowserWindow for privileged handlers
 */
export function registerFileHandlers(
  ipcMainInstance: IpcMain,
  window: BrowserWindow
): void {
  ensureFileIntegration(window);

  // File operation handlers
  ipcMainInstance.handle(IPC_CHANNELS.file.open, (event) => {
    assertAuthorizedIpcSender(event, window, IPC_CHANNELS.file.open);
    return handleFileOpen(undefined);
  });
  ipcMainInstance.handle(IPC_CHANNELS.file.save, (event, args) => {
    assertAuthorizedIpcSender(event, window, IPC_CHANNELS.file.save);
    return handleFileSave(args);
  });
  ipcMainInstance.handle(IPC_CHANNELS.file.saveAs, (event, args) => {
    assertAuthorizedIpcSender(event, window, IPC_CHANNELS.file.saveAs);
    return handleFileSaveAs(args);
  });
  ipcMainInstance.handle(IPC_CHANNELS.file.read, (event, args) => {
    assertAuthorizedIpcSender(event, window, IPC_CHANNELS.file.read);
    return handleFileRead(args);
  });
  ipcMainInstance.handle(IPC_CHANNELS.file.write, (event, args) => {
    assertAuthorizedIpcSender(event, window, IPC_CHANNELS.file.write);
    return handleFileWrite(args);
  });

  // App lifecycle handlers
  ipcMainInstance.handle(IPC_CHANNELS.app.getVersion, (event) => {
    assertAuthorizedIpcSender(event, window, IPC_CHANNELS.app.getVersion);
    return handleAppVersion(undefined);
  });
  ipcMainInstance.handle(IPC_CHANNELS.app.ready, (event) => {
    assertAuthorizedIpcSender(event, window, IPC_CHANNELS.app.ready);
    return handleAppReady(undefined);
  });

  console.log('[FileHandlers] All file and app handlers registered');
}
