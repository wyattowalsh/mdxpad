import { z } from 'zod';

import {
  ExportCliOutputSchema,
  ExportJobSchema,
  ExportJobStatusSchema,
} from '../types/export-model';
import { ExportPresetSchema } from '../types/root';

// ============================================================================
// Export IPC Channel Constants (single source of truth)
// ============================================================================

export const EXPORT_IPC_CHANNELS = {
  jobLifecycle: 'mdxpad:export:job-lifecycle',
  presetCrud: 'mdxpad:export:preset-crud',
  cliInvoke: 'mdxpad:export:cli-invoke',
  llmsGenerate: 'mdxpad:export:llms-generate',
} as const;

export const ExportJobIdSchema = z.string().uuid();
export type ExportJobId = z.infer<typeof ExportJobIdSchema>;

/** Separate ID schema for export presets (distinct domain from job IDs) */
export const ExportPresetIdSchema = z.string().uuid();
export type ExportPresetId = z.infer<typeof ExportPresetIdSchema>;

// ============================================================================
// Export Job Lifecycle
// ============================================================================

export const ExportJobCreateRequestSchema = z.object({
  action: z.literal('create'),
  job: ExportJobSchema,
});
export type ExportJobCreateRequest = z.infer<typeof ExportJobCreateRequestSchema>;

export const ExportJobGetRequestSchema = z.object({
  action: z.literal('get'),
  jobId: ExportJobIdSchema,
});
export type ExportJobGetRequest = z.infer<typeof ExportJobGetRequestSchema>;

export const ExportJobListRequestSchema = z.object({
  action: z.literal('list'),
  status: ExportJobStatusSchema.optional(),
});
export type ExportJobListRequest = z.infer<typeof ExportJobListRequestSchema>;

export const ExportJobCancelRequestSchema = z.object({
  action: z.literal('cancel'),
  jobId: ExportJobIdSchema,
});
export type ExportJobCancelRequest = z.infer<typeof ExportJobCancelRequestSchema>;

export const ExportJobUpdateStatusRequestSchema = z.object({
  action: z.literal('update-status'),
  jobId: ExportJobIdSchema,
  status: ExportJobStatusSchema,
  warnings: z.array(z.string()).optional(),
  errorMessage: z.string().min(1).optional(),
});
export type ExportJobUpdateStatusRequest = z.infer<typeof ExportJobUpdateStatusRequestSchema>;

export const ExportJobLifecycleRequestSchema = z.discriminatedUnion('action', [
  ExportJobCreateRequestSchema,
  ExportJobGetRequestSchema,
  ExportJobListRequestSchema,
  ExportJobCancelRequestSchema,
  ExportJobUpdateStatusRequestSchema,
]);
export type ExportJobLifecycleRequest = z.infer<typeof ExportJobLifecycleRequestSchema>;

export const ExportJobLifecycleErrorCodeSchema = z.enum([
  'NOT_FOUND',
  'INVALID_STATE',
  'VALIDATION_ERROR',
  'INTERNAL_ERROR',
]);
export type ExportJobLifecycleErrorCode = z.infer<typeof ExportJobLifecycleErrorCodeSchema>;

/**
 * Cannot use z.discriminatedUnion — two `ok: true` variants exist
 * (single job vs. job list). The ok/false variant handles errors.
 */
export const ExportJobLifecycleResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    job: ExportJobSchema,
  }),
  z.object({
    ok: z.literal(true),
    jobs: z.array(ExportJobSchema),
  }),
  z.object({
    ok: z.literal(false),
    code: ExportJobLifecycleErrorCodeSchema,
    error: z.string().min(1),
  }),
]);
export type ExportJobLifecycleResponse = z.infer<typeof ExportJobLifecycleResponseSchema>;

// ============================================================================
// Export Preset CRUD
// ============================================================================

export const ExportPresetCreateRequestSchema = z.object({
  action: z.literal('create'),
  preset: ExportPresetSchema,
});
export type ExportPresetCreateRequest = z.infer<typeof ExportPresetCreateRequestSchema>;

export const ExportPresetGetRequestSchema = z.object({
  action: z.literal('get'),
  presetId: ExportPresetIdSchema,
});
export type ExportPresetGetRequest = z.infer<typeof ExportPresetGetRequestSchema>;

export const ExportPresetListRequestSchema = z.object({
  action: z.literal('list'),
});
export type ExportPresetListRequest = z.infer<typeof ExportPresetListRequestSchema>;

