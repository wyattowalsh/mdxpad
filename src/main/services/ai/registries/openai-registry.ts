/**
 * OpenAI Model Registry
 *
 * Static capability registry for OpenAI models.
 * Provides model metadata, capabilities, and context window information.
 *
 * @module src/main/services/ai/registries/openai-registry
 */

import { ProviderCapability } from '../../../../shared/ai/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Registry entry for a model with its capabilities and constraints.
 */
export interface ModelRegistryEntry {
  /** Model identifier (e.g., 'gpt-4o') */
  id: string;
  /** Human-readable display name */
  name: string;
  /** List of supported capabilities */
  capabilities: ProviderCapability[];
  /** Context window size in tokens (for text models) */
  contextWindow?: number;
  /** Maximum output tokens (for text models) */
  maxOutputTokens?: number;
  /** Embedding vector dimensions (for embedding models) */
  embeddingDimensions?: number;
}

// =============================================================================
// OPENAI MODEL REGISTRY
// =============================================================================

/**
 * Static registry of OpenAI models and their capabilities.
 *
 * Categories:
 * - Chat models: GPT-4o family, GPT-4 Turbo, GPT-4
 * - Reasoning models: o1 family (no tool-use, no vision)
 * - Embedding models: text-embedding-3 family
 * - Image models: DALL-E 3
 */
const OPENAI_MODELS: ModelRegistryEntry[] = [
  // ---------------------------------------------------------------------------
  // Chat Models
  // ---------------------------------------------------------------------------
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    capabilities: [
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
      ProviderCapability.VISION,
      ProviderCapability.TOOL_USE,
    ],
    contextWindow: 128000,
    maxOutputTokens: 16384,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    capabilities: [
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
      ProviderCapability.VISION,
      ProviderCapability.TOOL_USE,
    ],
    contextWindow: 128000,
    maxOutputTokens: 16384,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    capabilities: [
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
      ProviderCapability.VISION,
      ProviderCapability.TOOL_USE,
    ],
    contextWindow: 128000,
    maxOutputTokens: 4096,
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    capabilities: [
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
      ProviderCapability.TOOL_USE,
    ],
    contextWindow: 8192,
    maxOutputTokens: 8192,
  },

  // ---------------------------------------------------------------------------
  // Reasoning Models (o1 family)
  // Note: These models do NOT support tool-use or vision
  // ---------------------------------------------------------------------------
  {
    id: 'o1',
    name: 'o1',
    capabilities: [
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
    ],
    contextWindow: 128000,
    maxOutputTokens: 32768,
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    capabilities: [
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
    ],
    contextWindow: 128000,
    maxOutputTokens: 65536,
  },
  {
    id: 'o1-pro',
    name: 'o1 Pro',
    capabilities: [
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
    ],
    contextWindow: 128000,
    maxOutputTokens: 32768,
  },

  // ---------------------------------------------------------------------------
  // Embedding Models
  // ---------------------------------------------------------------------------
  {
    id: 'text-embedding-3-small',
    name: 'Text Embedding 3 Small',
    capabilities: [ProviderCapability.EMBEDDINGS],
    embeddingDimensions: 1536,
  },
  {
    id: 'text-embedding-3-large',
    name: 'Text Embedding 3 Large',
    capabilities: [ProviderCapability.EMBEDDINGS],
    embeddingDimensions: 3072,
  },

  // ---------------------------------------------------------------------------
  // Image Generation Models
  // ---------------------------------------------------------------------------
  {
    id: 'dall-e-3',
    name: 'DALL-E 3',
    capabilities: [ProviderCapability.IMAGE_GENERATION],
  },
];

// Create a lookup map for O(1) access by model ID
const modelLookup = new Map<string, ModelRegistryEntry>(
  OPENAI_MODELS.map((model) => [model.id, model])
);

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get all registered OpenAI models.
 *
 * @returns Array of all OpenAI model registry entries
 */
export function getOpenAIModels(): ModelRegistryEntry[] {
  return [...OPENAI_MODELS];
}

/**
 * Get a specific OpenAI model by its ID.
 *
 * @param modelId - The model identifier (e.g., 'gpt-4o')
 * @returns The model registry entry, or undefined if not found
 */
export function getOpenAIModel(modelId: string): ModelRegistryEntry | undefined {
  return modelLookup.get(modelId);
}

/**
 * Check if a model ID is a valid OpenAI model.
 *
 * @param modelId - The model identifier to check
 * @returns True if the model is registered
 */
export function isOpenAIModel(modelId: string): boolean {
  return modelLookup.has(modelId);
}

/**
 * Get OpenAI models that support a specific capability.
 *
 * @param capability - The capability to filter by
 * @returns Array of models supporting the specified capability
 */
export function getOpenAIModelsByCapability(
  capability: ProviderCapability
): ModelRegistryEntry[] {
  return OPENAI_MODELS.filter((model) => model.capabilities.includes(capability));
}

/**
 * Get all OpenAI chat models (text generation with streaming).
 *
 * @returns Array of chat-capable models
 */
export function getOpenAIChatModels(): ModelRegistryEntry[] {
  return OPENAI_MODELS.filter(
    (model) =>
      model.capabilities.includes(ProviderCapability.TEXT_GENERATION) &&
      model.capabilities.includes(ProviderCapability.STREAMING) &&
      !model.capabilities.includes(ProviderCapability.EMBEDDINGS) &&
      !model.capabilities.includes(ProviderCapability.IMAGE_GENERATION)
  );
}

/**
 * Get all OpenAI embedding models.
 *
 * @returns Array of embedding-capable models
 */
export function getOpenAIEmbeddingModels(): ModelRegistryEntry[] {
  return getOpenAIModelsByCapability(ProviderCapability.EMBEDDINGS);
}

/**
 * Get all OpenAI image generation models.
 *
 * @returns Array of image generation models
 */
export function getOpenAIImageModels(): ModelRegistryEntry[] {
  return getOpenAIModelsByCapability(ProviderCapability.IMAGE_GENERATION);
}
