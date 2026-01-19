/**
 * Anthropic Model Registry
 *
 * Static capability registry for Anthropic Claude models.
 * Provides model metadata, capabilities, and context window information.
 *
 * @module src/main/services/ai/registries/anthropic-registry
 */

import { ProviderCapability } from '../../../../shared/ai/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Registry entry for a model with its capabilities and constraints.
 */
export interface ModelRegistryEntry {
  /** Model identifier (e.g., 'claude-opus-4-5-20251101') */
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
// ANTHROPIC MODEL REGISTRY
// =============================================================================

/**
 * Static registry of Anthropic Claude models and their capabilities.
 *
 * Model Tiers:
 * - Claude 4.5: Latest generation (Opus 4.5, Sonnet 4.5)
 * - Claude 3.5: Mid-generation (Sonnet 3.5, Haiku 3.5)
 * - Claude 3: Previous generation (Opus 3)
 *
 * Note: All Claude models support 200K context window.
 * Haiku 3.5 does NOT support vision.
 */
const ANTHROPIC_MODELS: ModelRegistryEntry[] = [
  // ---------------------------------------------------------------------------
  // Claude 4.5 Generation
  // ---------------------------------------------------------------------------
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    capabilities: [
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
      ProviderCapability.VISION,
      ProviderCapability.TOOL_USE,
    ],
    contextWindow: 200000,
    maxOutputTokens: 8192,
  },
  {
    id: 'claude-sonnet-4-5-20251101',
    name: 'Claude Sonnet 4.5',
    capabilities: [
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
      ProviderCapability.VISION,
      ProviderCapability.TOOL_USE,
    ],
    contextWindow: 200000,
    maxOutputTokens: 8192,
  },

  // ---------------------------------------------------------------------------
  // Claude 3.5 Generation
  // ---------------------------------------------------------------------------
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    capabilities: [
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
      ProviderCapability.VISION,
      ProviderCapability.TOOL_USE,
    ],
    contextWindow: 200000,
    maxOutputTokens: 8192,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    capabilities: [
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
      ProviderCapability.TOOL_USE,
      // Note: Haiku 3.5 does NOT support vision
    ],
    contextWindow: 200000,
    maxOutputTokens: 8192,
  },

  // ---------------------------------------------------------------------------
  // Claude 3 Generation
  // ---------------------------------------------------------------------------
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    capabilities: [
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
      ProviderCapability.VISION,
      ProviderCapability.TOOL_USE,
    ],
    contextWindow: 200000,
    maxOutputTokens: 4096,
  },
];

// Create a lookup map for O(1) access by model ID
const modelLookup = new Map<string, ModelRegistryEntry>(
  ANTHROPIC_MODELS.map((model) => [model.id, model])
);

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get all registered Anthropic models.
 *
 * @returns Array of all Anthropic model registry entries
 */
export function getAnthropicModels(): ModelRegistryEntry[] {
  return [...ANTHROPIC_MODELS];
}

/**
 * Get a specific Anthropic model by its ID.
 *
 * @param modelId - The model identifier (e.g., 'claude-opus-4-5-20251101')
 * @returns The model registry entry, or undefined if not found
 */
export function getAnthropicModel(modelId: string): ModelRegistryEntry | undefined {
  return modelLookup.get(modelId);
}

/**
 * Check if a model ID is a valid Anthropic model.
 *
 * @param modelId - The model identifier to check
 * @returns True if the model is registered
 */
export function isAnthropicModel(modelId: string): boolean {
  return modelLookup.has(modelId);
}

/**
 * Get Anthropic models that support a specific capability.
 *
 * @param capability - The capability to filter by
 * @returns Array of models supporting the specified capability
 */
export function getAnthropicModelsByCapability(
  capability: ProviderCapability
): ModelRegistryEntry[] {
  return ANTHROPIC_MODELS.filter((model) => model.capabilities.includes(capability));
}

/**
 * Get all Anthropic chat models (text generation with streaming).
 *
 * @returns Array of chat-capable models
 */
export function getAnthropicChatModels(): ModelRegistryEntry[] {
  return ANTHROPIC_MODELS.filter(
    (model) =>
      model.capabilities.includes(ProviderCapability.TEXT_GENERATION) &&
      model.capabilities.includes(ProviderCapability.STREAMING)
  );
}

/**
 * Get all Anthropic models that support vision.
 *
 * @returns Array of vision-capable models
 */
export function getAnthropicVisionModels(): ModelRegistryEntry[] {
  return getAnthropicModelsByCapability(ProviderCapability.VISION);
}

/**
 * Get all Anthropic models that support tool use.
 *
 * @returns Array of tool-use capable models
 */
export function getAnthropicToolUseModels(): ModelRegistryEntry[] {
  return getAnthropicModelsByCapability(ProviderCapability.TOOL_USE);
}
