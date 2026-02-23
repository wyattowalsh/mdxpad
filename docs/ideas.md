# mdxpad Feature Ideas

## Plugin & Extension System
- Remark, rehype, etc plugin support
- NPM package plugin support (e.g., shadcn-ui components)
- Component Registry with Live IntelliSense - auto-complete available JSX components from imported modules with prop snippets

## Persistence & Storage
- Autosave with configurable intervals
- Version control / document history
- External backup/storage integration (iCloud, Dropbox, Google Drive)
- Cloud sync with conflict resolution

## MDX-Specific Editor Features
- Frontmatter Schema Validation & Editor - dedicated UI panel with form fields for common metadata (title, date, author, tags)
- Bidirectional Preview Sync - click elements in preview to jump to source, editor selections highlight in preview
- Expression Evaluation Tooltips - hover over `{...}` expressions to see evaluated results inline
- Component Prop Documentation - parse JSDoc/TypeScript props and display inline hints when inserting components
- MDX Content Outline/Navigator - live TOC from headings, component hierarchy, and frontmatter sections
- Smart Markdown-to-JSX Converter - quick-action buttons to convert markdown tables/lists into styled JSX components

## Developer Experience
- Smart Command Filtering with Aliases & Synonyms - find commands by multiple names (e.g., "make bold" = "bold")
- Quick Actions Sidebar with Pinnable Commands - collapsible sidebar showing top 10 most-used and favorite commands
- Markdown Template Insertion System - keyboard-accessible templates for code blocks, callouts, tables, JSX patterns
- Context-Aware Command Availability with Tooltips - grayed-out commands show why disabled (e.g., "Save: No unsaved changes")
- Multi-Document Command Palette - show recent/open documents with preview on hover for rapid context-switching
- Customizable Keyboard Shortcuts - conflict detection, interactive resolver UI, user-rebindable shortcuts

## Integrations
- Git Version Control - commit, history, diff status through command palette with status bar integration
- Collaborative Real-time Editing - WebSocket sync with operational transformation for multi-user editing
- CMS Content Publishing Pipeline - bridge to headless CMS platforms (Contentful, Sanity) with publish/schedule commands
- Design Tool Asset Linking - drag-drop from Figma/Sketch with auto image optimization and component stub generation
- Export & Automation - convert MDX to OpenAPI specs or generate TypeScript interfaces from code blocks
- Multi-Window Collaboration Hub - secondary windows showing project structure and paired editing of related documents

## AI-Powered Features

### Writing Assistance (Local-First)
- Grammar & Style Assistant - integrate LanguageTool or Harper (open source grammar checkers) for real-time suggestions displayed as CodeMirror linting hints with quick-fix commands, runs entirely offline
- AI Text Completion with Ollama - use Mistral 7B/Llama 2 7B via Ollama or node-llama-cpp for context-aware sentence completion, connects to CodeMirror autocomplete, works offline
- Writing Tone & Sentiment Analysis - leverage ONNX.js with DistilBERT for local sentiment analysis, suggest rewrites for different tones without API calls
- Markdown Linting & Smart Suggestions - combine local AST parsing with lightweight models for MDX-specific improvements

### MDX & Component Intelligence (Local-First)
- Component Template Generator - AI-powered component suggestions when typing undefined component names
- JSX Component Suggestion Engine - query local embeddings (nomic-embed-text via Ollama) to suggest relevant React/MDX components based on content context
- Frontmatter Auto-Generation - use Mistral 7B (via Ollama) to generate title, description, tags from document content with one-click insertion
- Component JSX Generator - generate starter JSX component code from natural language descriptions using local inference
- Code Block Language Detection - auto-detect programming language in code blocks via lightweight classifiers

