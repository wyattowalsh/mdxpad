/**
 * Semantic Search IPC Handlers
 *
 * Registers IPC handlers for semantic search operations.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module src/main/services/ai/semantic-search-handlers
 */

import { ipcMain } from 'electron';

import {
  SemanticSearchChannels,
  SemanticSearchRequestSchema,
  SemanticSearchResponseSchema,
  SemanticIndexRequestSchema,
  SemanticIndexResponseSchema,
  SemanticIndexStatusRequestSchema,
  SemanticIndexStatusResponseSchema,
} from '@shared/contracts/semantic-search-schemas';

import type { EmbeddingService } from './embedding-service';

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
        request.topK
      );
      return SemanticSearchResponseSchema.parse({ success: true, results });
    } catch (error) {
      return SemanticSearchResponseSchema.parse({
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Search failed',
        },
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
        request.forceReindex
      );
      return SemanticIndexResponseSchema.parse({
        success: true,
        indexedFiles: result.indexedFiles,
        totalChunks: result.totalChunks,
      });
    } catch (error) {
      return SemanticIndexResponseSchema.parse({
        success: false,
        error: {
          code: 'INDEX_FAILED',
          message: error instanceof Error ? error.message : 'Indexing failed',
        },
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
        lastIndexedAt: status.lastIndexedAt,
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
export function registerSemanticSearchHandlers(embeddingService: EmbeddingService): void {
  ipcMain.handle(SemanticSearchChannels.SEARCH, handleSearch(embeddingService));
  ipcMain.handle(SemanticSearchChannels.INDEX, handleIndex(embeddingService));
  ipcMain.handle(SemanticSearchChannels.INDEX_STATUS, handleIndexStatus(embeddingService));
  console.log('[SemanticSearch] IPC handlers registered');
}
