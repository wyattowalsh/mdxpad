/**
 * Semantic Search Preload API
 *
 * Exposes semantic search operations to the renderer via contextBridge.
 * Per Constitution III.3: All payloads validated with zod on both ends.
 *
 * @module src/preload/semantic-search-api
 */

import { validatedInvoke } from './validated-invoke';
import {
  SemanticSearchChannels,
  SemanticSearchRequestSchema,
  SemanticSearchResponseSchema,
  SemanticIndexRequestSchema,
  SemanticIndexResponseSchema,
  SemanticIndexStatusRequestSchema,
  SemanticIndexStatusResponseSchema,
  type SemanticSearchResponse,
  type SemanticIndexResponse,
  type SemanticIndexStatusResponse,
} from '@shared/contracts/semantic-search-schemas';

// =============================================================================
// API INTERFACE
// =============================================================================

export interface SemanticSearchApi {
  search(query: string, workspacePath: string, topK?: number): Promise<SemanticSearchResponse>;
  indexWorkspace(
    workspacePath: string,
    forceReindex?: boolean,
    excludePatterns?: readonly string[]
  ): Promise<SemanticIndexResponse>;
  getIndexStatus(workspacePath: string): Promise<SemanticIndexStatusResponse>;
}

// =============================================================================
// API IMPLEMENTATION
// =============================================================================

export const semanticSearchApi: SemanticSearchApi = {
  search: (query, workspacePath, topK) =>
    validatedInvoke(
      SemanticSearchChannels.SEARCH,
      SemanticSearchRequestSchema,
      SemanticSearchResponseSchema,
      { query, workspacePath, topK }
    ),

  indexWorkspace: (workspacePath, forceReindex, excludePatterns) =>
    validatedInvoke(
      SemanticSearchChannels.INDEX,
      SemanticIndexRequestSchema,
      SemanticIndexResponseSchema,
      {
        workspacePath,
        forceReindex,
        ...(excludePatterns !== undefined && excludePatterns.length > 0 && { excludePatterns }),
      }
    ),

  getIndexStatus: (workspacePath) =>
    validatedInvoke(
      SemanticSearchChannels.INDEX_STATUS,
      SemanticIndexStatusRequestSchema,
      SemanticIndexStatusResponseSchema,
      { workspacePath }
    ),
};