### Content Enhancement (Local-First)
- Intelligent Image Handling & Alt Text - run CLIP-like vision models (quantized via ONNX.js) to suggest alt text for images
- AI Content Completion - context-aware suggestions for completing paragraphs, generating examples, expanding sections using local Ollama models
- Content Summarization - generate document summaries and TOC from full MDX content using prompt compression techniques
- Multi-Language Translation - leverage open source MarianMT (via ONNX) or Ollama for document translation without cloud APIs
- AI-Powered Link Suggestions - suggest relevant internal/external links based on content context

### Developer Productivity (Local-First)
- Code Explanation on Selection - use local Ollama inference (Codestral/Mistral) to generate explanations for selected code blocks
- Refactoring & Code Quality Suggestions - analyze code blocks using local models + pattern matching for improvement suggestions
- Command Palette AI Search - extend command palette with semantic search using local embeddings stored in IndexedDB/electron-store
- Markdown-to-JSX Conversion Assistant - intelligently convert markdown blocks to interactive JSX components
- Smart Content Outline Generator - AI-powered intelligent nesting and navigation generation

### Implementation Stack (OSS/Local)
- **Ollama** - macOS native local model hosting (Mistral 7B, Llama 2, Nomic Embed) with REST API
- **node-llama-cpp / @isdk/llama-node** - direct Node.js LLM integration without external service
- **ONNX.js / ONNX Runtime Web** - in-app inference for sentiment, classification, embeddings
- **LanguageTool** - self-hosted grammar/style checking server (LGPL)
- **Transformers.js** - Hugging Face transformers via WebAssembly
- **Harper** - fast, local-first open source grammar checker alternative

### Free API Tier Fallbacks (Optional)
- Mistral Free API - free tier via La Plateforme
- GitHub Models - free preview access to Llama 3.x, Phi, Mistral
- Cerebras - generous free tier for fast inference
- Groq - free API with rate limits for ultra-fast LLM inference
- Google AI Studio - limited free Gemini queries
- Cohere Free API - text classification and embeddings at no cost

### BYOK (Bring Your Own Key) Architecture
Flexible API key management enabling users to use their preferred AI providers:

**Provider Abstraction Layer**
- Unified `AIProvider` interface for all AI operations (completion, embeddings, classification)
- Provider implementations: `OllamaProvider`, `OpenAIProvider`, `AnthropicProvider`, `MistralProvider`, `CohereProvider`, `GroqProvider`, `GeminiProvider`
- Automatic fallback chain: local → BYOK → free tier (configurable per feature)

**Key Management**
- Secure storage via `electron-store` with encryption for API keys
- Per-provider credential management in Settings UI
- Key validation on save (test API call with minimal tokens)
- Environment variable overrides for CI/automation (`MDXPAD_OPENAI_KEY`, etc.)

**Provider Selection**
- Global default provider setting
- Per-feature provider override (e.g., use Ollama for completion but OpenAI for embeddings)
- Automatic model discovery from Ollama, user-specified models for cloud providers
- Model capability matching (some features require specific capabilities like function calling)

**Cost Awareness**
- Token usage tracking per provider
- Estimated cost display before expensive operations
- Usage alerts and limits (configurable per provider)
- Local-first preference toggle to minimize cloud usage

**Implementation Pattern**
```typescript
// Unified AI service with provider abstraction
interface AIProvider {
  id: string;
  name: string;
  isLocal: boolean;
  capabilities: AICapability[];
  complete(prompt: string, options: CompletionOptions): Promise<string>;
  embed(text: string): Promise<number[]>;
  validate(): Promise<boolean>;
}

// Factory pattern for provider instantiation
const provider = AIProviderFactory.create(config.defaultProvider, {
  apiKey: config.providers[config.defaultProvider]?.key,
  baseUrl: config.providers[config.defaultProvider]?.baseUrl,
});
```

**Settings UI**
- Accordion-style provider configuration (one section per provider)
- Connection test button with live status indicator
- Model selection dropdown (auto-populated for Ollama, manual for cloud)
- Base URL override for self-hosted/enterprise deployments
- Import/export settings (excluding sensitive keys) for sharing configs
