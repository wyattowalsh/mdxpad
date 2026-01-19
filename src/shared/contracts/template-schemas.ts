/**
 * Template Library - IPC Contracts and Type Definitions
 *
 * Feature: 016-template-library
 * Phase: 1 - Design
 *
 * CONSTITUTION COMPLIANCE (Article III.3):
 * - All IPC payloads MUST be validated using `schema.safeParse()` before processing
 * - Handlers MUST return TemplateErrorResponse for validation failures
 * - Both request and response payloads require zod validation
 *
 * This file defines the TypeScript types and Zod schemas for template
 * operations. Implementation pattern:
 *
 *   const result = TemplateRequestSchema.safeParse(payload);
 *   if (!result.success) {
 *     return { success: false, error: result.error.message, code: 'VALIDATION_ERROR' };
 *   }
 */

import { z } from 'zod';

// =============================================================================
// Enums
// =============================================================================

/**
 * Template category enumeration
 */
export const TemplateCategorySchema = z.enum([
  'blog',
  'documentation',
  'presentation',
  'notes',
  'tutorial',
  'custom',
]);

export type TemplateCategory = z.infer<typeof TemplateCategorySchema>;

// =============================================================================
// Core Entities
// =============================================================================

/**
 * Template variable for dynamic substitution
 */
export const TemplateVariableSchema = z.object({
  /** Variable identifier (alphanumeric, underscores allowed) */
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: 'Variable name must start with letter/underscore, contain only alphanumeric/underscores',
  }),
  /** Help text shown in variable dialog */
  description: z.string().max(200).optional(),
  /** Default value if user leaves blank */
  default: z.string().optional(),
  /** If true, user must provide value */
  required: z.boolean().default(false),
});

export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;

/**
 * Template metadata (for listing without full content)
 */
export const TemplateMetadataSchema = z.object({
  /** Unique identifier */
  id: z.string().min(1).max(100),
  /** Display name */
  name: z.string().min(1).max(100),
  /** Purpose and use case */
  description: z.string().min(1).max(500),
  /** Organizational grouping */
  category: TemplateCategorySchema,
  /** Searchable keywords */
  tags: z.array(z.string().max(30)).max(10).default([]),
  /** Creator attribution */
  author: z.string().max(100).optional(),
  /** True if bundled with app */
  isBuiltIn: z.boolean(),
});

export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;

/**
 * Full template entity
 */
export const TemplateSchema = TemplateMetadataSchema.extend({
  /** Semantic version */
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  /** Dynamic variables for substitution */
  variables: z.array(TemplateVariableSchema).default([]),
  /** MDX document content with placeholders */
  content: z.string().min(1),
  /** Creation timestamp */
  createdAt: z.coerce.date(),
  /** Last modification timestamp */
  updatedAt: z.coerce.date(),
  /** Absolute path to .mdxt file */
  filePath: z.string(),
});

export type Template = z.infer<typeof TemplateSchema>;

// =============================================================================
// IPC Channel: mdxpad:template
// =============================================================================

/**
 * Template source filter
 */
export const TemplateSourceSchema = z.enum(['all', 'builtin', 'custom']);
export type TemplateSource = z.infer<typeof TemplateSourceSchema>;

/**
 * List templates request
 */
export const TemplateListRequestSchema = z.object({
  action: z.literal('list'),
  source: TemplateSourceSchema.default('all'),
});

export type TemplateListRequest = z.infer<typeof TemplateListRequestSchema>;

/**
 * List templates response
 */
export const TemplateListResponseSchema = z.object({
  success: z.literal(true),
  templates: z.array(TemplateMetadataSchema),
});

export type TemplateListResponse = z.infer<typeof TemplateListResponseSchema>;

/**
 * Get single template request
 */
export const TemplateGetRequestSchema = z.object({
  action: z.literal('get'),
  id: z.string().min(1),
});

export type TemplateGetRequest = z.infer<typeof TemplateGetRequestSchema>;

/**
 * Get template response
 */
export const TemplateGetResponseSchema = z.object({
  success: z.literal(true),
  template: TemplateSchema,
});

export type TemplateGetResponse = z.infer<typeof TemplateGetResponseSchema>;

/**
 * Save template request (create or update)
 */
export const TemplateSaveRequestSchema = z.object({
  action: z.literal('save'),
  template: z.object({
    id: z.string().optional(), // Optional for new templates
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    category: TemplateCategorySchema,
    tags: z.array(z.string().max(30)).max(10).default([]),
    variables: z.array(TemplateVariableSchema).default([]),
    content: z.string().min(1),
  }),
  /** If true, replace existing template with same name */
  replace: z.boolean().default(false),
});

export type TemplateSaveRequest = z.infer<typeof TemplateSaveRequestSchema>;

/**
 * Save template response
 */
export const TemplateSaveResponseSchema = z.object({
  success: z.literal(true),
  template: TemplateMetadataSchema,
});

export type TemplateSaveResponse = z.infer<typeof TemplateSaveResponseSchema>;

/**
 * Delete template request
 */
export const TemplateDeleteRequestSchema = z.object({
  action: z.literal('delete'),
  id: z.string().min(1),
});

export type TemplateDeleteRequest = z.infer<typeof TemplateDeleteRequestSchema>;

/**
 * Delete template response
 */
export const TemplateDeleteResponseSchema = z.object({
  success: z.literal(true),
  id: z.string(),
});

