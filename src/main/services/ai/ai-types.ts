/**
 * AI Service Types
 *
 * Shared type definitions for AI generation operations.
 *
 * @module src/main/services/ai/ai-types
 */

import type { LanguageModel } from 'ai';
import type { ProviderCapability, ProviderConfig, ProviderType } from '@shared/ai/types';
import type { ModelRegistryEntry } from './registries';

// =============================================================================
// TEXT GENERATION TYPES
// =============================================================================

/**
 * Request for text generation (non-streaming).
 */
export interface TextGenerationRequest {
  /** The prompt text to generate from */
  prompt: string;
  /** Optional model ID (uses default if not specified) */
  modelId?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for generation (0-2) */
  temperature?: number;
  /** Optional system prompt */
  systemPrompt?: string;
}

/**
 * Response from text generation.
 */
export interface TextGenerationResponse {
  /** Generated text */
  text: string;
  /** Token usage statistics */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  /** Model ID that was used */
  modelId: string;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Controller for streaming operations.
 */
export interface StreamController {
  /** Abort the stream */
  abort: () => void;
  /** Promise that resolves when stream completes */
  completion: Promise<TextGenerationResponse>;
}

// =============================================================================
// EMBEDDING TYPES
// =============================================================================

/**
 * Request for generating embeddings.
 */
export interface EmbeddingRequest {
  /** Array of texts to embed */
  texts: string[];
  /** Optional model ID (uses default if not specified) */
  modelId?: string;
}

/**
 * Response from embedding generation.
 */
export interface EmbeddingResponse {
  /** Array of embedding vectors */
  embeddings: number[][];
  /** Dimension of each embedding vector */
  dimensions: number;
  /** Model ID that was used */
  modelId: string;
}

// =============================================================================
// IMAGE GENERATION TYPES
// =============================================================================

/**
 * Request for image generation.
 */
export interface ImageGenerationRequest {
  /** The prompt describing the image to generate */
  prompt: string;
  /** Image size */
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  /** Image quality */
  quality?: 'standard' | 'hd';
  /** Image style */
  style?: 'natural' | 'vivid';
}

/**
 * Response from image generation.
 */
export interface ImageGenerationResponse {
  /** URL of the generated image (if available) */
  imageUrl?: string;
  /** Base64-encoded image data (if available) */
  imageBase64?: string;
  /** Model ID that was used */
  modelId: string;
}

// =============================================================================
// SERVICE INTERFACES
// =============================================================================

/**
 * Interface for capability checking.
 */
export interface ICapabilityService {
  /** Check if a model supports a specific capability */
  hasCapability(providerId: string, modelId: string, capability: ProviderCapability): boolean;
  /** Get the model entry for capability checking */
  getModelEntry(providerType: ProviderType, modelId: string): ModelRegistryEntry | undefined;
}

/**
 * Interface for AI service operations.
 */
export interface IAIService {
  /** Generate text (non-streaming) */
  generateText(request: TextGenerationRequest): Promise<TextGenerationResponse>;
  /** Generate text with streaming */
  streamText(
    request: TextGenerationRequest,
    onChunk: (chunk: string) => void
  ): Promise<StreamController>;
  /** Generate embeddings */
  generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  /** Generate an image */
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
  /** Get the current active model */
  getActiveModel(): LanguageModel | null;
  /** Check if the service is ready for operations */
  isReady(): boolean;
}

// =============================================================================
// INTERNAL DELEGATION TYPES
// =============================================================================

/**
 * Resolves the active provider configuration with its API key.
 */
export type ProviderResolver = () => Promise<{
  provider: ProviderConfig;
  apiKey: string;
}>;

/**
 * Creates a language model instance for a given provider, API key, and model ID.
 */
export type ModelFactory = (
  config: ProviderConfig,
  apiKey: string,
  modelId: string
) => LanguageModel;

/**
 * Retrieves alternate provider IDs for rate-limit fallback.
 */
export type AlternateProvidersFn = (currentProviderId: string) => Promise<string[]>;