export const ExportPresetUpdateRequestSchema = z.object({
  action: z.literal('update'),
  presetId: ExportPresetIdSchema,
  preset: ExportPresetSchema,
});
export type ExportPresetUpdateRequest = z.infer<typeof ExportPresetUpdateRequestSchema>;

export const ExportPresetDeleteRequestSchema = z.object({
  action: z.literal('delete'),
  presetId: ExportPresetIdSchema,
});
export type ExportPresetDeleteRequest = z.infer<typeof ExportPresetDeleteRequestSchema>;

export const ExportPresetCrudRequestSchema = z.discriminatedUnion('action', [
  ExportPresetCreateRequestSchema,
  ExportPresetGetRequestSchema,
  ExportPresetListRequestSchema,
  ExportPresetUpdateRequestSchema,
  ExportPresetDeleteRequestSchema,
]);
export type ExportPresetCrudRequest = z.infer<typeof ExportPresetCrudRequestSchema>;

export const ExportPresetCrudErrorCodeSchema = z.enum([
  'NOT_FOUND',
  'ALREADY_EXISTS',
  'VALIDATION_ERROR',
  'INTERNAL_ERROR',
]);
export type ExportPresetCrudErrorCode = z.infer<typeof ExportPresetCrudErrorCodeSchema>;

/**
 * Cannot use z.discriminatedUnion — three `ok: true` variants exist
 * (single preset, preset list, deleted ID). The ok/false variant handles errors.
 */
export const ExportPresetCrudResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    preset: ExportPresetSchema,
  }),
  z.object({
    ok: z.literal(true),
    presets: z.array(ExportPresetSchema),
  }),
  z.object({
    ok: z.literal(true),
    deletedId: ExportPresetIdSchema,
  }),
  z.object({
    ok: z.literal(false),
    code: ExportPresetCrudErrorCodeSchema,
    error: z.string().min(1),
  }),
]);
export type ExportPresetCrudResponse = z.infer<typeof ExportPresetCrudResponseSchema>;

// ============================================================================
// Export CLI Invocation
// ============================================================================

export const ExportCliInvokeRequestSchema = z.object({
  job: ExportJobSchema,
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().positive().max(900_000).optional(),
  background: z.boolean().optional(),
  content: z.string().optional(),
});
export type ExportCliInvokeRequest = z.infer<typeof ExportCliInvokeRequestSchema>;

export const ExportCliInvokeErrorCodeSchema = z.enum([
  'SPAWN_FAILED',
  'TIMEOUT',
  'NON_ZERO_EXIT',
  'VALIDATION_ERROR',
]);
export type ExportCliInvokeErrorCode = z.infer<typeof ExportCliInvokeErrorCodeSchema>;

export const ExportCliInvokeResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    output: ExportCliOutputSchema,
  }),
  z.object({
    ok: z.literal(false),
    code: ExportCliInvokeErrorCodeSchema,
    error: z.string().min(1),
    output: ExportCliOutputSchema.optional(),
  }),
]);
export type ExportCliInvokeResponse = z.infer<typeof ExportCliInvokeResponseSchema>;

// ============================================================================
// llms.txt / llms-full.txt Generation
// ============================================================================

export const LlmsTargetSchema = z.enum(['llms.txt', 'llms-full.txt']);
export type LlmsTarget = z.infer<typeof LlmsTargetSchema>;

export const LlmsGenerationRequestSchema = z.object({
  action: z.literal('generate'),
  target: LlmsTargetSchema,
  sourcePath: z.string().min(1).nullable().optional(),
  content: z.string(),
  outputPath: z.string().min(1),
  overwrite: z.boolean().default(false),
  tagFilter: z.array(z.string().min(1)).optional(),
});
export type LlmsGenerationRequest = z.infer<typeof LlmsGenerationRequestSchema>;

export const LlmsGenerationErrorCodeSchema = z.enum([
  'WRITE_FAILED',
  'FILE_EXISTS',
  'VALIDATION_ERROR',
  'INTERNAL_ERROR',
]);
export type LlmsGenerationErrorCode = z.infer<typeof LlmsGenerationErrorCodeSchema>;

export const LlmsGenerationResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    target: LlmsTargetSchema,
    path: z.string().min(1),
    bytesWritten: z.number().int().nonnegative(),
  }),
  z.object({
    ok: z.literal(false),
    code: LlmsGenerationErrorCodeSchema,
    error: z.string().min(1),
  }),
]);
export type LlmsGenerationResponse = z.infer<typeof LlmsGenerationResponseSchema>;
