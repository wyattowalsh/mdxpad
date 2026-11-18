import type { BrowserWindow, IpcMain } from 'electron';

import { inlineLocalImages } from '@main/services/export-formats/export-image';
import {
  InlinePreviewImagesRequestSchema,
  InlinePreviewImagesResponseSchema,
  createValidatedHandler,
} from '@shared/contracts/file-schemas';
import { IPC_CHANNELS } from '@shared/lib/ipc';

import { assertAuthorizedIpcSender } from './ipc-sender-authorization';
import { hasReadCapability } from './document-capability';

/**
 * Embed local images for preview. The source file must already be open.
 * Pictures outside that file's folder stay as written.
 */
export async function inlinePreviewImages(content: string, sourcePath: string): Promise<string> {
  if (!hasReadCapability(sourcePath)) {
    return content;
  }
  return inlineLocalImages(content, sourcePath, 'document');
}

export function registerInlinePreviewImages(ipcMainInstance: IpcMain, window: BrowserWindow): void {
  ipcMainInstance.handle(IPC_CHANNELS.file.inlinePreviewImages, (event, args) => {
    assertAuthorizedIpcSender(event, window, IPC_CHANNELS.file.inlinePreviewImages);
    return createValidatedHandler(InlinePreviewImagesRequestSchema, async (request) => {
      const content = await inlinePreviewImages(request.content, request.sourcePath);
      return InlinePreviewImagesResponseSchema.parse({ content });
    })(args);
  });
}
