/**
 * Model Registries Index
 *
 * Re-exports all model registry functions and types for convenient imports.
 *
 * @module src/main/services/ai/registries
 */

// Export the shared interface
export type { ModelRegistryEntry } from './openai-registry';

// Export OpenAI registry functions
export {
  getOpenAIModels,
  getOpenAIModel,
  isOpenAIModel,
  getOpenAIModelsByCapability,
  getOpenAIChatModels,
  getOpenAIEmbeddingModels,
  getOpenAIImageModels,
} from './openai-registry';

// Export Anthropic registry functions
export {
  getAnthropicModels,
  getAnthropicModel,
  isAnthropicModel,
  getAnthropicModelsByCapability,
  getAnthropicChatModels,
  getAnthropicVisionModels,
  getAnthropicToolUseModels,
} from './anthropic-registry';
