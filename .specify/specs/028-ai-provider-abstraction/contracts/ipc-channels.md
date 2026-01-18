# IPC Channel Contracts: AI Provider Abstraction Layer

**Feature Branch**: `028-ai-provider-abstraction`
**Date**: 2026-01-17

Per Constitution Article III Section 3.3:
- All IPC channels MUST be defined in `shared/ipc-channels.ts`
- MUST use invoke/handle pattern (not send/on) for request/response
- All payloads MUST be validated with zod on both ends
- Maximum 10 top-level channels; nest related operations
- Channel naming: `mdxpad:<domain>:<action>`

---

## Channel Overview

```
mdxpad:ai:provider
├── list          → Get all configured providers
├── add           → Add new provider configuration
├── update        → Update provider configuration
├── remove        → Remove provider and credentials
├── set-active    → Set active provider
└── validate      → Validate provider credentials

mdxpad:ai:credential
├── set           → Store credential securely
├── has           → Check if credential exists
└── clear         → Remove credential

mdxpad:ai:generate
├── text          → Generate text (non-streaming)
├── stream        → Generate text (streaming)
├── embed         → Generate embeddings
└── image         → Generate image

mdxpad:ai:usage
├── query         → Query usage statistics
├── export        → Export usage data
└── clear         → Clear usage history

mdxpad:ai:capability
├── get           → Get model capabilities
├── list-models   → List available models for provider
└── refresh       → Refresh capability cache
```

---

## Provider Management Channels

### `mdxpad:ai:provider:list`

Returns all configured providers.

**Request**: None

**Response**:
```typescript
const ProviderListResponseSchema = z.object({
  providers: z.array(ProviderConfigSchema),
  activeProviderId: z.string().nullable(),
});
```

---

### `mdxpad:ai:provider:add`

Adds a new provider configuration.

**Request**:
```typescript
const AddProviderRequestSchema = z.object({
  displayName: z.string().min(1).max(50),
  type: ProviderTypeSchema,
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).optional(), // Not stored in request, handled separately
});
```

**Response**:
```typescript
const AddProviderResponseSchema = z.object({
  success: z.boolean(),
  provider: ProviderConfigSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
```

**Error Codes**:
- `DUPLICATE_NAME`: Display name already exists
- `INVALID_PROVIDER_TYPE`: Unknown provider type
- `MISSING_BASE_URL`: Base URL required for local providers
- `MAX_PROVIDERS_REACHED`: Maximum 10 providers allowed

---

### `mdxpad:ai:provider:update`

Updates an existing provider configuration.

**Request**:
```typescript
const UpdateProviderRequestSchema = z.object({
  id: z.string().uuid(),
  updates: z.object({
    displayName: z.string().min(1).max(50).optional(),
    baseUrl: z.string().url().optional(),
    isActive: z.boolean().optional(),
  }),
});
```

**Response**:
```typescript
const UpdateProviderResponseSchema = z.object({
  success: z.boolean(),
  provider: ProviderConfigSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
```

---

### `mdxpad:ai:provider:remove`

Removes a provider and its credentials.

**Request**:
```typescript
const RemoveProviderRequestSchema = z.object({
  id: z.string().uuid(),
});
```

**Response**:
```typescript
const RemoveProviderResponseSchema = z.object({
  success: z.boolean(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
```

---

### `mdxpad:ai:provider:set-active`

Sets the active provider for AI features.

**Request**:
```typescript
const SetActiveProviderRequestSchema = z.object({
  id: z.string().uuid(),
});
```

**Response**:
```typescript
const SetActiveProviderResponseSchema = z.object({
  success: z.boolean(),
  activeProviderId: z.string().uuid().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
```

**Error Codes**:
- `PROVIDER_NOT_FOUND`: Provider ID does not exist
- `PROVIDER_DISCONNECTED`: Provider is not connected
- `CREDENTIAL_MISSING`: Provider has no stored credential

---

### `mdxpad:ai:provider:validate`

