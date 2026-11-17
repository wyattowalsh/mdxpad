/**
 * Semantic Search IPC Handlers
 *
 * Registers IPC handlers for semantic search operations.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module src/main/services/ai/semantic-search-handlers
 */

import { ipcMain, type BrowserWindow } from 'electron';

import { registerAuthorizedIpcHandler } from '@main/ipc/ipc-sender-authorization';
import {
  SemanticSearchChannels,
  SemanticSearchRequestSchema,
  SemanticSearchResponseSchema,
  SemanticIndexRequestSchema,
  SemanticIndexResponseSchema,
  SemanticIndexStatusRequestSchema,
  SemanticIndexStatusResponseSchema,
} from '@shared/contracts/semantic-search-schemas';

import { EmbeddingsUnavailableError } from './embedding-availability';
import type { EmbeddingService } from './embedding-service';

function errorBody(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
): {
  code: string;
  message: string;
} {
  if (error instanceof EmbeddingsUnavailableError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: fallbackCode,
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}

// =============================================================================
// INDIVIDUAL HANDLERS
// =============================================================================

function handleSearch(embeddingService: EmbeddingService) {
  return async (_event: Electron.IpcMainInvokeEvent, rawRequest: unknown) => {
    try {
      const request = SemanticSearchRequestSchema.parse(rawRequest);
      const results = await embeddingService.search(
        request.workspacePath,
        request.query,
        request.topK,
        request.excludePatterns ?? []
      );
      return SemanticSearchResponseSchema.parse({ success: true, results });
    } catch (error) {
      return SemanticSearchResponseSchema.parse({
        success: false,
        error: errorBody(error, 'SEARCH_FAILED', 'Search failed'),
      });
    }
  };
}

function handleIndex(embeddingService: EmbeddingService) {
  return async (_event: Electron.IpcMainInvokeEvent, rawRequest: unknown) => {
    try {
      const request = SemanticIndexRequestSchema.parse(rawRequest);
      const result = await embeddingService.indexWorkspace(
        request.workspacePath,
        request.forceReindex,
        request.excludePatterns ?? []
      );
      return SemanticIndexResponseSchema.parse({
        success: true,
        indexedFiles: result.indexedFiles,
        totalChunks: result.totalChunks,
      });
    } catch (error) {
      return SemanticIndexResponseSchema.parse({
        success: false,
        error: errorBody(error, 'INDEX_FAILED', 'Indexing failed'),
      });
    }
  };
}

function handleIndexStatus(embeddingService: EmbeddingService) {
  return async (_event: Electron.IpcMainInvokeEvent, rawRequest: unknown) => {
    try {
      const request = SemanticIndexStatusRequestSchema.parse(rawRequest);
      const status = await embeddingService.getIndexStatus(request.workspacePath);
      return SemanticIndexStatusResponseSchema.parse({
        success: true,
        isIndexed: status.isIndexed,
        fileCount: status.fileCount,
        chunkCount: status.chunkCount,
        ...(status.lastIndexedAt === null ? {} : { lastIndexedAt: status.lastIndexedAt }),
      });
    } catch (error) {
      return SemanticIndexStatusResponseSchema.parse({
        success: false,
        error: {
          code: 'STATUS_FAILED',
          message: error instanceof Error ? error.message : 'Status check failed',
        },
      });
    }
  };
}

// =============================================================================
// HANDLER REGISTRATION
// =============================================================================

/**
 * Registers semantic search IPC handlers.
 */
export function registerSemanticSearchHandlers(
  embeddingService: EmbeddingService,
  window: BrowserWindow
): void {
  registerAuthorizedIpcHandler(
    ipcMain,
    window,
    SemanticSearchChannels.SEARCH,
    handleSearch(embeddingService)
  );
  registerAuthorizedIpcHandler(
    ipcMain,
    window,
    SemanticSearchChannels.INDEX,
    handleIndex(embeddingService)
  );
  registerAuthorizedIpcHandler(
    ipcMain,
    window,
    SemanticSearchChannels.INDEX_STATUS,
    handleIndexStatus(embeddingService)
  );
  console.log('[SemanticSearch] IPC handlers registered');
}
