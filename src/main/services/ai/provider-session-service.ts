/**
 * Provider/Model orchestration for AI sessions.
 *
 * Selects provider/model pairs for session operations and validates that
 * the selected pair is ready for use.
 *
 * @module src/main/services/ai/provider-session-service
 */

import type { ModelCapabilities, ProviderCapability, ProviderConfig } from '@shared/ai/types';
import {
  AIProviderError,
  CapabilityNotSupportedError,
  NoActiveProviderError,
  ProviderDisconnectedError,
  ProviderNotFoundError,
} from '@shared/ai/errors';

import { getDefaultModel } from './ai-helpers';
import type { ICapabilityService } from './capability-service';
import type { IProviderService } from './provider-service';

/**
 * Input for selecting a provider/model pair.
 */
export interface SessionModelSelectionRequest {
  providerId?: string;
  modelId?: string;
}

/**
 * Input for session readiness validation.
 */
export interface SessionReadinessRequest extends SessionModelSelectionRequest {
  requiredCapability?: ProviderCapability;
}

/**
 * Resolved provider/model pair for a session.
 */
export interface SessionModelSelection {
  provider: ProviderConfig;
  modelId: string;
}

/**
 * Fully validated provider/model selection with capabilities.
 */
export interface SessionReadySelection extends SessionModelSelection {
  capabilities: ModelCapabilities;
}

/**
 * Non-throwing readiness check result.
 */
export interface SessionReadinessResult {
  ready: boolean;
  selection?: SessionReadySelection;
  error?: AIProviderError;
}

/**
 * Interface for session provider/model orchestration.
 */
export interface IProviderSessionService {
  selectProviderModel(request?: SessionModelSelectionRequest): Promise<SessionModelSelection>;
  assertSessionReady(request?: SessionReadinessRequest): Promise<SessionReadySelection>;
  checkSessionReadiness(request?: SessionReadinessRequest): Promise<SessionReadinessResult>;
}

/**
 * Service that orchestrates provider/model selection for AI sessions.
 */
export class ProviderSessionService implements IProviderSessionService {
  private readonly providerService: IProviderService;
  private readonly capabilityService: ICapabilityService;

  constructor(providerService: IProviderService, capabilityService: ICapabilityService) {
    this.providerService = providerService;
    this.capabilityService = capabilityService;
  }

  async selectProviderModel(
    request: SessionModelSelectionRequest = {}
  ): Promise<SessionModelSelection> {
    const provider = await this.resolveProvider(request.providerId);
    const modelId = await this.resolveModelId(provider, request.modelId);
    return { provider, modelId };
  }

  async assertSessionReady(request: SessionReadinessRequest = {}): Promise<SessionReadySelection> {
    const selection = await this.selectProviderModel(request);

    if (selection.provider.status !== 'connected') {
      throw new ProviderDisconnectedError(selection.provider.id);
    }

    const capabilities = await this.capabilityService.getCapabilities(
      selection.provider.id,
      selection.modelId
    );

    if (request.requiredCapability && !capabilities.capabilities.has(request.requiredCapability)) {
      throw new CapabilityNotSupportedError(
        request.requiredCapability,
        selection.modelId,
        selection.provider.id
      );
    }

    return {
      ...selection,
      capabilities,
    };
  }

  async checkSessionReadiness(
    request: SessionReadinessRequest = {}
  ): Promise<SessionReadinessResult> {
    try {
      const selection = await this.assertSessionReady(request);
      return { ready: true, selection };
    } catch (error) {
      if (error instanceof AIProviderError) {
        return { ready: false, error };
      }
      throw error;
    }
  }

  private async resolveProvider(providerId?: string): Promise<ProviderConfig> {
    if (providerId) {
      const provider = await this.providerService.getProvider(providerId);
      if (!provider) {
        throw new ProviderNotFoundError(providerId);
      }
      return provider;
    }

    const activeProvider = await this.providerService.getActiveProvider();
    if (!activeProvider) {
      throw new NoActiveProviderError();
    }
    return activeProvider;
  }

  private async resolveModelId(
    provider: ProviderConfig,
    requestedModelId?: string
  ): Promise<string> {
    if (requestedModelId) {
      return requestedModelId;
    }

    const defaultModelId = getDefaultModel(provider.type);
    const models = await this.capabilityService.listModels(provider.id);
    if (models.length === 0 || models.some((model) => model.id === defaultModelId)) {
      return defaultModelId;
    }

    const firstModel = models[0];
    return firstModel ? firstModel.id : defaultModelId;
  }
}
