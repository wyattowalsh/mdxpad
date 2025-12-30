# Implementation Plan: Foundational Setup

**Branch**: `000-foundational-setup` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.specify/specs/000-foundational-setup/spec.md`

## Summary

Establish the complete development environment for mdxpad: an Electron 39.x + React 19 + TypeScript 5.9 application with strict security settings, build tooling, testing infrastructure, and performance benchmarking. This foundation enables all subsequent feature development.

**Primary Deliverables**:
- Working `pnpm dev` → Electron window with React shell
- Working `pnpm build` → macOS .app bundle
- Quality gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`
- Performance tracking: `pnpm bench`
- Security verification: `pnpm verify-security`

## Technical Context

**Language/Version**: TypeScript 5.9.x with `strict: true`
**Runtime**: Electron 39.x (Chromium 134, Node 22)
**Primary Dependencies**:
- electron-vite 5.x (bundler)
- React 19.x (UI)
- Tailwind CSS 4.x (styling)
- zod 4.x (validation)

**Storage**: N/A (file system access deferred to Spec 003)
**Testing**: Vitest 4.x (unit), Playwright 1.57.x (E2E)
**Target Platform**: macOS (Apple Silicon + Intel)
**Project Type**: Electron desktop application (main + renderer + preload)
**Performance Goals**: Cold start < 2s, Memory < 200MB idle
**Constraints**: Security-first (contextIsolation, sandbox mandatory)
**Scale/Scope**: Single developer initially, CI/CD from day one

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| I | Security > Performance > UX | ✅ PASS | Security settings non-negotiable |
| II | Electron 39.x | ✅ PASS | Latest stable per constitution v1.1.0 |
| II | TypeScript 5.9.x strict | ✅ PASS | Configured in tsconfig.json |
| II | React 19.x | ✅ PASS | Latest stable |
| II | Tailwind 4.x | ✅ PASS | Using 4.1.x |
| II | pnpm 10.x | ✅ PASS | Package manager |
| II | Vitest 4.x | ✅ PASS | Unit testing |
| II | Playwright 1.57.x | ✅ PASS | E2E testing |
| II | zod 4.x | ✅ PASS | Validation library |
| III §3.1 | Process separation | ✅ PASS | main/renderer/preload structure |
| III §3.2 | contextIsolation: true | ✅ PASS | BrowserWindow config |
| III §3.2 | sandbox: true | ✅ PASS | BrowserWindow config |
| III §3.2 | nodeIntegration: false | ✅ PASS | BrowserWindow config |
| III §3.2 | webSecurity: true | ✅ PASS | BrowserWindow config |
| III §3.3 | IPC channels in shared/ | ✅ PASS | src/shared/lib/ipc.ts |
| III §3.3 | invoke/handle pattern | ✅ PASS | Preload uses ipcRenderer.invoke |
| V | Cold start < 2s | ⏳ TBD | Benchmark harness will verify |
| V | Memory < 200MB | ⏳ TBD | Benchmark harness will verify |
| V | Benchmark harness | ✅ PASS | scripts/bench.ts included |
| VI §6.1 | strict: true | ✅ PASS | tsconfig.json |
| VI §6.2 | Max 50 lines/function | ✅ PASS | ESLint rule configured |
| VI §6.3 | ESLint flat config | ✅ PASS | eslint.config.js |
| VI §6.4 | Tests colocated | ✅ PASS | __tests__/ in each src dir |
| VII §7.1 | macOS HIG | ✅ PASS | hiddenInset titlebar |
| VIII §8.1 | Conventional commits | ✅ PASS | Will enforce |
| XI | Feature 000 first | ✅ PASS | This is Feature 000 |

