/**
 * Semantic Search IPC Schemas
 *
 * Zod schemas for validating IPC payloads in the semantic search system.
 * Per Constitution Article III Section 3.3: All payloads validated with zod on both ends.
 *
 * @module src/shared/contracts/semantic-search-schemas
 */

import { z } from 'zod';

// =============================================================================
// REQUEST SCHEMAS
// =============================================================================

/**
 * Request to perform semantic search across workspace files.
 */
export const SemanticSearchRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  topK: z.number().int().positive().max(50).optional().default(10),
  workspacePath: z.string().min(1),
});
export type SemanticSearchRequest = z.infer<typeof SemanticSearchRequestSchema>;

/**
 * Request to index workspace files for semantic search.
 */
export const SemanticIndexRequestSchema = z.object({
  workspacePath: z.string().min(1),
  forceReindex: z.boolean().optional().default(false),
});
export type SemanticIndexRequest = z.infer<typeof SemanticIndexRequestSchema>;

/**
 * Request to get index status.
 */
export const SemanticIndexStatusRequestSchema = z.object({
  workspacePath: z.string().min(1),
});
export type SemanticIndexStatusRequest = z.infer<typeof SemanticIndexStatusRequestSchema>;

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

/**
 * A single semantic search result.
 */
export const SemanticSearchResultSchema = z.object({
  filePath: z.string(),
  content: z.string(),
  score: z.number().min(0).max(1),
  chunkIndex: z.number().int().nonnegative(),
});
export type SemanticSearchResult = z.infer<typeof SemanticSearchResultSchema>;

/**
 * Response for semantic search.
 */
export const SemanticSearchResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(SemanticSearchResultSchema).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});
export type SemanticSearchResponse = z.infer<typeof SemanticSearchResponseSchema>;

/**
 * Response for indexing operation.
 */
export const SemanticIndexResponseSchema = z.object({
  success: z.boolean(),
  indexedFiles: z.number().int().nonnegative().optional(),
  totalChunks: z.number().int().nonnegative().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});
export type SemanticIndexResponse = z.infer<typeof SemanticIndexResponseSchema>;

/**
 * Response for index status.
 */
export const SemanticIndexStatusResponseSchema = z.object({
  success: z.boolean(),
  isIndexed: z.boolean().optional(),
  fileCount: z.number().int().nonnegative().optional(),
  chunkCount: z.number().int().nonnegative().optional(),
  lastIndexedAt: z.string().datetime().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});
export type SemanticIndexStatusResponse = z.infer<typeof SemanticIndexStatusResponseSchema>;

// =============================================================================
// IPC CHANNELS
// =============================================================================

export const SemanticSearchChannels = {
  SEARCH: 'mdxpad:semantic:search',
  INDEX: 'mdxpad:semantic:index',
  INDEX_STATUS: 'mdxpad:semantic:index-status',
} as const;

export type SemanticSearchChannel =
  (typeof SemanticSearchChannels)[keyof typeof SemanticSearchChannels];
