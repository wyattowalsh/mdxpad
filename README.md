# MDXPad

> A powerful, performant, and extensible macOS-first MDX editor with live preview and AI-powered features.

MDXPad is a native macOS application that provides a modern, efficient editing experience for Markdown and MDX files. Built with performance and extensibility in mind, it combines the simplicity of Markdown with the power of React components through MDX, offering developers and content creators a robust tool for technical documentation, blogs, and interactive content.

## Features

### Core Editing
- **Dual Format Support**: Full support for both standard Markdown (GitHub Flavored Markdown) and MDX
- **Live Preview**: Real-time rendering with synchronized scrolling and component preview
- **Advanced Editor**: Powered by CodeMirror 6 with syntax highlighting, autocompletion, and indentation markers
- **Outline Navigation**: Automatic document outline generation with headings, components, and frontmatter navigation
- **Command Palette**: Keyboard-driven command interface for rapid workflow

### File Management
- **Native File System**: Seamless integration with macOS file system via Electron
- **File Watching**: Automatic detection of external file changes with intelligent conflict resolution
- **Recent Files**: Quick access to recently edited documents
- **Template Library**: Built-in and custom templates for rapid document creation

### Content Features
- **YAML Frontmatter**: Visual frontmatter editor with schema validation
- **Smart Filtering**: Fuzzy search with FZF for fast file and content filtering
- **Autosave**: Configurable autosave with atomic writes and checksums
- **Metadata Management**: Rich frontmatter support with custom schemas

### AI Integration
- **Multi-Provider Support**: Bring-your-own-key (BYOK) support for Anthropic, OpenAI, and OpenAI-compatible providers
- **Secure Credentials**: API keys stored in macOS Keychain via Electron safeStorage
- **Usage Tracking**: Per-provider token usage monitoring and cost tracking
- **Capability Detection**: Automatic detection and validation of provider capabilities

### Developer Experience
- **Plugin System**: Extensible architecture supporting remark and rehype plugins
- **React Components**: Full MDX component support with live preview
- **Type Safety**: Built with TypeScript in strict mode
- **Modern Stack**: Electron 39, React 19, CodeMirror 6, and latest web technologies

## Tech Stack

### Core Technologies
- **Runtime**: Electron 39.2.7 (macOS native)
- **Framework**: React 19 with React 19 DOM
- **Language**: TypeScript 5.9.x with strict mode
- **Build Tool**: electron-vite 3.x + Vite 6.x
- **Package Manager**: pnpm 10.11.1

### Editor & Preview
- **Editor**: CodeMirror 6.x with language support for JavaScript, Markdown, YAML
- **MDX**: @mdx-js/mdx 3.x + @mdx-js/react 3.x
- **Syntax Highlighting**: rehype-highlight 7.x
- **Markdown**: remark-gfm 4.x, remark-frontmatter 5.x

### State Management & UI
- **State**: Zustand 5.x with Immer 11.x for immutable updates
- **UI Components**: Radix UI primitives (dialog, dropdown, tabs, etc.)
- **Styling**: Tailwind CSS 4.x with class-variance-authority
- **Icons**: Lucide React
- **Panels**: react-resizable-panels 4.1.0

### AI & Utilities
- **AI SDK**: Vercel AI SDK v6 (@ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/openai-compatible, ollama-ai-provider)
- **File Watching**: chokidar 5.0.0
- **Validation**: zod 3.24.x
- **YAML**: yaml 2.8.x, gray-matter 4.0.x
- **Storage**: electron-store 11.0.2
- **Search**: fzf 0.5.2

### Development & Testing
- **Testing**: Vitest 2.x + @testing-library/react 16.x
- **E2E**: Playwright 1.49.x
- **Coverage**: @vitest/coverage-v8 2.x
- **Linting**: ESLint 9.x with typescript-eslint 8.x
- **Formatting**: Prettier 3.4.x

## Prerequisites

- **Node.js**: >= 20.19.0
- **pnpm**: >= 10.0.0
- **macOS**: 11.0 (Big Sur) or later
- **Xcode Command Line Tools**: For native dependencies

## Installation

### Clone the Repository
```bash
git clone <repository-url>
cd mdxpad
```

