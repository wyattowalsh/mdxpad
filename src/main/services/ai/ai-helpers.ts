/**
 * AI Service Helpers
 *
 * Shared constants, utility functions, and helper logic used across
 * AI generation modules.
 *
 * @module src/main/services/ai/ai-helpers
 */

import type { ProviderConfig, ProviderCapability, ProviderType } from '@shared/ai/types';
import { ProviderCapability as Capability } from '@shared/ai/types';
import { AIProviderError, CapabilityNotSupportedError } from '@shared/ai/errors';
import {
  getOpenAIModel,
  getAnthropicModel,
  type ModelRegistryEntry,
} from './registries';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default models for each provider type */
export const DEFAULT_MODELS: Record<ProviderType, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  ollama: 'llama3',
  lmstudio: 'default',
  'openai-compatible': 'gpt-3.5-turbo',
};

/** Default embedding models for providers that support embeddings */
export const DEFAULT_EMBEDDING_MODELS: Partial<Record<ProviderType, string>> = {
  openai: 'text-embedding-3-small',
};

/** Default image generation models */
export const DEFAULT_IMAGE_MODELS: Partial<Record<ProviderType, string>> = {
  openai: 'dall-e-3',
};

// =============================================================================
// DEFAULT MODEL GETTERS
// =============================================================================

/**
 * Gets the default model for a provider type.
 */
export function getDefaultModel(providerType: ProviderType): string {
  return DEFAULT_MODELS[providerType];
}

/**
 * Gets the default embedding model for a provider type.
 */
export function getDefaultEmbeddingModel(providerType: ProviderType): string | undefined {
  return DEFAULT_EMBEDDING_MODELS[providerType];
}

/**
 * Gets the default image generation model for a provider type.
 */
export function getDefaultImageModel(providerType: ProviderType): string | undefined {
  return DEFAULT_IMAGE_MODELS[providerType];
}

// =============================================================================
// ERROR HELPERS
// =============================================================================

/**
 * Checks if an error is a rate limit error.
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('rate limit') || message.includes('429');
  }
  return false;
}

/**
 * Extracts retry-after seconds from an error.
 */
export function extractRetryAfter(error: unknown): number {
  if (error instanceof Error && 'headers' in error) {
    const headers = (error as { headers?: Record<string, string> }).headers;
    const retryAfter = headers?.['retry-after'];
    if (retryAfter) {
      const parsed = parseInt(retryAfter, 10);
      return isNaN(parsed) ? 60 : parsed;
    }
  }
  return 60;
}

/**
 * Wraps an unknown error in an AIProviderError.
 */
export function wrapError(error: unknown, provider: ProviderConfig): AIProviderError {
  if (error instanceof AIProviderError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new AIProviderError(message, 'GENERATION_ERROR', provider.id);
}

// =============================================================================
// CAPABILITY HELPERS
// =============================================================================

/**
 * Gets the model entry from the appropriate registry.
 */
export function getModelEntry(
  providerType: ProviderType,
  modelId: string
): ModelRegistryEntry | undefined {
  switch (providerType) {
    case 'openai':
    case 'openai-compatible':
      return getOpenAIModel(modelId);
    case 'anthropic':
      return getAnthropicModel(modelId);
    default:
      return undefined;
  }
}

/**
 * Checks if a model has a specific capability.
 */
export function modelHasCapability(
  providerType: ProviderType,
  modelId: string,
  capability: ProviderCapability
): boolean {
  const entry = getModelEntry(providerType, modelId);
  if (!entry) {
    // For unknown models (e.g., Ollama, LMStudio), assume basic capabilities
    return capability === Capability.TEXT_GENERATION || capability === Capability.STREAMING;
  }
  return entry.capabilities.includes(capability);
}

/**
 * Validates that a model supports a required capability.
 * Throws CapabilityNotSupportedError if not.
 */
export function validateCapability(
  provider: ProviderConfig,
  modelId: string,
  capability: ProviderCapability
): void {
  if (!modelHasCapability(provider.type, modelId, capability)) {
    throw new CapabilityNotSupportedError(capability, modelId, provider.id);
  }
}

// =============================================================================
// PROVIDER HELPERS
// =============================================================================

/**
 * Checks if a provider type requires an API key.
 */
export function requiresApiKey(providerType: ProviderType): boolean {
  return providerType === 'openai' || providerType === 'anthropic';
}
