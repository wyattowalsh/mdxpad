/**
 * Capability Service for AI Model Capability Detection
 *
 * Provides hybrid capability detection using static registries for cloud providers
 * (OpenAI, Anthropic) and dynamic probing for local providers (Ollama, LM Studio).
 * Implements a 5-minute TTL cache for dynamically detected capabilities.
 *
 * @module src/main/services/ai/capability-service
 */

import type {
  ProviderConfig,
  ModelCapabilities,
  ProviderCapability,
  CapabilityConstraints,
} from '../../../shared/ai/types';
import { ProviderNotFoundError } from '../../../shared/ai/errors';
import type { IProviderService } from './provider-service';
import {
  getOpenAIModels,
  getOpenAIModel,
  type ModelRegistryEntry,
} from './registries/openai-registry';
import {
  getAnthropicModels,
  getAnthropicModel,
} from './registries/anthropic-registry';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Model information with capabilities summary.
 */
export interface ModelInfo {
  /** Model identifier */
  id: string;
  /** Human-readable display name */
  name: string;
  /** List of supported capabilities */
  capabilities: ProviderCapability[];
  /** Context window size in tokens */
  contextWindow?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
}

/**
 * Interface for capability service operations.
 */
export interface ICapabilityService {
  /** Get capabilities for a specific model */
  getCapabilities(providerId: string, modelId: string): Promise<ModelCapabilities>;
  /** List all available models for a provider */
  listModels(providerId: string): Promise<ModelInfo[]>;
  /** Check if a model has a specific capability */
  hasCapability(
    providerId: string,
    modelId: string,
    capability: ProviderCapability
  ): Promise<boolean>;
  /** Refresh capabilities cache for a provider */
  refreshCapabilities(providerId: string): Promise<void>;
  /** Get all providers that support a specific capability */
  getProvidersWithCapability(capability: ProviderCapability): Promise<string[]>;
}

/**
 * Cached capability entry with expiration.
 */
interface CachedCapabilities {
  /** Map of model ID to capabilities */
  capabilities: Map<string, ModelCapabilities>;
  /** Expiration timestamp (Date.now() + TTL) */
  expiresAt: number;
}

/**
 * Ollama model show response structure.
 */
interface OllamaShowResponse {
  capabilities?: string[];
  details?: {
    family?: string;
    families?: string[];
    parameter_size?: string;
  };
  model_info?: {
    context_length?: number;
    [key: string]: unknown;
  };
}

/**
 * Ollama tags response structure.
 */
interface OllamaTagsResponse {
  models?: Array<{
    name: string;
    modified_at?: string;
    size?: number;
  }>;
}

/**
 * OpenAI-compatible models response structure.
 */
interface OpenAIModelsResponse {
  data?: Array<{
    id: string;
    object?: string;
    owned_by?: string;
  }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Cache TTL: 5 minutes in milliseconds */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Fetch timeout for probing requests */
const PROBE_TIMEOUT_MS = 10_000;

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Service for detecting and managing AI model capabilities.
 *
 * Uses a hybrid approach:
 * - Static registry lookups for OpenAI and Anthropic (reliable, immediate)
 * - Dynamic probing for Ollama and local providers (flexible, cached)
 *
 * @example
 * ```typescript
 * const capabilityService = new CapabilityService(providerService);
 *
 * // Check if a model supports vision
 * const hasVision = await capabilityService.hasCapability(
 *   'provider-1',
 *   'gpt-4o',
 *   ProviderCapability.VISION
 * );
 *
 * // List all available models
 * const models = await capabilityService.listModels('provider-1');
 * ```
 */
export class CapabilityService implements ICapabilityService {
  /** Provider service for looking up provider configurations */
  private readonly providerService: IProviderService;

  /** Cache for dynamically detected capabilities */
  private readonly capabilityCache = new Map<string, CachedCapabilities>();

  /**
   * Creates a new CapabilityService instance.
   * @param providerService - Service for managing provider configurations
   */
  constructor(providerService: IProviderService) {
    this.providerService = providerService;
  }

  /**
   * Gets capabilities for a specific model.
   *
   * @param providerId - Provider ID
   * @param modelId - Model identifier
   * @returns Model capabilities
   * @throws ProviderNotFoundError if provider doesn't exist
   */
  async getCapabilities(
    providerId: string,
    modelId: string
  ): Promise<ModelCapabilities> {
    const provider = await this.requireProvider(providerId);
    return this.getCapabilitiesForProvider(provider, modelId);
  }

