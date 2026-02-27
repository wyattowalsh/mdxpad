import { z } from 'zod';

export const DocumentMetadataSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  filePath: z.string().min(1),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  rootPath: z.string().min(1),
  documents: z.array(DocumentMetadataSchema),
  activeDocumentId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const AISessionSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  provider: z.string().min(1),
  model: z.string().min(1),
  contextDocumentIds: z.array(z.string().uuid()),
  startedAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),
});
export type AISession = z.infer<typeof AISessionSchema>;

export const PdfExportPresetOptionsSchema = z
  .object({
    pageSize: z.enum(['A4', 'Letter']).optional(),
    marginInches: z.number().min(0).max(3).optional(),
    fontSizePt: z.number().min(8).max(24).optional(),
    fontFamily: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    author: z.string().min(1).optional(),
    subject: z.string().min(1).optional(),
  })
  .catchall(z.unknown());
export type PdfExportPresetOptions = z.infer<typeof PdfExportPresetOptionsSchema>;

export const DocxExportPresetOptionsSchema = z
  .object({
    title: z.string().min(1).optional(),
    author: z.string().min(1).optional(),
    includeToc: z.boolean().optional(),
    headingBaseLevel: z.number().int().min(1).max(6).optional(),
    embedImages: z.boolean().optional(),
  })
  .catchall(z.unknown());
export type DocxExportPresetOptions = z.infer<typeof DocxExportPresetOptionsSchema>;

const ExportPresetBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

const TextExportPresetSchema = ExportPresetBaseSchema.extend({
  format: z.enum(['html', 'markdown', 'mdx']),
  options: z.record(z.unknown()),
});

const PdfExportPresetSchema = ExportPresetBaseSchema.extend({
  format: z.literal('pdf'),
  options: PdfExportPresetOptionsSchema,
});

const DocxExportPresetSchema = ExportPresetBaseSchema.extend({
  format: z.literal('docx'),
  options: DocxExportPresetOptionsSchema,
});

export const ExportPresetSchema = z.discriminatedUnion('format', [
  TextExportPresetSchema,
  PdfExportPresetSchema,
  DocxExportPresetSchema,
]);
export type ExportPreset = z.infer<typeof ExportPresetSchema>;

export const PluginConfigSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9._-]+$/),
  enabled: z.boolean(),
  version: z.string().min(1).optional(),
  options: z.record(z.unknown()),
});
export type PluginConfig = z.infer<typeof PluginConfigSchema>;

export const ValidationBoundaryIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  code: z.string(),
  message: z.string(),
});
export type ValidationBoundaryIssue = z.infer<typeof ValidationBoundaryIssueSchema>;

export const ValidationBoundaryErrorSchema = z.object({
  code: z.literal('VALIDATION_FAILED'),
  schema: z.string().min(1),
  message: z.string().min(1),
  issues: z.array(ValidationBoundaryIssueSchema),
});
export type ValidationBoundaryError = z.infer<typeof ValidationBoundaryErrorSchema>;
export type ValidationBoundaryResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ValidationBoundaryError };

export function createValidationBoundaryError(
  schema: string,
  error: z.ZodError
): ValidationBoundaryError {
  return {
    code: 'VALIDATION_FAILED',
    schema,
    message: `Validation failed for ${schema}`,
    issues: error.issues.map((issue) => ({
      path: issue.path,
      code: issue.code,
      message: issue.message,
    })),
  };
}

export function safeParseWithValidationBoundary<TOutput>(
  schemaName: string,
  schema: z.ZodType<TOutput, z.ZodTypeDef, unknown>,
  input: unknown
): ValidationBoundaryResult<TOutput> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  return {
    ok: false,
    error: createValidationBoundaryError(schemaName, result.error),
  };
}
