/**
 * AI Provider IPC Handlers
 *
 * Registers all AI-related IPC handlers connecting the AI services to IPC channels.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module src/main/ipc/ai-handlers
 */

import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

import { AIChannels } from '@shared/ai/ipc-channels';
import * as schemas from '@shared/ai/schemas';
import {
  AIProviderError,
  RateLimitError,
  ProviderNotFoundError,
  isAIProviderError,
} from '@shared/ai/errors';
import { getAIServices, type AIServices } from '@main/services/ai';

// =============================================================================
// TYPES
// =============================================================================

/** Error response object for IPC handlers */
interface ErrorResponse {
  code: string;
  message: string;
  retryAfterSeconds?: number;
  alternateProviders?: string[];
}

// =============================================================================
// REQUEST BUILDERS (handle exactOptionalPropertyTypes)
// =============================================================================

import type {
  TextGenerationRequest,
  EmbeddingRequest,
  ImageGenerationRequest,
} from '@main/services/ai';
import type { UsageQuery } from '@main/services/ai';
import type { ProviderConfig } from '@shared/ai/types';

/**
 * Builds a text generation request filtering out undefined values.
 */
function buildTextRequest(request: {
  prompt: string;
  modelId?: string | undefined;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  systemPrompt?: string | undefined;
}): TextGenerationRequest {
  const result: TextGenerationRequest = { prompt: request.prompt };
  if (request.modelId !== undefined) {
    result.modelId = request.modelId;
  }
  if (request.maxTokens !== undefined) {
    result.maxTokens = request.maxTokens;
  }
  if (request.temperature !== undefined) {
    result.temperature = request.temperature;
  }
  if (request.systemPrompt !== undefined) {
    result.systemPrompt = request.systemPrompt;
  }
  return result;
}

/**
 * Builds an embedding request filtering out undefined values.
 */
function buildEmbedRequest(request: {
  texts: string[];
  modelId?: string | undefined;
}): EmbeddingRequest {
  const result: EmbeddingRequest = { texts: request.texts };
  if (request.modelId !== undefined) {
    result.modelId = request.modelId;
  }
  return result;
}

/**
 * Builds an image generation request filtering out undefined values.
 */
function buildImageRequest(request: {
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792' | undefined;
  quality?: 'standard' | 'hd' | undefined;
  style?: 'natural' | 'vivid' | undefined;
}): ImageGenerationRequest {
  const result: ImageGenerationRequest = { prompt: request.prompt };
  if (request.size !== undefined) {
    result.size = request.size;
  }
  if (request.quality !== undefined) {
    result.quality = request.quality;
  }
  if (request.style !== undefined) {
    result.style = request.style;
  }
  return result;
}

/**
 * Builds a usage query filtering out undefined values.
 */
function buildUsageQuery(request: {
  timeRange: 'day' | 'week' | 'month' | 'all';
  providerId?: string | undefined;
  operationType?: 'text-generation' | 'streaming-generation' | 'embedding' | 'image-generation' | 'agent-execution' | undefined;
}): UsageQuery {
  const result: UsageQuery = { timeRange: request.timeRange };
  if (request.providerId !== undefined) {
    result.providerId = request.providerId;
  }
  if (request.operationType !== undefined) {
    result.operationType = request.operationType;
  }
  return result;
}

/**
 * Builds provider updates filtering out undefined values.
 */
function buildProviderUpdates(updates: {
  displayName?: string | undefined;
  baseUrl?: string | undefined;
  isActive?: boolean | undefined;
}): Partial<ProviderConfig> {
  const result: Partial<ProviderConfig> = {};
  if (updates.displayName !== undefined) {
    result.displayName = updates.displayName;
  }
  if (updates.baseUrl !== undefined) {
    result.baseUrl = updates.baseUrl;
  }
  if (updates.isActive !== undefined) {
    result.isActive = updates.isActive;
  }
  return result;
}

// =============================================================================
// ERROR HELPERS
// =============================================================================

/**
 * Converts an error to a standard error response object.
 */
