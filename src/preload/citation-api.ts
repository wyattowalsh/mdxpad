/**
 * Citation Operations Preload API.
 * Provides citation management bridge functions for the renderer process.
 *
 * @module citation-api
 */

import { z } from 'zod';
import {
  CitationChannels,
  ParseBibtexRequestSchema,
  FormatCitationRequestSchema,
  GenerateBibliographyRequestSchema,
  ParseBibtexResponseSchema,
  FormatCitationResponseSchema,
  GenerateBibliographyResponseSchema,
  CitationErrorSchema,
  type CitationEntry,
  type CitationStyle,
} from '@shared/contracts/citation-schemas';
import { validatedInvoke } from './validated-invoke';

const createCitationOperationResultSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: valueSchema }),
    z.object({ ok: z.literal(false), error: CitationErrorSchema }),
  ]);

const ParseBibtexResultSchema = createCitationOperationResultSchema(ParseBibtexResponseSchema);
const FormatCitationResultSchema = createCitationOperationResultSchema(FormatCitationResponseSchema);
const GenerateBibliographyResultSchema = createCitationOperationResultSchema(
  GenerateBibliographyResponseSchema
);

export const citationApi = {
  parseBibtex: (bibtex: string) =>
    validatedInvoke(
      CitationChannels.parseBibtex,
      ParseBibtexRequestSchema,
      ParseBibtexResultSchema,
      { bibtex }
    ),

  formatCitation: (entry: CitationEntry, style: CitationStyle) =>
    validatedInvoke(
      CitationChannels.formatCitation,
      FormatCitationRequestSchema,
      FormatCitationResultSchema,
      { entry, style }
    ),

  generateBibliography: (entries: CitationEntry[], style: CitationStyle) =>
    validatedInvoke(
      CitationChannels.generateBibliography,
      GenerateBibliographyRequestSchema,
      GenerateBibliographyResultSchema,
      { entries, style }
    ),
};
