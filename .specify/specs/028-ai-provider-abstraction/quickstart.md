# Quickstart: AI Provider Abstraction Layer

**Feature Branch**: `028-ai-provider-abstraction`
**Date**: 2026-01-17

---

## Overview

This feature implements a BYOK (Bring Your Own Key) AI provider abstraction layer for mdxpad, enabling users to configure and use multiple AI providers (OpenAI, Anthropic, local models) with secure credential storage and unified interfaces.

---

## Prerequisites

Before implementation:

1. **Feature 000 (Foundational Setup)** must be complete
2. **Feature 001 (Interface Contracts)** IPC patterns must be in place
3. Dependencies installed (see below)

---

## Quick Setup

### 1. Install Dependencies

```bash
# AI SDK core and providers
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/openai-compatible

# Ollama community provider (dev only - bundled for local testing)
pnpm add -D ollama-ai-provider

# Validation
pnpm add zod  # Should already be installed per Constitution
```

### 2. Create Directory Structure

```
src/
├── main/
│   └── services/
│       └── ai/
│           ├── index.ts              # Service exports
│           ├── credential-service.ts  # safeStorage wrapper
│           ├── provider-service.ts    # Provider CRUD
│           ├── capability-service.ts  # Capability detection
│           ├── ai-service.ts          # AI SDK integration
│           ├── usage-service.ts       # Usage tracking
│           ├── onboarding-service.ts  # Onboarding analytics
│           └── registries/
│               ├── openai-registry.ts    # Static capabilities
│               └── anthropic-registry.ts # Static capabilities
├── renderer/
│   └── features/
│       └── ai-provider/
│           ├── index.ts              # Feature exports
│           ├── store.ts              # Zustand store
│           ├── hooks.ts              # React hooks
│           └── components/
│               ├── ProviderSettings.tsx
│               ├── ProviderList.tsx
│               ├── ProviderForm.tsx
│               ├── UsageStats.tsx
│               └── CapabilityBadge.tsx
└── shared/
    └── ai/
        ├── types.ts                  # Shared type definitions
        ├── schemas.ts                # Zod schemas
        └── ipc-channels.ts           # IPC channel definitions
```

### 3. Register IPC Handlers

In `src/main/ipc/index.ts`:

```typescript
import { ipcMain } from 'electron';
import {
  providerService,
  credentialService,
  aiService,
  usageService,
  capabilityService
} from '../services/ai';
import {
  AddProviderRequestSchema,
  // ... other schemas
} from '@shared/ai/schemas';

// Provider management
ipcMain.handle('mdxpad:ai:provider:list', async () => {
  const providers = await providerService.getProviders();
  const activeId = (await providerService.getActiveProvider())?.id ?? null;
  return { providers, activeProviderId: activeId };
});

ipcMain.handle('mdxpad:ai:provider:add', async (_, request) => {
  const validated = AddProviderRequestSchema.parse(request);
  // Implementation...
});

// ... register other handlers
```

---

## Core Implementation Patterns

### Credential Storage Pattern

```typescript
// src/main/services/ai/credential-service.ts
import { safeStorage } from 'electron';
import Store from 'electron-store';

export class CredentialService implements ICredentialService {
  private store = new Store({ name: 'mdxpad-credentials' });
  private sessionCredentials = new Map<string, string>();

  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  async setCredential(providerId: string, apiKey: string): Promise<CredentialSetResult> {
    const keyPreview = apiKey.slice(-4);

    if (this.isAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey);
      this.store.set(`credentials.${providerId}`, encrypted.toString('latin1'));
      this.store.set(`metadata.${providerId}`, {
        storageType: 'persistent',
        keyPreview,
        storedAt: new Date().toISOString(),
      });
      return { success: true, storageType: 'persistent', keyPreview };
    }

    // Session-only fallback (FR-013)
    this.sessionCredentials.set(providerId, apiKey);
    return { success: true, storageType: 'session', keyPreview };
  }

  async getCredential(providerId: string): Promise<string | null> {
    if (this.isAvailable()) {
      const encrypted = this.store.get(`credentials.${providerId}`) as string | undefined;
      if (!encrypted) return null;
      return safeStorage.decryptString(Buffer.from(encrypted, 'latin1'));
    }
    return this.sessionCredentials.get(providerId) ?? null;
  }
}
```

### Provider Switching Pattern

