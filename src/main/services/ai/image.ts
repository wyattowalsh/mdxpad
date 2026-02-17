/**
 * Image Generation Module
 *
 * Provides image generation operations using the OpenAI images API.
 * Called by the AIService facade, receiving all dependencies as parameters.
 *
 * @module src/main/services/ai/image
 */

import type { ProviderConfig } from '@shared/ai/types';
import { ProviderCapability as Capability } from '@shared/ai/types';
import {
  AIProviderError,
  CapabilityNotSupportedError,
  RateLimitError,
} from '@shared/ai/errors';

import type { IUsageService } from './usage-service';
import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ProviderResolver,
  AlternateProvidersFn,
} from './ai-types';
import {
  getDefaultImageModel,
  validateCapability,
  extractRetryAfter,
} from './ai-helpers';

// =============================================================================
// IMAGE GENERATION
// =============================================================================

/**
 * Generates an image using the active provider.
 * Currently only supported by OpenAI.
 */
export async function performImageGeneration(
  request: ImageGenerationRequest,
  resolveProvider: ProviderResolver,
  usageService: IUsageService,
  getAlternates: AlternateProvidersFn
): Promise<ImageGenerationResponse> {
  const { provider, apiKey } = await resolveProvider();
  const modelId = getDefaultImageModel(provider.type);

  if (!modelId) {
    throw new CapabilityNotSupportedError(
      Capability.IMAGE_GENERATION,
      'default',
      provider.id
    );
  }

  validateCapability(provider, modelId, Capability.IMAGE_GENERATION);

  return generateOpenAIImage(
    apiKey,
    provider,
    request,
    modelId,
    usageService,
    getAlternates
  );
}

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * Generates an image using OpenAI's image generation API.
 */
// eslint-disable-next-line max-lines-per-function
async function generateOpenAIImage(
  apiKey: string,
  provider: ProviderConfig,
  request: ImageGenerationRequest,
  modelId: string,
  usageService: IUsageService,
  getAlternates: AlternateProvidersFn
): Promise<ImageGenerationResponse> {
  const startTime = Date.now();

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      prompt: request.prompt,
      size: request.size ?? '1024x1024',
      quality: request.quality ?? 'standard',
      style: request.style ?? 'vivid',
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    await recordImageUsage(
      usageService,
      provider.id,
      modelId,
      request.size ?? '1024x1024',
      Date.now() - startTime,
      false
    );
    await handleImageApiError(response, provider, getAlternates);
  }

  const data = (await response.json()) as {
    data?: { url?: string; b64_json?: string }[];
  };
  const imageData = data.data?.[0];

  await recordImageUsage(
    usageService,
    provider.id,
    modelId,
    request.size ?? '1024x1024',
    Date.now() - startTime,
    true
  );

  const result: ImageGenerationResponse = { modelId };
  if (imageData?.url !== undefined) {
    result.imageUrl = imageData.url;
  }
  if (imageData?.b64_json !== undefined) {
    result.imageBase64 = imageData.b64_json;
  }
  return result;
}

/**
 * Handles image API errors.
 */
async function handleImageApiError(
  response: Response,
  provider: ProviderConfig,
  getAlternates: AlternateProvidersFn
): Promise<never> {
  if (response.status === 429) {
    const alternates = await getAlternates(provider.id);
    throw new RateLimitError(
      provider.id,
      extractRetryAfter(response),
      alternates
    );
  }

  const errorData = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  throw new AIProviderError(
    errorData.error?.message ?? `Image generation failed: ${response.status}`,
    'IMAGE_GENERATION_ERROR',
    provider.id
  );
}

/**
 * Records image generation usage.
 */
async function recordImageUsage(
  usageService: IUsageService,
  providerId: string,
  modelId: string,
  imageSize: string,
  durationMs: number,
  success: boolean
): Promise<void> {
  await usageService.recordUsage({
    providerId,
    modelId,
    operationType: 'image-generation',
    imageSize,
    durationMs,
    success,
  });
}
