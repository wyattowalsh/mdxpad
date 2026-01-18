# Research: Provider Capability Detection Patterns

**Date**: 2026-01-17
**Feature**: AI Provider Abstraction Layer (028-ai-provider-abstraction)
**Researcher**: Claude Code

---

## Decision

**Chosen Approach: Hybrid Static Registry + Dynamic Probing**

Use a static capability registry as the primary source of truth for well-known cloud providers (OpenAI, Anthropic), supplemented by dynamic probing for local/OpenAI-compatible providers (Ollama, LM Studio) that expose model capabilities at runtime.

---

## Rationale

A hybrid approach provides the best balance of reliability, performance, and flexibility:

1. **Static registries for cloud providers are more reliable** because OpenAI and Anthropic APIs do not expose capability metadata programmatically - the `/v1/models` endpoint only returns basic model info (id, owner, created) without capability details. Capability knowledge must come from documentation.

2. **Dynamic probing is essential for local providers** because Ollama's `/api/show` endpoint explicitly returns a `capabilities` array (e.g., `["completion", "vision"]`), and local model availability changes frequently as users load/unload models.

3. **Hybrid minimizes startup latency** - no need to probe cloud APIs at startup when capabilities are known, while still supporting the dynamic nature of local model servers.

---

## Alternatives Considered

| Alternative | Rejection Reason |
|-------------|------------------|
| **Pure Static Registry** | Cannot handle dynamic local model environments; would require manual config for every Ollama model |
| **Pure Dynamic Probing** | Cloud providers (OpenAI, Anthropic) don't expose capability metadata via API; would require expensive trial-and-error |
| **Capability Detection via Trial Calls** | Expensive (consumes tokens), slow, unreliable error handling across providers, poor UX |
| **Rely on Model Name Parsing** | Fragile; model naming conventions vary wildly between providers and versions |

---

## Provider-Specific Findings

### OpenAI API

**Detection Method**: Static Registry Required

- **`/v1/models` endpoint**: Returns only basic metadata (`id`, `object`, `created`, `owned_by`)
- **No capability metadata**: API does not indicate which models support vision, embeddings, image generation, etc.
- **Model capability mapping must be maintained statically** based on OpenAI documentation

**Capabilities by Model Family** (current as of 2026-01):
| Model | Text Gen | Streaming | Vision | Embeddings | Image Gen | Tool Use |
|-------|----------|-----------|--------|------------|-----------|----------|
| GPT-5.x | Yes | Yes | Yes | No | No | Yes |
| GPT-5 mini/nano | Yes | Yes | Yes | No | No | Yes |
| text-embedding-3-* | No | No | No | Yes | No | No |
| dall-e-3 | No | No | No | No | Yes | No |
| gpt-image-1 | No | No | No | No | Yes | No |

**Key Insight**: OpenAI has separate endpoints for different capabilities (`/v1/chat/completions`, `/v1/embeddings`, `/v1/images/generations`), so capability support is implicit in which endpoints accept which models.

---

### Anthropic API

**Detection Method**: Static Registry Required

- **No model listing endpoint**: Anthropic does not provide a `/models` endpoint
- **Capabilities are documented** but not queryable via API
- **All Claude models support**: text generation, streaming, vision (images in messages), tool use
- **No native embeddings**: Anthropic recommends Voyage AI for embeddings
- **No image generation**: Claude does not generate images

**Capabilities** (current Claude 4.x/Sonnet 4.5):
| Capability | Supported |
|------------|-----------|
| Text Generation | Yes |
| Streaming | Yes (SSE events) |
| Vision (image input) | Yes |
| Embeddings | No (use Voyage AI) |
| Image Generation | No |
| Tool Use/Function Calling | Yes |
| Extended Thinking | Yes |

---

### Ollama (Local Models)

**Detection Method**: Dynamic Probing Supported

Ollama provides excellent capability detection via API:

**`/api/show` endpoint** returns:
```json
{
  "capabilities": ["completion", "vision"],
  "details": {
    "family": "gemma3",
    "parameter_size": "4.3B",
    "quantization_level": "Q4_K_M"
  },
  "model_info": {
    "gemma3.vision.image_size": 896,
    ...
  }
}
```

**`/api/tags` endpoint** lists all available models:
```json
{
  "models": [
    { "name": "llama3:latest", "modified_at": "...", "size": ... },
    { "name": "gemma3:latest", "modified_at": "...", "size": ... }
  ]
}
```