```typescript
// src/main/services/ai/ai-service.ts
import { generateText, streamText, embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export class AIService implements IAIService {
  private activeModel: LanguageModel | null = null;

  async initializeProvider(config: ProviderConfig, apiKey: string): Promise<void> {
    switch (config.type) {
      case 'openai':
        this.activeModel = openai(config.defaultModel ?? 'gpt-4o', { apiKey });
        break;
      case 'anthropic':
        this.activeModel = anthropic(config.defaultModel ?? 'claude-sonnet-4-5-20250929', { apiKey });
        break;
      case 'ollama':
        const ollama = createOpenAICompatible({
          name: 'ollama',
          baseURL: config.baseUrl ?? 'http://localhost:11434/v1',
        });
        this.activeModel = ollama(config.defaultModel ?? 'llama3');
        break;
      case 'lmstudio':
        const lmstudio = createOpenAICompatible({
          name: 'lmstudio',
          baseURL: config.baseUrl ?? 'http://localhost:1234/v1',
        });
        this.activeModel = lmstudio(config.defaultModel ?? 'local-model');
        break;
    }
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    if (!this.activeModel) throw new NoActiveProviderError();

    const startTime = Date.now();
    const result = await generateText({
      model: this.activeModel,
      prompt: request.prompt,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      system: request.systemPrompt,
    });

    return {
      text: result.text,
      usage: {
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
      modelId: result.response.modelId,
      durationMs: Date.now() - startTime,
    };
  }

  async streamText(
    request: TextGenerationRequest,
    onChunk: (chunk: string) => void
  ): Promise<StreamController> {
    if (!this.activeModel) throw new NoActiveProviderError();

    const controller = new AbortController();
    const startTime = Date.now();

    const resultPromise = (async () => {
      const result = streamText({
        model: this.activeModel!,
        prompt: request.prompt,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        system: request.systemPrompt,
        abortSignal: controller.signal,
      });

      for await (const chunk of result.textStream) {
        onChunk(chunk);
      }

      const finalResult = await result;
      return {
        text: finalResult.text,
        usage: {
          inputTokens: finalResult.usage.promptTokens,
          outputTokens: finalResult.usage.completionTokens,
          totalTokens: finalResult.usage.totalTokens,
        },
        modelId: finalResult.response.modelId,
        durationMs: Date.now() - startTime,
      };
    })();

    return {
      abort: () => controller.abort(),
      completion: resultPromise,
    };
  }
}
```

### Capability Detection Pattern

```typescript
// src/main/services/ai/capability-service.ts
import { OPENAI_CAPABILITIES } from './registries/openai-registry';
import { ANTHROPIC_CAPABILITIES } from './registries/anthropic-registry';

export class CapabilityService implements ICapabilityService {
  private dynamicCache = new Map<string, { capabilities: ModelCapabilities; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  async getCapabilities(providerId: string, modelId: string): Promise<ModelCapabilities> {
    const provider = await this.providerService.getProvider(providerId);
    if (!provider) throw new ProviderNotFoundError(providerId);

    // Static registry for cloud providers
    if (provider.type === 'openai') {
      return OPENAI_CAPABILITIES.get(modelId) ?? this.getDefaultCapabilities(modelId);
    }
    if (provider.type === 'anthropic') {
      return ANTHROPIC_CAPABILITIES.get(modelId) ?? this.getDefaultCapabilities(modelId);
    }

    // Dynamic detection for local providers
    return this.detectDynamicCapabilities(provider, modelId);
  }

  private async detectDynamicCapabilities(
    provider: ProviderConfig,
    modelId: string
  ): Promise<ModelCapabilities> {
    const cacheKey = `${provider.id}:${modelId}`;
    const cached = this.dynamicCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.capabilities;
    }

    if (provider.type === 'ollama') {
      const capabilities = await this.detectOllamaCapabilities(provider.baseUrl!, modelId);
      this.dynamicCache.set(cacheKey, {
        capabilities,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });
      return capabilities;
    }

    return this.getDefaultCapabilities(modelId);
  }

  private async detectOllamaCapabilities(
    baseUrl: string,
    modelId: string
  ): Promise<ModelCapabilities> {
    const response = await fetch(`${baseUrl}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelId }),
    });

    if (!response.ok) {
      return this.getDefaultCapabilities(modelId);
    }

    const data = await response.json();
    const capabilities = new Set<ProviderCapability>();

    for (const cap of data.capabilities ?? []) {
      switch (cap) {
        case 'completion':
          capabilities.add(ProviderCapability.TEXT_GENERATION);
          capabilities.add(ProviderCapability.STREAMING);
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
      contextWindow: data.model_info?.context_length,
    };
  }
}
```

### Zustand Store Pattern

```typescript
// src/renderer/features/ai-provider/store.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface AIProviderState {
  providers: ProviderConfig[];
  activeProviderId: string | null;
  isLoading: boolean;
  settingsOpen: boolean;
  usageStats: UsageStats | null;

  // Actions
  fetchProviders: () => Promise<void>;
  addProvider: (config: NewProviderConfig, apiKey?: string) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  setActiveProvider: (id: string) => Promise<void>;
}

