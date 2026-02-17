/**
 * AI Provider API Module - Exposes AI operations to renderer via contextBridge.
 *
 * This module provides the AI API surface that can be merged into the main MdxpadAPI.
 * All methods use validated invoke pattern with Zod schema validation on both ends.
 *
 * @security Uses invoke/handle pattern for all operations
 * @security All payloads validated with zod on both ends per Constitution III.3
 * @module src/preload/ai-api
 */

import { ipcRenderer } from 'electron';
import { z } from 'zod';
import { AIChannels } from '@shared/ai/ipc-channels';
import { validatedInvoke } from './validated-invoke';
import {
  // Provider Management Schemas
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
  // Credential Management Schemas
  SetCredentialRequestSchema,
  SetCredentialResponseSchema,
  HasCredentialRequestSchema,
  HasCredentialResponseSchema,
  ClearCredentialRequestSchema,
  ClearCredentialResponseSchema,
  // AI Generation Schemas
  GenerateTextRequestSchema,
  GenerateTextResponseSchema,
  GenerateStreamRequestSchema,
  StreamInitResponseSchema,
  StreamChunkSchema,
  StreamCompleteSchema,
  StreamErrorSchema,
  GenerateEmbedRequestSchema,
  GenerateEmbedResponseSchema,
  GenerateImageRequestSchema,
  GenerateImageResponseSchema,
  // Usage Statistics Schemas
  QueryUsageRequestSchema,
  QueryUsageResponseSchema,
  ExportUsageRequestSchema,
  ExportUsageResponseSchema,
  ClearUsageRequestSchema,
  ClearUsageResponseSchema,
  // Capability Detection Schemas
  GetCapabilityRequestSchema,
  GetCapabilityResponseSchema,
  ListModelsRequestSchema,
  ListModelsResponseSchema,
  RefreshCapabilityRequestSchema,
  RefreshCapabilityResponseSchema,
} from '@shared/ai/schemas';

// =============================================================================
// TYPE EXPORTS FOR RENDERER
// =============================================================================

// Re-export request types for renderer usage
export type {
  AddProviderRequestSchemaType as AddProviderRequest,
  UpdateProviderRequestSchemaType as UpdateProviderRequest,
  GenerateTextRequestSchemaType as GenerateTextRequest,
  GenerateStreamRequestSchemaType as GenerateStreamRequest,
  GenerateEmbedRequestSchemaType as GenerateEmbedRequest,
  GenerateImageRequestSchemaType as GenerateImageRequest,
  QueryUsageRequestSchemaType as QueryUsageRequest,
  ExportUsageRequestSchemaType as ExportUsageRequest,
  ClearUsageRequestSchemaType as ClearUsageRequest,
  GetCapabilityRequestSchemaType as GetCapabilityRequest,
} from '@shared/ai/schemas';

// Re-export response types for renderer usage
export type {
  ProviderListResponseSchemaType as ProviderListResponse,
  AddProviderResponseSchemaType as AddProviderResponse,
  UpdateProviderResponseSchemaType as UpdateProviderResponse,
  RemoveProviderResponseSchemaType as RemoveProviderResponse,
  SetActiveProviderResponseSchemaType as SetActiveProviderResponse,
  ValidateProviderResponseSchemaType as ValidateProviderResponse,
  SetCredentialResponseSchemaType as SetCredentialResponse,
  HasCredentialResponseSchemaType as HasCredentialResponse,
  ClearCredentialResponseSchemaType as ClearCredentialResponse,
  GenerateTextResponseSchemaType as GenerateTextResponse,
  StreamInitResponseSchemaType as StreamInitResponse,
  StreamChunkSchemaType as StreamChunk,
  StreamCompleteSchemaType as StreamComplete,
  StreamErrorSchemaType as StreamError,
  GenerateEmbedResponseSchemaType as GenerateEmbedResponse,
  GenerateImageResponseSchemaType as GenerateImageResponse,
  QueryUsageResponseSchemaType as QueryUsageResponse,
  ExportUsageResponseSchemaType as ExportUsageResponse,
  ClearUsageResponseSchemaType as ClearUsageResponse,
  GetCapabilityResponseSchemaType as GetCapabilityResponse,
  ListModelsResponseSchemaType as ListModelsResponse,
  RefreshCapabilityResponseSchemaType as RefreshCapabilityResponse,
} from '@shared/ai/schemas';

// Re-export enum types for renderer usage
export type {
  ProviderTypeSchemaType as ProviderType,
  ConnectionStatusSchemaType as ConnectionStatus,
  OperationTypeSchemaType as OperationType,
  TimeRangeSchemaType as TimeRange,
  ProviderCapabilitySchemaType as ProviderCapability,
  StorageTypeSchemaType as StorageType,
  ProviderConfigSchemaType as ProviderConfig,
  ModelInfoSchemaType as ModelInfo,
} from '@shared/ai/schemas';

