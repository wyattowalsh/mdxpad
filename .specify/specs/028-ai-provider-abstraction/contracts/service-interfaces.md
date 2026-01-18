# Service Interface Contracts: AI Provider Abstraction Layer

**Feature Branch**: `028-ai-provider-abstraction`
**Date**: 2026-01-17

---

## Service Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Main Process Services                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐    ┌─────────────────────┐                 │
│  │  CredentialService  │    │  ProviderService    │                 │
│  │                     │    │                     │                 │
│  │  - setCredential()  │    │  - addProvider()    │                 │
│  │  - getCredential()  │    │  - updateProvider() │                 │
│  │  - hasCredential()  │    │  - removeProvider() │                 │
│  │  - clearCredential()│    │  - getProviders()   │                 │
│  │  - isAvailable()    │    │  - setActive()      │                 │
│  └─────────────────────┘    │  - validate()       │                 │
│                             └─────────────────────┘                 │
│                                                                      │
│  ┌─────────────────────┐    ┌─────────────────────┐                 │
│  │ CapabilityService   │    │   UsageService      │                 │
│  │                     │    │                     │                 │
│  │  - getCapabilities()│    │  - recordUsage()    │                 │
│  │  - listModels()     │    │  - queryStats()     │                 │
│  │  - hasCapability()  │    │  - exportData()     │                 │
│  │  - refresh()        │    │  - clearHistory()   │                 │
│  └─────────────────────┘    └─────────────────────┘                 │
│                                                                      │
│  ┌─────────────────────┐    ┌─────────────────────┐                 │
│  │   AIService         │    │ OnboardingService   │                 │
│  │                     │    │                     │                 │
│  │  - generateText()   │    │  - startAttempt()   │                 │
│  │  - streamText()     │    │  - recordOutcome()  │                 │
│  │  - generateEmbed()  │    │  - getMetrics()     │                 │
│  │  - generateImage()  │    │                     │                 │
│  └─────────────────────┘    └─────────────────────┘                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## CredentialService

Manages secure storage of API credentials using Electron's safeStorage API.

```typescript
/**
 * Service for secure credential storage using OS keychain.
 * Falls back to session-only storage when keychain is unavailable.
 */
export interface ICredentialService {
  /**
   * Checks if persistent credential storage is available.
   * @returns true if safeStorage encryption is available (macOS Keychain accessible)
   */
  isAvailable(): boolean;

  /**
   * Stores a credential securely.
   * @param providerId - Unique provider identifier
   * @param apiKey - The API key to store
   * @returns Storage result with type and key preview
   * @throws CredentialStorageError if storage fails
   */
  setCredential(providerId: string, apiKey: string): Promise<CredentialSetResult>;

  /**
   * Retrieves a stored credential.
   * @param providerId - Unique provider identifier
   * @returns The API key if found, null otherwise
   * @throws CredentialAccessError if decryption fails
   */
  getCredential(providerId: string): Promise<string | null>;

  /**
   * Checks if a credential exists for a provider.
   * @param providerId - Unique provider identifier
   * @returns Credential metadata if exists
   */
  hasCredential(providerId: string): Promise<CredentialMetadata | null>;

  /**
   * Removes a stored credential.
   * @param providerId - Unique provider identifier
   * @returns true if credential was removed
   */
  clearCredential(providerId: string): Promise<boolean>;

  /**
   * Gets current storage type.
   * @returns 'persistent' if using keychain, 'session' if memory-only
   */
  getStorageType(): 'persistent' | 'session';
}

interface CredentialSetResult {
  success: boolean;
  storageType: 'persistent' | 'session';
  keyPreview: string; // Last 4 characters
}

interface CredentialMetadata {
  providerId: string;
  storageType: 'persistent' | 'session';
  keyPreview: string;
  storedAt: string;
}
```

---

## ProviderService

Manages AI provider configurations and lifecycle.

```typescript
/**
 * Service for managing AI provider configurations.
 */
export interface IProviderService {
  /**
   * Gets all configured providers.
   * @returns Array of provider configurations
   */
  getProviders(): Promise<ProviderConfig[]>;

  /**
   * Gets a specific provider by ID.
   * @param id - Provider ID
   * @returns Provider config if found
   */
  getProvider(id: string): Promise<ProviderConfig | null>;

  /**
   * Gets the currently active provider.
   * @returns Active provider config or null
   */
  getActiveProvider(): Promise<ProviderConfig | null>;

  /**
   * Adds a new provider configuration.
   * @param config - Provider configuration (without system fields)
   * @param apiKey - API key for the provider (optional for local providers)
   * @returns Created provider configuration
   * @throws ProviderValidationError if validation fails
   */
  addProvider(
    config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
    apiKey?: string
  ): Promise<ProviderConfig>;

  /**
   * Updates an existing provider configuration.
   * @param id - Provider ID
   * @param updates - Fields to update
   * @returns Updated provider configuration
   * @throws ProviderNotFoundError if provider doesn't exist
   */
  updateProvider(id: string, updates: Partial<ProviderConfig>): Promise<ProviderConfig>;

  /**
   * Removes a provider and its credentials.
   * @param id - Provider ID
   * @throws ProviderNotFoundError if provider doesn't exist
   */
  removeProvider(id: string): Promise<void>;

  /**
   * Sets a provider as the active provider.
   * @param id - Provider ID
   * @throws ProviderNotFoundError if provider doesn't exist
   * @throws ProviderDisconnectedError if provider is not connected
   */
  setActiveProvider(id: string): Promise<void>;

  /**
   * Validates provider credentials by making a test API call.
   * @param id - Provider ID
   * @returns Validation result with available models
   */
  validateProvider(id: string): Promise<ProviderValidationResult>;

  /**
   * Gets count of configured providers.
   * @returns Number of providers
   */
  getProviderCount(): Promise<number>;
}

interface ProviderValidationResult {
  success: boolean;
  status: ConnectionStatus;
  models?: string[];
  error?: {
    code: string;
    message: string;
    retryAfterSeconds?: number;
  };
}
```