### Install Dependencies
```bash
pnpm install
```

### Development Mode
```bash
pnpm dev
```

This starts the Electron app in development mode with hot-reload enabled.

### Build for Production
```bash
pnpm build
```

This compiles the TypeScript code and packages the application using electron-builder. The output will be in the `release/` directory.

## Development Commands

### Essential Commands
- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build and package the application
- `pnpm preview` - Preview production build without packaging
- `pnpm check` - Run typecheck, lint, and tests (full quality check)

### Code Quality
- `pnpm typecheck` - TypeScript type checking
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Auto-fix linting issues
- `pnpm lint:report` - Generate detailed lint report with error counts by rule
- `pnpm format` - Format code with Prettier

### Testing
- `pnpm test` - Run unit tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:e2e` - Run end-to-end tests with Playwright
- `pnpm coverage` - Generate test coverage report

### Utilities
- `pnpm audit:types` - Audit type safety escapes (as any, as unknown as, eslint-disable)
- `pnpm bench` - Run performance benchmarks
- `pnpm verify-security` - Verify security settings and configurations

## Advanced Feature Usage

### Workspace model, projects, and backlinks
- Open a workspace with `window.mdxpad.workspace?.openWorkspace({ rootPath })`; if no model exists, MDXPad creates `.mdxpad/workspace.json`.
- Workspace APIs support project creation and link graph operations: `createProject`, `addLink`, and `getBacklinks`.
- Workspace metadata APIs are also available here (`queryMetadataCollection`, `aggregateMetadataCollection`).

### AI write actions
- Command palette write actions (edit category):
  - `AI: Rewrite Selection` (`edit.ai-rewrite`)
  - `AI: Summarize Selection` (`edit.ai-summarize`)
  - `AI: Fix Grammar` (`edit.ai-fix-grammar`)
  - `AI: Adjust Tone` (`edit.ai-adjust-tone`)
  - `AI: Cancel Write Action` (`edit.ai-cancel-write-action`)
- Write actions require an active AI session and non-empty editor selection; the selected text is replaced with streamed output.
- `AIChatWritePanel` also supports action presets: Continue writing, Rewrite, Summarize, and Custom prompt.

### Export and CLI orchestration
- `File > Export…` / command `file.export` uses the file export path and currently supports `html`, `markdown`, and `mdx`.
- Advanced orchestration is exposed as `window.mdxpad.export`:
  - `jobLifecycle` (create/get/list/cancel/update-status)
  - `presetCrud` (create/get/list/update/delete)
  - `cliInvoke` (run export command)
  - `llmsGenerate` (generate `llms.txt` / `llms-full.txt`)
- The built-in CLI command name is `mdxpad-export`; it supports preset-driven PDF/DOCX generation in addition to text formats.

### Metadata collections
- Query metadata documents with:
  - `queryMetadataCollection({ workspaceId, documentIds?, filters?, limit? })`
- Aggregate metadata with:
  - `aggregateMetadataCollection({ workspaceId, field, operation, filters?, histogramBinSize? })`
- Supported filter operators: `eq`, `contains`, `in`, `gt`, `gte`, `lt`, `lte`.
- Fields can target built-ins (`id`, `title`, `filePath`, `slug`, `tags`, `snippet`, `indexedAt`) or frontmatter paths (for example, `frontmatter.tags`).

### MDX plugin pipeline
- Default pipeline plugins are enabled: `remark-gfm`, `remark-frontmatter`, `remark-outline`, and `rehype-highlight`.
- Per-plugin config supports `enabled` and `options` values under `pluginConfig.plugins`.
- Invalid plugin option payloads are safely ignored and fall back to plugin defaults.

### Mermaid diagrams and footnotes
- Mermaid fences render in preview with standard code fence syntax:
  - ````md
    ```mermaid
    graph TD
      A-->B
    ```
    ````
- GFM footnotes are supported (`[^1]` references + `[^1]:` definitions) and styled in the preview frame.
- HTML export injects Mermaid runtime support and emits a warning that rendering requires jsdelivr access.

### Feature flags and toggles
- Runtime feature surfaces: `workspace`, `ai`, `export`, and `authoring`.
- Default rollout posture is staged: feature surfaces are enabled by default in dev builds and disabled by default in production builds.
- Rollout knobs (applied in order, last wins):
  - `localStorage['mdxpad.feature-flags']` (local tester overrides)
  - `VITE_FEATURE_WORKSPACE`, `VITE_FEATURE_AI`, `VITE_FEATURE_EXPORT`, `VITE_FEATURE_AUTHORING` (build/deploy overrides)
  - `window.__MDXPAD_FEATURE_FLAGS__` (runtime bootstrap override)

## Architecture Overview

MDXPad follows Electron's multi-process architecture with a clear separation of concerns:

### Process Model

```
┌─────────────────────────────────────────────────────────┐
│ Main Process (src/main/)                                │
│ - Application lifecycle                                 │
│ - File system operations                                │
│ - Native OS integration                                 │
│ - IPC handlers                                          │
│ - Window management                                     │
└─────────────────────────────────────────────────────────┘
                        │
                        │ IPC
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Preload Script (src/preload/)                          │
│ - Contextually isolated bridge                          │
│ - Exposes safe APIs to renderer                         │
│ - Type-safe IPC communication                           │
└─────────────────────────────────────────────────────────┘
                        │
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Renderer Process (src/renderer/)                        │
│ - React application                                     │
│ - CodeMirror editor                                     │
│ - MDX preview                                           │
│ - UI components                                         │
│ - Zustand stores                                        │
└─────────────────────────────────────────────────────────┘
                        │
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Shared (src/shared/)                                    │
│ - Type definitions                                      │
│ - Constants                                             │
│ - Utilities                                             │
│ - Validation schemas                                    │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
mdxpad/
├── src/
│   ├── main/          # Main process (Node.js)
│   │   ├── index.ts   # Application entry point
│   │   ├── ipc/       # IPC handlers
│   │   └── services/  # File system, AI, templates, etc.
│   ├── preload/       # Preload scripts (context bridge)
│   │   └── index.ts   # API exposure to renderer
│   ├── renderer/      # Renderer process (React)
│   │   ├── App.tsx    # Root component
│   │   ├── main.tsx   # React entry point
│   │   ├── components/# UI components
│   │   ├── features/  # Feature modules
│   │   ├── stores/    # Zustand state stores
│   │   └── hooks/     # React hooks
│   └── shared/        # Shared types and utilities
│       ├── types/     # TypeScript definitions
│       ├── lib/       # Shared utilities
│       └── ai/        # AI-related shared code
├── scripts/           # Build and utility scripts
├── tests/             # Test files
├── .github/           # CI/CD workflows
└── docs/              # Documentation
```

### Main Process Responsibilities
- Window creation and lifecycle management
- File system operations (read, write, watch)
- Template management and validation
- AI provider integration and credential storage
- Recent files persistence
- Native OS integration (menus, dialogs)

### Renderer Process Responsibilities
- User interface rendering
- CodeMirror editor integration
- MDX compilation and preview
- State management via Zustand
- User interactions and commands
- Real-time syntax highlighting

### Preload Script
- Secure bridge between main and renderer
- Type-safe IPC method exposure
- Context isolation for security

### Shared Code
- TypeScript interfaces and types
- Constants and configuration
- Utility functions used across processes
- Zod validation schemas

## Key Design Principles

1. **Type Safety First**: Strict TypeScript mode with comprehensive type definitions
2. **Performance**: Optimized for large files with streaming, workers, and efficient rendering
3. **Security**: Context isolation, input validation, secure credential storage
4. **Modularity**: Clear separation of concerns with single-responsibility modules
5. **Testability**: Comprehensive test coverage with unit, integration, and E2E tests
6. **Constitution-Driven**: Development guided by architectural constitution (see `docs/constitution/`)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup and workflow
- Code conventions and standards
- Testing requirements
- Commit message format
- Pull request process

## Project Methodology

MDXPad is developed using **Specification-Driven Development (SDD)**, where features are:
1. Specified in detail before implementation
2. Reviewed for architectural consistency
3. Implemented according to the specification
4. Tested against acceptance criteria

See `docs/specs/` for detailed feature specifications.

## License

ISC License - see LICENSE file for details.
