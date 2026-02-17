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
} from '../../../shared/ai/types';
import { ProviderNotFoundError } from '../../../shared/ai/errors';
import type { IProviderService } from './provider-service';
import {
  getOpenAIModels,
  getOpenAIModel,
} from './registries/openai-registry';
import {
  getAnthropicModels,
  getAnthropicModel,
} from './registries/anthropic-registry';
import {
  CapabilityCache,
  probeOllamaModel,
  fetchOllamaModels,
  fetchOpenAICompatibleModels,
  createEmptyCapabilities,
  createBasicTextCapabilities,
  registryEntryToCapabilities,
  registryEntryToModelInfo,
  capabilitiesToModelInfo,
  type ModelInfo,
} from './capability-detection';

// Re-export for backwards compatibility
export type { ModelInfo } from './capability-detection';

/**
 * Interface for capability service operations.
 */
export interface ICapabilityService {
  getCapabilities(providerId: string, modelId: string): Promise<ModelCapabilities>;
  listModels(providerId: string): Promise<ModelInfo[]>;
  hasCapability(
    providerId: string,
    modelId: string,
    capability: ProviderCapability
  ): Promise<boolean>;
  refreshCapabilities(providerId: string): Promise<void>;
  getProvidersWithCapability(capability: ProviderCapability): Promise<string[]>;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Service for detecting and managing AI model capabilities.
 *
 * Uses a hybrid approach:
 * - Static registry lookups for OpenAI and Anthropic (reliable, immediate)
 * - Dynamic probing for Ollama and local providers (flexible, cached)
 */
export class CapabilityService implements ICapabilityService {
  private readonly providerService: IProviderService;
  private readonly cache = new CapabilityCache();

  constructor(providerService: IProviderService) {
    this.providerService = providerService;
  }

  async getCapabilities(
    providerId: string,
    modelId: string
  ): Promise<ModelCapabilities> {
    const provider = await this.requireProvider(providerId);
    return this.getCapabilitiesForProvider(provider, modelId);
  }

  async listModels(providerId: string): Promise<ModelInfo[]> {
    const provider = await this.requireProvider(providerId);

    switch (provider.type) {
      case 'openai':
        return getOpenAIModels().map(registryEntryToModelInfo);
      case 'anthropic':
        return getAnthropicModels().map(registryEntryToModelInfo);
      case 'ollama':
        return this.listOllamaModels(provider);
      case 'lmstudio':
      case 'openai-compatible':
        return this.listOpenAICompatibleModels(provider);
      default:
        return [];
    }
  }

  async hasCapability(
    providerId: string,
    modelId: string,
    capability: ProviderCapability
  ): Promise<boolean> {
    const capabilities = await this.getCapabilities(providerId, modelId);
    return capabilities.capabilities.has(capability);
  }

  async refreshCapabilities(providerId: string): Promise<void> {
    await this.requireProvider(providerId);
    this.cache.delete(providerId);
  }

  async getProvidersWithCapability(
    capability: ProviderCapability
  ): Promise<string[]> {
    const providers = await this.providerService.getProviders();
    const result: string[] = [];

    for (const provider of providers) {
      const hasIt = await this.providerHasCapability(provider, capability);
      if (hasIt) {
        result.push(provider.id);
      }
    }

    return result;
  }

  // ===========================================================================
  // PRIVATE: Provider Retrieval
  // ===========================================================================

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

  private async getCapabilitiesForProvider(
    provider: ProviderConfig,
    modelId: string
  ): Promise<ModelCapabilities> {
    switch (provider.type) {
      case 'openai':
        return this.getStaticCapabilities(getOpenAIModel, modelId);
      case 'anthropic':
        return this.getStaticCapabilities(getAnthropicModel, modelId);
      case 'ollama':
        return this.getOllamaCapabilities(provider, modelId);
      case 'lmstudio':
      case 'openai-compatible':
        return this.getLocalCapabilities(provider, modelId);
      default:
        return createEmptyCapabilities(modelId);
    }
  }

  /**
   * Gets capabilities from a static registry lookup function.
   */
  private getStaticCapabilities(
    lookupFn: (id: string) => import('./registries/openai-registry').ModelRegistryEntry | undefined,
    modelId: string
  ): ModelCapabilities {
    const model = lookupFn(modelId);
    return model ? registryEntryToCapabilities(model) : createEmptyCapabilities(modelId);
  }

  private async getOllamaCapabilities(
    provider: ProviderConfig,
    modelId: string
  ): Promise<ModelCapabilities> {
    const cached = this.cache.get(provider.id, modelId);
    if (cached) return cached;

    const capabilities = await probeOllamaModel(provider.baseUrl ?? '', modelId);
    this.cache.set(provider.id, modelId, capabilities);
    return capabilities;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async getLocalCapabilities(
    provider: ProviderConfig,
    modelId: string
  ): Promise<ModelCapabilities> {
    const cached = this.cache.get(provider.id, modelId);
    if (cached) return cached;

    const capabilities = createBasicTextCapabilities(modelId);
    this.cache.set(provider.id, modelId, capabilities);
    return capabilities;
  }

  // ===========================================================================
  // PRIVATE: Model Listing (dynamic providers)
  // ===========================================================================

  private async listOllamaModels(provider: ProviderConfig): Promise<ModelInfo[]> {
    if (!provider.baseUrl) return [];

    try {
      const models = await fetchOllamaModels(provider.baseUrl);
      const modelInfos: ModelInfo[] = [];

      for (const model of models) {
        const capabilities = await this.getOllamaCapabilities(provider, model);
        modelInfos.push(capabilitiesToModelInfo(capabilities, model));
      }

      return modelInfos;
    } catch {
      return [];
    }
  }

  private async listOpenAICompatibleModels(
    provider: ProviderConfig
  ): Promise<ModelInfo[]> {
    if (!provider.baseUrl) return [];

    try {
      const models = await fetchOpenAICompatibleModels(provider.baseUrl);
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
  // PRIVATE: Provider Capability Check
  // ===========================================================================

  private async providerHasCapability(
    provider: ProviderConfig,
    capability: ProviderCapability
  ): Promise<boolean> {
    switch (provider.type) {
      case 'openai':
        return getOpenAIModels().some((m) => m.capabilities.includes(capability));
      case 'anthropic':
        return getAnthropicModels().some((m) => m.capabilities.includes(capability));
      case 'ollama':
        return (await this.listOllamaModels(provider)).some((m) =>
          m.capabilities.includes(capability)
        );
      case 'lmstudio':
      case 'openai-compatible':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
        return capability === 'text-generation' || capability === 'streaming';
      default:
        return false;
    }
  }
}