export const useAIProviderStore = create<AIProviderState>()(
  immer((set, get) => ({
    providers: [],
    activeProviderId: null,
    isLoading: false,
    settingsOpen: false,
    usageStats: null,

    fetchProviders: async () => {
      set({ isLoading: true });
      try {
        const result = await window.electron.invoke('mdxpad:ai:provider:list');
        set({
          providers: result.providers,
          activeProviderId: result.activeProviderId,
          isLoading: false,
        });
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    addProvider: async (config, apiKey) => {
      const result = await window.electron.invoke('mdxpad:ai:provider:add', {
        ...config,
        apiKey,
      });
      if (result.success && result.provider) {
        set((state) => {
          state.providers.push(result.provider);
        });
      }
    },

    setActiveProvider: async (id) => {
      const result = await window.electron.invoke('mdxpad:ai:provider:set-active', { id });
      if (result.success) {
        set({ activeProviderId: result.activeProviderId });
      }
    },
  }))
);
```

---

## Testing Strategy

### Unit Tests (Vitest)

```typescript
// src/main/services/ai/__tests__/credential-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CredentialService } from '../credential-service';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((str) => Buffer.from(`encrypted:${str}`)),
    decryptString: vi.fn((buf) => buf.toString().replace('encrypted:', '')),
  },
}));

describe('CredentialService', () => {
  let service: CredentialService;

  beforeEach(() => {
    service = new CredentialService();
  });

  it('should store credentials securely', async () => {
    const result = await service.setCredential('provider-1', 'sk-test-key-12345');
    expect(result.success).toBe(true);
    expect(result.storageType).toBe('persistent');
    expect(result.keyPreview).toBe('2345');
  });

  it('should retrieve stored credentials', async () => {
    await service.setCredential('provider-1', 'sk-test-key-12345');
    const key = await service.getCredential('provider-1');
    expect(key).toBe('sk-test-key-12345');
  });

  it('should fall back to session storage when keychain unavailable', async () => {
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
    const result = await service.setCredential('provider-1', 'sk-test');
    expect(result.storageType).toBe('session');
  });
});
```

### Integration Tests

```typescript
// src/main/services/ai/__tests__/ai-service.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AIService } from '../ai-service';

describe('AIService Integration', () => {
  let service: AIService;

  beforeAll(async () => {
    service = new AIService();
    // Mock provider for testing
    await service.initializeProvider(
      { type: 'openai', displayName: 'Test' },
      process.env.OPENAI_API_KEY!
    );
  });

  it('should generate text', async () => {
    const result = await service.generateText({
      prompt: 'Say hello',
      maxTokens: 10,
    });
    expect(result.text).toBeDefined();
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  });

  it('should stream text', async () => {
    const chunks: string[] = [];
    const controller = await service.streamText(
      { prompt: 'Count to 3', maxTokens: 20 },
      (chunk) => chunks.push(chunk)
    );

    const result = await controller.completion;
    expect(chunks.length).toBeGreaterThan(0);
    expect(result.text).toBe(chunks.join(''));
  });
});
```

---

## Success Criteria Verification

| Criteria | Verification Method |
|----------|---------------------|
| SC-001: 2-minute configuration | Manual timing during E2E test |
| SC-002: No plain text storage | Unit test + security audit |
| SC-003: Immediate provider switch | E2E test with provider change |
| SC-004: 1% usage accuracy | Compare with provider dashboard |
| SC-005: 5+ providers | Unit test: add 5 providers |
| SC-006: 95% onboarding success | OnboardingService metrics |

---

## Common Pitfalls

1. **Don't store credentials in renderer process** - All credential operations must go through IPC to main process

2. **Don't block on capability detection** - Use cached capabilities, refresh asynchronously

3. **Don't forget session-only warning** - When `storageType: 'session'`, notify user clearly

4. **Don't assume streaming support** - Check capabilities before using `streamText()`

5. **Don't skip usage tracking** - Track every request, even failures (for cost estimation)
