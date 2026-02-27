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
import { ProviderSessionService } from './provider-session-service';
import { AISessionStorageService } from './ai-session-storage-service';
import { AIPromptFileLoaderService } from './prompt-file-loader-service';
import { InstructionLoaderService } from './instruction-loader-service';

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

export { CapabilityService, type ICapabilityService, type ModelInfo } from './capability-service';

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

export { UsageService, type IUsageService, type UsageQuery } from './usage-service';

export { OnboardingService, type IOnboardingService } from './onboarding-service';

export {
  ProviderSessionService,
  type IProviderSessionService,
  type SessionModelSelectionRequest,
  type SessionReadinessRequest,
  type SessionModelSelection,
  type SessionReadySelection,
  type SessionReadinessResult,
} from './provider-session-service';

export {
  AISessionStorageService,
  type IAISessionStorageService,
  type ArchivedAISession,
  type SessionListOptions,
  type SessionUpdate,
  type InstructionListOptions,
} from './ai-session-storage-service';

export {
  AIPromptFileLoaderService,
  type IAIPromptFileLoaderService,
  type PromptDiscoveryContext,
} from './prompt-file-loader-service';

export {
  InstructionLoaderService,
  type IInstructionLoaderService,
  type InstructionLoaderOptions,
  type LoadedInstructionFile,
} from './instruction-loader-service';

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
  const providerSessionService = new ProviderSessionService(providerService, capabilityService);
  const usageService = new UsageService();
  const onboardingService = new OnboardingService();
  const aiSessionStorageService = new AISessionStorageService();
  const promptFileLoaderService = new AIPromptFileLoaderService();
  const instructionLoaderService = new InstructionLoaderService(aiSessionStorageService);
  const aiService = new AIService(credentialService, providerService, usageService);

  return {
    credentialService,
    providerService,
    capabilityService,
    providerSessionService,
    aiService,
    usageService,
    onboardingService,
    aiSessionStorageService,
    promptFileLoaderService,
    instructionLoaderService,
  };
}

/**
 * Container for all AI services.
 */
export interface AIServices {
  credentialService: CredentialService;
  providerService: ProviderService;
  capabilityService: CapabilityService;
  providerSessionService: ProviderSessionService;
  aiService: AIService;
  usageService: UsageService;
  onboardingService: OnboardingService;
  aiSessionStorageService: AISessionStorageService;
  promptFileLoaderService: AIPromptFileLoaderService;
  instructionLoaderService: InstructionLoaderService;
}
