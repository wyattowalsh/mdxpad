/**
 * Import IPC handlers.
 * Registers IPC handlers for content import operations.
 *
 * @module import-handlers
 */

import type { IpcMain, BrowserWindow } from 'electron';
import {
  ImportChannels,
  ImportFromHtmlRequestSchema,
  ImportFromNotionRequestSchema,
  ImportFromGoogleDocsRequestSchema,
} from '@shared/contracts/import-schemas';
import { assertAuthorizedIpcSender } from '@main/ipc/ipc-sender-authorization';
import { convertHtmlToMdx } from './html-to-mdx-converter';
import { importFromNotion, NotionImportError } from './notion-importer';
import { importFromGoogleDocs, GoogleDocsImportError } from './google-docs-importer';

function mapImportError(error: unknown): { ok: false; error: { code: string; message: string } } {
  if (error instanceof NotionImportError) {
    const codeMap: Record<string, string> = {
      UNAUTHORIZED: 'UNAUTHORIZED',
      NOT_FOUND: 'NOT_FOUND',
      API_ERROR: 'NOTION_API_ERROR',
    };
    return {
      ok: false,
      error: { code: codeMap[error.code] ?? 'UNKNOWN', message: error.message },
    };
  }
  if (error instanceof GoogleDocsImportError) {
    const codeMap: Record<string, string> = {
      UNAUTHORIZED: 'UNAUTHORIZED',
      NOT_FOUND: 'NOT_FOUND',
      API_ERROR: 'GOOGLE_DOCS_API_ERROR',
    };
    return {
      ok: false,
      error: { code: codeMap[error.code] ?? 'UNKNOWN', message: error.message },
    };
  }
  return {
    ok: false,
    error: {
      code: 'UNKNOWN',
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

export function registerImportHandlers(ipcMain: IpcMain, window: BrowserWindow): void {
  ipcMain.handle(ImportChannels.fromHtml, async (event, args) => {
    assertAuthorizedIpcSender(event, window, ImportChannels.fromHtml);
    try {
      const { html } = ImportFromHtmlRequestSchema.parse(args);
      const content = await convertHtmlToMdx(html);
      return { ok: true, value: { content, warnings: [] } };
    } catch (error) {
      return mapImportError(error);
    }
  });

  ipcMain.handle(ImportChannels.fromNotion, async (event, args) => {
    assertAuthorizedIpcSender(event, window, ImportChannels.fromNotion);
    try {
      const { pageId, apiKey } = ImportFromNotionRequestSchema.parse(args);
      const result = await importFromNotion(pageId, apiKey);
      return { ok: true, value: result };
    } catch (error) {
      return mapImportError(error);
    }
  });

  ipcMain.handle(ImportChannels.fromGoogleDocs, async (event, args) => {
    assertAuthorizedIpcSender(event, window, ImportChannels.fromGoogleDocs);
    try {
      const { docId, accessToken } = ImportFromGoogleDocsRequestSchema.parse(args);
      const result = await importFromGoogleDocs(docId, accessToken);
      return { ok: true, value: result };
    } catch (error) {
      return mapImportError(error);
    }
  });

  console.log('[ImportHandlers] All import handlers registered');
}