Validates provider credentials by making a test API call.

**Request**:
```typescript
const ValidateProviderRequestSchema = z.object({
  id: z.string().uuid(),
});
```

**Response**:
```typescript
const ValidateProviderResponseSchema = z.object({
  success: z.boolean(),
  status: ConnectionStatusSchema,
  models: z.array(z.string()).optional(), // Available models if successful
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryAfterSeconds: z.number().optional(), // For rate limits
  }).optional(),
});
```

**Error Codes**:
- `INVALID_API_KEY`: API key is invalid
- `RATE_LIMITED`: Provider rate limit exceeded (includes `retryAfterSeconds`)
- `NETWORK_ERROR`: Cannot reach provider endpoint
- `ENDPOINT_UNREACHABLE`: Local provider endpoint not responding

---

## Credential Management Channels

### `mdxpad:ai:credential:set`

Stores a credential securely using safeStorage.

**Request**:
```typescript
const SetCredentialRequestSchema = z.object({
  providerId: z.string().uuid(),
  apiKey: z.string().min(1),
});
```

**Response**:
```typescript
const SetCredentialResponseSchema = z.object({
  success: z.boolean(),
  storageType: z.enum(['persistent', 'session']),
  keyPreview: z.string().length(4), // Last 4 chars
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
```

**Notes**:
- If `storageType` is `session`, UI should warn user credentials won't persist
- `keyPreview` is for masked display (e.g., "sk-...abc1")

---

### `mdxpad:ai:credential:has`

Checks if a credential exists for a provider.

**Request**:
```typescript
const HasCredentialRequestSchema = z.object({
  providerId: z.string().uuid(),
});
```

**Response**:
```typescript
const HasCredentialResponseSchema = z.object({
  exists: z.boolean(),
  storageType: z.enum(['persistent', 'session']).optional(),
  keyPreview: z.string().length(4).optional(),
});
```

---

### `mdxpad:ai:credential:clear`

Removes a credential from storage.

**Request**:
```typescript
const ClearCredentialRequestSchema = z.object({
  providerId: z.string().uuid(),
});
```

**Response**:
```typescript
const ClearCredentialResponseSchema = z.object({
  success: z.boolean(),
});
```

---

## AI Generation Channels

### `mdxpad:ai:generate:text`

Generates text using the active provider (non-streaming).

**Request**:
```typescript
const GenerateTextRequestSchema = z.object({
  prompt: z.string().min(1),
  modelId: z.string().optional(), // Uses default if not specified
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().optional(),
});
```

**Response**:
```typescript
const GenerateTextResponseSchema = z.object({
  success: z.boolean(),
  text: z.string().optional(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryAfterSeconds: z.number().optional(),
    alternateProviders: z.array(z.string()).optional(), // FR-015
  }).optional(),
});
```

---

### `mdxpad:ai:generate:stream`

Generates text using streaming (FR-017).

**Request**: Same as `generate:text`

**Response** (initial):
```typescript
const StreamInitResponseSchema = z.object({
  success: z.boolean(),
  streamId: z.string().uuid().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
```

**Stream Events** (via `webContents.send`):
```typescript
// Channel: mdxpad:ai:stream:chunk
const StreamChunkSchema = z.object({
  streamId: z.string().uuid(),
  chunk: z.string(),
  isComplete: z.boolean(),
});

// Channel: mdxpad:ai:stream:complete
const StreamCompleteSchema = z.object({
  streamId: z.string().uuid(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
  }),
});

// Channel: mdxpad:ai:stream:error
const StreamErrorSchema = z.object({
  streamId: z.string().uuid(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
```

---

### `mdxpad:ai:generate:embed`

Generates embeddings for text.

**Request**:
```typescript
const GenerateEmbedRequestSchema = z.object({
  texts: z.array(z.string().min(1)).min(1).max(100),
  modelId: z.string().optional(),
});
```

**Response**:
```typescript
const GenerateEmbedResponseSchema = z.object({
  success: z.boolean(),
  embeddings: z.array(z.array(z.number())).optional(),
  dimensions: z.number().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
```