---

## CapabilityService

Manages model capability detection and caching.

```typescript
/**
 * Service for detecting and caching model capabilities.
 * Uses static registry for cloud providers, dynamic probing for local.
 */
export interface ICapabilityService {
  /**
   * Gets capabilities for a specific model.
   * @param providerId - Provider ID
   * @param modelId - Model identifier
   * @returns Model capabilities
   */
  getCapabilities(providerId: string, modelId: string): Promise<ModelCapabilities>;

  /**
   * Lists all available models for a provider.
   * @param providerId - Provider ID
   * @returns Array of model info with capabilities
   */
  listModels(providerId: string): Promise<ModelInfo[]>;

  /**
   * Checks if a model has a specific capability.
   * @param providerId - Provider ID
   * @param modelId - Model identifier
   * @param capability - Capability to check
   * @returns true if model has capability
   */
  hasCapability(
    providerId: string,
    modelId: string,
    capability: ProviderCapability
  ): Promise<boolean>;

  /**
   * Refreshes capability cache for a provider.
   * @param providerId - Provider ID
   * @returns Updated capabilities
   */
  refreshCapabilities(providerId: string): Promise<void>;

  /**
   * Gets providers that support a specific capability.
   * @param capability - Required capability
   * @returns Array of provider IDs
   */
  getProvidersWithCapability(capability: ProviderCapability): Promise<string[]>;
}

interface ModelInfo {
  id: string;
  name: string;
  capabilities: ProviderCapability[];
  contextWindow?: number;
  maxOutputTokens?: number;
}
```

---

## AIService

Core service for AI operations using the Vercel AI SDK.

```typescript
/**
 * Service for AI generation operations.
 * Routes requests through the active provider.
 */
export interface IAIService {
  /**
   * Generates text using the active provider (non-streaming).
   * @param request - Generation request
   * @returns Generated text and usage info
   * @throws NoActiveProviderError if no provider is active
   * @throws CapabilityNotSupportedError if model doesn't support text generation
   */
  generateText(request: TextGenerationRequest): Promise<TextGenerationResponse>;

  /**
   * Generates text with streaming (FR-017).
   * @param request - Generation request
   * @param onChunk - Callback for each chunk
   * @returns Stream controller and final result promise
   */
  streamText(
    request: TextGenerationRequest,
    onChunk: (chunk: string) => void
  ): Promise<StreamController>;

  /**
   * Generates embeddings for text.
   * @param request - Embedding request
   * @returns Embedding vectors
   * @throws CapabilityNotSupportedError if provider doesn't support embeddings
   */
  generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  /**
   * Generates an image.
   * @param request - Image generation request
   * @returns Generated image URL or base64
   * @throws CapabilityNotSupportedError if provider doesn't support image generation
   */
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;

  /**
   * Gets the currently active AI model.
   * @returns Active model instance or null
   */
  getActiveModel(): LanguageModel | null;

  /**
   * Checks if AI service is ready for requests.
   * @returns true if active provider is configured and connected
   */
  isReady(): boolean;
}

interface TextGenerationRequest {
  prompt: string;
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

interface TextGenerationResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  modelId: string;
  durationMs: number;
}

interface StreamController {
  /** Abort the stream */
  abort(): void;
  /** Promise that resolves when stream completes */
  completion: Promise<TextGenerationResponse>;
}

interface EmbeddingRequest {
  texts: string[];
  modelId?: string;
}

interface EmbeddingResponse {
  embeddings: number[][];
  dimensions: number;
  modelId: string;
}

interface ImageGenerationRequest {
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'natural' | 'vivid';
}

interface ImageGenerationResponse {
  imageUrl?: string;
  imageBase64?: string;
  modelId: string;
}
```

---

## UsageService

Tracks and reports AI usage statistics.