**Gate Status**: ✅ PASSED - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
.specify/specs/000-foundational-setup/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (IPC contracts)
│   └── ipc-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
mdxpad/
├── package.json              # Workspace root, "type": "module"
├── pnpm-lock.yaml            # Lockfile
├── tsconfig.json             # Base TypeScript config
├── tsconfig.node.json        # Node.js (main process) config
├── eslint.config.js          # ESLint flat config
├── prettier.config.js        # Prettier config
├── tailwind.config.ts        # Tailwind v4 config
├── electron.vite.config.ts   # electron-vite config
├── playwright.config.ts      # E2E test config
├── vitest.config.ts          # Unit test config
│
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # Entry point, app lifecycle
│   │   ├── window.ts         # BrowserWindow factory
│   │   ├── ipc/              # IPC handlers
│   │   │   └── index.ts      # Handler registration
│   │   └── __tests__/        # Main process tests
│   │       └── window.test.ts
│   │
│   ├── renderer/             # Electron renderer process
│   │   ├── index.html        # HTML entry
│   │   ├── main.tsx          # React entry
│   │   ├── App.tsx           # Root component
│   │   ├── styles/
│   │   │   ├── globals.css   # Tailwind directives
│   │   │   └── tokens.css    # Design tokens
│   │   ├── components/       # (empty, for 001+)
│   │   │   └── .gitkeep
│   │   ├── hooks/            # (empty, for 003+)
│   │   │   └── .gitkeep
│   │   ├── lib/              # (empty, for 001+)
│   │   │   └── .gitkeep
│   │   └── __tests__/
│   │       ├── setup.ts      # Test setup
│   │       └── App.test.tsx
│   │
│   ├── shared/               # Shared between main/renderer
│   │   ├── types/
│   │   │   └── index.ts      # Global types
│   │   ├── contracts/
│   │   │   └── index.ts      # API contracts stub
│   │   ├── lib/
│   │   │   ├── result.ts     # Result<T, E> monad
│   │   │   ├── ipc.ts        # Typed IPC helpers
│   │   │   ├── events.ts     # TypedEventEmitter
│   │   │   └── index.ts      # Re-exports
│   │   └── __tests__/
│   │       ├── result.test.ts
│   │       ├── ipc.test.ts
│   │       └── events.test.ts
│   │
│   └── preload/              # Preload scripts
│       ├── index.ts          # contextBridge exposure
│       └── api.ts            # MdxpadAPI interface
│
├── scripts/                  # Build and dev scripts
│   ├── bench.ts              # Performance benchmark
│   └── verify-security.ts    # Security verification
│
├── resources/                # App resources
│   └── icon.icns             # macOS app icon
│
├── tests/                    # E2E tests
│   └── app.spec.ts           # Basic app launch test
│
└── .github/
    └── workflows/
        └── ci.yml            # CI pipeline
```

**Structure Decision**: Electron application with electron-vite structure. Three processes (main, renderer, preload) with shared utilities. Tests colocated per constitution §6.4.

## Complexity Tracking

No constitution violations requiring justification. Structure follows Electron best practices and constitution requirements directly.

## Phase 0: Research Summary

See [research.md](./research.md) for detailed findings.

**Key Decisions**:
1. **electron-vite 5.x**: Provides optimal Electron + Vite integration with HMR support
2. **Tailwind CSS 4.x**: New engine, requires @tailwindcss/vite plugin
3. **ESLint 9 flat config**: Modern configuration, better TypeScript integration
4. **happy-dom for Vitest**: Lightweight DOM simulation for renderer tests
5. **electron-builder**: Mature macOS packaging with code signing support

## Phase 1: Design Summary

See [data-model.md](./data-model.md) for entity definitions.
See [contracts/ipc-api.md](./contracts/ipc-api.md) for IPC contract.
See [quickstart.md](./quickstart.md) for developer onboarding.

**Key Entities**:
- `MdxpadAPI`: Interface exposed via contextBridge
- `Result<T, E>`: Functional error handling
- `TypedEventEmitter<T>`: Type-safe pub/sub
- `IPC_CHANNELS`: Centralized channel definitions

## Next Steps

Run `/speckit.tasks` to generate the task list for implementation.