  /**
   * Lists all available models for a provider.
   *
   * @param providerId - Provider ID
   * @returns Array of model information
   * @throws ProviderNotFoundError if provider doesn't exist
   */
  async listModels(providerId: string): Promise<ModelInfo[]> {
    const provider = await this.requireProvider(providerId);

    switch (provider.type) {
      case 'openai':
        return this.listOpenAIModels();
      case 'anthropic':
        return this.listAnthropicModels();
      case 'ollama':
        return this.listOllamaModels(provider);
      case 'lmstudio':
      case 'openai-compatible':
        return this.listOpenAICompatibleModels(provider);
      default:
        return [];
    }
  }

  /**
   * Checks if a model has a specific capability.
   *
   * @param providerId - Provider ID
   * @param modelId - Model identifier
   * @param capability - Capability to check
   * @returns True if capability is supported
   * @throws ProviderNotFoundError if provider doesn't exist
   */
  async hasCapability(
    providerId: string,
    modelId: string,
    capability: ProviderCapability
  ): Promise<boolean> {
    const capabilities = await this.getCapabilities(providerId, modelId);
    return capabilities.capabilities.has(capability);
  }

  /**
   * Refreshes the capabilities cache for a provider.
   * Clears the cache entry, forcing a fresh probe on next access.
   *
   * @param providerId - Provider ID
   * @throws ProviderNotFoundError if provider doesn't exist
   */
  async refreshCapabilities(providerId: string): Promise<void> {
    await this.requireProvider(providerId);
    this.capabilityCache.delete(providerId);
  }

  /**
   * Gets all providers that support a specific capability.
   *
   * @param capability - Capability to search for
   * @returns Array of provider IDs that support the capability
   */
  async getProvidersWithCapability(
    capability: ProviderCapability
  ): Promise<string[]> {
    const providers = await this.providerService.getProviders();
    const result: string[] = [];

    for (const provider of providers) {
      const hasCapability = await this.providerHasCapability(provider, capability);
      if (hasCapability) {
        result.push(provider.id);
      }
    }

    return result;
  }

  // ===========================================================================
  // PRIVATE: Provider Retrieval
  // ===========================================================================

  /**
   * Retrieves and validates a provider exists.
   */
  private async requireProvider(providerId: string): Promise<ProviderConfig> {
    const provider = await this.providerService.getProvider(providerId);
    if (!provider) {
      throw new ProviderNotFoundError(providerId);
    }
    return provider;
  }

  // ===========================================================================
  // PRIVATE: Capability Detection by Provider Type
  // ===========================================================================

  /**
   * Gets capabilities based on provider type.
   */
  private async getCapabilitiesForProvider(
    provider: ProviderConfig,
    modelId: string
  ): Promise<ModelCapabilities> {
    switch (provider.type) {
      case 'openai':
        return this.getOpenAICapabilities(modelId);
      case 'anthropic':
        return this.getAnthropicCapabilities(modelId);
      case 'ollama':
        return this.getOllamaCapabilities(provider, modelId);
      case 'lmstudio':
      case 'openai-compatible':
        return this.getLocalCapabilities(provider, modelId);
      default:
        return this.createEmptyCapabilities(modelId);
    }
  }

  /**
   * Gets capabilities for an OpenAI model from static registry.
   */
  private getOpenAICapabilities(modelId: string): ModelCapabilities {
    const model = getOpenAIModel(modelId);
    if (!model) {
      return this.createEmptyCapabilities(modelId);
    }
    return this.registryEntryToCapabilities(model);
  }

  /**
   * Gets capabilities for an Anthropic model from static registry.
   */
  private getAnthropicCapabilities(modelId: string): ModelCapabilities {
    const model = getAnthropicModel(modelId);
    if (!model) {
      return this.createEmptyCapabilities(modelId);
    }
    return this.registryEntryToCapabilities(model);
  }

  /**
   * Gets capabilities for an Ollama model via dynamic probing.
   */
  private async getOllamaCapabilities(
    provider: ProviderConfig,
    modelId: string
  ): Promise<ModelCapabilities> {
    const cached = this.getCachedCapabilities(provider.id, modelId);
    if (cached) {
      return cached;
    }

    const capabilities = await this.probeOllamaModel(provider.baseUrl!, modelId);
    this.cacheCapabilities(provider.id, modelId, capabilities);
    return capabilities;
  }

  /**
   * Gets capabilities for a local provider model.
   */
  private async getLocalCapabilities(
    provider: ProviderConfig,
    modelId: string
  ): Promise<ModelCapabilities> {
    const cached = this.getCachedCapabilities(provider.id, modelId);
    if (cached) {
      return cached;
    }

    // For OpenAI-compatible providers, assume basic text generation capabilities
    const capabilities = this.createBasicTextCapabilities(modelId);
    this.cacheCapabilities(provider.id, modelId, capabilities);
    return capabilities;
  }

  // ===========================================================================
  // PRIVATE: Model Listing by Provider Type
  // ===========================================================================

