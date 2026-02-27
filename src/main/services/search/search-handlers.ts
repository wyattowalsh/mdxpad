/**
 * Search IPC handlers.
 * Registers IPC handlers for workspace full-text search.
 *
 * @module search-handlers
 */

import type { IpcMain, BrowserWindow } from 'electron';
import {
  SearchChannels,
  SearchQueryRequestSchema,
  SearchIndexRequestSchema,
  SearchStatusRequestSchema,
} from '@shared/contracts/search-schemas';
import { assertAuthorizedIpcSender } from '@main/ipc/ipc-sender-authorization';
import * as searchService from './search-service';

function handleSearchError(
  error: unknown,
  code = 'UNKNOWN'
): { ok: false; error: { code: string; message: string } } {
  return {
    ok: false,
    error: { code, message: error instanceof Error ? error.message : String(error) },
  };
}

function registerQueryHandler(ipcMain: IpcMain, window: BrowserWindow): void {
  ipcMain.handle(SearchChannels.search, (event, args) => {
    assertAuthorizedIpcSender(event, window, SearchChannels.search);
    try {
      const { query, workspaceDir, maxResults, fuzzy } = SearchQueryRequestSchema.parse(args);
      const result = searchService.search(workspaceDir, query, maxResults, fuzzy);
      return { ok: true, value: result };
    } catch (error) {
      return handleSearchError(error);
    }
  });
}

function registerIndexHandlers(ipcMain: IpcMain, window: BrowserWindow): void {
  ipcMain.handle(SearchChannels.index, async (event, args) => {
    assertAuthorizedIpcSender(event, window, SearchChannels.index);
    try {
      const { workspaceDir, fileExtensions } = SearchIndexRequestSchema.parse(args);
      const result = await searchService.indexWorkspace(workspaceDir, fileExtensions);
      return { ok: true, value: result };
    } catch (error) {
      return handleSearchError(error, 'INDEX_FAILED');
    }
  });

  ipcMain.handle(SearchChannels.status, (event, args) => {
    assertAuthorizedIpcSender(event, window, SearchChannels.status);
    try {
      const { workspaceDir } = SearchStatusRequestSchema.parse(args);
      const result = searchService.getStatus(workspaceDir);
      return { ok: true, value: result };
    } catch (error) {
      return handleSearchError(error);
    }
  });
}

export function registerSearchHandlers(ipcMain: IpcMain, window: BrowserWindow): void {
  registerQueryHandler(ipcMain, window);
  registerIndexHandlers(ipcMain, window);
  console.log('[SearchHandlers] All search handlers registered');
}
