/**
 * Provider Service for AI Provider Configuration Management
 *
 * Manages the lifecycle of AI provider configurations including creation,
 * updates, validation, and activation. Coordinates with CredentialService
 * for secure credential storage.
 *
 * @module src/main/services/ai/provider-service
 */

import Store from 'electron-store';
import { randomUUID } from 'node:crypto';

import type {
  ProviderConfig,
  ProviderType,
  ConnectionStatus,
} from '../../../shared/ai/types';
import { ProviderNotFoundError } from '../../../shared/ai/errors';
import type { ICredentialService } from './credential-service';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of validating a provider's connection.
 */
export interface ProviderValidationResult {
  /** Whether validation succeeded */
  valid: boolean;
  /** Connection status after validation */
  status: ConnectionStatus;
  /** List of available models (if validation succeeded) */
  models?: string[];
  /** Error details (if validation failed) */
  error?: {
    code: string;
    message: string;
    retryAfterSeconds?: number;
  };
}

/**
 * Interface for provider service operations.
 */
export interface IProviderService {
  /** Get all configured providers */
  getProviders(): Promise<ProviderConfig[]>;
  /** Get a specific provider by ID */
  getProvider(id: string): Promise<ProviderConfig | null>;
  /** Get the currently active provider */
  getActiveProvider(): Promise<ProviderConfig | null>;
  /** Add a new provider configuration */
  addProvider(
    config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
    apiKey?: string
  ): Promise<ProviderConfig>;
  /** Update an existing provider configuration */
  updateProvider(id: string, updates: Partial<ProviderConfig>): Promise<ProviderConfig>;
  /** Remove a provider and its credential */
  removeProvider(id: string): Promise<void>;
  /** Set the active provider */
  setActiveProvider(id: string): Promise<void>;
  /** Validate a provider's connection */
  validateProvider(id: string): Promise<ProviderValidationResult>;
  /** Get the count of configured providers */
  getProviderCount(): Promise<number>;
}

// =============================================================================
// STORAGE SCHEMA
// =============================================================================

/**
 * Schema for the provider store.
 */
interface ProviderStoreSchema {
  providers: Record<string, ProviderConfig>;
  activeProviderId: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORE_NAME = 'mdxpad-providers';
const MAX_PROVIDERS = 10;
const VALIDATION_TIMEOUT_MS = 10_000;

/** Provider types that require a baseUrl */
const BASE_URL_REQUIRED_TYPES: readonly ProviderType[] = [
  'ollama',
  'lmstudio',
  'openai-compatible',
] as const;

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Service for managing AI provider configurations.
 *
 * Handles CRUD operations for provider configs, coordinates with CredentialService
 * for credential storage, enforces business constraints (max providers, single active),
 * and provides connection validation.
 *
 * @example
 * ```typescript
 * const providerService = new ProviderService(credentialService);
 *
 * // Add a new provider
 * const provider = await providerService.addProvider({
 *   displayName: 'My OpenAI',
 *   type: 'openai',
 *   isActive: true,
 * }, 'sk-...');
 *
 * // Validate the connection
 * const result = await providerService.validateProvider(provider.id);
 *
 * // Get all providers
 * const providers = await providerService.getProviders();
 * ```
 */
export class ProviderService implements IProviderService {
  /** Persistent store for provider configurations */
  private readonly store: Store<ProviderStoreSchema>;

  /** Credential service for API key management */
  private readonly credentialService: ICredentialService;

  /**
   * Creates a new ProviderService instance.
   * @param credentialService - Service for managing API credentials
   */
  constructor(credentialService: ICredentialService) {
    this.credentialService = credentialService;
    this.store = new Store<ProviderStoreSchema>({
      name: STORE_NAME,
      defaults: {
        providers: {},
        activeProviderId: null,
      },
    });
  }