  /**
   * Lists OpenAI models from static registry.
   */
  private listOpenAIModels(): ModelInfo[] {
    return getOpenAIModels().map(this.registryEntryToModelInfo);
  }

  /**
   * Lists Anthropic models from static registry.
   */
  private listAnthropicModels(): ModelInfo[] {
    return getAnthropicModels().map(this.registryEntryToModelInfo);
  }

  /**
   * Lists Ollama models via API probing.
   */
  private async listOllamaModels(provider: ProviderConfig): Promise<ModelInfo[]> {
    if (!provider.baseUrl) {
      return [];
    }

    try {
      const models = await this.fetchOllamaModels(provider.baseUrl);
      const modelInfos: ModelInfo[] = [];

      for (const model of models) {
        const capabilities = await this.getOllamaCapabilities(provider, model);
        modelInfos.push(this.capabilitiesToModelInfo(capabilities, model));
      }

      return modelInfos;
    } catch {
      return [];
    }
  }

  /**
   * Lists OpenAI-compatible models via API probing.
   */
  private async listOpenAICompatibleModels(
    provider: ProviderConfig
  ): Promise<ModelInfo[]> {
    if (!provider.baseUrl) {
      return [];
    }

    try {
      const models = await this.fetchOpenAICompatibleModels(provider.baseUrl);
      return models.map((id) => ({
        id,
        name: id,
        capabilities: [
          'text-generation' as ProviderCapability,
          'streaming' as ProviderCapability,
        ],
      }));
    } catch {
      return [];
    }
  }

  // ===========================================================================
  // PRIVATE: Ollama Probing
  // ===========================================================================

  /**
   * Probes an Ollama model for capabilities.
   */
  private async probeOllamaModel(
    baseUrl: string,
    modelId: string
  ): Promise<ModelCapabilities> {
    try {
      const response = await this.fetchWithTimeout(
        `${baseUrl}/api/show`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelId }),
        }
      );

      if (!response.ok) {
        return this.createBasicTextCapabilities(modelId);
      }