export type TemplateDeleteResponse = z.infer<typeof TemplateDeleteResponseSchema>;

/**
 * Import template request
 */
export const TemplateImportRequestSchema = z.object({
  action: z.literal('import'),
  /** Absolute path to .mdxt file */
  path: z.string().min(1),
  /** If true, replace existing template with same name */
  replace: z.boolean().default(false),
});

export type TemplateImportRequest = z.infer<typeof TemplateImportRequestSchema>;

/**
 * Import template response
 */
export const TemplateImportResponseSchema = z.object({
  success: z.literal(true),
  template: TemplateMetadataSchema,
});

export type TemplateImportResponse = z.infer<typeof TemplateImportResponseSchema>;

/**
 * Export template request
 */
export const TemplateExportRequestSchema = z.object({
  action: z.literal('export'),
  id: z.string().min(1),
  /** Absolute path to save .mdxt file */
  path: z.string().min(1),
});

export type TemplateExportRequest = z.infer<typeof TemplateExportRequestSchema>;

/**
 * Export template response
 */
export const TemplateExportResponseSchema = z.object({
  success: z.literal(true),
  path: z.string(),
});

export type TemplateExportResponse = z.infer<typeof TemplateExportResponseSchema>;

/**
 * Validate template content request
 */
export const TemplateValidateRequestSchema = z.object({
  action: z.literal('validate'),
  content: z.string(),
});

export type TemplateValidateRequest = z.infer<typeof TemplateValidateRequestSchema>;

/**
 * Validate template response
 */
export const TemplateValidateResponseSchema = z.object({
  success: z.literal(true),
  valid: z.boolean(),
  errors: z.array(z.string()).default([]),
});

export type TemplateValidateResponse = z.infer<typeof TemplateValidateResponseSchema>;

/**
 * Union of all template request types
 */
export const TemplateRequestSchema = z.discriminatedUnion('action', [
  TemplateListRequestSchema,
  TemplateGetRequestSchema,
  TemplateSaveRequestSchema,
  TemplateDeleteRequestSchema,
  TemplateImportRequestSchema,
  TemplateExportRequestSchema,
  TemplateValidateRequestSchema,
]);

export type TemplateRequest = z.infer<typeof TemplateRequestSchema>;

/**
 * Error response (for all failed operations)
 */
export const TemplateErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    'NOT_FOUND',
    'ALREADY_EXISTS',
    'VALIDATION_ERROR',
    'PERMISSION_DENIED',
    'FILE_ERROR',
    'PARSE_ERROR',
  ]),
});

export type TemplateErrorResponse = z.infer<typeof TemplateErrorResponseSchema>;

// =============================================================================
// Variable Substitution
// =============================================================================

/**
 * Variable values for substitution
 */
export const VariableValuesSchema = z.record(z.string(), z.string());
export type VariableValues = z.infer<typeof VariableValuesSchema>;

/**
 * Document creation from template request
 */
export const CreateFromTemplateRequestSchema = z.object({
  templateId: z.string().min(1),
  variables: VariableValuesSchema,
  /** Optional save path (if not provided, creates untitled document) */
  savePath: z.string().optional(),
});

export type CreateFromTemplateRequest = z.infer<typeof CreateFromTemplateRequestSchema>;

/**
 * Document creation response
 */
export const CreateFromTemplateResponseSchema = z.object({
  success: z.literal(true),
  content: z.string(),
  path: z.string().optional(),
});

export type CreateFromTemplateResponse = z.infer<typeof CreateFromTemplateResponseSchema>;

// =============================================================================
// File Dialog Schemas
// =============================================================================

/**
 * Template open dialog request (for importing templates)
 */
export const TemplateOpenDialogRequestSchema = z.object({
  action: z.literal('showOpenDialog'),
});

export type TemplateOpenDialogRequest = z.infer<typeof TemplateOpenDialogRequestSchema>;

/**
 * Template open dialog response
 */
export const TemplateOpenDialogResponseSchema = z.object({
  success: z.literal(true),
  /** Selected file path, or null if canceled */
  path: z.string().nullable(),
  canceled: z.boolean(),
});

export type TemplateOpenDialogResponse = z.infer<typeof TemplateOpenDialogResponseSchema>;

/**
 * Template save dialog request (for exporting templates)
 */
export const TemplateSaveDialogRequestSchema = z.object({
  action: z.literal('showSaveDialog'),
  /** Suggested file name (without path) */
  defaultName: z.string().optional(),
});

export type TemplateSaveDialogRequest = z.infer<typeof TemplateSaveDialogRequestSchema>;

/**
 * Template save dialog response
 */
export const TemplateSaveDialogResponseSchema = z.object({
  success: z.literal(true),
  /** Selected file path, or null if canceled */
  path: z.string().nullable(),
  canceled: z.boolean(),
});

export type TemplateSaveDialogResponse = z.infer<typeof TemplateSaveDialogResponseSchema>;

// =============================================================================
// IPC Channel Constants
// =============================================================================

/**
 * IPC channel name for template operations
 * Per Constitution Article III.3: mdxpad:<domain>:<action>
 */
export const TEMPLATE_IPC_CHANNEL = 'mdxpad:template' as const;

/**
 * IPC channel for document creation from template
 */
export const TEMPLATE_CREATE_CHANNEL = 'mdxpad:template:create' as const;
