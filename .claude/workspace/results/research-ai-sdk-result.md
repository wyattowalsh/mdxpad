# AI SDK Research Results for mdxpad AI Provider Abstraction Layer

**Date**: 2026-01-17
**Feature Branch**: `028-ai-provider-abstraction`
**Context**: Building a BYOK AI Provider Abstraction Layer for mdxpad

---

## Decision

**Chosen Approach**: **Vercel AI SDK (`@ai-sdk/*`)**

## Rationale

The Vercel AI SDK provides the best combination of comprehensive provider coverage, excellent TypeScript support, modular architecture for bundle optimization, and native streaming support - all critical requirements for an Electron-based MDX editor. With 2.8M weekly npm downloads (vs LangChain.js's 795K), it represents the dominant TypeScript AI framework with superior community support and maintenance velocity. Its provider-agnostic design allows seamless switching between OpenAI, Anthropic, and local models (via OpenAI-compatible endpoints like Ollama/LM Studio) with minimal code changes.

---

## Alternatives Considered

### 1. LangChain.js
**Rejection Reasons**:
- **Heavy bundle size**: Core package ~15MB, typical implementation 150-300MB with dependencies - problematic for Electron renderer (Constitution Article V mandates <5MB renderer bundle)
- **Cognitive overhead**: Library-specific abstractions (Chains, Agents, Runnables) add complexity
- **Black-box debugging**: Errors often originate from deep library internals
- **Memory footprint**: 200-400MB base, increasing to 1-4GB during active RAG operations
- **Overkill for requirements**: LangChain's strength is complex RAG/orchestration pipelines; mdxpad needs simpler provider abstraction

### 2. Direct Provider SDKs (openai, @anthropic-ai/sdk)
**Rejection Reasons**:
- **No unified interface**: Would require maintaining separate code paths for each provider
- **Duplicated streaming logic**: Each SDK handles streaming differently
- **No local model abstraction**: Would need custom wrapper for Ollama/LM Studio
- **Higher maintenance burden**: API changes require updates across multiple integrations
- **No built-in tool/agent primitives**: Would need to build from scratch

### 3. Custom Abstraction over Raw HTTP
**Rejection Reasons**:
- **Significant development effort**: Reinventing solved problems (streaming, error handling, retries)
- **Security risks**: Custom HTTP handling may miss edge cases the established SDKs handle
- **Maintenance overhead**: Must track API changes for all providers manually
- **No community support**: Cannot leverage existing ecosystem of examples and solutions

---

## Detailed Evaluation Matrix

| Criteria | Vercel AI SDK | LangChain.js | Direct SDKs | Custom HTTP |
|----------|---------------|--------------|-------------|-------------|
| **Provider Coverage** | Excellent (20+ providers) | Excellent | Limited (per-SDK) | Manual |
| **Streaming Support** | Native, unified API | Supported | Per-SDK differences | Manual impl |
| **Agent/Tool Support** | Built-in primitives | Comprehensive | Basic | Manual |
| **Bundle Size** | ~67KB core (v5/v6) | ~15MB+ with deps | Variable | Minimal |
| **TypeScript Support** | First-class, strict | Good | Varies | Manual types |
| **Maintenance/Community** | 20.9K stars, 2.8M/wk downloads | 16.6K stars, 795K/wk | Provider-dependent | N/A |
| **Local Model Flexibility** | OpenAI-compatible providers | Ollama integration | N/A | Full control |
| **Embeddings** | Yes, unified API | Yes | Yes (separate) | Manual |
| **Image Generation** | Yes, multi-provider | Limited | Yes (separate) | Manual |

---

## Vercel AI SDK Feature Coverage for mdxpad Requirements

### FR-014 Requirements Mapping

| Requirement | AI SDK Support | Implementation Notes |
|-------------|----------------|---------------------|
| Text generation (chat/completion) | `generateText()`, `streamText()` | Unified API across all providers |
| Streaming | Native with SSE, stream parts | `streamText()` with callbacks |
| Embeddings | `embed()`, `embedMany()` | Provider-specific embedding models |
| Image generation | `generateImage()` | OpenAI, Fal, Fireworks, Replicate, Google support |
| Agents | `Agent` class, tool loop patterns | v6 introduces dedicated agent primitives |
| Multiagent systems | Composable with tool handoffs | Can orchestrate multiple agents |
| Deep agents | Supported via recursive tool calls | Memory and planning patterns available |
| Local models (Ollama) | `@ai-sdk/ollama` community provider | OpenAI-compatible endpoint support |
| Local models (LM Studio) | OpenAI-compatible provider | Uses `createOpenAICompatible()` |

### Streaming Architecture

```typescript
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const result = streamText({
  model: anthropic('claude-sonnet-4-5-20250929'),
  prompt: 'Generate MDX documentation...',
});

for await (const chunk of result.textStream) {
  // Process streaming chunks
}
```

### Provider Switching (Hot-Swappable)

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOllama } from 'ollama-ai-provider';