      const data = (await response.json()) as OllamaShowResponse;
      return this.parseOllamaCapabilities(modelId, data);
    } catch {
      return this.createBasicTextCapabilities(modelId);
    }
  }

  /**
   * Parses Ollama show response into model capabilities.
   */
  private parseOllamaCapabilities(
    modelId: string,
    data: OllamaShowResponse
  ): ModelCapabilities {
    const capabilities = new Set<ProviderCapability>();

    for (const cap of data.capabilities ?? []) {
      const mapped = this.mapOllamaCapability(cap);
      if (mapped) {
        capabilities.add(mapped);
      }
    }

    // Default to text generation if no capabilities returned
    if (capabilities.size === 0) {
      capabilities.add('text-generation' as ProviderCapability);
      capabilities.add('streaming' as ProviderCapability);
    }

    const result: ModelCapabilities = {
      modelId,
      capabilities,
      detectedAt: new Date().toISOString(),
    };

    const contextWindow = data.model_info?.context_length;
    if (contextWindow !== undefined) {
      result.contextWindow = contextWindow;
    }

    return result;
  }

  /**
   * Maps Ollama capability string to ProviderCapability enum.
   */
  private mapOllamaCapability(cap: string): ProviderCapability | null {
    switch (cap) {
      case 'completion':
        return 'text-generation' as ProviderCapability;
      case 'vision':
        return 'vision' as ProviderCapability;
      case 'embedding':
        return 'embeddings' as ProviderCapability;
      case 'tools':
        return 'tool-use' as ProviderCapability;
      default:
        return null;
    }
  }

  /**
   * Fetches available Ollama models.
   */
  private async fetchOllamaModels(baseUrl: string): Promise<string[]> {
    const response = await this.fetchWithTimeout(`${baseUrl}/api/tags`, {
      method: 'GET',
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as OllamaTagsResponse;
    return data.models?.map((m) => m.name) ?? [];
  }

  /**
   * Fetches available OpenAI-compatible models.
   */
  private async fetchOpenAICompatibleModels(baseUrl: string): Promise<string[]> {
    const response = await this.fetchWithTimeout(`${baseUrl}/v1/models`, {
      method: 'GET',
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as OpenAIModelsResponse;
    return data.data?.map((m) => m.id) ?? [];
  }

  // ===========================================================================
  // PRIVATE: Cache Management
  // ===========================================================================

  /**
   * Gets cached capabilities if still valid.
   */
  private getCachedCapabilities(
    providerId: string,
    modelId: string
  ): ModelCapabilities | null {
    const cached = this.capabilityCache.get(providerId);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.capabilityCache.delete(providerId);
      return null;
    }

    return cached.capabilities.get(modelId) ?? null;
  }

  /**
   * Caches capabilities for a model.
   */
  private cacheCapabilities(
    providerId: string,
    modelId: string,
    capabilities: ModelCapabilities
  ): void {
    let cached = this.capabilityCache.get(providerId);
    if (!cached || Date.now() > cached.expiresAt) {
      cached = {
        capabilities: new Map(),
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      this.capabilityCache.set(providerId, cached);
    }
    cached.capabilities.set(modelId, capabilities);
  }

  // ===========================================================================
  // PRIVATE: Provider Capability Check
  // ===========================================================================

  /**
   * Checks if a provider has any model with the specified capability.
   */
  private async providerHasCapability(
    provider: ProviderConfig,
    capability: ProviderCapability
  ): Promise<boolean> {
    switch (provider.type) {
      case 'openai':
        return this.openAIHasCapability(capability);
      case 'anthropic':
        return this.anthropicHasCapability(capability);
      case 'ollama':
        return this.ollamaHasCapability(provider, capability);
      case 'lmstudio':
      case 'openai-compatible':
        return this.localHasCapability(capability);
      default:
        return false;
    }
  }

  /**
   * Checks if OpenAI has any model with the capability.
   */
  private openAIHasCapability(capability: ProviderCapability): boolean {
    return getOpenAIModels().some((m) => m.capabilities.includes(capability));
  }

  /**
   * Checks if Anthropic has any model with the capability.
   */
  private anthropicHasCapability(capability: ProviderCapability): boolean {
    return getAnthropicModels().some((m) => m.capabilities.includes(capability));
  }

  /**
   * Checks if Ollama provider has any model with the capability.
   */
  private async ollamaHasCapability(
    provider: ProviderConfig,
    capability: ProviderCapability
  ): Promise<boolean> {
    const models = await this.listOllamaModels(provider);
    return models.some((m) => m.capabilities.includes(capability));
  }

  /**
   * Checks if local provider has capability (basic text only).
   */
  private localHasCapability(capability: ProviderCapability): boolean {
    return capability === 'text-generation' || capability === 'streaming';
  }

  // ===========================================================================
  // PRIVATE: Utility Methods
  // ===========================================================================

  /**
   * Converts a registry entry to ModelCapabilities.
   */
  private registryEntryToCapabilities(entry: ModelRegistryEntry): ModelCapabilities {
    const result: ModelCapabilities = {
      modelId: entry.id,
      capabilities: new Set(entry.capabilities),
    };

    if (entry.contextWindow !== undefined) {
      result.contextWindow = entry.contextWindow;
    }
    if (entry.maxOutputTokens !== undefined) {
      result.maxOutputTokens = entry.maxOutputTokens;
    }

    const constraints = this.buildConstraints(entry);
    if (constraints) {
      result.constraints = constraints;
    }

    return result;
  }

  /**
   * Converts a registry entry to ModelInfo.
   */
  private registryEntryToModelInfo = (entry: ModelRegistryEntry): ModelInfo => {
    const result: ModelInfo = {
      id: entry.id,
      name: entry.name,
      capabilities: entry.capabilities,
    };

    if (entry.contextWindow !== undefined) {
      result.contextWindow = entry.contextWindow;
    }
    if (entry.maxOutputTokens !== undefined) {
      result.maxOutputTokens = entry.maxOutputTokens;
    }

    return result;
  };

  /**
   * Converts ModelCapabilities to ModelInfo.
   */
  private capabilitiesToModelInfo(
    capabilities: ModelCapabilities,
    displayName: string
  ): ModelInfo {
    const result: ModelInfo = {
      id: capabilities.modelId,
      name: displayName,
      capabilities: Array.from(capabilities.capabilities),
    };

    if (capabilities.contextWindow !== undefined) {
      result.contextWindow = capabilities.contextWindow;
    }
    if (capabilities.maxOutputTokens !== undefined) {
      result.maxOutputTokens = capabilities.maxOutputTokens;
    }

    return result;
  }

  /**
   * Builds capability constraints from registry entry.
   */
  private buildConstraints(entry: ModelRegistryEntry): CapabilityConstraints | undefined {
    if (!entry.embeddingDimensions) {
      return undefined;
    }
    return { embeddingDimensions: entry.embeddingDimensions };
  }

  /**
   * Creates empty capabilities for unknown models.
   */
  private createEmptyCapabilities(modelId: string): ModelCapabilities {
    return {
      modelId,
      capabilities: new Set(),
    };
  }

  /**
   * Creates basic text generation capabilities.
   */
  private createBasicTextCapabilities(modelId: string): ModelCapabilities {
    return {
      modelId,
      capabilities: new Set([
        'text-generation' as ProviderCapability,
        'streaming' as ProviderCapability,
      ]),
      detectedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetches a URL with timeout.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
