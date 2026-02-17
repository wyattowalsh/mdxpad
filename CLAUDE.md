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
- **Editor**: CodeMirror 6.x
- **MDX**: @mdx-js/mdx 3.x, @mdx-js/react 3.x
- **Markdown**: remark-gfm 4.x, remark-frontmatter 5.x, rehype-highlight 7.x
- **State**: Zustand 5.x + Immer 11.x
- **UI**: Radix UI, Tailwind CSS 4.x, Lucide React
- **AI**: Vercel AI SDK v6 (@ai-sdk/anthropic, @ai-sdk/openai, ollama-ai-provider)
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

## Recent Changes

### 2026-02-16: Full Codebase Audit
Major quality improvements (see `~/.claude/plans/modular-waddling-parasol.md` for details):

**Architecture**
- Split 5 monolithic files into focused modules (<400 lines each)
- Extracted shared utilities: `atomic-write.ts`, `checksum.ts`
- Improved module boundaries and separation of concerns

**Quality**
- Linting: 528 → 0 errors
- Type casts: 65 → <10 (justified only)
- ESLint suppressions: 49 → <15 (documented)
- Test coverage: Added 106+ tests, 2610+ total passing

**Defects Fixed**
- Security info hardcoding in IPC handlers
- File save lock race condition
- Template store stale request handling
- Menu and watcher error swallowing
- Unsafe type casts in frontmatter store

**CI/CD**
- Eliminated duplicate builds (2min savings)
- Added coverage reporting
- Optimized caching

**Documentation**
- Rewrote README.md (comprehensive)
- Created CONTRIBUTING.md
- Updated architecture docs

### Previous Milestones
- 028-ai-provider-abstraction: BYOK AI with Vercel SDK, safeStorage
- 020-frontmatter-editor: Visual editor with schema validation
- 016-template-library: Custom and built-in templates
- 014-smart-filtering: FZF fuzzy search
- 007-mdx-content-outline: Live outline navigation
- 006-application-shell: Integrated editor + preview
- 005-command-palette: Keyboard commands
- 004-file-system-shell: File operations + watching
- 003-preview-pane: Live MDX preview with workers
- 001-interface-contracts: Type-safe IPC
- 000-foundational-setup: TypeScript strict foundation
