# Changelog

All notable changes to MDXPad are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Architecture Decision Records directory (`docs/adr/`)
- First ADR: IPC Validation with Zod (ADR-001)
- Documentation directories: `docs/constitution/`, `docs/specs/`, `docs/adr/`
- Feature documentation: `docs/features/` (collaboration, AI, editor extensions, export, plugins)

### Changed
- Moved `ideas.md` to `docs/ideas.md`
- Fixed CONTRIBUTING.md coverage threshold (70% to 80%) to match project standards
- Updated AGENTS.md, CLAUDE.md, and CHANGELOG.md for Waves 1-3
- Updated README and hardening runbook command docs for lockfile/actions pinning/audit baseline quality gates and rehearsal flow

### Fixed
- Restored `tests/integration/ipc/file-handlers.test.ts` save/write coverage after write-capability bootstrap now reads files before granting write capability

### Removed
- Stale wave4/wave5 orchestration logs from `docs/`
- Stale build artifact `electron.vite.config.1768069459160.mjs`

## [0.3.0] - 2026-02-27 (Wave 3)

### Added
- **Real-Time Collaboration**: Yjs WebSocket server in main process with room management (max 50 rooms, 20 clients/room), document update buffering for late joiners, and automatic empty room cleanup
- **Collaboration Store**: Zustand + Immer store tracking room, peers, connection status, and local user info
- **Cursor Overlay**: Remote cursor rendering with username labels and color-coded cursors
- **Collaboration Status Bar**: Connection indicator showing peer count and room status
- **Comment Threads**: Anchored document comments with threaded replies, open/resolved states, persisted as JSON in `~/.mdxpad/collaboration/`
- **Inline Suggestions**: Change proposals with diff patches, accept/reject workflow, and checksum-based staleness detection
- **Share Links**: Token-based shareable URLs with configurable expiration, access modes (read/write), revocation, and cleanup of expired links
- **Static Site Publishing**: MDX-to-HTML generator with index page, default CSS, syntax highlighting support, and progress callbacks
- **Version History**: Aggregated history from autosave snapshots (max 50/file) and git commits (max 100), with browse, diff, and restore
- **Tags/Taxonomy**: Hierarchical tag system with color, parent/child nesting, per-file assignment, tree view, and localStorage persistence
- **Keyboard Shortcut Editor**: Customizable keybindings with conflict detection, import/export, reset to defaults, and localStorage persistence
- **WYSIWYG Editor**: ProseMirror-based rich text editing with MDX schema, markdown parser/serializer, formatting toolbar, and source/WYSIWYG mode toggle
- **Multi-File AI Editing**: AI-driven edits across multiple files with per-file accept/reject, bulk apply/reject, and diff view
- **Template Marketplace**: Browse, preview, and install document templates
- **Accessibility**: High contrast CodeMirror theme, focus trap hooks, accessibility store with preference persistence
- **Voice Input**: Web Speech API integration with continuous mode, interim results, webkit prefix fallback, and graceful degradation
- **Notifications**: Native system notification service with queue management (max 10), click handling, auto-dismiss oldest
- **Yjs-CodeMirror Binding**: Bridge connecting Yjs documents to CodeMirror editor state
- **Comment Decorations**: CodeMirror gutter decorations for comment thread markers
- **Publish Provenance**: Content integrity and provenance tracking for published sites

### Changed
- Expanded IPC handler registration for collaboration, history, share, and notification channels
- Added sender authorization for all new IPC channels

## [0.2.0] - 2026-02-25 (Wave 2)

### Added
- **AI Agent Mode**: Autonomous multi-step AI operations with tool use (readFile, writeFile, searchFiles, listDirectory), plan steps, streaming events, and human-in-the-loop approval workflow
- **Agent Panel**: Conversation UI showing messages, tool calls with approve/reject, plan steps, and status indicators
- **Semantic Search**: Embedding-based workspace search with vector store (in-memory cosine similarity), workspace indexing with chunk splitting, and search result ranking
- **Semantic Search Panel**: Search UI with query input, results list, index status, and re-index trigger
- **Next-Edit Prediction**: AI-powered ghost text completions as a CodeMirror extension with 500ms debounce, Tab to accept, Escape to dismiss, and AbortController cancellation
- **Diagram Generation**: AI-powered Mermaid diagram creation with store and dialog UI
- **Plugin System**: Plugin registry (JSON persistence), loader, manifest validation, state management (installed/active/disabled/error), and IPC handlers
- **Theme System**: Theme manager, built-in theme definitions, custom CSS editor with runtime injection
- **Slash Commands**: `/command` autocomplete in CodeMirror with command definitions
- **Code Execution**: Sandboxed JavaScript/TypeScript execution with CodeOutputWidget for inline results
- **Component Playground**: Interactive component preview with editable props and live rendering
- **Go-to-Definition**: Navigate to component/import definitions from the editor
- **Plugin Marketplace UI**: Browse, search, and manage plugins from within the app
- **CSS Injector**: Runtime CSS injection for themes and custom styles

### Changed
- Added IPC handlers for git, search, import, and citation operations
- Extended preload API with git, search, import, citation, and semantic search bridges