// Single line change to switch providers
const model =
  provider === 'openai' ? openai('gpt-5') :
  provider === 'anthropic' ? anthropic('claude-sonnet-4-5-20250929') :
  createOllama({ baseURL: 'http://localhost:11434/api' })('llama3');

const result = await generateText({ model, prompt });
```

### Local Model Support

**Ollama**:
```typescript
import { createOllama } from 'ollama-ai-provider';

const ollama = createOllama({
  baseURL: 'http://localhost:11434/api',
});

// Text generation
const { text } = await generateText({
  model: ollama('llama3.2'),
  prompt: 'Hello!',
});

// Embeddings
const { embeddings } = await embedMany({
  model: ollama.embeddingModel('nomic-embed-text'),
  values: ['text to embed'],
});
```

**LM Studio** (OpenAI-compatible):
```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const lmstudio = createOpenAICompatible({
  name: 'lmstudio',
  baseURL: 'http://localhost:1234/v1',
});

const { text } = await generateText({
  model: lmstudio('local-model'),
  prompt: 'Hello!',
});
```

---

## Bundle Size Analysis (Electron Renderer Concerns)

### AI SDK v6 (Current)
- **Core `ai` package**: ~67.5KB (gzipped)
- **Provider packages**: ~10-30KB each (tree-shakeable)
- **Total typical installation**: ~100-150KB for core + 2 providers

### Tree-Shaking Effectiveness
- AI SDK uses ES Modules with `"sideEffects": false`
- Only imported functions are bundled
- Provider-specific code isolated to separate packages

### Electron-Specific Considerations
- Renderer process should only import types and lightweight client code
- Heavy operations (actual API calls) should route through main process via IPC
- Per Constitution Article III, all IPC must use `invoke/handle` pattern with zod validation

---

## Recommended Architecture for mdxpad

```
Renderer Process (UI)
    |
    | IPC: mdxpad:ai:generate, mdxpad:ai:embed, mdxpad:ai:image
    v
Main Process (AI Provider Layer)
    |
    +-- Provider Manager (credential management)
    +-- AI SDK Integration (@ai-sdk/*)
    +-- Usage Tracker (per-request logging)
    |
    v
External APIs / Local Endpoints
```

### Key Implementation Points

1. **Main Process Isolation**: All AI SDK calls execute in main process (Node.js context)
2. **IPC Contract**: Define typed channels for each AI operation
3. **Streaming via IPC**: Use `webContents.send()` for streaming chunks
4. **Credential Storage**: System keychain (per FR-002), never in renderer
5. **Bundle Optimization**: Renderer only contains TypeScript types, not SDK runtime

---

## Version Recommendation

**Recommended Version**: `ai@6.x` (currently in beta as of 2026-01-17)

**Rationale**:
- AI SDK v6 introduces dedicated `Agent` class and improved streaming primitives
- Better separation of concerns for agent workflows
- Enhanced TypeScript type inference
- Breaking changes from v5 are minimal

**Fallback**: `ai@5.x` (stable) if v6 beta issues arise

---

## Provider Packages to Install

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

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AI SDK v6 instability | Medium | Medium | Pin to specific version, have v5 fallback |
| Provider API breaking changes | Low | Medium | AI SDK abstracts this; watch changelogs |
| Local model compatibility | Low | Low | OpenAI-compatible API is stable standard |
| Bundle size growth | Low | Medium | Tree-shaking, main process isolation |

---

## Conclusion

The Vercel AI SDK is the clear choice for mdxpad's AI Provider Abstraction Layer. It provides:

1. **Unified API** across all target providers (OpenAI, Anthropic, local models)
2. **First-class TypeScript** with strict typing (aligns with Constitution Article II)
3. **Lightweight bundle** (~67KB core) suitable for Electron (Constitution Article V)
4. **Native streaming** with consistent patterns across providers
5. **Modular architecture** allowing tree-shaking and main process isolation
6. **Strong community** with 2.8M weekly downloads and active maintenance

The architecture naturally fits mdxpad's Electron security model (main process for sensitive operations, renderer for UI) while providing the flexibility needed for the BYOK model with multiple provider support.
