/**
 * AI Service Facade
 *
 * Thin orchestration layer that delegates text generation, streaming,
 * embeddings, and image generation to focused modules. Owns provider
 * resolution, model caching (with credential-aware invalidation), and
 * the public IAIService interface.
 *
 * @module src/main/services/ai/ai-service
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel, EmbeddingModel } from 'ai';

import type { ProviderConfig } from '@shared/ai/types';
import {
  NoActiveProviderError,
  AIProviderError,
} from '@shared/ai/errors';

import type { ICredentialService } from './credential-service';
import type { IProviderService } from './provider-service';
import type { IUsageService } from './usage-service';

// Re-export all public types from ai-types so consumers importing from
// './ai-service' continue to work unchanged.
export type {
  TextGenerationRequest,
  TextGenerationResponse,
  StreamController,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ICapabilityService,
  IAIService,
} from './ai-types';

import type {
  TextGenerationRequest,
  TextGenerationResponse,
  StreamController,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  IAIService,
} from './ai-types';

import { requiresApiKey } from './ai-helpers';

// Domain modules
import { performTextGeneration, performStreamText } from './text-generation';
import { performEmbedding } from './embedding';
import { performImageGeneration } from './image';

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
  /** Track the API key hash used when the model was cached (P1-7 fix) */
  private cachedApiKeyHash: string | null = null;

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

  // ===========================================================================
  // PUBLIC API (delegates to domain modules)
  // ===========================================================================

  /**
   * Generates text using the active provider.
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    return performTextGeneration(
      request,
      this.resolveProvider,
      this.createLanguageModel,
      this.usageService,
      this.getAlternateProviders
    );
  }

  /**
   * Streams text generation using the active provider.
   */
  async streamText(
    request: TextGenerationRequest,
    onChunk: (chunk: string) => void
  ): Promise<StreamController> {
    return performStreamText(
      request,
      onChunk,
      this.resolveProvider,
      this.createLanguageModel,
      this.usageService,
      this.getAlternateProviders
    );
  }

  /**
   * Generates embeddings using the active provider.
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return performEmbedding(
      request,
      this.resolveProvider,
      this.createEmbeddingModel,
      this.usageService
    );
  }

  /**
   * Generates an image using the active provider.
   * Note: Currently only supported by OpenAI.
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    return performImageGeneration(
      request,
      this.resolveProvider,
      this.usageService,
      this.getAlternateProviders
    );
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

  /**
   * Invalidates the cached model and state.
   * Should be called when credentials change or provider is updated.
   */
  invalidateCache(): void {
    this.cachedModel = null;
    this.cachedProviderId = null;
    this.cachedModelId = null;
    this.cachedApiKeyHash = null;
  }

  // ===========================================================================
  // PRIVATE: Provider Resolution (bound arrow functions for delegation)
  // ===========================================================================

  /**
   * Resolves the active provider with its API key.
   * Bound as arrow function so it can be passed to domain modules.
   */
  private resolveProvider = async (): Promise<{
    provider: ProviderConfig;
    apiKey: string;
  }> => {
    const provider = await this.providerService.getActiveProvider();
    if (!provider) {
      throw new NoActiveProviderError();
    }

    const apiKey = await this.credentialService.getCredential(provider.id);
    if (!apiKey && requiresApiKey(provider.type)) {
      throw new AIProviderError(
        'API key not configured for active provider',
        'MISSING_API_KEY',
        provider.id
      );
    }

    return { provider, apiKey: apiKey ?? '' };
  };

  /**
   * Gets alternate provider IDs for rate limit fallback.
   * Bound as arrow function so it can be passed to domain modules.
   */
  private getAlternateProviders = async (currentProviderId: string): Promise<string[]> => {
    const providers = await this.providerService.getProviders();
    return providers
      .filter((p) => p.id !== currentProviderId && p.status === 'connected')
      .map((p) => p.id);
  };

  // ===========================================================================
  // PRIVATE: Model Creation (bound arrow functions for delegation)
  // ===========================================================================

  /**
   * Creates a language model instance for text generation.
   * Caches the model, invalidating on provider/model/key changes (P1-7 fix).
   * Bound as arrow function so it can be passed to domain modules.
   */
  private createLanguageModel = (
    config: ProviderConfig,
    apiKey: string,
    modelId: string
  ): LanguageModel => {
    const keyHash = simpleHash(apiKey);

    // Check cache -- invalidate if API key changed (P1-7 fix)
    if (
      this.cachedModel &&
      this.cachedProviderId === config.id &&
      this.cachedModelId === modelId &&
      this.cachedApiKeyHash === keyHash
    ) {
      return this.cachedModel;
    }

    const provider = this.createProviderInstance(config, apiKey);
    const model = provider(modelId) as LanguageModel;

    // Update cache
    this.cachedModel = model;
    this.cachedProviderId = config.id;
    this.cachedModelId = modelId;
    this.cachedApiKeyHash = keyHash;

    return model;
  };

  /**
   * Creates an embedding model instance.
   * Bound as arrow function so it can be passed to domain modules.
   */
  private createEmbeddingModel = (
    config: ProviderConfig,
    apiKey: string,
    modelId: string
  ): EmbeddingModel => {
    const provider = this.createProviderInstance(config, apiKey);
    return provider.embeddingModel(modelId);
  };

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
          `Unsupported provider type: ${String(config.type)}`,
          'UNSUPPORTED_PROVIDER',
          config.id
        );
    }
  }
}

// =============================================================================
// PRIVATE UTILITIES
// =============================================================================

/**
 * Produces a simple numeric hash of a string for cache-key comparison.
 * Not cryptographic -- only used to detect API key changes cheaply.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return String(hash);
}
