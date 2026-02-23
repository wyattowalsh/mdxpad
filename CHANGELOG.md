# Changelog

All notable changes to MDXPad are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Architecture Decision Records directory (`docs/adr/`)
- First ADR: IPC Validation with Zod (ADR-001)
- Documentation directories: `docs/constitution/`, `docs/specs/`, `docs/adr/`

### Changed
- Moved `ideas.md` to `docs/ideas.md`
- Fixed CONTRIBUTING.md coverage threshold (70% to 80%) to match project standards

### Removed
- Stale wave4/wave5 orchestration logs from `docs/`
- Stale build artifact `electron.vite.config.1768069459160.mjs`

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