**Capability Values** (from Ollama docs):
- `completion` - text generation
- `vision` - image understanding
- `embedding` - vector embeddings
- `tools` - function calling

**Implementation Strategy**:
1. Call `/api/tags` to get available models
2. For each model, call `/api/show` to get capabilities
3. Cache results with TTL (models change infrequently once loaded)

---

### LM Studio

**Detection Method**: Dynamic Probing via OpenAI-Compatible API

LM Studio exposes OpenAI-compatible endpoints:

- **`/v1/models`**: Lists loaded models
- **`/v1/chat/completions`**: Text generation
- **`/v1/embeddings`**: Embeddings (if model supports)
- **`/v1/completions`**: Legacy completions

**Capability Detection Strategy**:
1. Call `/v1/models` to list available models
2. Capabilities are **not** returned in model metadata
3. Must maintain a static mapping for known model families OR
4. Probe by attempting requests (not recommended)

**Limitation**: LM Studio's API only exposes: Text, Instruct, Vision - no image generation, audio, etc.

---

## Recommended Architecture

### 1. Capability Type Definitions

```typescript
export enum ProviderCapability {
  TEXT_GENERATION = 'text-generation',
  STREAMING = 'streaming',
  VISION = 'vision',
  EMBEDDINGS = 'embeddings',
  IMAGE_GENERATION = 'image-generation',
  TOOL_USE = 'tool-use',
  AGENTS = 'agents',
}

export interface ModelCapabilities {
  modelId: string;
  capabilities: Set<ProviderCapability>;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface ProviderCapabilityRegistry {
  providerId: string;
  staticCapabilities: Map<string, ModelCapabilities>; // For known models
  supportsRuntimeDetection: boolean;
  detectCapabilities?: (modelId: string) => Promise<ModelCapabilities>;
}
```

### 2. Static Registry Structure

```typescript
const OPENAI_CAPABILITIES: Map<string, ModelCapabilities> = new Map([
  ['gpt-5.2', {
    modelId: 'gpt-5.2',
    capabilities: new Set([
      ProviderCapability.TEXT_GENERATION,
      ProviderCapability.STREAMING,
      ProviderCapability.VISION,
      ProviderCapability.TOOL_USE,
      ProviderCapability.AGENTS,
    ]),
    contextWindow: 400000,
  }],
  ['text-embedding-3-small', {
    modelId: 'text-embedding-3-small',
    capabilities: new Set([ProviderCapability.EMBEDDINGS]),
  }],
  ['dall-e-3', {
    modelId: 'dall-e-3',
    capabilities: new Set([ProviderCapability.IMAGE_GENERATION]),
  }],
]);
```

### 3. Dynamic Detection for Ollama

```typescript
async function detectOllamaCapabilities(
  baseUrl: string,
  modelId: string
): Promise<ModelCapabilities> {
  const response = await fetch(`${baseUrl}/api/show`, {
    method: 'POST',
    body: JSON.stringify({ name: modelId }),
  });
  const data = await response.json();

  const capabilities = new Set<ProviderCapability>();

  for (const cap of data.capabilities ?? []) {
    switch (cap) {
      case 'completion':
        capabilities.add(ProviderCapability.TEXT_GENERATION);
        capabilities.add(ProviderCapability.STREAMING); // Ollama always supports streaming
        break;
      case 'vision':
        capabilities.add(ProviderCapability.VISION);
        break;
      case 'embedding':
        capabilities.add(ProviderCapability.EMBEDDINGS);
        break;
      case 'tools':
        capabilities.add(ProviderCapability.TOOL_USE);
        break;
    }
  }

  return {
    modelId,
    capabilities,
    contextWindow: data.model_info?.['context_length'],
  };
}
```

### 4. Unified Capability Checker

