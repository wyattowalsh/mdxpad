import { ExportFormatSchema } from '@shared/contracts/file-schemas';
import { z } from 'zod';

import { ExportPresetSchema, type ExportPreset } from './root';

export { ExportPresetSchema };
export type { ExportPreset };

export const GeneratedDocumentFormatSchema = z.enum(['pdf', 'docx']);
export type GeneratedDocumentFormat = z.infer<typeof GeneratedDocumentFormatSchema>;

export const ExportGenerationModeSchema = z.enum(['native', 'llm']);
export type ExportGenerationMode = z.infer<typeof ExportGenerationModeSchema>;

export const ExportJobStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
]);
export type ExportJobStatus = z.infer<typeof ExportJobStatusSchema>;

export const ExportLlmModelSchema = z.object({
  providerId: z.string().uuid().optional(),
  modelId: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  promptTemplate: z.string().min(1).optional(),
});
export type ExportLlmModel = z.infer<typeof ExportLlmModelSchema>;

export const ExportJobSchema = z
  .object({
    id: z.string().uuid(),
    preset: ExportPresetSchema,
    format: ExportFormatSchema,
    sourcePath: z.string().min(1).nullable().optional(),
    targetPath: z.string().min(1),
    generationMode: ExportGenerationModeSchema,
    llm: ExportLlmModelSchema.optional(),
    status: ExportJobStatusSchema,
    warnings: z.array(z.string()),
    errorMessage: z.string().min(1).optional(),
    createdAt: z.string().datetime(),
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
  })
  .superRefine((job, ctx) => {
    if (job.preset.format !== job.format) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['format'],
        message: 'Job format must match preset format',
      });
    }
  });
export type ExportJob = z.infer<typeof ExportJobSchema>;

export const ExportCliEventLevelSchema = z.enum(['info', 'warn', 'error', 'success']);
export type ExportCliEventLevel = z.infer<typeof ExportCliEventLevelSchema>;

export const ExportCliEventSchema = z.object({
  level: ExportCliEventLevelSchema,
  message: z.string().min(1),
  timestamp: z.string().datetime(),
});
export type ExportCliEvent = z.infer<typeof ExportCliEventSchema>;

export const ExportCliOutputSchema = z.object({
  job: ExportJobSchema,
  exitCode: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  artifactPath: z.string().min(1).optional(),
  commandLine: z.string().min(1).optional(),
  pid: z.number().int().positive().optional(),
  background: z.boolean().optional(),
  events: z.array(ExportCliEventSchema),
});
export type ExportCliOutput = z.infer<typeof ExportCliOutputSchema>;
