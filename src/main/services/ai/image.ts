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
import {
  OPENAI_CANONICAL_BASE_URL,
  resolveTrustedProviderBaseUrl,
} from './provider-validation';

const IMAGE_REQUEST_TIMEOUT_MS = 60_000;
const IMAGE_MAX_ATTEMPTS = 2;
const IMAGE_RETRY_DELAY_MS = 250;

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
  const baseUrl =
    resolveTrustedProviderBaseUrl(provider.type, provider.baseUrl) ??
    OPENAI_CANONICAL_BASE_URL;
  const url = `${baseUrl}/v1/images/generations`;

  let response: Response | undefined;
  for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_REQUEST_TIMEOUT_MS);

    try {
      response = await fetch(url, {
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
        signal: controller.signal,
      });
    } catch (error) {
      if (attempt < IMAGE_MAX_ATTEMPTS && isRetryableTransportError(error)) {
        await delay(IMAGE_RETRY_DELAY_MS);
        continue;
      }

      recordImageUsage(
        usageService,
        provider.id,
        modelId,
        request.size ?? '1024x1024',
        Date.now() - startTime,
        false
      );
      throw toImageTransportError(error, provider);
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.ok) {
      break;
    }

    if (attempt < IMAGE_MAX_ATTEMPTS && isRetryableStatus(response.status)) {
      await delay(IMAGE_RETRY_DELAY_MS);
      continue;
    }

    recordImageUsage(
      usageService,
      provider.id,
      modelId,
      request.size ?? '1024x1024',
      Date.now() - startTime,
      false
    );
    await handleImageApiError(response, provider, getAlternates);
  }

  if (!response?.ok) {
    throw new AIProviderError(
      'Image generation failed after retry attempts',
      'IMAGE_GENERATION_ERROR',
      provider.id
    );
  }

  const data = (await response.json()) as {
    data?: { url?: string; b64_json?: string }[];
  };
  const imageData = data.data?.[0];

  recordImageUsage(
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

function isRetryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status >= 500
  );
}

function isRetryableTransportError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error instanceof TypeError || error.name === 'AbortError';
}

function toImageTransportError(
  error: unknown,
  provider: ProviderConfig
): AIProviderError {
  if (error instanceof Error && error.name === 'AbortError') {
    return new AIProviderError(
      'Image generation request timed out',
      'IMAGE_GENERATION_TIMEOUT',
      provider.id
    );
  }

  return new AIProviderError(
    error instanceof Error ? error.message : 'Image generation failed',
    'IMAGE_GENERATION_ERROR',
    provider.id
  );
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
function recordImageUsage(
  usageService: IUsageService,
  providerId: string,
  modelId: string,
  imageSize: string,
  durationMs: number,
  success: boolean
): void {
  void usageService.recordUsage({
    providerId,
    modelId,
    operationType: 'image-generation',
    imageSize,
    durationMs,
    success,
  }).catch((error: unknown) => {
    console.error('[AI] Failed to record usage:', error);
  });
}
