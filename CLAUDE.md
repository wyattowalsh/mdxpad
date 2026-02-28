ALWAYS START BY READING ANY AND ALL PERTINENT `AGENTS.md` INSTRUCTION FILES FIRST!!!

## Project Overview

MDXPad is a native macOS MDX editor built with:
- **Electron 39** (main + preload + renderer processes)
- **React 19** (renderer UI)
- **TypeScript 5.9** (strict mode)
- **CodeMirror 6** (editor)
- **Zustand + Immer** (state management)

See `AGENTS.md` for detailed architecture, patterns, and conventions.

## Active Technologies

### Core Stack
- TypeScript 5.9.x with `strict: true`
- Electron 39.2.7 (macOS native)
- React 19 + React DOM
- electron-vite 3.x + Vite 6.x
- pnpm 10.11.1

### Key Dependencies
- **Editor**: CodeMirror 6.x, ProseMirror (WYSIWYG mode)
- **MDX**: @mdx-js/mdx 3.x, @mdx-js/react 3.x
- **Markdown**: remark-gfm 4.x, remark-frontmatter 5.x, remark-math 6.x, rehype-highlight 7.x
- **Math**: KaTeX 0.16.x (rehype-katex 7.x)
- **Diagrams**: mermaid 11.x
- **State**: Zustand 5.x + Immer 11.x (25+ stores)
- **UI**: Radix UI, Tailwind CSS 4.x, Lucide React, @dnd-kit
- **AI**: Vercel AI SDK v6 (@ai-sdk/anthropic, @ai-sdk/openai, ollama-ai-provider)
- **Collaboration**: yjs 13.x, y-websocket 3.x, y-indexeddb 9.x
- **Export**: docx 9.x, epub-gen-memory 1.x
- **Git**: simple-git 3.x
- **Citations**: @citation-js/core 0.7.x
- **Search**: fzf 0.5.2, minisearch 7.x
- **Validation**: zod 3.24.x
- **File Watching**: chokidar 5.0.0
- **Testing**: Vitest 2.x, Playwright 1.49.x, @testing-library/react 16.x

### Storage
- **Main Process**: electron-store 11.0.2 (recent files, settings, AI config)
- **Renderer**: localStorage (UI state, command history)
- **Credentials**: Electron safeStorage (macOS Keychain)

## Architecture Notes

### Process Separation
- **Main Process** (`src/main/`): File I/O, native OS integration, IPC handlers, services
- **Preload** (`src/preload/`): Context bridge with Zod-validated IPC
- **Renderer** (`src/renderer/`): React UI, CodeMirror, Zustand stores
- **Shared** (`src/shared/`): Types, IPC contracts, utilities

### Key Patterns
- **IPC**: All communication uses Zod schemas from `src/shared/contracts/`
- **State**: Zustand + Immer for immutable updates
- **MDX Compilation**: Worker pool in `src/renderer/lib/mdx/compiler.ts`
- **File Operations**: Atomic writes with checksums (`src/shared/lib/atomic-write.ts`)
- **Error Handling**: Custom error classes, Zod validation at boundaries

### Code Quality Standards
- **Max File Size**: 400 lines (enforced via ESLint)
- **Type Safety**: No `any`, minimal type casts, strict mode
- **Linting**: Zero ESLint errors
- **Test Coverage**: 80%+ overall, 90%+ for critical paths
- **Naming**: `kebab-case.ts` for files, `PascalCase.tsx` for components

## Development Commands

### Essential
- `pnpm dev` - Start development with hot reload
- `pnpm build` - Build and package application
- `pnpm check` - Run typecheck + lint + test (full quality check)

### Code Quality
- `pnpm typecheck` - TypeScript type checking
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Auto-fix linting issues
- `pnpm lint:report` - Generate detailed lint report
- `pnpm format` - Format with Prettier

### Testing
- `pnpm test` - Run unit tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:e2e` - Run Playwright E2E tests
- `pnpm coverage` - Generate coverage report

### Utilities
- `pnpm audit:types` - Audit type safety escapes
- `pnpm bench` - Run performance benchmarks
- `pnpm verify-security` - Verify security settings
- `pnpm test:unit` - Run unit tests only (src/)
- `pnpm test:integration` - Run integration tests (tests/integration/)

## Recent Changes

### 2026-02-27: Wave 3 — Collaboration, Publishing & Polish
- Real-time collaboration via Yjs WebSocket server with cursor overlay
- Comment threads and inline suggestions with accept/reject workflow
- Share links with token-based access, expiration, and revocation
- Static site publishing (MDX to HTML with index page)
- Version history from autosave snapshots + git commits
- Tags/taxonomy with hierarchical tree and per-file assignment
- Keyboard shortcut editor with conflict detection
- WYSIWYG editor (ProseMirror) with source/WYSIWYG toggle
- Multi-file AI editing with per-file accept/reject
- Template marketplace for browsing/installing templates
- Accessibility: high contrast theme, focus traps, accessibility store
- Voice input via Web Speech API
- Native system notifications with queue management

### 2026-02-25: Wave 2 — Intelligence & Extensibility
- AI agent mode with tool use, plan steps, and approval workflow
- Semantic search with embedding-based vector store
- Next-edit prediction (AI ghost text in editor)
- AI-powered diagram generation (Mermaid)
- Plugin system with registry, loader, and manifest validation
- Slash commands (`/command` autocomplete)
- Sandboxed code execution with inline output
- Component playground for live component preview
- Go-to-definition for imports and components

### 2026-02-20: Wave 1 — Editor Extensions, Export & Backend
- 14 CodeMirror extensions (multi-cursor, code folding, regex find/replace, snippets, minimap, focus mode, distraction-free, spellcheck, font settings, word wrap, code execution, go-to-definition, slash commands, next-edit prediction)
- Vim and Emacs keymap modes
- Export: PDF, DOCX, EPUB, LaTeX, Pandoc bridge
- Git integration (simple-git)
- Full-text search (MiniSearch)
- Document import (Notion, Google Docs, HTML-to-MDX)
- Citations (BibTeX, CSL formatting)
- Editor tabs, breadcrumb navigation
- Math rendering (KaTeX), Mermaid diagrams
- Word count/reading time in status bar
- Export orchestration with job lifecycle, presets, CLI, llms.txt
- Workspace model with projects, link graph, metadata collections
- Feature flags system

### 2026-02-16: Full Codebase Audit
- Split monolithic files, reduced lint errors to 0, 2610+ tests passing

### Foundation (pre-Wave)
- 028: BYOK AI, 020: Frontmatter editor, 016: Templates, 014: FZF search
- 007-000: Outline, shell, commands, file system, preview, IPC, TS strict
