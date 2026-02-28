# AI Features

MDXPad integrates AI capabilities through the Vercel AI SDK v6 with BYOK (bring-your-own-key) provider support.

## Provider Architecture

```
Renderer                    Preload (ai-api)           Main Process
┌────────────────┐         ┌──────────────┐         ┌──────────────────┐
│ ProviderSettings│◄──────►│ aiApi         │◄──────►│ AIService         │
│ AIChatWritePanel│        │ ai-session-api│         │ ProviderService   │
│ AgentPanel      │        │               │         │ CredentialService │
│ SemanticSearch  │        │               │         │ UsageService      │
│ MultiFileEdit   │        │               │         │ EmbeddingService  │
└────────────────┘         └──────────────┘         └──────────────────┘
```

### Main Process Services (`src/main/services/ai/`)

| Service | File | Purpose |
|---------|------|---------|
| `AIService` | `ai-service.ts` | Core AI operations (text, embedding, image) |
| `ProviderService` | `provider-service.ts` | Provider config management and validation |
| `CredentialService` | `credential-service.ts` | API key storage via macOS Keychain |
| `CapabilityService` | `capability-service.ts` | Model capability detection |
| `UsageService` | `usage-service.ts` | Token usage tracking and cost estimation |
| `AgentService` | `agent-service.ts` | AI agent mode with tool execution |
| `EmbeddingService` | `embedding-service.ts` | Text embedding generation |
| `VectorStore` | `vector-store.ts` | In-memory vector storage for semantic search |
| `OnboardingService` | `onboarding-service.ts` | First-run provider setup |
| `ProviderSessionService` | `provider-session-service.ts` | Session-scoped provider instances |
| `AISessionStorageService` | `ai-session-storage-service.ts` | Conversation persistence |

### Supported Providers

- **Anthropic** (`@ai-sdk/anthropic`) -- Claude models
- **OpenAI** (`@ai-sdk/openai`) -- GPT models
- **OpenAI-Compatible** (`@ai-sdk/openai-compatible`) -- Any OpenAI-compatible API
- **Ollama** (`ollama-ai-provider`) -- Local models via Ollama

## AI Agent Mode

The agent mode enables autonomous multi-step AI operations with tool use.

### Components

- `AgentPanel` (`src/renderer/features/ai-agent/AgentPanel.tsx`) -- Agent conversation UI
- `useAgentModeStore` (`src/renderer/features/ai-agent/agent-mode-store.ts`) -- Conversation state
- `AGENT_TOOLS` (`src/renderer/features/ai-agent/agent-tools.ts`) -- Tool registry

### Available Agent Tools

| Tool | Description | Approval Required |
|------|-------------|-------------------|
| `readFile` | Read file contents | No |
| `writeFile` | Write content to a file | Yes |
| `searchFiles` | Search files by pattern | No |
| `listDirectory` | List directory contents | No |

### Agent Status Flow

```
idle → thinking → executing → waiting-for-approval → idle
                                    ↓
                                  error
```

## AI Write Actions

Command palette write actions for in-editor AI operations:

| Command | ID | Description |
|---------|-----|-------------|
| AI: Rewrite Selection | `edit.ai-rewrite` | Rewrite selected text |
| AI: Summarize Selection | `edit.ai-summarize` | Summarize selected text |
| AI: Fix Grammar | `edit.ai-fix-grammar` | Fix grammar in selection |
| AI: Adjust Tone | `edit.ai-adjust-tone` | Change tone of selection |
| AI: Cancel Write Action | `edit.ai-cancel-write-action` | Cancel active write |

Write actions stream output to replace the selected text. The `AIChatWritePanel` (`src/renderer/components/ai/AIChatWritePanel.tsx`) also provides action presets: Continue writing, Rewrite, Summarize, and Custom prompt.

## Semantic Search

Semantic search uses AI embeddings to find conceptually related content across the workspace.

### Components

- `SemanticSearchPanel` (`src/renderer/features/semantic-search/SemanticSearchPanel.tsx`) -- Search UI
- `useSemanticSearchStore` (`src/renderer/features/semantic-search/semantic-search-store.ts`) -- Search state
- `semantic-search-handlers.ts` (`src/main/services/ai/semantic-search-handlers.ts`) -- IPC handlers
- `VectorStore` (`src/main/services/ai/vector-store.ts`) -- In-memory vector index

### Workflow

1. **Index**: Split workspace files into chunks, generate embeddings, store in VectorStore
2. **Search**: Embed query, find nearest neighbors by cosine similarity
3. **Results**: Return ranked results with file path, snippet, and similarity score

### Store State

```typescript
interface SemanticSearchState {
  query: string;
  results: SemanticSearchResult[];
  isSearching: boolean;
  isIndexing: boolean;
  isIndexed: boolean;
  fileCount: number;
  chunkCount: number;
  lastIndexedAt: string | null;
}
```

## Next-Edit Prediction

Ghost text completions powered by AI, shown after a 500ms typing pause.

### Implementation

`src/renderer/lib/editor/extensions/next-edit-prediction.ts`

- CodeMirror extension using `StateField` and `Decoration.widget`
- **Tab** to accept prediction, **Escape** to dismiss
- Debounced at 500ms with `AbortController` cancellation on new keystrokes
- Configurable via `PredictionProvider` callback

```typescript
const provider: PredictionProvider = async (text, cursorPos, signal) => {
  // Call AI API for completion
  return predictedText;
};

const extension = nextEditPrediction(provider);
```

## Multi-File AI Editing

Enables AI-driven edits across multiple files with per-file accept/reject workflow.

### Components

- `useMultiFileAiStore` (`src/renderer/stores/multi-file-ai-store.ts`) -- Edit tracking
- `MultiFileEditPanel` (`src/renderer/components/ai/MultiFileEditPanel.tsx`) -- Diff review UI
- `FileEditDiff` (`src/renderer/components/ai/FileEditDiff.tsx`) -- Per-file diff view

### Store State

Each file edit has a status: `pending`, `applied`, or `rejected`. Users can apply/reject individual files or use bulk operations (`applyAll`, `rejectAll`).

## IPC Schemas

AI-related IPC contracts are defined in:
- `src/shared/ai/schemas.ts` -- Provider, model, and session schemas
- `src/shared/ai/ipc-channels.ts` -- Channel definitions
- `src/shared/contracts/ai-schemas.ts` -- Validation schemas
- `src/shared/contracts/agent-schemas.ts` -- Agent mode schemas
- `src/shared/contracts/semantic-search-schemas.ts` -- Search schemas
