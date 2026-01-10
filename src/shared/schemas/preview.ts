/**
 * Preview Validation Schemas
 *
 * Zod schemas for validating preview-related messages.
 * @module shared/schemas/preview
 */

import { z } from 'zod';

// ============================================================================
// Worker Message Schemas
// ============================================================================

export const compileRequestSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
});

export const compileErrorSchema = z.object({
  message: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
  source: z.string().optional(),
});

export const compileResponseSuccessSchema = z.object({
  id: z.string().uuid(),
  ok: z.literal(true),
  code: z.string(),
  frontmatter: z.record(z.unknown()),
});

export const compileResponseFailureSchema = z.object({
  id: z.string().uuid(),
  ok: z.literal(false),
  errors: z.array(compileErrorSchema),
});

export const compileResponseSchema = z.discriminatedUnion('ok', [
  compileResponseSuccessSchema,
  compileResponseFailureSchema,
]);

// ============================================================================
// Iframe Message Schemas
// ============================================================================

export const renderCommandSchema = z.object({
  type: z.literal('render'),
  code: z.string(),
  frontmatter: z.record(z.unknown()),
});

export const themeCommandSchema = z.object({
  type: z.literal('theme'),
  value: z.enum(['light', 'dark']),
});

export const scrollCommandSchema = z.object({
  type: z.literal('scroll'),
  ratio: z.number().min(0).max(1),
});

export const parentToIframeMessageSchema = z.discriminatedUnion('type', [
  renderCommandSchema,
  themeCommandSchema,
  scrollCommandSchema,
]);

export const readySignalSchema = z.object({
  type: z.literal('ready'),
});

export const sizeSignalSchema = z.object({
  type: z.literal('size'),
  height: z.number(),
});

export const runtimeErrorSignalSchema = z.object({
  type: z.literal('runtime-error'),
  message: z.string(),
  componentStack: z.string().optional(),
});

export const iframeToParentMessageSchema = z.discriminatedUnion('type', [
  readySignalSchema,
  sizeSignalSchema,
  runtimeErrorSignalSchema,
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
export type IframeToParentMessage = z.infer<typeof iframeToParentMessageSchema>;
