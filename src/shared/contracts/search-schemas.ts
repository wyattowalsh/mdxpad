/**
 * Search IPC contract schemas.
 * Zod schemas for validating all search operation IPC payloads.
 *
 * @module search-schemas
 */

import { z } from 'zod';
import { FilePathSchema } from './file-schemas';

// ============================================================================
// Channel Definitions
// ============================================================================

export const SearchChannels = {
  search: 'mdxpad:search:query',
  index: 'mdxpad:search:index',
  status: 'mdxpad:search:status',
} as const;

// ============================================================================
// Request Schemas
// ============================================================================

export const SearchQueryRequestSchema = z.object({
  query: z.string().min(1),
  workspaceDir: FilePathSchema,
  maxResults: z.number().int().positive().optional(),
  fuzzy: z.boolean().optional(),
});

export const SearchIndexRequestSchema = z.object({
  workspaceDir: FilePathSchema,
  fileExtensions: z.array(z.string()).optional(),
});

export const SearchStatusRequestSchema = z.object({
  workspaceDir: FilePathSchema,
});

// ============================================================================
// Response Schemas
// ============================================================================

export const SearchResultSchema = z.object({
  filePath: z.string(),
  fileName: z.string(),
  score: z.number(),
  snippet: z.string(),
  matchRanges: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
    })
  ),
});

export const SearchQueryResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  totalResults: z.number(),
  queryTimeMs: z.number(),
});

export const SearchIndexResponseSchema = z.object({
  indexedFiles: z.number(),
  indexTimeMs: z.number(),
});

export const SearchStatusResponseSchema = z.object({
  indexed: z.boolean(),
  fileCount: z.number(),
  lastIndexedAt: z.string().nullable(),
});

// ============================================================================
// Error Schema
// ============================================================================

export const SearchErrorSchema = z.object({
  code: z.enum(['NOT_INDEXED', 'INVALID_WORKSPACE', 'INDEX_FAILED', 'UNKNOWN']),
  message: z.string(),
});

export type SearchError = z.infer<typeof SearchErrorSchema>;

// ============================================================================
// Type Exports
// ============================================================================

export type SearchQueryRequest = z.infer<typeof SearchQueryRequestSchema>;
export type SearchQueryResponse = z.infer<typeof SearchQueryResponseSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchIndexRequest = z.infer<typeof SearchIndexRequestSchema>;
export type SearchIndexResponse = z.infer<typeof SearchIndexResponseSchema>;
export type SearchStatusRequest = z.infer<typeof SearchStatusRequestSchema>;
export type SearchStatusResponse = z.infer<typeof SearchStatusResponseSchema>;