```typescript
export class CapabilityChecker {
  private cache = new Map<string, ModelCapabilities>();

  async getCapabilities(
    provider: ProviderConfig,
    modelId: string
  ): Promise<ModelCapabilities> {
    const cacheKey = `${provider.id}:${modelId}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    let capabilities: ModelCapabilities;

    if (provider.supportsRuntimeDetection) {
      // Dynamic detection for local providers
      capabilities = await provider.detectCapabilities!(modelId);
    } else {
      // Static lookup for cloud providers
      capabilities = provider.staticCapabilities.get(modelId) ?? {
        modelId,
        capabilities: new Set(), // Unknown model
      };
    }

    this.cache.set(cacheKey, capabilities);
    return capabilities;
  }

  hasCapability(
    capabilities: ModelCapabilities,
    required: ProviderCapability
  ): boolean {
    return capabilities.capabilities.has(required);
  }
}
```

---

## Graceful Degradation Patterns

### 1. Capability-Aware Feature Gating

```typescript
async function handleUserRequest(request: AIRequest): Promise<AIResponse> {
  const capabilities = await checker.getCapabilities(provider, modelId);

  if (request.type === 'image-generation') {
    if (!checker.hasCapability(capabilities, ProviderCapability.IMAGE_GENERATION)) {
      return {
        error: 'CAPABILITY_UNAVAILABLE',
        message: `${provider.name} does not support image generation`,
        suggestion: 'Switch to OpenAI (DALL-E) for image generation',
        availableProviders: getProvidersWithCapability(ProviderCapability.IMAGE_GENERATION),
      };
    }
  }

  // Proceed with request
}
```

### 2. Streaming Fallback

```typescript
async function generateText(
  provider: Provider,
  model: string,
  prompt: string,
  preferStreaming: boolean
): Promise<TextResponse> {
  const capabilities = await checker.getCapabilities(provider, model);
  const canStream = checker.hasCapability(capabilities, ProviderCapability.STREAMING);

  if (preferStreaming && !canStream) {
    console.warn(`Streaming requested but ${provider.name}:${model} does not support it. Falling back to non-streaming.`);
  }

  const useStreaming = preferStreaming && canStream;

  return useStreaming
    ? provider.streamCompletion(model, prompt)
    : provider.completion(model, prompt);
}
```

### 3. Provider Fallback Chain

```typescript
interface FallbackConfig {
  capability: ProviderCapability;
  preferredProviders: string[]; // Ordered by preference
}

async function executeWithFallback<T>(
  config: FallbackConfig,
  operation: (provider: Provider) => Promise<T>
): Promise<T> {
  const errors: Error[] = [];

  for (const providerId of config.preferredProviders) {
    const provider = getProvider(providerId);
    const capabilities = await checker.getCapabilities(provider, provider.defaultModel);

    if (!checker.hasCapability(capabilities, config.capability)) {
      continue; // Skip providers without required capability
    }

    try {
      return await operation(provider);
    } catch (error) {
      errors.push(error as Error);
      continue; // Try next provider
    }
  }

  throw new AggregateError(errors, `All providers failed for ${config.capability}`);
}
```

---

## Model Listing and Capability Mapping

### Implementation Strategy

1. **On Provider Configuration**:
   - Cloud providers: Load static registry immediately
   - Local providers: Probe available models via API

2. **Model Discovery Flow**:
   ```
   User adds provider
   -> Validate credentials/connection
   -> For local providers: GET /api/tags or /v1/models
   -> For each model: get/detect capabilities
   -> Store in capability cache
   -> Expose via UI for model selection
   ```

3. **Capability Refresh**:
   - Cloud providers: Refresh on app startup (static registry may have updates)
   - Local providers: Refresh when user opens model selector (models may have been added/removed)

---

## Partial Capability Support Handling

Some providers support capabilities partially:

| Scenario | Handling |
|----------|----------|
| Model supports vision but with limited image sizes | Store constraints in `ModelCapabilities.constraints` |
| Streaming supported but with different event formats | Abstract via provider-specific adapter |
| Tool use supported but with schema limitations | Validate tool schemas against provider constraints |
| Embeddings with different dimensions | Expose `embeddingDimensions` in capabilities |

### Example: Constrained Capabilities

```typescript
interface ModelCapabilities {
  modelId: string;
  capabilities: Set<ProviderCapability>;
  constraints?: {
    maxImageSize?: number;
    maxImageCount?: number;
    maxToolCount?: number;
    embeddingDimensions?: number;
    supportedImageFormats?: string[];
  };
}
```

---

## References

- OpenAI API Models: https://platform.openai.com/docs/models
- OpenAI API Reference (Models): https://platform.openai.com/docs/api-reference/models
- Anthropic Models Overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Anthropic Embeddings: https://platform.claude.com/docs/en/build-with-claude/embeddings
- Ollama API Show: https://docs.ollama.com/api-reference/show-model-details
- Ollama Capabilities: https://docs.ollama.com/capabilities/
- LM Studio OpenAI Compatibility: https://lmstudio.ai/docs/developer/openai-compat
- Vercel AI SDK Provider Registry: https://ai-sdk.dev/docs/ai-sdk-core/provider-management
