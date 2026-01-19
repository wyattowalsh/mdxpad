/**
 * AI Provider Abstraction Layer Zod Validation Schemas
 *
 * Zod schemas for validating IPC payloads in the AI Provider system.
 * All schemas match the TypeScript types defined in types.ts.
 *
 * Per Constitution Article III Section 3.3:
 * - All payloads MUST be validated with zod on both ends
 *
 * @module src/shared/ai/schemas
 */

import { z } from 'zod';

// =============================================================================
// BASE ENUM SCHEMAS
// =============================================================================

/**
 * Supported AI provider types.
 */
export const ProviderTypeSchema = z.enum([
  'openai',
  'anthropic',
  'ollama',
  'lmstudio',
  'openai-compatible',
]);
export type ProviderTypeSchemaType = z.infer<typeof ProviderTypeSchema>;

/**
 * Connection status for a provider.
 */
export const ConnectionStatusSchema = z.enum([
  'connected',
  'disconnected',
  'error',
  'validating',
]);
export type ConnectionStatusSchemaType = z.infer<typeof ConnectionStatusSchema>;

/**
 * Type of AI operation performed.
 */
export const OperationTypeSchema = z.enum([
  'text-generation',
  'streaming-generation',
  'embedding',
  'image-generation',
  'agent-execution',
]);
export type OperationTypeSchemaType = z.infer<typeof OperationTypeSchema>;

/**
 * Time range for filtering usage statistics.
 */
export const TimeRangeSchema = z.enum(['day', 'week', 'month', 'all']);
export type TimeRangeSchemaType = z.infer<typeof TimeRangeSchema>;

/**
 * Capability flags for AI models.
 */
export const ProviderCapabilitySchema = z.enum([
  'text-generation',
  'streaming',
  'vision',
  'embeddings',
  'image-generation',
  'tool-use',
  'agents',
]);
export type ProviderCapabilitySchemaType = z.infer<typeof ProviderCapabilitySchema>;

/**
 * Storage type for credentials.
 */
export const StorageTypeSchema = z.enum(['persistent', 'session']);
export type StorageTypeSchemaType = z.infer<typeof StorageTypeSchema>;

/**
 * Onboarding outcome.
 */
export const OnboardingOutcomeSchema = z.enum(['success', 'failure', 'abandoned']);
export type OnboardingOutcomeSchemaType = z.infer<typeof OnboardingOutcomeSchema>;

/**
 * Onboarding step.
 */
export const OnboardingStepSchema = z.enum([
  'provider-selection',
  'credential-entry',
  'validation',
  'save',
]);
export type OnboardingStepSchemaType = z.infer<typeof OnboardingStepSchema>;

// =============================================================================
// BASE OBJECT SCHEMAS
// =============================================================================

/**
 * Capability constraints for partial support.
 */
export const CapabilityConstraintsSchema = z.object({
  maxImageSize: z.number().optional(),
  maxImageCount: z.number().optional(),
  supportedImageFormats: z.array(z.string()).optional(),
  embeddingDimensions: z.number().optional(),
  maxToolCount: z.number().optional(),
});
export type CapabilityConstraintsSchemaType = z.infer<typeof CapabilityConstraintsSchema>;

/**
 * Full Provider Configuration.
 */
export const ProviderConfigSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  type: ProviderTypeSchema,
  baseUrl: z.string().url().optional(),
  isActive: z.boolean(),
  status: ConnectionStatusSchema,
  lastConnectedAt: z.string().datetime().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProviderConfigSchemaType = z.infer<typeof ProviderConfigSchema>;

/**
 * Error response object used across multiple schemas.
 */
export const ErrorObjectSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryAfterSeconds: z.number().optional(),
  alternateProviders: z.array(z.string()).optional(),
});
export type ErrorObjectSchemaType = z.infer<typeof ErrorObjectSchema>;

/**
 * Usage token counts.
 */
export const UsageTokensSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
});
export type UsageTokensSchemaType = z.infer<typeof UsageTokensSchema>;

// =============================================================================
// PROVIDER MANAGEMENT SCHEMAS
// =============================================================================

