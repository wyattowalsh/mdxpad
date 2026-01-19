/**
 * AI Provider Abstraction Layer Type Definitions
 *
 * Shared types for the BYOK (Bring Your Own Key) AI provider system.
 * Defines provider configuration, credentials, usage tracking, and capabilities.
 *
 * @module src/shared/ai/types
 */

// =============================================================================
// PROVIDER TYPES
// =============================================================================

/**
 * Supported AI provider types.
 * - openai: OpenAI API (GPT-4, GPT-3.5, etc.)
 * - anthropic: Anthropic API (Claude models)
 * - ollama: Local Ollama instance
 * - lmstudio: Local LM Studio instance
 * - openai-compatible: Any OpenAI-compatible API endpoint
 */
export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'lmstudio'
  | 'openai-compatible';

/**
 * Connection status for a provider.
 * - connected: Successfully validated and ready to use
 * - disconnected: Not yet validated or intentionally disconnected
 * - error: Validation failed or connection error
 * - validating: Currently testing connection
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'validating';

/**
 * Type of AI operation performed.
 * Used for usage tracking and cost estimation.
 */
export type OperationType =
  | 'text-generation'
  | 'streaming-generation'
  | 'embedding'
  | 'image-generation'
  | 'agent-execution';

/**
 * Time range for filtering usage statistics.
 */
export type TimeRange = 'day' | 'week' | 'month' | 'all';

// =============================================================================
// CAPABILITY ENUM
// =============================================================================

/**
 * Capability flags for AI models.
 * Used for feature detection and UI enablement.
 */
export enum ProviderCapability {
  /** Basic text generation (non-streaming) */
  TEXT_GENERATION = 'text-generation',
  /** Streaming text generation */
  STREAMING = 'streaming',
  /** Vision/image understanding */
  VISION = 'vision',
  /** Text embeddings generation */
  EMBEDDINGS = 'embeddings',
  /** Image generation (DALL-E, etc.) */
  IMAGE_GENERATION = 'image-generation',
  /** Function/tool calling support */
  TOOL_USE = 'tool-use',
  /** Agent/multi-step execution support */
  AGENTS = 'agents',
}

// =============================================================================
// PROVIDER CONFIGURATION
// =============================================================================

/**
 * Configuration for an AI provider.
 * Represents a configured provider with its settings and connection status.
 *
 * Constraints:
 * - id must be unique across all providers
 * - Only one provider can have isActive: true at a time
 * - baseUrl is required for ollama, lmstudio, and openai-compatible types
 * - Maximum 10 providers allowed
 */
export interface ProviderConfig {
  /** Unique identifier for this provider configuration */
  readonly id: string;

  /** User-defined display name */
  displayName: string;

  /** Provider type determines API compatibility */
  type: ProviderType;

  /** Base URL for API requests (required for local/custom providers) */
  baseUrl?: string;

  /** Whether this is the active provider for AI features */
  isActive: boolean;

  /** Current connection status */
  status: ConnectionStatus;

  /** Last successful connection timestamp (ISO 8601) */
  lastConnectedAt?: string;

  /** Error message if status is 'error' */
  errorMessage?: string;

  /** Creation timestamp (ISO 8601) */
  readonly createdAt: string;

  /** Last modification timestamp (ISO 8601) */
  updatedAt: string;
}

// =============================================================================
// CREDENTIAL STORAGE
// =============================================================================

/**
 * Credential storage metadata.
 * Actual key is stored via safeStorage (macOS Keychain).
 * This metadata tracks where/how the credential is stored.
 *
 * Constraints:
 * - Credential is 1:1 with ProviderConfig (except local providers which have none)
 * - keyPreview must only contain last 4 characters, never the full key
 * - On provider deletion, credential must be purged from both Keychain and metadata store
 */
export interface CredentialMetadata {
  /** Provider ID this credential belongs to */
  readonly providerId: string;