// Note: validatedInvoke is imported from ./validated-invoke
// S1-25: Deduplicated validatedInvoke to use shared utility

// =============================================================================
// STREAMING EVENT LISTENERS
// =============================================================================

/**
 * Stream chunk event listeners registry.
 */
const streamChunkListeners = new Set<(data: z.infer<typeof StreamChunkSchema>) => void>();

/**
 * Stream complete event listeners registry.
 */
const streamCompleteListeners = new Set<(data: z.infer<typeof StreamCompleteSchema>) => void>();

/**
 * Stream error event listeners registry.
 */
const streamErrorListeners = new Set<(data: z.infer<typeof StreamErrorSchema>) => void>();

// Set up IPC listeners for stream events (once, shared across all subscriptions)
ipcRenderer.on(AIChannels.STREAM_CHUNK, (_event, data: unknown) => {
  const validated = StreamChunkSchema.safeParse(data);
  if (validated.success) {
    for (const listener of streamChunkListeners) {
      listener(validated.data);
    }
  } else {
    console.error('Invalid stream chunk data:', validated.error.message);
  }
});

ipcRenderer.on(AIChannels.STREAM_COMPLETE, (_event, data: unknown) => {
  const validated = StreamCompleteSchema.safeParse(data);
  if (validated.success) {
    for (const listener of streamCompleteListeners) {
      listener(validated.data);
    }
  } else {
    console.error('Invalid stream complete data:', validated.error.message);
  }
});

ipcRenderer.on(AIChannels.STREAM_ERROR, (_event, data: unknown) => {
  const validated = StreamErrorSchema.safeParse(data);
  if (validated.success) {
    for (const listener of streamErrorListeners) {
      listener(validated.data);
    }
  } else {
    console.error('Invalid stream error data:', validated.error.message);
  }
});

// =============================================================================
// AI API INTERFACE
// =============================================================================

/**
 * AI Provider API exposed to renderer via contextBridge.
 */
export interface AIApi {
  // Provider Management
  listProviders(): Promise<z.infer<typeof ProviderListResponseSchema>>;
  addProvider(request: z.infer<typeof AddProviderRequestSchema>): Promise<z.infer<typeof AddProviderResponseSchema>>;
  updateProvider(request: z.infer<typeof UpdateProviderRequestSchema>): Promise<z.infer<typeof UpdateProviderResponseSchema>>;
  removeProvider(providerId: string): Promise<z.infer<typeof RemoveProviderResponseSchema>>;
  setActiveProvider(providerId: string): Promise<z.infer<typeof SetActiveProviderResponseSchema>>;
  validateProvider(providerId: string): Promise<z.infer<typeof ValidateProviderResponseSchema>>;

  // Credential Management
  setCredential(providerId: string, apiKey: string): Promise<z.infer<typeof SetCredentialResponseSchema>>;
  hasCredential(providerId: string): Promise<z.infer<typeof HasCredentialResponseSchema>>;
  clearCredential(providerId: string): Promise<z.infer<typeof ClearCredentialResponseSchema>>;

  // AI Generation
  generateText(request: z.infer<typeof GenerateTextRequestSchema>): Promise<z.infer<typeof GenerateTextResponseSchema>>;
  generateStream(request: z.infer<typeof GenerateStreamRequestSchema>): Promise<z.infer<typeof StreamInitResponseSchema>>;
  generateEmbed(request: z.infer<typeof GenerateEmbedRequestSchema>): Promise<z.infer<typeof GenerateEmbedResponseSchema>>;
  generateImage(request: z.infer<typeof GenerateImageRequestSchema>): Promise<z.infer<typeof GenerateImageResponseSchema>>;

  // Usage Statistics
  queryUsage(request: z.infer<typeof QueryUsageRequestSchema>): Promise<z.infer<typeof QueryUsageResponseSchema>>;
  exportUsage(request: z.infer<typeof ExportUsageRequestSchema>): Promise<z.infer<typeof ExportUsageResponseSchema>>;
  clearUsage(request?: z.infer<typeof ClearUsageRequestSchema>): Promise<z.infer<typeof ClearUsageResponseSchema>>;

  // Capability Detection
  getCapability(providerId: string, modelId: string): Promise<z.infer<typeof GetCapabilityResponseSchema>>;
  listModels(providerId: string): Promise<z.infer<typeof ListModelsResponseSchema>>;
  refreshCapabilities(providerId: string): Promise<z.infer<typeof RefreshCapabilityResponseSchema>>;

  // Streaming Events
  onStreamChunk(callback: (data: z.infer<typeof StreamChunkSchema>) => void): () => void;
  onStreamComplete(callback: (data: z.infer<typeof StreamCompleteSchema>) => void): () => void;
  onStreamError(callback: (data: z.infer<typeof StreamErrorSchema>) => void): () => void;
}

// =============================================================================
// AI API IMPLEMENTATION
// =============================================================================

/**
 * AI API implementation exposed to renderer.
 * All methods use validatedInvoke for schema validation on both ends.
 */
