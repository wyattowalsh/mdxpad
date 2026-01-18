/**
 * AI Provider Abstraction Layer - Shared Types and Utilities
 *
 * @module src/shared/ai
 */

// Error types
export {
  AIProviderError,
  NoActiveProviderError,
  ProviderNotFoundError,
  ProviderDisconnectedError,
  CapabilityNotSupportedError,
  RateLimitError,
  CredentialStorageError,
  InvalidApiKeyError,
  isAIProviderError,
  AIErrorCodes,
  type AIErrorCode,
} from './errors';

// Types - Core
export {
  ProviderCapability,
  type ProviderType,
  type ConnectionStatus,
  type OperationType,
  type TimeRange,
} from './types';

// Types - Configuration and Credentials
export type {
  ProviderConfig,
  CredentialMetadata,
} from './types';

// Types - Usage Tracking
export type {
  UsageRecord,
  UsageStats,
  ProviderUsageSummary,
  ModelUsageSummary,
} from './types';

// Types - Model Capabilities
export type {
  CapabilityConstraints,
  ModelCapabilities,
} from './types';

// Types - Onboarding Analytics
export type {
  OnboardingOutcome,
  OnboardingStep,
  OnboardingAttempt,
  OnboardingMetrics,
} from './types';

// Types - State Management
export type {
  AIProviderState,
  AIProviderActions,
  AIProviderStore,
} from './types';

// Zod Schemas - Base Enums
export {
  ProviderTypeSchema,
  ConnectionStatusSchema,
  OperationTypeSchema,
  TimeRangeSchema,
  ProviderCapabilitySchema,
  StorageTypeSchema,
  OnboardingOutcomeSchema,
  OnboardingStepSchema,
  type ProviderTypeSchemaType,
  type ConnectionStatusSchemaType,
  type OperationTypeSchemaType,
  type TimeRangeSchemaType,
  type ProviderCapabilitySchemaType,
  type StorageTypeSchemaType,
  type OnboardingOutcomeSchemaType,
  type OnboardingStepSchemaType,
} from './schemas';

// Zod Schemas - Base Objects
export {
  CapabilityConstraintsSchema,
  ProviderConfigSchema,
  ErrorObjectSchema,
  UsageTokensSchema,
  type CapabilityConstraintsSchemaType,
  type ProviderConfigSchemaType,
  type ErrorObjectSchemaType,
  type UsageTokensSchemaType,
} from './schemas';

// Zod Schemas - Provider Management
export {
  ProviderListResponseSchema,
  AddProviderRequestSchema,
  AddProviderResponseSchema,
  UpdateProviderRequestSchema,
  UpdateProviderResponseSchema,
  RemoveProviderRequestSchema,
  RemoveProviderResponseSchema,
  SetActiveProviderRequestSchema,
  SetActiveProviderResponseSchema,
  ValidateProviderRequestSchema,
  ValidateProviderResponseSchema,
  type ProviderListResponseSchemaType,
  type AddProviderRequestSchemaType,
  type AddProviderResponseSchemaType,
  type UpdateProviderRequestSchemaType,
  type UpdateProviderResponseSchemaType,
  type RemoveProviderRequestSchemaType,
  type RemoveProviderResponseSchemaType,
  type SetActiveProviderRequestSchemaType,
  type SetActiveProviderResponseSchemaType,
  type ValidateProviderRequestSchemaType,
  type ValidateProviderResponseSchemaType,
} from './schemas';

// Zod Schemas - Credential Management
export {
  SetCredentialRequestSchema,
  SetCredentialResponseSchema,
  HasCredentialRequestSchema,
  HasCredentialResponseSchema,
  ClearCredentialRequestSchema,
  ClearCredentialResponseSchema,
  type SetCredentialRequestSchemaType,
  type SetCredentialResponseSchemaType,
  type HasCredentialRequestSchemaType,
  type HasCredentialResponseSchemaType,
  type ClearCredentialRequestSchemaType,
  type ClearCredentialResponseSchemaType,
} from './schemas';

// Zod Schemas - AI Generation
export {
  GenerateTextRequestSchema,
  GenerateTextResponseSchema,
  GenerateStreamRequestSchema,
  StreamInitResponseSchema,
  StreamChunkSchema,
  StreamCompleteSchema,
  StreamErrorSchema,
  GenerateEmbedRequestSchema,
  GenerateEmbedResponseSchema,
  ImageSizeSchema,
  ImageQualitySchema,
  ImageStyleSchema,
  GenerateImageRequestSchema,
  GenerateImageResponseSchema,
  type GenerateTextRequestSchemaType,
  type GenerateTextResponseSchemaType,
  type GenerateStreamRequestSchemaType,
  type StreamInitResponseSchemaType,
  type StreamChunkSchemaType,
  type StreamCompleteSchemaType,
  type StreamErrorSchemaType,
  type GenerateEmbedRequestSchemaType,
  type GenerateEmbedResponseSchemaType,
  type ImageSizeSchemaType,
  type ImageQualitySchemaType,
  type ImageStyleSchemaType,
  type GenerateImageRequestSchemaType,
  type GenerateImageResponseSchemaType,
} from './schemas';

// Zod Schemas - Usage Statistics
export {
  QueryUsageRequestSchema,
  ProviderUsageStatSchema,
  OperationUsageStatSchema,
  QueryUsageResponseSchema,
  ExportUsageRequestSchema,
  ExportUsageResponseSchema,
  ClearUsageRequestSchema,
  ClearUsageResponseSchema,
  type QueryUsageRequestSchemaType,
  type ProviderUsageStatSchemaType,
  type OperationUsageStatSchemaType,
  type QueryUsageResponseSchemaType,
  type ExportUsageRequestSchemaType,
  type ExportUsageResponseSchemaType,
  type ClearUsageRequestSchemaType,
  type ClearUsageResponseSchemaType,
} from './schemas';

// Zod Schemas - Capability
export {
  GetCapabilityRequestSchema,
  GetCapabilityResponseSchema,
  ListModelsRequestSchema,
  ModelInfoSchema,
  ListModelsResponseSchema,
  RefreshCapabilityRequestSchema,
  RefreshCapabilityResponseSchema,
  type GetCapabilityRequestSchemaType,
  type GetCapabilityResponseSchemaType,
  type ListModelsRequestSchemaType,
  type ModelInfoSchemaType,
  type ListModelsResponseSchemaType,
  type RefreshCapabilityRequestSchemaType,
  type RefreshCapabilityResponseSchemaType,
} from './schemas';

// Zod Schemas - Records and Metrics
export {
  CredentialMetadataSchema,
  UsageRecordSchema,
  OnboardingAttemptSchema,
  OnboardingMetricsSchema,
  type CredentialMetadataSchemaType,
  type UsageRecordSchemaType,
  type OnboardingAttemptSchemaType,
  type OnboardingMetricsSchemaType,
} from './schemas';

// Validation Helpers
export {
  validateRequest,
  validateResponse,
  createValidator,
} from './schemas';

// IPC Channel Definitions
export {
  AIChannels,
  AIChannelRegistry,
  AIStreamRegistry,
  getInvokeChannels,
  getStreamChannels,
  isAIChannel,
  isInvokeChannel,
  isStreamChannel,
  type AIChannel,
  type AIInvokeChannel,
  type AIStreamChannel,
  type AIProviderApi,
  type AIStreamApi,
  type AIRequestType,
  type AIResponseType,
  type AIStreamPayload,
  type TypedInvoke,
  type TypedHandler,
  type TypedSend,
  type TypedListener,
  type ChannelRegistryEntry,
  type StreamChannelRegistryEntry,
} from './ipc-channels';
