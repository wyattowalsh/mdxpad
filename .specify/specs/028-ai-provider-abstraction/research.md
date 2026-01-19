# Research Summary: AI Provider Abstraction Layer

**Feature Branch**: `028-ai-provider-abstraction`
**Date**: 2026-01-17
**Status**: Complete

---

## Research Questions & Decisions

### 1. Secure Credential Storage

**Question**: What is the best approach for securely storing AI provider API keys in an Electron application on macOS?

**Decision**: **Electron's `safeStorage` API** (built-in)

**Rationale**: Electron's safeStorage API provides OS-native keychain integration without external dependencies, is actively maintained as part of Electron's core, and offers the best security guarantees for macOS through direct Keychain Access integration. Since mdxpad uses Electron 39.x (which includes mature safeStorage support), no additional dependencies are required.

**Alternatives Rejected**:
| Option | Rejection Reason |
|--------|------------------|
| **keytar** | Repository archived December 15, 2022. No longer maintained. Native module causes build complexity. |
| **electron-store with encryption** | Uses AES-256-CBC without authentication - vulnerable to bit-flipping attacks. Docs warn against using for sensitive data. |

**Implementation Pattern**:
```typescript
import { safeStorage } from 'electron';
import Store from 'electron-store';

class CredentialManager {
  private store = new Store({ name: 'mdxpad-credentials' });
  private sessionCredentials = new Map<string, string>();

  async setCredential(key: string, value: string): Promise<void> {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value);
      this.store.set(key, encrypted.toString('latin1'));
    } else {
      // Session-only fallback (FR-013)
      this.sessionCredentials.set(key, value);
    }
  }

  async getCredential(key: string): Promise<string | null> {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = this.store.get(key) as string | undefined;
      if (!encrypted) return null;
      return safeStorage.decryptString(Buffer.from(encrypted, 'latin1'));
    }
    return this.sessionCredentials.get(key) ?? null;
  }
}
```

---

### 2. AI SDK Selection

**Question**: What SDK/library should be used for unified AI provider abstraction across OpenAI, Anthropic, and local models?

**Decision**: **Vercel AI SDK (`@ai-sdk/*`)**

**Rationale**: The Vercel AI SDK provides comprehensive provider coverage, excellent TypeScript support, modular architecture for bundle optimization, and native streaming support. With 2.8M weekly npm downloads, it represents the dominant TypeScript AI framework. Its provider-agnostic design allows seamless switching between providers with minimal code changes.

**Alternatives Rejected**:
| Option | Rejection Reason |
|--------|------------------|
| **LangChain.js** | Heavy bundle (~15MB+) - violates Constitution Article V (<5MB renderer). Overkill for requirements. |
| **Direct Provider SDKs** | No unified interface. Would require maintaining separate code paths. |
| **Custom HTTP Abstraction** | Significant development effort. Reinventing solved problems. |

**Package Dependencies**:
```json
{
  "dependencies": {
    "ai": "^6.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai-compatible": "^0.1.0"
  },
  "devDependencies": {
    "ollama-ai-provider": "^1.0.0"
  }
}
```

**Feature Coverage** (FR-014):
| Feature | AI SDK Support |
|---------|----------------|
| Text generation | `generateText()`, `streamText()` |
| Streaming | Native SSE with callbacks |
| Embeddings | `embed()`, `embedMany()` |
| Image generation | `generateImage()` |
| Agents | `Agent` class (v6) |
| Local models (Ollama) | `ollama-ai-provider` community package |
| Local models (LM Studio) | `@ai-sdk/openai-compatible` |

---

### 3. Provider Capability Detection

**Question**: How should the system detect which features each provider/model supports?

**Decision**: **Hybrid Static Registry + Dynamic Probing**

**Rationale**: Use a static capability registry as the primary source for cloud providers (OpenAI, Anthropic) since their APIs don't expose capability metadata. Supplement with dynamic probing for local providers (Ollama) that expose capabilities at runtime.

**Provider-Specific Findings**:

| Provider | Detection Method | Notes |
|----------|------------------|-------|
| OpenAI | Static registry | `/v1/models` returns only id/owner/created - no capability data |
| Anthropic | Static registry | No model listing endpoint. Capabilities documented only. |
| Ollama | Dynamic probing | `/api/show` returns `capabilities` array |
| LM Studio | Static + heuristics | OpenAI-compatible but no capability metadata |

**Capability Types**:
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
```

**Ollama Dynamic Detection**:
```typescript
async function detectOllamaCapabilities(baseUrl: string, modelId: string): Promise<ModelCapabilities> {
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
  return { modelId, capabilities };
}
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  AI Feature UI (React 19.x + Zustand)               │    │
│  │  - Provider Settings Panel                          │    │
│  │  - Usage Statistics Dashboard                       │    │
│  │  - AI Feature Consumers                             │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │ IPC (mdxpad:ai:*)                 │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                     Main Process                             │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              AI Provider Manager                     │    │
│  │  - Provider Registry                                │    │
│  │  - Capability Checker                               │    │
│  │  - Active Provider State                            │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                   │
│  ┌───────────┬───────────┼───────────┬───────────────┐      │
│  ▼           ▼           ▼           ▼               ▼      │
│ ┌─────┐  ┌─────────┐  ┌─────┐  ┌──────────┐  ┌──────────┐  │
│ │Cred │  │ Usage   │  │ AI  │  │Capability│  │ Rate     │  │
│ │Svc  │  │ Tracker │  │ SDK │  │ Checker  │  │ Limiter  │  │
│ └──┬──┘  └────┬────┘  └──┬──┘  └────┬─────┘  └────┬─────┘  │
│    │          │          │          │             │        │
│    ▼          ▼          ▼          ▼             ▼        │
│ safeStorage electron-   @ai-sdk/*  Static +     Per-provider│
│ (Keychain)  store                  Dynamic      tracking    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              External APIs / Local Endpoints
              (OpenAI, Anthropic, Ollama, LM Studio)
```

---

## Constitution Alignment

| Requirement | Research Finding | Status |
|-------------|------------------|--------|
| Article II: TypeScript 5.9.x strict | AI SDK has first-class TypeScript | ✅ PASS |
| Article III: contextIsolation | Credentials in main process via IPC | ✅ PASS |
| Article III: IPC pattern | Will use invoke/handle with zod | ✅ PLANNED |
| Article V: <5MB renderer | AI SDK core ~67KB; main process isolation | ✅ PASS |
| FR-002: OS keychain | safeStorage uses macOS Keychain | ✅ PASS |
| FR-013: Keychain fallback | `isEncryptionAvailable()` check | ✅ PASS |
| FR-014: Feature support | AI SDK covers all required features | ✅ PASS |
| FR-016: Capability detection | Hybrid approach covers all providers | ✅ PASS |
| FR-017: Streaming | AI SDK native streaming | ✅ PASS |

---

## References

- [Electron safeStorage Documentation](https://electronjs.org/docs/latest/api/safe-storage)
- [Vercel AI SDK Documentation](https://ai-sdk.dev/docs)
- [Ollama API Reference](https://docs.ollama.com/api-reference)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Anthropic API Reference](https://platform.claude.com/docs/en/api/overview)
