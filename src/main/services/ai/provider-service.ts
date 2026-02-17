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
} from '../../../shared/ai/types';
import { ProviderNotFoundError } from '../../../shared/ai/errors';
import type { ICredentialService } from './credential-service';
import {
  performValidation,
  createErrorResult,
  type ProviderValidationResult,
} from './provider-validation';

// Re-export for backwards compatibility
export type { ProviderValidationResult } from './provider-validation';

// =============================================================================
// TYPES
// =============================================================================

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
 * Handles CRUD operations, credential coordination, business constraints,
 * and connection validation.
 */
export class ProviderService implements IProviderService {
  private readonly store: Store<ProviderStoreSchema>;
  private readonly credentialService: ICredentialService;

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

  // eslint-disable-next-line @typescript-eslint/require-await
  async getProviders(): Promise<ProviderConfig[]> {
    const providers = this.store.get('providers');
    return Object.values(providers).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getProvider(id: string): Promise<ProviderConfig | null> {
    const providers = this.store.get('providers');
    return providers[id] ?? null;
  }

  async getActiveProvider(): Promise<ProviderConfig | null> {
    const activeId = this.store.get('activeProviderId');
    if (!activeId) {
      return null;
    }
    return this.getProvider(activeId);
  }

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

  async removeProvider(id: string): Promise<void> {
    const existing = await this.getProvider(id);
    if (!existing) {
      throw new ProviderNotFoundError(id);
    }

    await this.credentialService.clearCredential(id);

    const providers = this.store.get('providers');
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete providers[id];
    this.store.set('providers', providers);

    if (this.store.get('activeProviderId') === id) {
      this.store.set('activeProviderId', null);
    }
  }

  async setActiveProvider(id: string): Promise<void> {
    const provider = await this.getProvider(id);
    if (!provider) {
      throw new ProviderNotFoundError(id);
    }

    await this.deactivateCurrentProvider();
    await this.updateProvider(id, { isActive: true });
    this.store.set('activeProviderId', id);
  }

  async validateProvider(id: string): Promise<ProviderValidationResult> {
    const provider = await this.getProvider(id);
    if (!provider) {
      throw new ProviderNotFoundError(id);
    }

    await this.updateProvider(id, { status: 'validating' });

    try {
      const apiKey = await this.credentialService.getCredential(provider.id);
      const result = await performValidation(provider, apiKey);
      await this.handleValidationResult(id, result);
      return result;
    } catch (error) {
      const result = createErrorResult(error);
      await this.handleValidationResult(id, result);
      return result;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getProviderCount(): Promise<number> {
    const providers = this.store.get('providers');
    return Object.keys(providers).length;
  }

  // --- Private: Business Rule Validation ---

  private async validateProviderLimit(): Promise<void> {
    const count = await this.getProviderCount();
    if (count >= MAX_PROVIDERS) {
      throw new Error(`Maximum provider limit (${MAX_PROVIDERS}) reached`);
    }
  }

  private validateBaseUrlRequirement(type: ProviderType, baseUrl?: string): void {
    if (BASE_URL_REQUIRED_TYPES.includes(type) && !baseUrl) {
      throw new Error(`baseUrl is required for provider type: ${type}`);
    }
  }

  // --- Private: State Management ---

  // eslint-disable-next-line @typescript-eslint/require-await
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

  private saveProvider(provider: ProviderConfig): void {
    const providers = this.store.get('providers');
    providers[provider.id] = provider;
    this.store.set('providers', providers);
  }

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
}