  /**
   * Retrieves all configured providers.
   * @returns Array of provider configurations sorted by creation date
   */
  async getProviders(): Promise<ProviderConfig[]> {
    const providers = this.store.get('providers');
    return Object.values(providers).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  /**
   * Retrieves a specific provider by ID.
   * @param id - Provider ID to look up
   * @returns Provider configuration or null if not found
   */
  async getProvider(id: string): Promise<ProviderConfig | null> {
    const providers = this.store.get('providers');
    return providers[id] ?? null;
  }

  /**
   * Retrieves the currently active provider.
   * @returns Active provider configuration or null if none active
   */
  async getActiveProvider(): Promise<ProviderConfig | null> {
    const activeId = this.store.get('activeProviderId');
    if (!activeId) {
      return null;
    }
    return this.getProvider(activeId);
  }

  /**
   * Adds a new provider configuration.
   *
   * @param config - Provider configuration (without auto-generated fields)
   * @param apiKey - Optional API key to store with the provider
   * @returns The created provider configuration
   * @throws Error if max providers limit reached
   * @throws Error if baseUrl required but not provided
   */
  async addProvider(
    config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
    apiKey?: string
  ): Promise<ProviderConfig> {
    await this.validateProviderLimit();
    this.validateBaseUrlRequirement(config.type, config.baseUrl);

    const now = new Date().toISOString();
    const provider: ProviderConfig = {
      id: randomUUID(),
      displayName: config.displayName,
      type: config.type,
      ...(config.baseUrl !== undefined && { baseUrl: config.baseUrl }),
      isActive: config.isActive,
      status: 'disconnected',
      createdAt: now,
      updatedAt: now,
    };

    if (provider.isActive) {
      await this.deactivateCurrentProvider();
    }

    if (apiKey) {
      await this.credentialService.setCredential(provider.id, apiKey);
    }

    this.saveProvider(provider);

    if (provider.isActive) {
      this.store.set('activeProviderId', provider.id);
    }

    return provider;
  }

  /**
   * Updates an existing provider configuration.
   *
   * @param id - Provider ID to update
   * @param updates - Partial provider configuration to apply
   * @returns The updated provider configuration
   * @throws ProviderNotFoundError if provider doesn't exist
   * @throws Error if baseUrl required but not provided
   */
  async updateProvider(
    id: string,
    updates: Partial<ProviderConfig>
  ): Promise<ProviderConfig> {
    const existing = await this.getProvider(id);
    if (!existing) {
      throw new ProviderNotFoundError(id);
    }

    const newType = updates.type ?? existing.type;
    const newBaseUrl = updates.baseUrl ?? existing.baseUrl;
    this.validateBaseUrlRequirement(newType, newBaseUrl);

    if (updates.isActive === true && !existing.isActive) {
      await this.deactivateCurrentProvider();
    }

    const updated: ProviderConfig = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.saveProvider(updated);

    if (updates.isActive === true) {
      this.store.set('activeProviderId', id);
    } else if (updates.isActive === false && this.store.get('activeProviderId') === id) {
      this.store.set('activeProviderId', null);
    }

    return updated;
  }

  /**
   * Removes a provider and its associated credential.
   *
   * @param id - Provider ID to remove
   * @throws ProviderNotFoundError if provider doesn't exist
   */
  async removeProvider(id: string): Promise<void> {
    const existing = await this.getProvider(id);
    if (!existing) {
      throw new ProviderNotFoundError(id);
    }

    await this.credentialService.clearCredential(id);

    const providers = this.store.get('providers');
    delete providers[id];
    this.store.set('providers', providers);

    if (this.store.get('activeProviderId') === id) {
      this.store.set('activeProviderId', null);
    }
  }

  /**
   * Sets the active provider.
   *
   * @param id - Provider ID to activate
   * @throws ProviderNotFoundError if provider doesn't exist
   */
  async setActiveProvider(id: string): Promise<void> {
    const provider = await this.getProvider(id);
    if (!provider) {
      throw new ProviderNotFoundError(id);
    }

    await this.deactivateCurrentProvider();
    await this.updateProvider(id, { isActive: true });
    this.store.set('activeProviderId', id);
  }

  /**
   * Validates a provider's connection by testing the API.
   *
   * @param id - Provider ID to validate
   * @returns Validation result with status and optional models list
   * @throws ProviderNotFoundError if provider doesn't exist
   */
  async validateProvider(id: string): Promise<ProviderValidationResult> {
    const provider = await this.getProvider(id);
    if (!provider) {
      throw new ProviderNotFoundError(id);
    }

    await this.updateProvider(id, { status: 'validating' });

    try {
      const result = await this.performValidation(provider);
      await this.handleValidationResult(id, result);
      return result;
    } catch (error) {
      const result = this.createErrorResult(error);
      await this.handleValidationResult(id, result);
      return result;
    }
  }

  /**
   * Gets the count of configured providers.
   * @returns Number of configured providers
   */
  async getProviderCount(): Promise<number> {
    const providers = this.store.get('providers');
    return Object.keys(providers).length;
  }

  // ===========================================================================
  // PRIVATE: Validation Methods
  // ===========================================================================

  /**
   * Performs the actual validation based on provider type.
   */
  private async performValidation(
    provider: ProviderConfig
  ): Promise<ProviderValidationResult> {
    const apiKey = await this.credentialService.getCredential(provider.id);

    switch (provider.type) {
      case 'openai':
        return this.validateOpenAI(apiKey);
      case 'anthropic':
        return this.validateAnthropic(apiKey);
      case 'ollama':
        return this.validateOllama(provider.baseUrl);
      case 'lmstudio':
        return this.validateLMStudio(provider.baseUrl);
      case 'openai-compatible':
        return this.validateOpenAICompatible(provider.baseUrl, apiKey);
      default:
        return { valid: false, status: 'error', error: { code: 'UNKNOWN_TYPE', message: 'Unknown provider type' } };
    }
  }

  /**
   * Validates an OpenAI provider.
   */
  private async validateOpenAI(apiKey: string | null): Promise<ProviderValidationResult> {
    if (!apiKey) {
      return this.createMissingKeyResult();
    }

    const response = await this.fetchWithTimeout('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    return this.parseOpenAIResponse(response);
  }

  /**
   * Validates an Anthropic provider.
   */
  private async validateAnthropic(apiKey: string | null): Promise<ProviderValidationResult> {
    if (!apiKey) {
      return this.createMissingKeyResult();
    }

    const response = await this.fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    return this.parseAnthropicResponse(response);
  }

  /**
   * Validates an Ollama provider.
   */
  private async validateOllama(baseUrl?: string): Promise<ProviderValidationResult> {
    if (!baseUrl) {
      return this.createMissingUrlResult();
    }

    const response = await this.fetchWithTimeout(`${baseUrl}/api/tags`, {
      method: 'GET',
    });

    return this.parseOllamaResponse(response);
  }

  /**
   * Validates an LM Studio provider.
   */
  private async validateLMStudio(baseUrl?: string): Promise<ProviderValidationResult> {
    if (!baseUrl) {
      return this.createMissingUrlResult();
    }

    const response = await this.fetchWithTimeout(`${baseUrl}/v1/models`, {
      method: 'GET',
    });

    return this.parseOpenAICompatibleResponse(response);
  }

  /**
   * Validates an OpenAI-compatible provider.
   */
  private async validateOpenAICompatible(
    baseUrl?: string,
    apiKey?: string | null
  ): Promise<ProviderValidationResult> {
    if (!baseUrl) {
      return this.createMissingUrlResult();
    }

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await this.fetchWithTimeout(`${baseUrl}/v1/models`, {
      method: 'GET',
      headers,
    });

    return this.parseOpenAICompatibleResponse(response);
  }

  // ===========================================================================
  // PRIVATE: Response Parsing Methods
  // ===========================================================================

  /**
   * Parses OpenAI API response.
   */
  private async parseOpenAIResponse(response: Response): Promise<ProviderValidationResult> {
    if (response.status === 401) {
      return { valid: false, status: 'error', error: { code: 'INVALID_API_KEY', message: 'Invalid API key' } };
    }

    if (response.status === 429) {
      const retryAfter = this.parseRetryAfter(response);
      return { valid: false, status: 'error', error: { code: 'RATE_LIMITED', message: 'Rate limited', retryAfterSeconds: retryAfter } };
    }

    if (!response.ok) {
      return { valid: false, status: 'error', error: { code: 'API_ERROR', message: `API error: ${response.status}` } };
    }

    const data = (await response.json()) as { data?: Array<{ id: string }> };
    const models = data.data?.map((m) => m.id) ?? [];
    return { valid: true, status: 'connected', models };
  }

  /**
   * Parses Anthropic API response.
   */
  private async parseAnthropicResponse(response: Response): Promise<ProviderValidationResult> {
    if (response.status === 401) {
      return { valid: false, status: 'error', error: { code: 'INVALID_API_KEY', message: 'Invalid API key' } };
    }

    if (response.status === 429) {
      const retryAfter = this.parseRetryAfter(response);
      return { valid: false, status: 'error', error: { code: 'RATE_LIMITED', message: 'Rate limited', retryAfterSeconds: retryAfter } };
    }

    // Anthropic returns 200 for valid key (we made a valid request)
    // or 400 for invalid request structure (but valid key)
    if (response.ok || response.status === 400) {
      return { valid: true, status: 'connected' };
    }

    return { valid: false, status: 'error', error: { code: 'API_ERROR', message: `API error: ${response.status}` } };
  }

  /**
   * Parses Ollama API response.
   */
  private async parseOllamaResponse(response: Response): Promise<ProviderValidationResult> {
    if (!response.ok) {
      return { valid: false, status: 'error', error: { code: 'CONNECTION_ERROR', message: 'Failed to connect to Ollama' } };
    }

    const data = (await response.json()) as { models?: Array<{ name: string }> };
    const models = data.models?.map((m) => m.name) ?? [];
    return { valid: true, status: 'connected', models };
  }

  /**
   * Parses OpenAI-compatible API response (LM Studio, etc.).
   */
  private async parseOpenAICompatibleResponse(response: Response): Promise<ProviderValidationResult> {
    if (response.status === 401) {
      return { valid: false, status: 'error', error: { code: 'INVALID_API_KEY', message: 'Invalid API key' } };
    }

    if (!response.ok) {
      return { valid: false, status: 'error', error: { code: 'CONNECTION_ERROR', message: `Connection error: ${response.status}` } };
    }

    const data = (await response.json()) as { data?: Array<{ id: string }> };
    const models = data.data?.map((m) => m.id) ?? [];
    return { valid: true, status: 'connected', models };
  }

  // ===========================================================================
  // PRIVATE: Utility Methods
  // ===========================================================================

  /**
   * Fetches a URL with timeout.
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parses Retry-After header.
   */
  private parseRetryAfter(response: Response): number {
    const header = response.headers.get('Retry-After');
    if (!header) {
      return 60;
    }
    const parsed = parseInt(header, 10);
    return isNaN(parsed) ? 60 : parsed;
  }

  /**
   * Validates provider limit hasn't been exceeded.
   */
  private async validateProviderLimit(): Promise<void> {
    const count = await this.getProviderCount();
    if (count >= MAX_PROVIDERS) {
      throw new Error(`Maximum provider limit (${MAX_PROVIDERS}) reached`);
    }
  }

  /**
   * Validates baseUrl requirement for specific provider types.
   */
  private validateBaseUrlRequirement(type: ProviderType, baseUrl?: string): void {
    if (BASE_URL_REQUIRED_TYPES.includes(type) && !baseUrl) {
      throw new Error(`baseUrl is required for provider type: ${type}`);
    }
  }

  /**
   * Deactivates the current active provider.
   */
  private async deactivateCurrentProvider(): Promise<void> {
    const activeId = this.store.get('activeProviderId');
    if (activeId) {
      const providers = this.store.get('providers');
      const activeProvider = providers[activeId];
      if (activeProvider) {
        activeProvider.isActive = false;
        activeProvider.updatedAt = new Date().toISOString();
        this.store.set('providers', providers);
      }
    }
  }

  /**
   * Saves a provider to the store.
   */
  private saveProvider(provider: ProviderConfig): void {
    const providers = this.store.get('providers');
    providers[provider.id] = provider;
    this.store.set('providers', providers);
  }

  /**
   * Handles validation result by updating provider status.
   */
  private async handleValidationResult(
    id: string,
    result: ProviderValidationResult
  ): Promise<void> {
    if (result.valid) {
      // On success, clear errorMessage by fetching and modifying directly
      const provider = await this.getProvider(id);
      if (provider) {
        const updated = { ...provider };
        delete updated.errorMessage;
        updated.status = result.status;
        updated.lastConnectedAt = new Date().toISOString();
        updated.updatedAt = new Date().toISOString();
        this.saveProvider(updated);
      }
    } else {
      const updates: Partial<ProviderConfig> = { status: result.status };
      if (result.error) {
        updates.errorMessage = result.error.message;
      }
      await this.updateProvider(id, updates);
    }
  }

  /**
   * Creates a validation result for missing API key.
   */
  private createMissingKeyResult(): ProviderValidationResult {
    return { valid: false, status: 'error', error: { code: 'MISSING_API_KEY', message: 'API key not configured' } };
  }

  /**
   * Creates a validation result for missing baseUrl.
   */
  private createMissingUrlResult(): ProviderValidationResult {
    return { valid: false, status: 'error', error: { code: 'MISSING_BASE_URL', message: 'Base URL not configured' } };
  }

  /**
   * Creates an error validation result from an unknown error.
   */
  private createErrorResult(error: unknown): ProviderValidationResult {
    if (error instanceof Error && error.name === 'AbortError') {
      return { valid: false, status: 'error', error: { code: 'TIMEOUT', message: 'Connection timed out' } };
    }

    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, status: 'error', error: { code: 'UNKNOWN_ERROR', message } };
  }
}
