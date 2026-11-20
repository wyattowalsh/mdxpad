/**
 * Citation IPC contract schemas.
 * Zod schemas for validating all citation management IPC payloads.
 *
 * @module citation-schemas
 */

import { z } from 'zod';

// ============================================================================
// Channel Definitions
// ============================================================================

export const CitationChannels = {
  parseBibtex: 'mdxpad:citation:parse-bibtex',
  formatCitation: 'mdxpad:citation:format',
  generateBibliography: 'mdxpad:citation:bibliography',
} as const;

// ============================================================================
// Shared Schemas
// ============================================================================

export const CitationStyleSchema = z.enum(['apa', 'mla', 'chicago', 'ieee']);

export const CitationEntrySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().optional(),
  author: z
    .array(
      z.object({
        given: z.string().optional(),
        family: z.string().optional(),
      })
    )
    .optional(),
  year: z.number().optional(),
  journal: z.string().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  publisher: z.string().optional(),
  booktitle: z.string().optional(),
  school: z.string().optional(),
  institution: z.string().optional(),
  editor: z.string().optional(),
  howpublished: z.string().optional(),
  series: z.string().optional(),
  address: z.string().optional(),
  edition: z.string().optional(),
  organization: z.string().optional(),
  chapter: z.string().optional(),
  month: z.string().optional(),
  subtitle: z.string().optional(),
  translator: z.string().optional(),
  isbn: z.string().optional(),
  issn: z.string().optional(),
  eid: z.string().optional(),
  language: z.string().optional(),
  urldate: z.string().optional(),
  version: z.string().optional(),
  venue: z.string().optional(),
  pagetotal: z.string().optional(),
  shorttitle: z.string().optional(),
  titleaddon: z.string().optional(),
  eventtitle: z.string().optional(),
  booksubtitle: z.string().optional(),
  maintitle: z.string().optional(),
  issuetitle: z.string().optional(),
  editora: z.string().optional(),
  annotator: z.string().optional(),
  commentator: z.string().optional(),
  holder: z.string().optional(),
  assignee: z.string().optional(),
  note: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
});

// ============================================================================
// Request Schemas
// ============================================================================

export const ParseBibtexRequestSchema = z.object({
  bibtex: z.string().min(1),
});

export const FormatCitationRequestSchema = z.object({
  entry: CitationEntrySchema,
  style: CitationStyleSchema,
});

export const GenerateBibliographyRequestSchema = z.object({
  entries: z.array(CitationEntrySchema).min(1),
  style: CitationStyleSchema,
});

// ============================================================================
// Response Schemas
// ============================================================================

export const ParseBibtexResponseSchema = z.object({
  entries: z.array(CitationEntrySchema),
  warnings: z.array(z.string()),
});

export const FormatCitationResponseSchema = z.object({
  formatted: z.string(),
  inlineRef: z.string(),
});

export const GenerateBibliographyResponseSchema = z.object({
  bibliography: z.string(),
  entryCount: z.number(),
});

// ============================================================================
// Error Schema
// ============================================================================

export const CitationErrorSchema = z.object({
  code: z.enum(['PARSE_ERROR', 'INVALID_STYLE', 'FORMAT_ERROR', 'UNKNOWN']),
  message: z.string(),
});

export type CitationError = z.infer<typeof CitationErrorSchema>;

// ============================================================================
// Type Exports
// ============================================================================

export type CitationStyle = z.infer<typeof CitationStyleSchema>;
export type CitationEntry = z.infer<typeof CitationEntrySchema>;
export type ParseBibtexRequest = z.infer<typeof ParseBibtexRequestSchema>;
export type ParseBibtexResponse = z.infer<typeof ParseBibtexResponseSchema>;
export type FormatCitationRequest = z.infer<typeof FormatCitationRequestSchema>;
export type FormatCitationResponse = z.infer<typeof FormatCitationResponseSchema>;
export type GenerateBibliographyRequest = z.infer<typeof GenerateBibliographyRequestSchema>;
export type GenerateBibliographyResponse = z.infer<typeof GenerateBibliographyResponseSchema>;