  /** Whether credential is stored persistently or session-only */
  storageType: 'persistent' | 'session';

  /** Last 4 characters of the key for display (masked) */
  keyPreview: string;

  /** Timestamp when credential was stored (ISO 8601) */
  readonly storedAt: string;
}

// =============================================================================
// USAGE TRACKING
// =============================================================================

/**
 * Record of a single AI request.
 * Used for usage statistics and cost estimation.
 *
 * Constraints:
 * - Records are append-only (no updates)
 * - Automatic pruning: records older than 90 days are deleted
 * - Maximum 100,000 records (oldest deleted when exceeded)
 */
export interface UsageRecord {
  /** Unique identifier */
  readonly id: string;

  /** Provider that handled this request */
  readonly providerId: string;

  /** Model used for the request */
  readonly modelId: string;

  /** Type of operation */
  readonly operationType: OperationType;

  /** Input tokens consumed (for text operations) */
  inputTokens?: number;

  /** Output tokens generated (for text operations) */
  outputTokens?: number;

  /** Total tokens (input + output) */
  totalTokens?: number;

  /** Embedding dimensions (for embedding operations) */
  embeddingDimensions?: number;

  /** Image size (for image generation) */
  imageSize?: string;

  /** Request duration in milliseconds */
  durationMs: number;

  /** Whether request succeeded */
  success: boolean;

  /** Error code if failed */
  errorCode?: string;

  /** Timestamp of request (ISO 8601) */
  readonly timestamp: string;

  /** Estimated cost in USD (if pricing available) */
  estimatedCostUsd?: number;
}

// =============================================================================
// MODEL CAPABILITIES
// =============================================================================

/**
 * Capability constraints for partial support.
 * Defines limitations on specific capabilities.
 */
export interface CapabilityConstraints {
  /** Maximum image size in pixels (for vision) */
  maxImageSize?: number;

  /** Maximum images per request (for vision) */
  maxImageCount?: number;

  /** Supported image formats */
  supportedImageFormats?: string[];

  /** Embedding vector dimensions */
  embeddingDimensions?: number;

  /** Maximum tools per request */
  maxToolCount?: number;
}

/**
 * Capabilities for a specific model.
 * Describes what features a model supports and its constraints.
 *
 * Storage:
 * - Cloud providers (OpenAI, Anthropic): Static registry in code
 * - Local providers (Ollama): Cached in memory with 5-minute TTL
 */
export interface ModelCapabilities {
  /** Model identifier */
  readonly modelId: string;

  /** Set of supported capabilities */
  capabilities: Set<ProviderCapability>;

  /** Context window size in tokens */
  contextWindow?: number;

  /** Maximum output tokens */
  maxOutputTokens?: number;

  /** Constraints on specific capabilities */
  constraints?: CapabilityConstraints;

  /** Cache timestamp for dynamic detection (ISO 8601) */
  detectedAt?: string;
}

// =============================================================================
// ONBOARDING ANALYTICS
// =============================================================================

/**
 * Outcome of an onboarding attempt.
 */
export type OnboardingOutcome = 'success' | 'failure' | 'abandoned';

/**
 * Step in the onboarding flow where failure/abandonment can occur.
 */
export type OnboardingStep =
  | 'provider-selection'
  | 'credential-entry'
  | 'validation'
  | 'save';

/**
 * Single onboarding attempt record.
 * Tracks individual provider configuration attempts for SC-006 measurement.
 *
 * Constraints:
 * - Records kept for 30 days, then aggregated into OnboardingMetrics
 */
export interface OnboardingAttempt {
  /** Unique attempt identifier */
  readonly id: string;

  /** Provider type being configured */
  readonly providerType: ProviderType;

  /** Outcome of the attempt */
  outcome: OnboardingOutcome;

  /** Step where failure/abandonment occurred (if applicable) */
  failedAtStep?: OnboardingStep;

  /** Duration from start to completion/abandonment in ms */
  durationMs: number;