/**
 * Response for listing all providers.
 */
export const ProviderListResponseSchema = z.object({
  providers: z.array(ProviderConfigSchema),
  activeProviderId: z.string().nullable(),
});
export type ProviderListResponseSchemaType = z.infer<typeof ProviderListResponseSchema>;

/**
 * Request to add a new provider.
 */
export const AddProviderRequestSchema = z.object({
  displayName: z.string().min(1).max(50),
  type: ProviderTypeSchema,
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
});
export type AddProviderRequestSchemaType = z.infer<typeof AddProviderRequestSchema>;

/**
 * Response for adding a new provider.
 */
export const AddProviderResponseSchema = z.object({
  success: z.boolean(),
  provider: ProviderConfigSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type AddProviderResponseSchemaType = z.infer<typeof AddProviderResponseSchema>;

/**
 * Request to update an existing provider.
 */
export const UpdateProviderRequestSchema = z.object({
  id: z.string().uuid(),
  updates: z.object({
    displayName: z.string().min(1).max(50).optional(),
    baseUrl: z.string().url().optional(),
    isActive: z.boolean().optional(),
  }),
});
export type UpdateProviderRequestSchemaType = z.infer<typeof UpdateProviderRequestSchema>;

/**
 * Response for updating a provider.
 */
export const UpdateProviderResponseSchema = z.object({
  success: z.boolean(),
  provider: ProviderConfigSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type UpdateProviderResponseSchemaType = z.infer<typeof UpdateProviderResponseSchema>;

/**
 * Request to remove a provider.
 */
export const RemoveProviderRequestSchema = z.object({
  id: z.string().uuid(),
});
export type RemoveProviderRequestSchemaType = z.infer<typeof RemoveProviderRequestSchema>;

/**
 * Response for removing a provider.
 */
export const RemoveProviderResponseSchema = z.object({
  success: z.boolean(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type RemoveProviderResponseSchemaType = z.infer<typeof RemoveProviderResponseSchema>;

/**
 * Request to set the active provider.
 */
export const SetActiveProviderRequestSchema = z.object({
  id: z.string().uuid(),
});
export type SetActiveProviderRequestSchemaType = z.infer<typeof SetActiveProviderRequestSchema>;

/**
 * Response for setting the active provider.
 */
export const SetActiveProviderResponseSchema = z.object({
  success: z.boolean(),
  activeProviderId: z.string().uuid().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type SetActiveProviderResponseSchemaType = z.infer<typeof SetActiveProviderResponseSchema>;

/**
 * Request to validate a provider's credentials.
 */
export const ValidateProviderRequestSchema = z.object({
  id: z.string().uuid(),
});
export type ValidateProviderRequestSchemaType = z.infer<typeof ValidateProviderRequestSchema>;

/**
 * Response for validating a provider.
 */
export const ValidateProviderResponseSchema = z.object({
  success: z.boolean(),
  status: ConnectionStatusSchema,
  models: z.array(z.string()).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryAfterSeconds: z.number().optional(),
  }).optional(),
});
export type ValidateProviderResponseSchemaType = z.infer<typeof ValidateProviderResponseSchema>;

// =============================================================================
// CREDENTIAL MANAGEMENT SCHEMAS
// =============================================================================

/**
 * Request to store a credential.
 */
export const SetCredentialRequestSchema = z.object({
  providerId: z.string().uuid(),
  apiKey: z.string().min(1),
});
export type SetCredentialRequestSchemaType = z.infer<typeof SetCredentialRequestSchema>;

/**
 * Response for storing a credential.
 */
export const SetCredentialResponseSchema = z.object({
  success: z.boolean(),
  storageType: StorageTypeSchema,
  keyPreview: z.string().length(4),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type SetCredentialResponseSchemaType = z.infer<typeof SetCredentialResponseSchema>;

/**
 * Request to check if a credential exists.
 */
export const HasCredentialRequestSchema = z.object({
  providerId: z.string().uuid(),
});
export type HasCredentialRequestSchemaType = z.infer<typeof HasCredentialRequestSchema>;

/**
 * Response for checking credential existence.
 */
export const HasCredentialResponseSchema = z.object({
  exists: z.boolean(),
  storageType: StorageTypeSchema.optional(),
  keyPreview: z.string().length(4).optional(),
});
export type HasCredentialResponseSchemaType = z.infer<typeof HasCredentialResponseSchema>;

/**
 * Request to clear a credential.
 */
export const ClearCredentialRequestSchema = z.object({
  providerId: z.string().uuid(),
});
export type ClearCredentialRequestSchemaType = z.infer<typeof ClearCredentialRequestSchema>;

/**
 * Response for clearing a credential.
 */
export const ClearCredentialResponseSchema = z.object({
  success: z.boolean(),
});
export type ClearCredentialResponseSchemaType = z.infer<typeof ClearCredentialResponseSchema>;

// =============================================================================
// AI GENERATION SCHEMAS
// =============================================================================

/**
 * Request for text generation (non-streaming).
 */
export const GenerateTextRequestSchema = z.object({
  prompt: z.string().min(1),
  modelId: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().optional(),
});
export type GenerateTextRequestSchemaType = z.infer<typeof GenerateTextRequestSchema>;

/**
 * Response for text generation.
 */
export const GenerateTextResponseSchema = z.object({
  success: z.boolean(),
  text: z.string().optional(),
  usage: UsageTokensSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryAfterSeconds: z.number().optional(),
    alternateProviders: z.array(z.string()).optional(),
  }).optional(),
});
export type GenerateTextResponseSchemaType = z.infer<typeof GenerateTextResponseSchema>;

/**
 * Request for streaming text generation.
 * Uses the same schema as non-streaming.
 */
export const GenerateStreamRequestSchema = GenerateTextRequestSchema;
export type GenerateStreamRequestSchemaType = z.infer<typeof GenerateStreamRequestSchema>;

/**
 * Initial response for streaming text generation.
 */
export const StreamInitResponseSchema = z.object({
  success: z.boolean(),
  streamId: z.string().uuid().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type StreamInitResponseSchemaType = z.infer<typeof StreamInitResponseSchema>;

/**
 * Stream chunk event schema.
 */
export const StreamChunkSchema = z.object({
  streamId: z.string().uuid(),
  chunk: z.string(),
  isComplete: z.boolean(),
});
export type StreamChunkSchemaType = z.infer<typeof StreamChunkSchema>;

/**
 * Stream complete event schema.
 */
export const StreamCompleteSchema = z.object({
  streamId: z.string().uuid(),
  usage: UsageTokensSchema,
});
export type StreamCompleteSchemaType = z.infer<typeof StreamCompleteSchema>;

/**
 * Stream error event schema.
 */
export const StreamErrorSchema = z.object({
  streamId: z.string().uuid(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type StreamErrorSchemaType = z.infer<typeof StreamErrorSchema>;

/**
 * Request for generating embeddings.
 */
export const GenerateEmbedRequestSchema = z.object({
  texts: z.array(z.string().min(1)).min(1).max(100),
  modelId: z.string().optional(),
});
export type GenerateEmbedRequestSchemaType = z.infer<typeof GenerateEmbedRequestSchema>;

/**
 * Response for generating embeddings.
 */
export const GenerateEmbedResponseSchema = z.object({
  success: z.boolean(),
  embeddings: z.array(z.array(z.number())).optional(),
  dimensions: z.number().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type GenerateEmbedResponseSchemaType = z.infer<typeof GenerateEmbedResponseSchema>;

/**
 * Image size options.
 */
export const ImageSizeSchema = z.enum([
  '256x256',
  '512x512',
  '1024x1024',
  '1792x1024',
  '1024x1792',
]);
export type ImageSizeSchemaType = z.infer<typeof ImageSizeSchema>;

/**
 * Image quality options.
 */
export const ImageQualitySchema = z.enum(['standard', 'hd']);
export type ImageQualitySchemaType = z.infer<typeof ImageQualitySchema>;

/**
 * Image style options.
 */
export const ImageStyleSchema = z.enum(['natural', 'vivid']);
export type ImageStyleSchemaType = z.infer<typeof ImageStyleSchema>;

/**
 * Request for image generation.
 */
export const GenerateImageRequestSchema = z.object({
  prompt: z.string().min(1),
  size: ImageSizeSchema.optional(),
  quality: ImageQualitySchema.optional(),
  style: ImageStyleSchema.optional(),
});
export type GenerateImageRequestSchemaType = z.infer<typeof GenerateImageRequestSchema>;

/**
 * Response for image generation.
 */
export const GenerateImageResponseSchema = z.object({
  success: z.boolean(),
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type GenerateImageResponseSchemaType = z.infer<typeof GenerateImageResponseSchema>;

// =============================================================================
// USAGE STATISTICS SCHEMAS
// =============================================================================

/**
 * Request to query usage statistics.
 */
export const QueryUsageRequestSchema = z.object({
  timeRange: TimeRangeSchema,
  providerId: z.string().uuid().optional(),
  operationType: OperationTypeSchema.optional(),
});
export type QueryUsageRequestSchemaType = z.infer<typeof QueryUsageRequestSchema>;

/**
 * Provider usage summary for statistics.
 */
export const ProviderUsageStatSchema = z.object({
  providerId: z.string(),
  providerName: z.string(),
  requestCount: z.number(),
  tokenCount: z.number(),
  estimatedCostUsd: z.number(),
});
export type ProviderUsageStatSchemaType = z.infer<typeof ProviderUsageStatSchema>;

/**
 * Operation usage summary for statistics.
 */
export const OperationUsageStatSchema = z.object({
  operationType: OperationTypeSchema,
  requestCount: z.number(),
  avgDurationMs: z.number(),
});
export type OperationUsageStatSchemaType = z.infer<typeof OperationUsageStatSchema>;

/**
 * Response for querying usage statistics.
 */
export const QueryUsageResponseSchema = z.object({
  success: z.boolean(),
  stats: z.object({
    totalRequests: z.number(),
    successfulRequests: z.number(),
    failedRequests: z.number(),
    totalTokens: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    estimatedCostUsd: z.number(),
    byProvider: z.array(ProviderUsageStatSchema),
    byOperation: z.array(OperationUsageStatSchema),
  }).optional(),
});
export type QueryUsageResponseSchemaType = z.infer<typeof QueryUsageResponseSchema>;

/**
 * Request to export usage data.
 */
export const ExportUsageRequestSchema = z.object({
  timeRange: TimeRangeSchema,
  providerId: z.string().uuid().optional(),
  format: z.enum(['json', 'csv']).optional(),
});
export type ExportUsageRequestSchemaType = z.infer<typeof ExportUsageRequestSchema>;

/**
 * Response for exporting usage data.
 */
export const ExportUsageResponseSchema = z.object({
  success: z.boolean(),
  data: z.string().optional(),
  filename: z.string().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type ExportUsageResponseSchemaType = z.infer<typeof ExportUsageResponseSchema>;

/**
 * Request to clear usage history.
 */
export const ClearUsageRequestSchema = z.object({
  providerId: z.string().uuid().optional(),
  olderThan: z.string().datetime().optional(),
});
export type ClearUsageRequestSchemaType = z.infer<typeof ClearUsageRequestSchema>;

/**
 * Response for clearing usage history.
 */
export const ClearUsageResponseSchema = z.object({
  success: z.boolean(),
  deletedCount: z.number().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type ClearUsageResponseSchemaType = z.infer<typeof ClearUsageResponseSchema>;

// =============================================================================
// CAPABILITY SCHEMAS
// =============================================================================

/**
 * Request to get model capabilities.
 */
export const GetCapabilityRequestSchema = z.object({
  providerId: z.string().uuid(),
  modelId: z.string(),
});
export type GetCapabilityRequestSchemaType = z.infer<typeof GetCapabilityRequestSchema>;

/**
 * Response for getting model capabilities.
 */
export const GetCapabilityResponseSchema = z.object({
  success: z.boolean(),
  capabilities: z.object({
    modelId: z.string(),
    capabilities: z.array(ProviderCapabilitySchema),
    contextWindow: z.number().optional(),
    maxOutputTokens: z.number().optional(),
    constraints: CapabilityConstraintsSchema.optional(),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type GetCapabilityResponseSchemaType = z.infer<typeof GetCapabilityResponseSchema>;

/**
 * Request to list models for a provider.
 */
export const ListModelsRequestSchema = z.object({
  providerId: z.string().uuid(),
});
export type ListModelsRequestSchemaType = z.infer<typeof ListModelsRequestSchema>;

/**
 * Model info in list response.
 */
export const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  capabilities: z.array(ProviderCapabilitySchema),
});
export type ModelInfoSchemaType = z.infer<typeof ModelInfoSchema>;

/**
 * Response for listing models.
 */
export const ListModelsResponseSchema = z.object({
  success: z.boolean(),
  models: z.array(ModelInfoSchema).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type ListModelsResponseSchemaType = z.infer<typeof ListModelsResponseSchema>;

/**
 * Request to refresh capability cache.
 */
export const RefreshCapabilityRequestSchema = z.object({
  providerId: z.string().uuid(),
});
export type RefreshCapabilityRequestSchemaType = z.infer<typeof RefreshCapabilityRequestSchema>;

/**
 * Response for refreshing capability cache.
 */
export const RefreshCapabilityResponseSchema = z.object({
  success: z.boolean(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
export type RefreshCapabilityResponseSchemaType = z.infer<typeof RefreshCapabilityResponseSchema>;

// =============================================================================
// CREDENTIAL METADATA SCHEMA
// =============================================================================

/**
 * Credential storage metadata.
 */
export const CredentialMetadataSchema = z.object({
  providerId: z.string().uuid(),
  storageType: StorageTypeSchema,
  keyPreview: z.string(),
  storedAt: z.string().datetime(),
});
export type CredentialMetadataSchemaType = z.infer<typeof CredentialMetadataSchema>;

// =============================================================================
// USAGE RECORD SCHEMA
// =============================================================================

/**
 * Usage record for a single AI request.
 */
export const UsageRecordSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  modelId: z.string(),
  operationType: OperationTypeSchema,
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  embeddingDimensions: z.number().optional(),
  imageSize: z.string().optional(),
  durationMs: z.number(),
  success: z.boolean(),
  errorCode: z.string().optional(),
  timestamp: z.string().datetime(),
  estimatedCostUsd: z.number().optional(),
});
export type UsageRecordSchemaType = z.infer<typeof UsageRecordSchema>;

// =============================================================================
// ONBOARDING SCHEMAS
// =============================================================================

/**
 * Single onboarding attempt record.
 */
export const OnboardingAttemptSchema = z.object({
  id: z.string(),
  providerType: ProviderTypeSchema,
  outcome: OnboardingOutcomeSchema,
  failedAtStep: OnboardingStepSchema.optional(),
  durationMs: z.number(),
  errorCode: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type OnboardingAttemptSchemaType = z.infer<typeof OnboardingAttemptSchema>;

/**
 * Aggregated onboarding metrics.
 */
export const OnboardingMetricsSchema = z.object({
  totalAttempts: z.number(),
  successCount: z.number(),
  failureCount: z.number(),
  abandonmentCount: z.number(),
  successRate: z.number(),
  avgSuccessDurationMs: z.number(),
  updatedAt: z.string().datetime(),
});
export type OnboardingMetricsSchemaType = z.infer<typeof OnboardingMetricsSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validates data against a schema and returns the parsed result or throws.
 * Use on renderer side before sending IPC requests.
 */
export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

/**
 * Validates data against a schema and returns a safe result.
 * Use on main side before returning IPC responses.
 */
export function validateResponse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.SafeParseReturnType<unknown, z.infer<T>> {
  return schema.safeParse(data);
}

/**
 * Creates a typed validator function for a specific schema.
 */
export function createValidator<T extends z.ZodTypeAny>(schema: T) {
  return {
    parse: (data: unknown): z.infer<T> => schema.parse(data),
    safeParse: (data: unknown): z.SafeParseReturnType<unknown, z.infer<T>> =>
      schema.safeParse(data),
    isValid: (data: unknown): data is z.infer<T> => schema.safeParse(data).success,
  };
}
