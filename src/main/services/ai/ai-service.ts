/**
 * AI Service for AI Generation Operations
 *
 * Provides text generation, streaming, embeddings, and image generation
 * using the Vercel AI SDK. Coordinates with CredentialService for API keys,
 * ProviderService for provider configuration, and UsageService for tracking.
 *
 * @module src/main/services/ai/ai-service
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText, embedMany } from 'ai';
import type { LanguageModel, EmbeddingModel } from 'ai';

import type { ProviderConfig, ProviderType, ProviderCapability } from '@shared/ai/types';
import {
  NoActiveProviderError,
  CapabilityNotSupportedError,
  RateLimitError,
  AIProviderError,
} from '@shared/ai/errors';
import { ProviderCapability as Capability } from '@shared/ai/types';

import type { ICredentialService } from './credential-service';
import type { IProviderService } from './provider-service';
import type { IUsageService } from './usage-service';
import {
  getOpenAIModel,
  getAnthropicModel,
  type ModelRegistryEntry,
} from './registries';

// =============================================================================
// TYPES
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
// CONSTANTS
// =============================================================================

/** Default models for each provider type */
const DEFAULT_MODELS: Record<ProviderType, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  ollama: 'llama3',
  lmstudio: 'default',
  'openai-compatible': 'gpt-3.5-turbo',
};

/** Default embedding models for providers that support embeddings */
const DEFAULT_EMBEDDING_MODELS: Partial<Record<ProviderType, string>> = {
  openai: 'text-embedding-3-small',
};