  /** Error code if failure */
  errorCode?: string;

  /** Timestamp (ISO 8601) */
  readonly timestamp: string;
}

/**
 * Aggregated onboarding metrics.
 * Local-only storage for privacy-preserving analytics.
 * Used for SC-006 measurement: "95% first-provider success rate"
 */
export interface OnboardingMetrics {
  /** Total attempts */
  totalAttempts: number;

  /** Successful completions */
  successCount: number;

  /** Failures */
  failureCount: number;

  /** Abandonments */
  abandonmentCount: number;

  /** Success rate (successCount / totalAttempts) */
  successRate: number;

  /** Average duration for successful attempts in ms */
  avgSuccessDurationMs: number;

  /** Last updated timestamp (ISO 8601) */
  updatedAt: string;
}

// =============================================================================
// USAGE STATISTICS (Aggregated)
// =============================================================================

/**
 * Aggregated usage statistics for display.
 * Computed from UsageRecord entries.
 */
export interface UsageStats {
  /** Time range for these statistics */
  readonly timeRange: TimeRange;

  /** Total number of requests */
  totalRequests: number;

  /** Successful requests */
  successfulRequests: number;

  /** Failed requests */
  failedRequests: number;

  /** Total tokens consumed (input + output) */
  totalTokens: number;

  /** Total input tokens */
  inputTokens: number;

  /** Total output tokens */
  outputTokens: number;

  /** Estimated total cost in USD */
  estimatedCostUsd: number;

  /** Average request duration in ms */
  avgDurationMs: number;

  /** Usage broken down by provider */
  byProvider: Record<string, ProviderUsageSummary>;

  /** Usage broken down by model */
  byModel: Record<string, ModelUsageSummary>;
}

/**
 * Provider-level usage summary.
 */
export interface ProviderUsageSummary {
  /** Provider ID */
  readonly providerId: string;

  /** Total requests for this provider */
  requestCount: number;

  /** Total tokens for this provider */
  totalTokens: number;

  /** Estimated cost for this provider */
  estimatedCostUsd: number;
}

/**
 * Model-level usage summary.
 */
export interface ModelUsageSummary {
  /** Model ID */
  readonly modelId: string;

  /** Provider ID for this model */
  readonly providerId: string;

  /** Total requests for this model */
  requestCount: number;

  /** Total tokens for this model */
  totalTokens: number;

  /** Estimated cost for this model */
  estimatedCostUsd: number;
}

// =============================================================================
// STATE TYPES (for Zustand store)
// =============================================================================

/**
 * AI provider state for the renderer process Zustand store.
 * Synced from main process via IPC.
 */
export interface AIProviderState {
  /** Provider list (synced from main process) */
  providers: ProviderConfig[];

  /** Currently active provider ID */
  activeProviderId: string | null;

  /** Loading states */
  isLoading: boolean;
  isValidating: boolean;

  /** UI state */
  settingsOpen: boolean;
  selectedProviderId: string | null;

  /** Usage stats (fetched on demand) */
  usageStats: UsageStats | null;
  usageStatsTimeRange: TimeRange;
}

/**
 * AI provider actions for the renderer process Zustand store.
 */
export interface AIProviderActions {
  /** Fetch all providers from main process */
  fetchProviders: () => Promise<void>;

  /** Add a new provider */
  addProvider: (
    config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ) => Promise<void>;

  /** Update an existing provider */
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => Promise<void>;

  /** Remove a provider */
  removeProvider: (id: string) => Promise<void>;

  /** Set the active provider */
  setActiveProvider: (id: string) => Promise<void>;

  /** Validate a provider's connection */
  validateProvider: (id: string) => Promise<boolean>;

  /** Fetch usage statistics */
  fetchUsageStats: (timeRange: TimeRange) => Promise<void>;
}

/**
 * Complete AI provider store type.
 */
export type AIProviderStore = AIProviderState & AIProviderActions;
