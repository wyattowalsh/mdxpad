/**
 * Dynamic Capability Detection for Local AI Providers
 *
 * Provides dynamic probing and model listing for Ollama and OpenAI-compatible
 * providers, plus a TTL-based cache for dynamically detected capabilities.
 *
 * @module src/main/services/ai/capability-detection
 */

import type {
  ModelCapabilities,
  ProviderCapability,
} from '../../../shared/ai/types';
import type { ModelRegistryEntry } from './registries/openai-registry';

// --- Types ---

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

interface OllamaTagsResponse {
  models?: {
    name: string;
    modified_at?: string;
    size?: number;
  }[];
}

interface OpenAIModelsResponse {
  data?: {
    id: string;
    object?: string;
    owned_by?: string;
  }[];
}

interface CachedCapabilities {
  capabilities: Map<string, ModelCapabilities>;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const PROBE_TIMEOUT_MS = 10_000;

// --- Cache Management ---

/** Manages a TTL-based cache for dynamically detected model capabilities. */
export class CapabilityCache {
  private readonly cache = new Map<string, CachedCapabilities>();
  private cacheWriteCount = 0;

  get(providerId: string, modelId: string): ModelCapabilities | null {
    const cached = this.cache.get(providerId);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(providerId);
      return null;
    }

    return cached.capabilities.get(modelId) ?? null;
  }

  set(
    providerId: string,
    modelId: string,
    capabilities: ModelCapabilities
  ): void {
    let cached = this.cache.get(providerId);
    if (!cached || Date.now() > cached.expiresAt) {
      cached = {
        capabilities: new Map(),
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      this.cache.set(providerId, cached);
    }
    cached.capabilities.set(modelId, capabilities);

    // Increment write counter and evict expired entries every 10 writes
    this.cacheWriteCount++;
    if (this.cacheWriteCount % 10 === 0) {
      this.evictExpired();
    }
  }

  delete(providerId: string): void {
    this.cache.delete(providerId);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [providerId, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(providerId);
      }
    }
  }
}

// --- Dynamic Probing ---

/** Probes an Ollama model for capabilities via the /api/show endpoint. */
export async function probeOllamaModel(
  baseUrl: string,
  modelId: string
): Promise<ModelCapabilities> {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/show`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelId }),
      }
    );

    if (!response.ok) {
      return createBasicTextCapabilities(modelId);
    }

    const data = (await response.json()) as OllamaShowResponse;
    return parseOllamaCapabilities(modelId, data);
  } catch {
    return createBasicTextCapabilities(modelId);
  }
}

function parseOllamaCapabilities(
  modelId: string,
  data: OllamaShowResponse
): ModelCapabilities {
  const capabilities = new Set<ProviderCapability>();

  for (const cap of data.capabilities ?? []) {
    const mapped = mapOllamaCapability(cap);
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

function mapOllamaCapability(cap: string): ProviderCapability | null {
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

// --- Model Listing ---

/** Fetches available Ollama models from the /api/tags endpoint. */
export async function fetchOllamaModels(baseUrl: string): Promise<string[]> {
  const response = await fetchWithTimeout(`${baseUrl}/api/tags`, {
    method: 'GET',
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as OllamaTagsResponse;
  return data.models?.map((m) => m.name) ?? [];
}

/** Fetches available models from an OpenAI-compatible endpoint. */
export async function fetchOpenAICompatibleModels(baseUrl: string): Promise<string[]> {
  const response = await fetchWithTimeout(`${baseUrl}/v1/models`, {
    method: 'GET',
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as OpenAIModelsResponse;
  return data.data?.map((m) => m.id) ?? [];
}

// --- Capability Factories ---

/** Creates empty capabilities for unknown models. */
export function createEmptyCapabilities(modelId: string): ModelCapabilities {
  return {
    modelId,
    capabilities: new Set(),
  };
}

/** Creates basic text generation capabilities. */
export function createBasicTextCapabilities(modelId: string): ModelCapabilities {
  return {
    modelId,
    capabilities: new Set([
      'text-generation' as ProviderCapability,
      'streaming' as ProviderCapability,
    ]),
    detectedAt: new Date().toISOString(),
  };
}

// --- Shared Types ---

/** Model information with capabilities summary. */
export interface ModelInfo {
  id: string;
  name: string;
  capabilities: ProviderCapability[];
  contextWindow?: number;
  maxOutputTokens?: number;
}

// --- Conversion Utilities ---

/** Converts a registry entry to ModelCapabilities. */
export function registryEntryToCapabilities(entry: ModelRegistryEntry): ModelCapabilities {
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

  if (entry.embeddingDimensions) {
    result.constraints = { embeddingDimensions: entry.embeddingDimensions };
  }

  return result;
}

/** Converts a registry entry to ModelInfo. */
export function registryEntryToModelInfo(entry: ModelRegistryEntry): ModelInfo {
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
}

/** Converts ModelCapabilities to ModelInfo. */
export function capabilitiesToModelInfo(
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

// --- Utility ---

/** Fetches a URL with timeout. */
async function fetchWithTimeout(
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
