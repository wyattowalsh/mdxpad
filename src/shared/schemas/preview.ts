/**
 * Preview Validation Schemas
 *
 * Zod schemas for validating preview-related messages.
 * Security-sensitive envelope objects are strict (unknown keys rejected).
 * Flexible payload fields (e.g., frontmatter) remain explicitly dynamic.
 * @module shared/schemas/preview
 */

import { z } from 'zod';

// ============================================================================
// Worker Message Schemas
// ============================================================================

export const compileRequestSchema = z
  .object({
    id: z.string().uuid(),
    source: z.string(),
    pluginConfig: z
      .object({
        plugins: z
          .record(
            z
              .object({
                enabled: z.boolean().optional(),
                options: z.unknown().optional(),
              })
              .strict()
          )
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const compileErrorSchema = z
  .object({
    message: z.string(),
    line: z.number().optional(),
    column: z.number().optional(),
    source: z.string().optional(),
  })
  .strict();

export const compileResponseSuccessSchema = z
  .object({
    id: z.string().uuid(),
    ok: z.literal(true),
    code: z.string(),
    // Frontmatter keys are intentionally dynamic user content.
    frontmatter: z.record(z.unknown()),
  })
  .strict();

export const compileResponseFailureSchema = z
  .object({
    id: z.string().uuid(),
    ok: z.literal(false),
    errors: z.array(compileErrorSchema),
  })
  .strict();

export const compileResponseSchema = z.discriminatedUnion('ok', [
  compileResponseSuccessSchema,
  compileResponseFailureSchema,
]);

// ============================================================================
// Iframe Message Schemas
// ============================================================================

export const renderCommandSchema = z
  .object({
    type: z.literal('render'),
    code: z.string(),
    // Frontmatter keys are intentionally dynamic user content.
    frontmatter: z.record(z.unknown()),
  })
  .strict();

export const themeCommandSchema = z
  .object({
    type: z.literal('theme'),
    value: z.enum(['light', 'dark']),
  })
  .strict();

export const scrollCommandSchema = z
  .object({
    type: z.literal('scroll'),
    ratio: z.number().min(0).max(1),
  })
  .strict();

export const parentToIframeMessageSchema = z.discriminatedUnion('type', [
  renderCommandSchema,
  themeCommandSchema,
  scrollCommandSchema,
]);

export const readySignalSchema = z
  .object({
    type: z.literal('ready'),
  })
  .strict();

export const sizeSignalSchema = z
  .object({
    type: z.literal('size'),
    height: z.number(),
  })
  .strict();

export const runtimeErrorSignalSchema = z
  .object({
    type: z.literal('runtime-error'),
    message: z.string(),
    componentStack: z.string().optional(),
  })
  .strict();

/**
 * Schema for scroll report signal.
 * Feature: 008-bidirectional-sync
 */
export const scrollReportSignalSchema = z
  .object({
    type: z.literal('scroll-report'),
    ratio: z.number().min(0).max(1),
    scrollTop: z.number().min(0),
    scrollHeight: z.number().min(0),
    clientHeight: z.number().min(0),
  })
  .strict();

export const openDocumentSignalSchema = z
  .object({
    type: z.literal('open-document'),
    href: z.string().min(1).max(500),
  })
  .strict();

export const iframeToParentMessageSchema = z.discriminatedUnion('type', [
  readySignalSchema,
  sizeSignalSchema,
  runtimeErrorSignalSchema,
  scrollReportSignalSchema,
  openDocumentSignalSchema,
]);

// ============================================================================
// Type Exports
// ============================================================================

export type CompileRequest = z.infer<typeof compileRequestSchema>;
export type CompileError = z.infer<typeof compileErrorSchema>;
export type CompileResponseSuccess = z.infer<typeof compileResponseSuccessSchema>;
export type CompileResponseFailure = z.infer<typeof compileResponseFailureSchema>;
export type CompileResponse = z.infer<typeof compileResponseSchema>;
export type RenderCommand = z.infer<typeof renderCommandSchema>;
export type ThemeCommand = z.infer<typeof themeCommandSchema>;
export type ScrollCommand = z.infer<typeof scrollCommandSchema>;
export type ParentToIframeMessage = z.infer<typeof parentToIframeMessageSchema>;
export type ReadySignal = z.infer<typeof readySignalSchema>;
export type SizeSignal = z.infer<typeof sizeSignalSchema>;
export type RuntimeErrorSignal = z.infer<typeof runtimeErrorSignalSchema>;
export type ScrollReportSignal = z.infer<typeof scrollReportSignalSchema>;
export type OpenDocumentSignal = z.infer<typeof openDocumentSignalSchema>;
export type IframeToParentMessage = z.infer<typeof iframeToParentMessageSchema>;