---

### `mdxpad:ai:generate:image`

Generates images.

**Request**:
```typescript
const GenerateImageRequestSchema = z.object({
  prompt: z.string().min(1),
  size: z.enum(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792']).optional(),
  quality: z.enum(['standard', 'hd']).optional(),
  style: z.enum(['natural', 'vivid']).optional(),
});
```

**Response**:
```typescript
const GenerateImageResponseSchema = z.object({
  success: z.boolean(),
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
```

---

## Usage Statistics Channels

### `mdxpad:ai:usage:query`

Queries usage statistics.

**Request**:
```typescript
const QueryUsageRequestSchema = z.object({
  timeRange: z.enum(['day', 'week', 'month', 'all']),
  providerId: z.string().uuid().optional(), // Filter by provider
  operationType: OperationTypeSchema.optional(), // Filter by operation
});
```

**Response**:
```typescript
const QueryUsageResponseSchema = z.object({
  success: z.boolean(),
  stats: z.object({
    totalRequests: z.number(),
    successfulRequests: z.number(),
    failedRequests: z.number(),
    totalTokens: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    estimatedCostUsd: z.number(),
    byProvider: z.array(z.object({
      providerId: z.string(),
      providerName: z.string(),
      requestCount: z.number(),
      tokenCount: z.number(),
      estimatedCostUsd: z.number(),
    })),
    byOperation: z.array(z.object({
      operationType: OperationTypeSchema,
      requestCount: z.number(),
      avgDurationMs: z.number(),
    })),
  }).optional(),
});
```

---

## Capability Channels

### `mdxpad:ai:capability:get`

Gets capabilities for a specific model.

**Request**:
```typescript
const GetCapabilityRequestSchema = z.object({
  providerId: z.string().uuid(),
  modelId: z.string(),
});
```

**Response**:
```typescript
const GetCapabilityResponseSchema = z.object({
  success: z.boolean(),
  capabilities: z.object({
    modelId: z.string(),
    capabilities: z.array(ProviderCapabilitySchema),
    contextWindow: z.number().optional(),
    maxOutputTokens: z.number().optional(),
    constraints: CapabilityConstraintsSchema.optional(),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
```

---

### `mdxpad:ai:capability:list-models`

Lists available models for a provider.

**Request**:
```typescript
const ListModelsRequestSchema = z.object({
  providerId: z.string().uuid(),
});
```

**Response**:
```typescript
const ListModelsResponseSchema = z.object({
  success: z.boolean(),
  models: z.array(z.object({
    id: z.string(),
    name: z.string(),
    capabilities: z.array(ProviderCapabilitySchema),
  })).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
```

---

## Shared Schemas

```typescript
// Provider Types
const ProviderTypeSchema = z.enum(['openai', 'anthropic', 'ollama', 'lmstudio', 'openai-compatible']);

// Connection Status
const ConnectionStatusSchema = z.enum(['connected', 'disconnected', 'error', 'validating']);

// Operation Types
const OperationTypeSchema = z.enum([
  'text-generation',
  'streaming-generation',
  'embedding',
  'image-generation',
  'agent-execution',
]);

// Provider Capabilities
const ProviderCapabilitySchema = z.enum([
  'text-generation',
  'streaming',
  'vision',
  'embeddings',
  'image-generation',
  'tool-use',
  'agents',
]);

// Capability Constraints
const CapabilityConstraintsSchema = z.object({
  maxImageSize: z.number().optional(),
  maxImageCount: z.number().optional(),
  supportedImageFormats: z.array(z.string()).optional(),
  embeddingDimensions: z.number().optional(),
  maxToolCount: z.number().optional(),
});

// Full Provider Config
const ProviderConfigSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  type: ProviderTypeSchema,
  baseUrl: z.string().url().optional(),
  isActive: z.boolean(),
  status: ConnectionStatusSchema,
  lastConnectedAt: z.string().datetime().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```
