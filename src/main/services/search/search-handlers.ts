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
import { trustedDirectoryError } from '@main/ipc/trusted-directory';
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
      const { query, workspaceDir, maxResults, fuzzy, excludePatterns } =
        SearchQueryRequestSchema.parse(args);
      const scopeError = trustedDirectoryError(workspaceDir);
      if (scopeError !== null) {
        return handleSearchError(new Error(scopeError), 'PERMISSION_DENIED');
      }
      const result = searchService.search(
        workspaceDir,
        query,
        maxResults,
        fuzzy,
        excludePatterns ?? []
      );
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
      const { workspaceDir, fileExtensions, excludePatterns } =
        SearchIndexRequestSchema.parse(args);
      const scopeError = trustedDirectoryError(workspaceDir);
      if (scopeError !== null) {
        return handleSearchError(new Error(scopeError), 'PERMISSION_DENIED');
      }
      const result = await searchService.indexWorkspace(
        workspaceDir,
        fileExtensions,
        excludePatterns ?? []
      );
      return { ok: true, value: result };
    } catch (error) {
      return handleSearchError(error, 'INDEX_FAILED');
    }
  });

  ipcMain.handle(SearchChannels.status, (event, args) => {
    assertAuthorizedIpcSender(event, window, SearchChannels.status);
    try {
      const { workspaceDir } = SearchStatusRequestSchema.parse(args);
      const scopeError = trustedDirectoryError(workspaceDir);
      if (scopeError !== null) {
        return handleSearchError(new Error(scopeError), 'PERMISSION_DENIED');
      }
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
