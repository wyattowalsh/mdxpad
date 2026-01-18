# Data Model: AI Provider Abstraction Layer

**Feature Branch**: `028-ai-provider-abstraction`
**Date**: 2026-01-17

---

## Entity Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Domain Model                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐      1:1      ┌──────────────┐                    │
│  │   Provider   │──────────────>│  Credential  │                    │
│  │   Config     │               │  (encrypted) │                    │
│  └──────┬───────┘               └──────────────┘                    │
│         │                                                            │
│         │ 1:N                                                        │
│         ▼                                                            │
│  ┌──────────────┐                                                   │
│  │ UsageRecord  │                                                   │
│  └──────────────┘                                                   │
│                                                                      │
│  ┌──────────────┐      1:N      ┌──────────────┐                    │
│  │   Provider   │──────────────>│    Model     │                    │
│  │   Config     │               │ Capabilities │                    │
│  └──────────────┘               └──────────────┘                    │
│                                                                      │
│  ┌──────────────┐                                                   │
│  │  Onboarding  │  (analytics tracking - FR-018)                    │
│  │   Metrics    │                                                   │
│  └──────────────┘                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Entities

### ProviderConfig

Represents a configured AI provider with its settings and connection status.

```typescript
/**
 * Supported AI provider types
 */
export type ProviderType = 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | 'openai-compatible';

/**
 * Connection status for a provider
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'validating';

/**
 * Configuration for an AI provider
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

  /** Last successful connection timestamp */
  lastConnectedAt?: string; // ISO 8601

  /** Error message if status is 'error' */
  errorMessage?: string;

  /** Creation timestamp */
  readonly createdAt: string; // ISO 8601

  /** Last modification timestamp */
  updatedAt: string; // ISO 8601
}
```

**Storage**: `electron-store` in main process (`mdxpad-providers.json`)

**Constraints**:
- `id` must be unique across all providers
- Only one provider can have `isActive: true` at a time
- `baseUrl` is required for `ollama`, `lmstudio`, and `openai-compatible` types
- Maximum 10 providers (SC-005 requires at least 5, cap at 10 for UX)

---

### Credential

Securely stored API key or authentication token. Never stored in plain text.

```typescript
/**
 * Credential storage metadata (actual key stored via safeStorage)
 */
export interface CredentialMetadata {
  /** Provider ID this credential belongs to */
  readonly providerId: string;

  /** Whether credential is stored persistently or session-only */
  storageType: 'persistent' | 'session';

  /** Last 4 characters of the key for display (masked) */
  keyPreview: string;

  /** Timestamp when credential was stored */
  readonly storedAt: string; // ISO 8601
}
```

**Storage**:
- Encrypted key: `safeStorage` → macOS Keychain
- Metadata: `electron-store` (`mdxpad-credentials.json`)
- Session-only fallback: In-memory Map (lost on restart)

**Constraints**:
- Credential is 1:1 with ProviderConfig (except local providers which have none)
- `keyPreview` must only contain last 4 characters, never the full key
- On provider deletion, credential must be purged from both Keychain and metadata store

---

### UsageRecord

Tracks individual AI requests for usage statistics and cost estimation.

```typescript
/**
 * Type of AI operation performed
 */
export type OperationType =
  | 'text-generation'
  | 'streaming-generation'
  | 'embedding'
  | 'image-generation'
  | 'agent-execution';

/**
 * Record of a single AI request
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

  /** Timestamp of request */
  readonly timestamp: string; // ISO 8601

  /** Estimated cost in USD (if pricing available) */
  estimatedCostUsd?: number;
}
```

**Storage**: `electron-store` (`mdxpad-usage.json`)

**Constraints**:
- Records are append-only (no updates)
- Automatic pruning: records older than 90 days are deleted
- Maximum 100,000 records (oldest deleted when exceeded)

---

### ModelCapabilities

Describes what features a specific model supports.

```typescript
/**
 * Capability flags for AI models
 */
export enum ProviderCapability {
  TEXT_GENERATION = 'text-generation',
  STREAMING = 'streaming',
  VISION = 'vision',
  EMBEDDINGS = 'embeddings',
  IMAGE_GENERATION = 'image-generation',
  TOOL_USE = 'tool-use',
  AGENTS = 'agents',
}

/**
 * Capability constraints for partial support
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
 * Capabilities for a specific model
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

  /** Cache timestamp for dynamic detection */
  detectedAt?: string; // ISO 8601
}
```

**Storage**:
- Cloud providers (OpenAI, Anthropic): Static registry in code
- Local providers (Ollama): Cached in memory with 5-minute TTL

---

### OnboardingMetrics

Tracks provider configuration analytics for SC-006 measurement.