## [0.1.1] - 2026-02-20 (Wave 1)

### Added
- **Multi-Cursor**: Select next/all occurrences of current selection (VS Code-style)
- **Code Folding**: Fold frontmatter blocks, code fences, and JSX blocks
- **Regex Find/Replace**: Regex search with capture group expansion and case sensitivity toggle
- **Snippets Engine**: Expandable MDX snippets with tab-stop placeholders and built-in MDX snippet set
- **Minimap**: Scaled-down document overview sidebar
- **Focus Mode**: Dims non-focused paragraphs for reduced visual noise
- **Distraction-Free Mode**: Hides all UI chrome for immersive writing
- **Spellcheck**: Real-time spell checking with custom dictionary support
- **Font Settings**: Runtime-configurable font family, size, and line height
- **Word Wrap**: Configurable word wrapping extension
- **Vim Keymap**: Vim modal editing emulation for CodeMirror
- **Emacs Keymap**: Emacs key bindings for CodeMirror
- **PDF Export**: Via Electron printToPDF API
- **DOCX Export**: Via docx npm package with heading, paragraph, code, and list support
- **EPUB Export**: Via epub-gen-memory with metadata and chapter splitting
- **LaTeX Export**: Markdown-to-LaTeX conversion with document class and packages
- **Pandoc Bridge**: Integration with local Pandoc installation for custom format output
- **Pandoc Detector**: Runtime Pandoc availability detection
- **Git Integration**: Git service via simple-git for status, diff, and commit operations
- **Full-Text Search**: MiniSearch-based workspace search with search-service and IPC handlers
- **Document Import**: Notion, Google Docs, and HTML-to-MDX converters
- **Citation Management**: BibTeX parsing and CSL formatting via @citation-js
- **Editor Tabs**: Multi-tab editing with tab store, context menus, and drag reordering
- **Breadcrumb Navigation**: File path breadcrumb component with segment navigation
- **Math Rendering**: KaTeX support via remark-math + rehype-katex plugins
- **Mermaid Diagrams**: Mermaid code fence rendering in preview with render scheduler
- **GFM Footnotes**: Footnote references and definitions with styled preview
- **Word Count**: Live word count in status bar
- **Reading Time**: Estimated reading time in status bar
- **Export Orchestration**: Job lifecycle management with presets, CLI orchestration, and llms.txt/llms-full.txt generation
- **Workspace Model**: Projects, link graph, backlinks, metadata collections with query/aggregate operations
- **File Indexing**: Workspace file indexing service with metadata extraction
- **Feature Flags**: Runtime feature surface toggles (workspace, ai, export, authoring) with localStorage, env var, and runtime override layers
- **AI Write Actions**: Rewrite, summarize, fix grammar, adjust tone commands for selected text
- **AI Chat Write Panel**: Streaming AI write panel with action presets
- **MDX Plugin Pipeline**: Configurable remark/rehype plugin pipeline with per-plugin enable/options

## [0.1.0] - 2026-02-16

### Added
- **AI Provider Abstraction** (028): BYOK support for Anthropic, OpenAI, and OpenAI-compatible providers via Vercel AI SDK v6
- **Frontmatter Editor** (020): Visual YAML frontmatter editor with schema validation
- **Template Library** (016): Built-in and custom template system with variable support
- **Smart Filtering** (014): FZF-based fuzzy search for files and content
- **Autosave & Recovery** (011): Configurable autosave with atomic writes, crash recovery
- **MDX Content Outline** (007): Live document outline with heading/component/frontmatter navigation
- **Application Shell** (006): Integrated editor, preview, and file operations layout
- **Command Palette** (005): Keyboard-driven command interface
- **File System Shell** (004): File operations with external change watching via chokidar
- **Preview Pane** (003): Live MDX preview with Web Worker compilation pool
- **Interface Contracts** (001): Type-safe IPC with Zod schema validation
- **Foundational Setup** (000): TypeScript 5.9 strict mode, Electron 39, React 19, electron-vite
- Shared utilities: `atomic-write.ts`, `checksum.ts`, `result.ts`, `events.ts`
- Security module: origin validation, rate limiting, CSP nonces, content sanitization, message validation, integrity checking
- Zustand + Immer state management for document, preview, template, frontmatter, autosave, and settings stores
- CodeMirror 6 editor with MDX/Markdown/YAML language support
- Comprehensive test suite: 2610+ tests passing, 80%+ coverage
- CI/CD pipeline with typecheck, lint, test, E2E, and coverage reporting
- Secure credential storage via macOS Keychain (Electron safeStorage)
- AI usage tracking and capability detection

### Fixed
- Security info hardcoding in IPC handlers
- File save lock race condition
- Template store stale async request handling
- Menu and watcher error swallowing
- Unsafe type casts in frontmatter store

### Changed
- Split 5 monolithic files (>700 lines each) into focused modules under 400 lines
- Reduced ESLint errors from 528 to 0
- Reduced type casts from 65 to <10 (justified only)
- Reduced ESLint suppressions from 49 to <15 (documented)
