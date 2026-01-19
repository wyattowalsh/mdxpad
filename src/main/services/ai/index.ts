/**
 * AI Provider Abstraction Layer - Main Process Services
 *
 * This module exports all AI-related services for the main process.
 * Services are designed for dependency injection and singleton usage.
 *
 * @module src/main/services/ai
 */

// =============================================================================
// SERVICE IMPORTS (for internal use)
// =============================================================================

import { CredentialService } from './credential-service';
import { ProviderService } from './provider-service';
import { CapabilityService } from './capability-service';
import { AIService } from './ai-service';
import { UsageService } from './usage-service';
import { OnboardingService } from './onboarding-service';

// =============================================================================
// SERVICE EXPORTS
// =============================================================================

export {
  CredentialService,
  type ICredentialService,
  type CredentialSetResult,
} from './credential-service';

export {
  ProviderService,
  type IProviderService,
  type ProviderValidationResult,
} from './provider-service';

export {
  CapabilityService,
  type ICapabilityService,
  type ModelInfo,
} from './capability-service';

export {
  AIService,
  type IAIService,
  type TextGenerationRequest,
  type TextGenerationResponse,
  type StreamController,
  type EmbeddingRequest,
  type EmbeddingResponse,
  type ImageGenerationRequest,
  type ImageGenerationResponse,
} from './ai-service';

export {
  UsageService,
  type IUsageService,
  type UsageQuery,
} from './usage-service';

export {
  OnboardingService,
  type IOnboardingService,
} from './onboarding-service';

// =============================================================================
// REGISTRY EXPORTS
// =============================================================================

export {
  getOpenAIModels,
  getOpenAIModel,
  isOpenAIModel,
  getOpenAIChatModels,
  getOpenAIEmbeddingModels,
  getOpenAIImageModels,
  getOpenAIModelsByCapability,
} from './registries/openai-registry';

export {
  getAnthropicModels,
  getAnthropicModel,
  isAnthropicModel,
  getAnthropicChatModels,
  getAnthropicVisionModels,
  getAnthropicToolUseModels,
  getAnthropicModelsByCapability,
} from './registries/anthropic-registry';

export type { ModelRegistryEntry } from './registries';

// =============================================================================
// SERVICE FACTORY
// =============================================================================

/**
 * Creates a complete set of AI services with proper dependency injection.
 * Use this factory to ensure all services are properly wired together.
 *
 * @example
 * ```typescript
 * const services = createAIServices();
 * const providers = await services.providerService.getProviders();
 * ```
 */
export function createAIServices(): AIServices {
  const credentialService = new CredentialService();
  const providerService = new ProviderService(credentialService);
  const capabilityService = new CapabilityService(providerService);
  const usageService = new UsageService();
  const onboardingService = new OnboardingService();
  const aiService = new AIService(
    credentialService,
    providerService,
    usageService
  );

  return {
    credentialService,
    providerService,
    capabilityService,
    aiService,
    usageService,
    onboardingService,
  };
}

/**
 * Container for all AI services.
 */
export interface AIServices {
  credentialService: CredentialService;
  providerService: ProviderService;
  capabilityService: CapabilityService;
  aiService: AIService;
  usageService: UsageService;
  onboardingService: OnboardingService;
}

// =============================================================================
// SINGLETON INSTANCE (optional, for simple usage)
// =============================================================================

let _services: AIServices | null = null;

/**
 * Gets the singleton AI services instance.
 * Creates the services on first call.
 *
 * @example
 * ```typescript
 * const { aiService } = getAIServices();
 * const result = await aiService.generateText({ prompt: 'Hello' });
 * ```
 */
export function getAIServices(): AIServices {
  if (!_services) {
    _services = createAIServices();
  }
  return _services;
}

/**
 * Resets the singleton services instance.
 * Useful for testing or when reinitializing the application.
 */
export function resetAIServices(): void {
  _services = null;
}
