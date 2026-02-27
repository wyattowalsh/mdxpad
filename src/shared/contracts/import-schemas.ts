/**
 * Import IPC contract schemas.
 * Zod schemas for validating all content import IPC payloads.
 *
 * @module import-schemas
 */

import { z } from 'zod';

// ============================================================================
// Channel Definitions
// ============================================================================

export const ImportChannels = {
  fromHtml: 'mdxpad:import:from-html',
  fromNotion: 'mdxpad:import:from-notion',
  fromGoogleDocs: 'mdxpad:import:from-google-docs',
} as const;

// ============================================================================
// Request Schemas
// ============================================================================

export const ImportFromHtmlRequestSchema = z.object({
  html: z.string().min(1),
});

export const ImportFromNotionRequestSchema = z.object({
  pageId: z.string().min(1),
  apiKey: z.string().min(1),
});

export const ImportFromGoogleDocsRequestSchema = z.object({
  docId: z.string().min(1),
  accessToken: z.string().min(1),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const ImportResultSchema = z.object({
  content: z.string(),
  title: z.string().optional(),
  warnings: z.array(z.string()),
});

export const ImportFromHtmlResponseSchema = ImportResultSchema;
export const ImportFromNotionResponseSchema = ImportResultSchema;
export const ImportFromGoogleDocsResponseSchema = ImportResultSchema;

// ============================================================================
// Error Schema
// ============================================================================

export const ImportErrorSchema = z.object({
  code: z.enum([
    'INVALID_HTML',
    'NOTION_API_ERROR',
    'GOOGLE_DOCS_API_ERROR',
    'CONVERSION_FAILED',
    'UNAUTHORIZED',
    'NOT_FOUND',
    'UNKNOWN',
  ]),
  message: z.string(),
});

export type ImportError = z.infer<typeof ImportErrorSchema>;

// ============================================================================
// Type Exports
// ============================================================================

export type ImportFromHtmlRequest = z.infer<typeof ImportFromHtmlRequestSchema>;
export type ImportFromNotionRequest = z.infer<typeof ImportFromNotionRequestSchema>;
export type ImportFromGoogleDocsRequest = z.infer<typeof ImportFromGoogleDocsRequestSchema>;
export type ImportResult = z.infer<typeof ImportResultSchema>;
