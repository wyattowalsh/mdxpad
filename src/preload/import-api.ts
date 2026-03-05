/**
 * Import Operations Preload API.
 * Provides content import bridge functions for the renderer process.
 *
 * @module import-api
 */

import { z } from 'zod';
import {
  ImportChannels,
  ImportFromHtmlRequestSchema,
  ImportFromNotionRequestSchema,
  ImportFromGoogleDocsRequestSchema,
  ImportFromHtmlResponseSchema,
  ImportFromNotionResponseSchema,
  ImportFromGoogleDocsResponseSchema,
  ImportErrorSchema,
} from '@shared/contracts/import-schemas';
import { validatedInvoke } from './validated-invoke';

const createImportOperationResultSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: valueSchema }),
    z.object({ ok: z.literal(false), error: ImportErrorSchema }),
  ]);

const ImportFromHtmlResultSchema = createImportOperationResultSchema(ImportFromHtmlResponseSchema);
const ImportFromNotionResultSchema = createImportOperationResultSchema(
  ImportFromNotionResponseSchema
);
const ImportFromGoogleDocsResultSchema = createImportOperationResultSchema(
  ImportFromGoogleDocsResponseSchema
);

export const importApi = {
  fromHtml: (html: string) =>
    validatedInvoke(
      ImportChannels.fromHtml,
      ImportFromHtmlRequestSchema,
      ImportFromHtmlResultSchema,
      { html }
    ),

  fromNotion: (pageId: string, apiKey: string) =>
    validatedInvoke(
      ImportChannels.fromNotion,
      ImportFromNotionRequestSchema,
      ImportFromNotionResultSchema,
      { pageId, apiKey }
    ),

  fromGoogleDocs: (docId: string, accessToken: string) =>
    validatedInvoke(
      ImportChannels.fromGoogleDocs,
      ImportFromGoogleDocsRequestSchema,
      ImportFromGoogleDocsResultSchema,
      { docId, accessToken }
    ),
};