```typescript
/**
 * Service for tracking AI usage and calculating costs.
 */
export interface IUsageService {
  /**
   * Records a usage event.
   * @param record - Usage record to save
   */
  recordUsage(record: Omit<UsageRecord, 'id'>): Promise<void>;

  /**
   * Queries usage statistics.
   * @param query - Query parameters
   * @returns Aggregated usage statistics
   */
  queryStats(query: UsageQuery): Promise<UsageStats>;

  /**
   * Exports raw usage data.
   * @param timeRange - Time range to export
   * @param format - Export format
   * @returns Exported data
   */
  exportData(timeRange: TimeRange, format: 'json' | 'csv'): Promise<string>;

  /**
   * Clears usage history.
   * @param beforeDate - Clear records before this date (optional, clears all if not provided)
   */
  clearHistory(beforeDate?: Date): Promise<void>;

  /**
   * Gets estimated cost for a provider.
   * @param providerId - Provider ID
   * @param timeRange - Time range
   * @returns Estimated cost in USD
   */
  getEstimatedCost(providerId: string, timeRange: TimeRange): Promise<number>;
}

interface UsageQuery {
  timeRange: TimeRange;
  providerId?: string;
  operationType?: OperationType;
}

type TimeRange = 'day' | 'week' | 'month' | 'all';

interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  byProvider: ProviderUsageStats[];
  byOperation: OperationUsageStats[];
}

interface ProviderUsageStats {
  providerId: string;
  providerName: string;
  requestCount: number;
  tokenCount: number;
  estimatedCostUsd: number;
}

interface OperationUsageStats {
  operationType: OperationType;
  requestCount: number;
  avgDurationMs: number;
}
```

---

## OnboardingService

Tracks onboarding analytics for SC-006 measurement.

```typescript
/**
 * Service for tracking onboarding completion metrics.
 */
export interface IOnboardingService {
  /**
   * Starts tracking an onboarding attempt.
   * @param providerType - Type of provider being configured
   * @returns Attempt ID for tracking
   */
  startAttempt(providerType: ProviderType): string;

  /**
   * Records the outcome of an onboarding attempt.
   * @param attemptId - Attempt ID from startAttempt
   * @param outcome - Outcome of the attempt
   * @param details - Additional details
   */
  recordOutcome(
    attemptId: string,
    outcome: OnboardingOutcome,
    details?: {
      failedAtStep?: OnboardingStep;
      errorCode?: string;
    }
  ): Promise<void>;

  /**
   * Gets aggregated onboarding metrics.
   * @returns Onboarding success metrics
   */
  getMetrics(): Promise<OnboardingMetrics>;

  /**
   * Resets onboarding metrics (for testing).
   */
  resetMetrics(): Promise<void>;
}

type OnboardingStep = 'provider-selection' | 'credential-entry' | 'validation' | 'save';

type OnboardingOutcome = 'success' | 'failure' | 'abandoned';

interface OnboardingMetrics {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  abandonmentCount: number;
  successRate: number;
  avgSuccessDurationMs: number;
  updatedAt: string;
}
```

---

## Error Types

```typescript
/**
 * Base error for AI provider operations.
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly providerId?: string
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

/**
 * No active provider is configured.
 */
export class NoActiveProviderError extends AIProviderError {
  constructor() {
    super('No active AI provider configured', 'NO_ACTIVE_PROVIDER');
  }
}

/**
 * Provider not found.
 */
export class ProviderNotFoundError extends AIProviderError {
  constructor(providerId: string) {
    super(`Provider not found: ${providerId}`, 'PROVIDER_NOT_FOUND', providerId);
  }
}

/**
 * Provider is disconnected.
 */
export class ProviderDisconnectedError extends AIProviderError {
  constructor(providerId: string) {
    super(`Provider is disconnected: ${providerId}`, 'PROVIDER_DISCONNECTED', providerId);
  }
}

/**
 * Capability not supported by model.
 */
export class CapabilityNotSupportedError extends AIProviderError {
  constructor(
    public readonly capability: ProviderCapability,
    public readonly modelId: string,
    providerId: string
  ) {
    super(
      `Model ${modelId} does not support ${capability}`,
      'CAPABILITY_NOT_SUPPORTED',
      providerId
    );
  }
}

/**
 * Rate limit exceeded.
 */
export class RateLimitError extends AIProviderError {
  constructor(
    providerId: string,
    public readonly retryAfterSeconds: number,
    public readonly alternateProviders: string[]
  ) {
    super(
      `Rate limit exceeded. Retry after ${retryAfterSeconds}s`,
      'RATE_LIMITED',
      providerId
    );
  }
}

/**
 * Credential storage error.
 */
export class CredentialStorageError extends AIProviderError {
  constructor(message: string, providerId?: string) {
    super(message, 'CREDENTIAL_STORAGE_ERROR', providerId);
  }
}

/**
 * Invalid API key.
 */
export class InvalidApiKeyError extends AIProviderError {
  constructor(providerId: string) {
    super('Invalid API key', 'INVALID_API_KEY', providerId);
  }
}
```