export const aiApi: AIApi = {
  // =========================================================================
  // Provider Management
  // =========================================================================

  listProviders: () =>
    validatedInvoke(
      AIChannels.PROVIDER_LIST,
      null,
      ProviderListResponseSchema
    ),

  addProvider: (request) =>
    validatedInvoke(
      AIChannels.PROVIDER_ADD,
      AddProviderRequestSchema,
      AddProviderResponseSchema,
      request
    ),

  updateProvider: (request) =>
    validatedInvoke(
      AIChannels.PROVIDER_UPDATE,
      UpdateProviderRequestSchema,
      UpdateProviderResponseSchema,
      request
    ),

  removeProvider: (providerId) =>
    validatedInvoke(
      AIChannels.PROVIDER_REMOVE,
      RemoveProviderRequestSchema,
      RemoveProviderResponseSchema,
      { id: providerId }
    ),

  setActiveProvider: (providerId) =>
    validatedInvoke(
      AIChannels.PROVIDER_SET_ACTIVE,
      SetActiveProviderRequestSchema,
      SetActiveProviderResponseSchema,
      { id: providerId }
    ),

  validateProvider: (providerId) =>
    validatedInvoke(
      AIChannels.PROVIDER_VALIDATE,
      ValidateProviderRequestSchema,
      ValidateProviderResponseSchema,
      { id: providerId }
    ),

  // =========================================================================
  // Credential Management
  // =========================================================================

  setCredential: (providerId, apiKey) =>
    validatedInvoke(
      AIChannels.CREDENTIAL_SET,
      SetCredentialRequestSchema,
      SetCredentialResponseSchema,
      { providerId, apiKey }
    ),

  hasCredential: (providerId) =>
    validatedInvoke(
      AIChannels.CREDENTIAL_HAS,
      HasCredentialRequestSchema,
      HasCredentialResponseSchema,
      { providerId }
    ),

  clearCredential: (providerId) =>
    validatedInvoke(
      AIChannels.CREDENTIAL_CLEAR,
      ClearCredentialRequestSchema,
      ClearCredentialResponseSchema,
      { providerId }
    ),

  // =========================================================================
  // AI Generation
  // =========================================================================

  generateText: (request) =>
    validatedInvoke(
      AIChannels.GENERATE_TEXT,
      GenerateTextRequestSchema,
      GenerateTextResponseSchema,
      request
    ),

  generateStream: (request) =>
    validatedInvoke(
      AIChannels.GENERATE_STREAM,
      GenerateStreamRequestSchema,
      StreamInitResponseSchema,
      request
    ),

  generateEmbed: (request) =>
    validatedInvoke(
      AIChannels.GENERATE_EMBED,
      GenerateEmbedRequestSchema,
      GenerateEmbedResponseSchema,
      request
    ),

  generateImage: (request) =>
    validatedInvoke(
      AIChannels.GENERATE_IMAGE,
      GenerateImageRequestSchema,
      GenerateImageResponseSchema,
      request
    ),

  // =========================================================================
  // Usage Statistics
  // =========================================================================

  queryUsage: (request) =>
    validatedInvoke(
      AIChannels.USAGE_QUERY,
      QueryUsageRequestSchema,
      QueryUsageResponseSchema,
      request
    ),

  exportUsage: (request) =>
    validatedInvoke(
      AIChannels.USAGE_EXPORT,
      ExportUsageRequestSchema,
      ExportUsageResponseSchema,
      request
    ),

  clearUsage: (request) =>
    validatedInvoke(
      AIChannels.USAGE_CLEAR,
      ClearUsageRequestSchema,
      ClearUsageResponseSchema,
      request ?? {}
    ),

  // =========================================================================
  // Capability Detection
  // =========================================================================

  getCapability: (providerId, modelId) =>
    validatedInvoke(
      AIChannels.CAPABILITY_GET,
      GetCapabilityRequestSchema,
      GetCapabilityResponseSchema,
      { providerId, modelId }
    ),

  listModels: (providerId) =>
    validatedInvoke(
      AIChannels.CAPABILITY_LIST_MODELS,
      ListModelsRequestSchema,
      ListModelsResponseSchema,
      { providerId }
    ),

  refreshCapabilities: (providerId) =>
    validatedInvoke(
      AIChannels.CAPABILITY_REFRESH,
      RefreshCapabilityRequestSchema,
      RefreshCapabilityResponseSchema,
      { providerId }
    ),

  // =========================================================================
  // Streaming Events
  // =========================================================================

  onStreamChunk: (callback) => {
    streamChunkListeners.add(callback);
    return () => {
      streamChunkListeners.delete(callback);
    };
  },

  onStreamComplete: (callback) => {
    streamCompleteListeners.add(callback);
    return () => {
      streamCompleteListeners.delete(callback);
    };
  },

  onStreamError: (callback) => {
    streamErrorListeners.add(callback);
    return () => {
      streamErrorListeners.delete(callback);
    };
  },
};