function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof RateLimitError) {
    return {
      code: error.code,
      message: error.message,
      retryAfterSeconds: error.retryAfterSeconds,
      alternateProviders: error.alternateProviders,
    };
  }

  if (isAIProviderError(error)) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof ZodError) {
    return { code: 'VALIDATION_ERROR', message: error.message };
  }

  if (error instanceof Error) {
    return { code: 'UNKNOWN_ERROR', message: error.message };
  }

  return { code: 'UNKNOWN_ERROR', message: String(error) };
}

// =============================================================================
// PROVIDER MANAGEMENT HANDLERS
// =============================================================================

/**
 * Handles PROVIDER_LIST: List all configured AI providers.
 */
async function handleProviderList(
  services: AIServices
): Promise<schemas.ProviderListResponseSchemaType> {
  const providers = await services.providerService.getProviders();
  const activeProvider = await services.providerService.getActiveProvider();

  return schemas.ProviderListResponseSchema.parse({
    providers,
    activeProviderId: activeProvider?.id ?? null,
  });
}

/**
 * Handles PROVIDER_ADD: Add a new AI provider.
 */
async function handleProviderAdd(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.AddProviderResponseSchemaType> {
  try {
    const request = schemas.AddProviderRequestSchema.parse(rawRequest);

    const provider = await services.providerService.addProvider(
      {
        displayName: request.displayName,
        type: request.type,
        ...(request.baseUrl !== undefined && { baseUrl: request.baseUrl }),
        isActive: false,
      },
      request.apiKey
    );

    return schemas.AddProviderResponseSchema.parse({
      success: true,
      provider,
    });
  } catch (error) {
    return schemas.AddProviderResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles PROVIDER_UPDATE: Update an existing AI provider.
 */
async function handleProviderUpdate(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.UpdateProviderResponseSchemaType> {
  try {
    const request = schemas.UpdateProviderRequestSchema.parse(rawRequest);

    const provider = await services.providerService.updateProvider(
      request.id,
      buildProviderUpdates(request.updates)
    );

    return schemas.UpdateProviderResponseSchema.parse({
      success: true,
      provider,
    });
  } catch (error) {
    return schemas.UpdateProviderResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles PROVIDER_REMOVE: Remove an AI provider.
 */
async function handleProviderRemove(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.RemoveProviderResponseSchemaType> {
  try {
    const request = schemas.RemoveProviderRequestSchema.parse(rawRequest);
    await services.providerService.removeProvider(request.id);

    return schemas.RemoveProviderResponseSchema.parse({ success: true });
  } catch (error) {
    return schemas.RemoveProviderResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles PROVIDER_SET_ACTIVE: Set the active AI provider.
 */
async function handleProviderSetActive(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.SetActiveProviderResponseSchemaType> {
  try {
    const request = schemas.SetActiveProviderRequestSchema.parse(rawRequest);
    await services.providerService.setActiveProvider(request.id);

    return schemas.SetActiveProviderResponseSchema.parse({
      success: true,
      activeProviderId: request.id,
    });
  } catch (error) {
    return schemas.SetActiveProviderResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles PROVIDER_VALIDATE: Validate an AI provider's credentials.
 */
async function handleProviderValidate(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.ValidateProviderResponseSchemaType> {
  try {
    const request = schemas.ValidateProviderRequestSchema.parse(rawRequest);
    const result = await services.providerService.validateProvider(request.id);

    return schemas.ValidateProviderResponseSchema.parse({
      success: result.valid,
      status: result.status,
      models: result.models,
      error: result.error,
    });
  } catch (error) {
    return schemas.ValidateProviderResponseSchema.parse({
      success: false,
      status: 'error',
      error: toErrorResponse(error),
    });
  }
}

// =============================================================================
// CREDENTIAL MANAGEMENT HANDLERS
// =============================================================================

/**
 * Handles CREDENTIAL_SET: Store a credential securely.
 */
async function handleCredentialSet(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.SetCredentialResponseSchemaType> {
  try {
    const request = schemas.SetCredentialRequestSchema.parse(rawRequest);
    const result = await services.credentialService.setCredential(
      request.providerId,
      request.apiKey
    );

    return schemas.SetCredentialResponseSchema.parse({
      success: result.success,
      storageType: result.storageType,
      keyPreview: result.metadata.keyPreview,
    });
  } catch (error) {
    return schemas.SetCredentialResponseSchema.parse({
      success: false,
      storageType: 'session',
      keyPreview: '****',
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles CREDENTIAL_HAS: Check if a credential exists.
 */
async function handleCredentialHas(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.HasCredentialResponseSchemaType> {
  const request = schemas.HasCredentialRequestSchema.parse(rawRequest);
  const metadata = await services.credentialService.hasCredential(
    request.providerId
  );

  if (!metadata) {
    return schemas.HasCredentialResponseSchema.parse({ exists: false });
  }

  return schemas.HasCredentialResponseSchema.parse({
    exists: true,
    storageType: metadata.storageType,
    keyPreview: metadata.keyPreview,
  });
}

/**
 * Handles CREDENTIAL_CLEAR: Remove a credential.
 */
async function handleCredentialClear(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.ClearCredentialResponseSchemaType> {
  const request = schemas.ClearCredentialRequestSchema.parse(rawRequest);
  await services.credentialService.clearCredential(request.providerId);

  return schemas.ClearCredentialResponseSchema.parse({ success: true });
}

// =============================================================================
// AI GENERATION HANDLERS
// =============================================================================

/**
 * Handles GENERATE_TEXT: Generate text (non-streaming).
 */
async function handleGenerateText(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.GenerateTextResponseSchemaType> {
  try {
    const request = schemas.GenerateTextRequestSchema.parse(rawRequest);
    const result = await services.aiService.generateText(
      buildTextRequest(request)
    );

    return schemas.GenerateTextResponseSchema.parse({
      success: true,
      text: result.text,
      usage: result.usage,
    });
  } catch (error) {
    return schemas.GenerateTextResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles GENERATE_STREAM: Generate text with streaming.
 * Returns immediately with streamId, sends chunks via events.
 */
async function handleGenerateStream(
  services: AIServices,
  event: IpcMainInvokeEvent,
  rawRequest: unknown
): Promise<schemas.StreamInitResponseSchemaType> {
  try {
    const request = schemas.GenerateStreamRequestSchema.parse(rawRequest);
    const streamId = randomUUID();
    const sender = event.sender;

    const controller = await services.aiService.streamText(
      buildTextRequest(request),
      (chunk) => {
        sender.send(AIChannels.STREAM_CHUNK, { streamId, chunk, isComplete: false });
      }
    );

    // Handle completion in background (don't await)
    handleStreamCompletion(controller.completion, streamId, sender);

    return schemas.StreamInitResponseSchema.parse({
      success: true,
      streamId,
    });
  } catch (error) {
    return schemas.StreamInitResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles stream completion in background.
 */
function handleStreamCompletion(
  completion: Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }>,
  streamId: string,
  sender: Electron.WebContents
): void {
  completion
    .then((result) => {
      sender.send(AIChannels.STREAM_COMPLETE, {
        streamId,
        usage: result.usage,
      });
    })
    .catch((error: unknown) => {
      sender.send(AIChannels.STREAM_ERROR, {
        streamId,
        error: toErrorResponse(error),
      });
    });
}

/**
 * Handles GENERATE_EMBED: Generate text embeddings.
 */
async function handleGenerateEmbed(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.GenerateEmbedResponseSchemaType> {
  try {
    const request = schemas.GenerateEmbedRequestSchema.parse(rawRequest);
    const result = await services.aiService.generateEmbedding(
      buildEmbedRequest(request)
    );

    return schemas.GenerateEmbedResponseSchema.parse({
      success: true,
      embeddings: result.embeddings,
      dimensions: result.dimensions,
    });
  } catch (error) {
    return schemas.GenerateEmbedResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles GENERATE_IMAGE: Generate an image.
 */
async function handleGenerateImage(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.GenerateImageResponseSchemaType> {
  try {
    const request = schemas.GenerateImageRequestSchema.parse(rawRequest);
    const result = await services.aiService.generateImage(
      buildImageRequest(request)
    );

    return schemas.GenerateImageResponseSchema.parse({
      success: true,
      imageUrl: result.imageUrl,
      imageBase64: result.imageBase64,
    });
  } catch (error) {
    return schemas.GenerateImageResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

// =============================================================================
// USAGE STATISTICS HANDLERS
// =============================================================================

/**
 * Handles USAGE_QUERY: Query usage statistics.
 */
async function handleUsageQuery(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.QueryUsageResponseSchemaType> {
  try {
    const request = schemas.QueryUsageRequestSchema.parse(rawRequest);
    const stats = await services.usageService.queryStats(
      buildUsageQuery(request)
    );

    return schemas.QueryUsageResponseSchema.parse({
      success: true,
      stats: {
        totalRequests: stats.totalRequests,
        successfulRequests: stats.successfulRequests,
        failedRequests: stats.failedRequests,
        totalTokens: stats.totalTokens,
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        estimatedCostUsd: stats.estimatedCostUsd,
        byProvider: Object.values(stats.byProvider).map((p) => ({
          providerId: p.providerId,
          providerName: p.providerId, // Use providerId as name for now
          requestCount: p.requestCount,
          tokenCount: p.totalTokens,
          estimatedCostUsd: p.estimatedCostUsd,
        })),
        byOperation: Object.keys(stats.byModel).length > 0
          ? buildOperationStats(stats)
          : [],
      },
    });
  } catch (error) {
    return schemas.QueryUsageResponseSchema.parse({ success: false });
  }
}

/**
 * Builds operation stats from usage stats.
 */
function buildOperationStats(
  stats: { avgDurationMs: number }
): schemas.OperationUsageStatSchemaType[] {
  // Simplified: return empty array for now
  // Full implementation would aggregate by operationType
  return [
    {
      operationType: 'text-generation',
      requestCount: 0,
      avgDurationMs: stats.avgDurationMs,
    },
  ];
}

/**
 * Handles USAGE_EXPORT: Export usage data.
 */
async function handleUsageExport(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.ExportUsageResponseSchemaType> {
  try {
    const request = schemas.ExportUsageRequestSchema.parse(rawRequest);
    const format = request.format ?? 'json';
    const data = await services.usageService.exportData(
      request.timeRange,
      format
    );

    const filename = `mdxpad-usage-${request.timeRange}-${Date.now()}.${format}`;

    return schemas.ExportUsageResponseSchema.parse({
      success: true,
      data,
      filename,
    });
  } catch (error) {
    return schemas.ExportUsageResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles USAGE_CLEAR: Clear usage history.
 */
async function handleUsageClear(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.ClearUsageResponseSchemaType> {
  try {
    const request = schemas.ClearUsageRequestSchema.parse(rawRequest);
    const beforeDate = request.olderThan
      ? new Date(request.olderThan)
      : undefined;

    await services.usageService.clearHistory(beforeDate);

    return schemas.ClearUsageResponseSchema.parse({
      success: true,
      deletedCount: 0, // UsageService doesn't return count
    });
  } catch (error) {
    return schemas.ClearUsageResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

// =============================================================================
// CAPABILITY DETECTION HANDLERS
// =============================================================================

/**
 * Handles CAPABILITY_GET: Get model capabilities.
 */
async function handleCapabilityGet(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.GetCapabilityResponseSchemaType> {
  try {
    const request = schemas.GetCapabilityRequestSchema.parse(rawRequest);
    const capabilities = await services.capabilityService.getCapabilities(
      request.providerId,
      request.modelId
    );

    return schemas.GetCapabilityResponseSchema.parse({
      success: true,
      capabilities: {
        modelId: capabilities.modelId,
        capabilities: Array.from(capabilities.capabilities),
        contextWindow: capabilities.contextWindow,
        maxOutputTokens: capabilities.maxOutputTokens,
        constraints: capabilities.constraints,
      },
    });
  } catch (error) {
    return schemas.GetCapabilityResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles CAPABILITY_LIST_MODELS: List available models for a provider.
 */
async function handleCapabilityListModels(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.ListModelsResponseSchemaType> {
  try {
    const request = schemas.ListModelsRequestSchema.parse(rawRequest);
    const models = await services.capabilityService.listModels(
      request.providerId
    );

    return schemas.ListModelsResponseSchema.parse({
      success: true,
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        capabilities: m.capabilities,
      })),
    });
  } catch (error) {
    return schemas.ListModelsResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles CAPABILITY_REFRESH: Refresh capability cache for a provider.
 */
async function handleCapabilityRefresh(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.RefreshCapabilityResponseSchemaType> {
  try {
    const request = schemas.RefreshCapabilityRequestSchema.parse(rawRequest);
    await services.capabilityService.refreshCapabilities(request.providerId);

    return schemas.RefreshCapabilityResponseSchema.parse({ success: true });
  } catch (error) {
    return schemas.RefreshCapabilityResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Registers all AI-related IPC handlers.
 * Call this once during app initialization.
 *
 * @param window - The main BrowserWindow instance (used for streaming events)
 */
export function registerAIHandlers(window: BrowserWindow): void {
  const services = getAIServices();

  // Provider Management (6 handlers)
  ipcMain.handle(AIChannels.PROVIDER_LIST, () =>
    handleProviderList(services)
  );
  ipcMain.handle(AIChannels.PROVIDER_ADD, (_, request) =>
    handleProviderAdd(services, request)
  );
  ipcMain.handle(AIChannels.PROVIDER_UPDATE, (_, request) =>
    handleProviderUpdate(services, request)
  );
  ipcMain.handle(AIChannels.PROVIDER_REMOVE, (_, request) =>
    handleProviderRemove(services, request)
  );
  ipcMain.handle(AIChannels.PROVIDER_SET_ACTIVE, (_, request) =>
    handleProviderSetActive(services, request)
  );
  ipcMain.handle(AIChannels.PROVIDER_VALIDATE, (_, request) =>
    handleProviderValidate(services, request)
  );

  // Credential Management (3 handlers)
  ipcMain.handle(AIChannels.CREDENTIAL_SET, (_, request) =>
    handleCredentialSet(services, request)
  );
  ipcMain.handle(AIChannels.CREDENTIAL_HAS, (_, request) =>
    handleCredentialHas(services, request)
  );
  ipcMain.handle(AIChannels.CREDENTIAL_CLEAR, (_, request) =>
    handleCredentialClear(services, request)
  );

  // AI Generation (4 handlers)
  ipcMain.handle(AIChannels.GENERATE_TEXT, (_, request) =>
    handleGenerateText(services, request)
  );
  ipcMain.handle(AIChannels.GENERATE_STREAM, (event, request) =>
    handleGenerateStream(services, event, request)
  );
  ipcMain.handle(AIChannels.GENERATE_EMBED, (_, request) =>
    handleGenerateEmbed(services, request)
  );
  ipcMain.handle(AIChannels.GENERATE_IMAGE, (_, request) =>
    handleGenerateImage(services, request)
  );

  // Usage Statistics (3 handlers)
  ipcMain.handle(AIChannels.USAGE_QUERY, (_, request) =>
    handleUsageQuery(services, request)
  );
  ipcMain.handle(AIChannels.USAGE_EXPORT, (_, request) =>
    handleUsageExport(services, request)
  );
  ipcMain.handle(AIChannels.USAGE_CLEAR, (_, request) =>
    handleUsageClear(services, request)
  );

  // Capability Detection (3 handlers)
  ipcMain.handle(AIChannels.CAPABILITY_GET, (_, request) =>
    handleCapabilityGet(services, request)
  );
  ipcMain.handle(AIChannels.CAPABILITY_LIST_MODELS, (_, request) =>
    handleCapabilityListModels(services, request)
  );
  ipcMain.handle(AIChannels.CAPABILITY_REFRESH, (_, request) =>
    handleCapabilityRefresh(services, request)
  );

  // Reference window for streaming events
  void window;

  console.log('[AIHandlers] All AI handlers registered (19 channels)');
}