```typescript
/**
 * Outcome of an onboarding attempt
 */
export type OnboardingOutcome = 'success' | 'failure' | 'abandoned';

/**
 * Single onboarding attempt record
 */
export interface OnboardingAttempt {
  /** Unique attempt identifier */
  readonly id: string;

  /** Provider type being configured */
  readonly providerType: ProviderType;

  /** Outcome of the attempt */
  outcome: OnboardingOutcome;

  /** Step where failure/abandonment occurred (if applicable) */
  failedAtStep?: 'provider-selection' | 'credential-entry' | 'validation' | 'save';

  /** Duration from start to completion/abandonment in ms */
  durationMs: number;

  /** Error code if failure */
  errorCode?: string;

  /** Timestamp */
  readonly timestamp: string; // ISO 8601
}

/**
 * Aggregated onboarding metrics
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

  /** Average duration for successful attempts */
  avgSuccessDurationMs: number;

  /** Last updated timestamp */
  updatedAt: string; // ISO 8601
}
```

**Storage**: `electron-store` (`mdxpad-onboarding.json`)

**Constraints**:
- Local-only storage (privacy-preserving per assumptions)
- Records kept for 30 days, then aggregated into OnboardingMetrics
- Used for SC-006 measurement: "95% first-provider success rate"

---

## State Management

### Zustand Store Structure (Renderer)

```typescript
interface AIProviderState {
  // Provider list (synced from main process)
  providers: ProviderConfig[];

  // Currently active provider ID
  activeProviderId: string | null;

  // Loading states
  isLoading: boolean;
  isValidating: boolean;

  // UI state
  settingsOpen: boolean;
  selectedProviderId: string | null;

  // Usage stats (fetched on demand)
  usageStats: UsageStats | null;
  usageStatsTimeRange: 'day' | 'week' | 'month' | 'all';

  // Actions
  fetchProviders: () => Promise<void>;
  addProvider: (config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<void>;
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  setActiveProvider: (id: string) => Promise<void>;
  validateProvider: (id: string) => Promise<boolean>;
  fetchUsageStats: (timeRange: 'day' | 'week' | 'month' | 'all') => Promise<void>;
}
```

### Main Process State

```typescript
interface MainProcessAIState {
  // Active provider instance (AI SDK model)
  activeModel: LanguageModel | null;

  // Credential cache (session-only when keychain unavailable)
  sessionCredentials: Map<string, string>;

  // Capability cache (for dynamic detection)
  capabilityCache: Map<string, { capabilities: ModelCapabilities; expiresAt: number }>;

  // Rate limit tracking per provider
  rateLimits: Map<string, { retryAfter: number; provider: string }>;
}
```

---

## Data Flow

### Provider Configuration Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Renderer     │     │      IPC        │     │  Main Process   │
│   (Zustand)     │────>│ mdxpad:ai:*     │────>│   (Services)    │
└────────┬────────┘     └─────────────────┘     └────────┬────────┘
         │                                               │
         │  1. User submits provider config              │
         │─────────────────────────────────────────────>│
         │                                               │
         │                               2. Validate API key
         │                                  (call provider API)
         │                                               │
         │                               3. Store credential
         │                                  (safeStorage)
         │                                               │
         │                               4. Save config
         │                                  (electron-store)
         │                                               │
         │  5. Return success + provider list           │
         │<─────────────────────────────────────────────│
         │                                               │
         │  6. Update Zustand state                     │
         ▼                                               ▼
```

### AI Request Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  AI Consumer    │     │   IPC Bridge    │     │  AI Provider    │
│  (Renderer)     │────>│ mdxpad:ai:gen   │────>│   Manager       │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                          1. Get active provider
                                          2. Load credential
                                          3. Check capabilities
                                          4. Build AI SDK request
                                                         │
                                                         ▼
                                                ┌────────────────┐
                                                │   AI SDK       │
                                                │  (streamText)  │
                                                └────────┬───────┘
                                                         │
                                          5. Stream response
                                          6. Track usage
                                          7. Send chunks via IPC
                                                         │
                                                         ▼
                                                ┌────────────────┐
                                                │  Usage Tracker │
                                                │ (UsageRecord)  │
                                                └────────────────┘
```

---

## Storage Summary

| Entity | Location | Format | Encryption |
|--------|----------|--------|------------|
| ProviderConfig | electron-store | JSON | No (no secrets) |
| Credential (key) | macOS Keychain | Binary | Yes (safeStorage) |
| Credential (metadata) | electron-store | JSON | No |
| UsageRecord | electron-store | JSON | No |
| ModelCapabilities (static) | In-code registry | TypeScript | N/A |
| ModelCapabilities (dynamic) | Memory cache | Runtime | N/A |
| OnboardingMetrics | electron-store | JSON | No |
| Session credentials | Memory | Map | No (transient) |
