/**
 * Embedding Module
 *
 * Provides embedding generation operations using the Vercel AI SDK.
 * Called by the AIService facade, receiving all dependencies as parameters.
 *
 * @module src/main/services/ai/embedding
 */

import { embedMany } from 'ai';
import type { EmbeddingModel } from 'ai';

import type { ProviderConfig } from '@shared/ai/types';
import { ProviderCapability as Capability } from '@shared/ai/types';
import { CapabilityNotSupportedError } from '@shared/ai/errors';

import type { IUsageService } from './usage-service';
import type {
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderResolver,
} from './ai-types';
import {
  getDefaultEmbeddingModel,
  validateCapability,
  wrapError,
} from './ai-helpers';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Creates an embedding model instance for a given provider, API key, and model ID.
 */
export type EmbeddingModelFactory = (
  config: ProviderConfig,
  apiKey: string,
  modelId: string
) => EmbeddingModel;

// =============================================================================
// EMBEDDING GENERATION
// =============================================================================

/**
 * Generates embeddings using the active provider.
 */
export async function performEmbedding(
  request: EmbeddingRequest,
  resolveProvider: ProviderResolver,
  createModel: EmbeddingModelFactory,
  usageService: IUsageService
): Promise<EmbeddingResponse> {
  const { provider, apiKey } = await resolveProvider();
  const modelId = request.modelId ?? getDefaultEmbeddingModel(provider.type);

  if (!modelId) {
    throw new CapabilityNotSupportedError(
      Capability.EMBEDDINGS,
      'default',
      provider.id
    );
  }

  validateCapability(provider, modelId, Capability.EMBEDDINGS);

  const model = createModel(provider, apiKey, modelId);
  const startTime = Date.now();

  try {
    const result = await embedMany({
      model,
      values: request.texts,
    });

    const embeddings = result.embeddings.map((e) => Array.from(e));
    const dimensions = embeddings[0]?.length ?? 0;

    await recordEmbeddingUsage(
      usageService,
      provider.id,
      modelId,
      dimensions,
      Date.now() - startTime,
      true
    );

    return { embeddings, dimensions, modelId };
  } catch (error) {
    await recordEmbeddingUsage(
      usageService,
      provider.id,
      modelId,
      0,
      Date.now() - startTime,
      false
    );
    throw wrapError(error, provider);
  }
}

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * Records embedding generation usage.
 */
async function recordEmbeddingUsage(
  usageService: IUsageService,
  providerId: string,
  modelId: string,
  dimensions: number,
  durationMs: number,
  success: boolean
): Promise<void> {
  await usageService.recordUsage({
    providerId,
    modelId,
    operationType: 'embedding',
    embeddingDimensions: dimensions,
    durationMs,
    success,
  });
}