/** Default image generation models */
const DEFAULT_IMAGE_MODELS: Partial<Record<ProviderType, string>> = {
  openai: 'dall-e-3',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Gets the default model for a provider type.
 */
function getDefaultModel(providerType: ProviderType): string {
  return DEFAULT_MODELS[providerType];
}

/**
 * Gets the default embedding model for a provider type.
 */
function getDefaultEmbeddingModel(providerType: ProviderType): string | undefined {
  return DEFAULT_EMBEDDING_MODELS[providerType];
}

/**
 * Gets the default image generation model for a provider type.
 */
function getDefaultImageModel(providerType: ProviderType): string | undefined {
  return DEFAULT_IMAGE_MODELS[providerType];
}

/**
 * Checks if an error is a rate limit error.
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('rate limit') || message.includes('429');
  }
  return false;
}

/**
 * Extracts retry-after seconds from an error.
 */
function extractRetryAfter(error: unknown): number {
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
 * Gets the model entry from the appropriate registry.
 */
function getModelEntry(
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
function modelHasCapability(
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

// =============================================================================
// AI SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Service for AI generation operations using Vercel AI SDK.
 *
 * Coordinates with CredentialService for API keys, ProviderService for
 * provider configuration, and UsageService for usage tracking.
 *
 * @example
 * ```typescript
 * const aiService = new AIService(credentialService, providerService, usageService);
 *
 * // Generate text
 * const result = await aiService.generateText({
 *   prompt: 'Hello, world!',
 *   maxTokens: 100,
 * });
 *
 * // Stream text
 * const controller = await aiService.streamText(
 *   { prompt: 'Tell me a story' },
 *   (chunk) => console.log(chunk)
 * );
 * const result = await controller.completion;
 * ```
 */
export class AIService implements IAIService {
  private readonly credentialService: ICredentialService;
  private readonly providerService: IProviderService;
  private readonly usageService: IUsageService;

  /** Cached active model instance */
  private cachedModel: LanguageModel | null = null;
  private cachedProviderId: string | null = null;
  private cachedModelId: string | null = null;

  /**
   * Creates a new AIService instance.
   */
  constructor(
    credentialService: ICredentialService,
    providerService: IProviderService,
    usageService: IUsageService
  ) {
    this.credentialService = credentialService;
    this.providerService = providerService;
    this.usageService = usageService;
  }

  /**
   * Generates text using the active provider.
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const { provider, apiKey } = await this.getActiveProviderWithKey();
    const modelId = request.modelId ?? getDefaultModel(provider.type);

    this.validateCapability(provider, modelId, Capability.TEXT_GENERATION);

    const model = this.createLanguageModel(provider, apiKey, modelId);
    const startTime = Date.now();

    try {
      const result = await generateText({
        model,
        prompt: request.prompt,
        ...(request.maxTokens !== undefined && { maxOutputTokens: request.maxTokens }),
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(request.systemPrompt !== undefined && { system: request.systemPrompt }),
      });

      const response = this.buildTextResponse(result, modelId, startTime);
      await this.recordUsage(provider.id, modelId, 'text-generation', response, true);
      return response;
    } catch (error) {
      await this.handleGenerationError(error, provider, modelId, startTime);
      throw error; // Re-throw after handling
    }
  }

  /**
   * Streams text generation using the active provider.
   */
  async streamText(
    request: TextGenerationRequest,
    onChunk: (chunk: string) => void
  ): Promise<StreamController> {
    const { provider, apiKey } = await this.getActiveProviderWithKey();
    const modelId = request.modelId ?? getDefaultModel(provider.type);

    this.validateCapability(provider, modelId, Capability.STREAMING);

    const model = this.createLanguageModel(provider, apiKey, modelId);
    const abortController = new AbortController();
    const startTime = Date.now();

    const stream = streamText({
      model,
      prompt: request.prompt,
      abortSignal: abortController.signal,
      ...(request.maxTokens !== undefined && { maxOutputTokens: request.maxTokens }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.systemPrompt !== undefined && { system: request.systemPrompt }),
    });

    const completion = this.processStream(
      stream,
      onChunk,
      provider,
      modelId,
      startTime
    );

    return {
      abort: () => abortController.abort(),
      completion,
    };
  }

  /**
   * Generates embeddings using the active provider.
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const { provider, apiKey } = await this.getActiveProviderWithKey();
    const modelId = request.modelId ?? getDefaultEmbeddingModel(provider.type);

    if (!modelId) {
      throw new CapabilityNotSupportedError(
        Capability.EMBEDDINGS,
        'default',
        provider.id
      );
    }

    this.validateCapability(provider, modelId, Capability.EMBEDDINGS);

    const model = this.createEmbeddingModel(provider, apiKey, modelId);
    const startTime = Date.now();

    try {
      const result = await embedMany({
        model,
        values: request.texts,
      });

      const embeddings = result.embeddings.map((e) => Array.from(e));
      const dimensions = embeddings[0]?.length ?? 0;

      await this.recordEmbeddingUsage(
        provider.id,
        modelId,
        dimensions,
        Date.now() - startTime,
        true
      );

      return { embeddings, dimensions, modelId };
    } catch (error) {
      await this.recordEmbeddingUsage(
        provider.id,
        modelId,
        0,
        Date.now() - startTime,
        false
      );
      throw this.wrapError(error, provider);
    }
  }

  /**
   * Generates an image using the active provider.
   * Note: Currently only supported by OpenAI.
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const { provider, apiKey } = await this.getActiveProviderWithKey();
    const modelId = getDefaultImageModel(provider.type);

    if (!modelId) {
      throw new CapabilityNotSupportedError(
        Capability.IMAGE_GENERATION,
        'default',
        provider.id
      );
    }

    this.validateCapability(provider, modelId, Capability.IMAGE_GENERATION);

    // Image generation uses OpenAI's API directly (not Vercel AI SDK)
    const response = await this.generateOpenAIImage(
      apiKey,
      provider,
      request,
      modelId
    );

    return response;
  }

  /**
   * Gets the currently active language model instance.
   */
  getActiveModel(): LanguageModel | null {
    return this.cachedModel;
  }

  /**
   * Checks if the service is ready for operations.
   */
  isReady(): boolean {
    return this.cachedModel !== null;
  }

  // ===========================================================================
  // PRIVATE: Provider and Model Creation
  // ===========================================================================

  /**
   * Gets the active provider with its API key.
   */
  private async getActiveProviderWithKey(): Promise<{
    provider: ProviderConfig;
    apiKey: string;
  }> {
    const provider = await this.providerService.getActiveProvider();
    if (!provider) {
      throw new NoActiveProviderError();
    }

    const apiKey = await this.credentialService.getCredential(provider.id);
    if (!apiKey && this.requiresApiKey(provider.type)) {
      throw new AIProviderError(
        'API key not configured for active provider',
        'MISSING_API_KEY',
        provider.id
      );
    }

    return { provider, apiKey: apiKey ?? '' };
  }

  /**
   * Checks if a provider type requires an API key.
   */
  private requiresApiKey(providerType: ProviderType): boolean {
    return providerType === 'openai' || providerType === 'anthropic';
  }

  /**
   * Creates a provider instance using the Vercel AI SDK.
   */
  private createProviderInstance(
    config: ProviderConfig,
    apiKey: string
  ): ReturnType<typeof createOpenAI> | ReturnType<typeof createAnthropic> {
    switch (config.type) {
      case 'openai':
        return createOpenAI({ apiKey });
      case 'anthropic':
        return createAnthropic({ apiKey });
      case 'ollama':
      case 'lmstudio':
      case 'openai-compatible':
        return createOpenAI({
          apiKey,
          ...(config.baseUrl !== undefined && { baseURL: config.baseUrl }),
        });
      default:
        throw new AIProviderError(
          `Unsupported provider type: ${config.type}`,
          'UNSUPPORTED_PROVIDER',
          config.id
        );
    }
  }

  /**
   * Creates a language model instance for text generation.
   */
  private createLanguageModel(
    config: ProviderConfig,
    apiKey: string,
    modelId: string
  ): LanguageModel {
    // Check cache
    if (
      this.cachedModel &&
      this.cachedProviderId === config.id &&
      this.cachedModelId === modelId
    ) {
      return this.cachedModel;
    }

    const provider = this.createProviderInstance(config, apiKey);
    const model = provider(modelId) as LanguageModel;

    // Update cache
    this.cachedModel = model;
    this.cachedProviderId = config.id;
    this.cachedModelId = modelId;

    return model;
  }

  /**
   * Creates an embedding model instance.
   */
  private createEmbeddingModel(
    config: ProviderConfig,
    apiKey: string,
    modelId: string
  ): EmbeddingModel {
    const provider = this.createProviderInstance(config, apiKey);
    return provider.embeddingModel(modelId);
  }

  // ===========================================================================
  // PRIVATE: Capability Validation
  // ===========================================================================

  /**
   * Validates that a model supports a required capability.
   */
  private validateCapability(
    provider: ProviderConfig,
    modelId: string,
    capability: ProviderCapability
  ): void {
    if (!modelHasCapability(provider.type, modelId, capability)) {
      throw new CapabilityNotSupportedError(capability, modelId, provider.id);
    }
  }

  // ===========================================================================
  // PRIVATE: Response Building
  // ===========================================================================

  /**
   * Builds a text generation response from the AI SDK result.
   */
  private buildTextResponse(
    result: Awaited<ReturnType<typeof generateText>>,
    modelId: string,
    startTime: number
  ): TextGenerationResponse {
    return {
      text: result.text,
      usage: {
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
      },
      modelId,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Processes a text stream and returns the completion.
   */
  private async processStream(
    stream: ReturnType<typeof streamText>,
    onChunk: (chunk: string) => void,
    provider: ProviderConfig,
    modelId: string,
    startTime: number
  ): Promise<TextGenerationResponse> {
    let fullText = '';

    try {
      for await (const chunk of stream.textStream) {
        fullText += chunk;
        onChunk(chunk);
      }

      const usage = await stream.usage;
      const response: TextGenerationResponse = {
        text: fullText,
        usage: {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          totalTokens: usage.totalTokens ?? 0,
        },
        modelId,
        durationMs: Date.now() - startTime,
      };

      await this.recordUsage(provider.id, modelId, 'streaming-generation', response, true);
      return response;
    } catch (error) {
      await this.handleGenerationError(error, provider, modelId, startTime);
      throw error;
    }
  }

  // ===========================================================================
  // PRIVATE: Image Generation
  // ===========================================================================

  /**
   * Generates an image using OpenAI's image generation API.
   */
  private async generateOpenAIImage(
    apiKey: string,
    provider: ProviderConfig,
    request: ImageGenerationRequest,
    modelId: string
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
      await this.recordImageUsage(
        provider.id,
        modelId,
        request.size ?? '1024x1024',
        Date.now() - startTime,
        false
      );
      await this.handleImageApiError(response, provider);
    }

    const data = (await response.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
    };
    const imageData = data.data?.[0];

    await this.recordImageUsage(
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
  private async handleImageApiError(
    response: Response,
    provider: ProviderConfig
  ): Promise<never> {
    if (response.status === 429) {
      const alternates = await this.getAlternateProviders(provider.id);
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

  // ===========================================================================
  // PRIVATE: Error Handling
  // ===========================================================================

  /**
   * Handles generation errors, including rate limiting.
   */
  private async handleGenerationError(
    error: unknown,
    provider: ProviderConfig,
    modelId: string,
    startTime: number
  ): Promise<void> {
    const durationMs = Date.now() - startTime;

    await this.usageService.recordUsage({
      providerId: provider.id,
      modelId,
      operationType: 'text-generation',
      durationMs,
      success: false,
      errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
    });

    if (isRateLimitError(error)) {
      const alternates = await this.getAlternateProviders(provider.id);
      throw new RateLimitError(provider.id, extractRetryAfter(error), alternates);
    }

    throw this.wrapError(error, provider);
  }

  /**
   * Wraps an unknown error in an AIProviderError.
   */
  private wrapError(error: unknown, provider: ProviderConfig): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    return new AIProviderError(message, 'GENERATION_ERROR', provider.id);
  }

  /**
   * Gets alternate provider IDs for rate limit fallback.
   */
  private async getAlternateProviders(currentProviderId: string): Promise<string[]> {
    const providers = await this.providerService.getProviders();
    return providers
      .filter((p) => p.id !== currentProviderId && p.status === 'connected')
      .map((p) => p.id);
  }

  // ===========================================================================
  // PRIVATE: Usage Recording
  // ===========================================================================

  /**
   * Records text generation usage.
   */
  private async recordUsage(
    providerId: string,
    modelId: string,
    operationType: 'text-generation' | 'streaming-generation',
    response: TextGenerationResponse,
    success: boolean
  ): Promise<void> {
    await this.usageService.recordUsage({
      providerId,
      modelId,
      operationType,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      durationMs: response.durationMs,
      success,
    });
  }

  /**
   * Records embedding generation usage.
   */
  private async recordEmbeddingUsage(
    providerId: string,
    modelId: string,
    dimensions: number,
    durationMs: number,
    success: boolean
  ): Promise<void> {
    await this.usageService.recordUsage({
      providerId,
      modelId,
      operationType: 'embedding',
      embeddingDimensions: dimensions,
      durationMs,
      success,
    });
  }

  /**
   * Records image generation usage.
   */
  private async recordImageUsage(
    providerId: string,
    modelId: string,
    imageSize: string,
    durationMs: number,
    success: boolean
  ): Promise<void> {
    await this.usageService.recordUsage({
      providerId,
      modelId,
      operationType: 'image-generation',
      imageSize,
      durationMs,
      success,
    });
  }
}
