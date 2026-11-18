/**
 * Open a document the user dropped on the window.
 * The last path component must be a real Markdown or MDX file.
 */

import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
import type { BrowserWindow, IpcMain } from 'electron';

import { DroppedFileRequestSchema, type DroppedFileResponse } from '@shared/contracts/file-schemas';
import { IPC_CHANNELS } from '@shared/lib/ipc';
import { addToRecentFiles } from '@main/menu';

import { assertAuthorizedIpcSender } from './ipc-sender-authorization';
import { grantWriteCapability } from './document-capability';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.mdx', '.markdown']);

function extensionAllowed(filePath: string): boolean {
  return DOCUMENT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function readRegularFile(filePath: string): Promise<string | null> {
  let info: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    info = await fs.lstat(filePath);
  } catch {
    return null;
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    return null;
  }

  const handle = await fs.open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    return await handle.readFile({ encoding: 'utf8' });
  } finally {
    await handle.close();
  }
}

export async function openDroppedDocument(filePath: string): Promise<DroppedFileResponse> {
  if (filePath.includes('\0') || !extensionAllowed(filePath)) {
    return { ok: false, message: 'Drop a Markdown or MDX file' };
  }

  const resolved = path.resolve(filePath);
  let content: string | null;
  try {
    content = await readRegularFile(resolved);
  } catch {
    content = null;
  }
  if (content === null) {
    return { ok: false, message: 'That file could not be opened' };
  }

  grantWriteCapability(resolved);
  return { ok: true, path: resolved, content };
}

export function openDroppedRequest(args: unknown): Promise<DroppedFileResponse> {
  const parsed = DroppedFileRequestSchema.safeParse(args);
  if (!parsed.success) {
    return Promise.resolve({ ok: false, message: 'That file could not be opened' });
  }
  return openDroppedDocument(parsed.data.path).then((result) => {
    if (result.ok) {
      addToRecentFiles(result.path);
    }
    return result;
  });
}

export function registerDroppedFileHandler(ipcMain: IpcMain, window: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.file.openDropped, (event, args: unknown) => {
    assertAuthorizedIpcSender(event, window, IPC_CHANNELS.file.openDropped);
    return openDroppedRequest(args);
  });
}
