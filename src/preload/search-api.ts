/**
 * Search Operations Preload API.
 * Provides search bridge functions for the renderer process.
 *
 * @module search-api
 */

import { z } from 'zod';
import {
  SearchChannels,
  SearchQueryRequestSchema,
  SearchIndexRequestSchema,
  SearchStatusRequestSchema,
  SearchQueryResponseSchema,
  SearchIndexResponseSchema,
  SearchStatusResponseSchema,
  SearchErrorSchema,
} from '@shared/contracts/search-schemas';
import { validatedInvoke } from './validated-invoke';

const createSearchOperationResultSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: valueSchema }),
    z.object({ ok: z.literal(false), error: SearchErrorSchema }),
  ]);

const SearchQueryResultSchema = createSearchOperationResultSchema(SearchQueryResponseSchema);
const SearchIndexResultSchema = createSearchOperationResultSchema(SearchIndexResponseSchema);
const SearchStatusResultSchema = createSearchOperationResultSchema(SearchStatusResponseSchema);

export const searchApi = {
  search: (workspaceDir: string, query: string, maxResults?: number, fuzzy?: boolean) =>
    validatedInvoke(SearchChannels.search, SearchQueryRequestSchema, SearchQueryResultSchema, {
      query,
      workspaceDir,
      ...(maxResults !== undefined && { maxResults }),
      ...(fuzzy !== undefined && { fuzzy }),
    }),

  index: (workspaceDir: string, fileExtensions?: string[]) =>
    validatedInvoke(SearchChannels.index, SearchIndexRequestSchema, SearchIndexResultSchema, {
      workspaceDir,
      ...(fileExtensions !== undefined && { fileExtensions }),
    }),

  status: (workspaceDir: string) =>
    validatedInvoke(SearchChannels.status, SearchStatusRequestSchema, SearchStatusResultSchema, {
      workspaceDir,
    }),
};
