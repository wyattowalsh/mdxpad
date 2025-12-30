# Feature Specification: Foundational Setup

**Feature Branch**: `feat/000-foundational-setup`
**Created**: 2025-12-30
**Status**: Draft
**Spec ID**: 000

## Overview

Establish the development environment, build tooling, security configuration, and project
scaffolding for mdxpad. This spec creates the foundation that all subsequent specs build upon.
It MUST be complete and verified before any parallel development begins.

## User Scenarios & Testing

### User Story 1 - Development Environment (Priority: P1)

As a developer, I can clone the repo, run `pnpm install && pnpm dev`, and see a secure Electron
window with a React shell, so that I have a working foundation to build features on.

**Why this priority**: This is the absolute minimum viable foundation. Without this, no other
development can proceed.

**Independent Test**: Clone fresh, run install and dev, verify window appears with "mdxpad" text.

**Acceptance Scenarios**:

1. **Given** a fresh clone, **When** I run `pnpm install`, **Then** all dependencies install without errors
2. **Given** dependencies installed, **When** I run `pnpm dev`, **Then** an Electron window opens within 5 seconds
3. **Given** the window is open, **When** I inspect the content, **Then** I see "mdxpad" and version information

---

### User Story 2 - Code Quality Tooling (Priority: P1)

As a developer, I can run `pnpm typecheck`, `pnpm lint`, and `pnpm test` and see all checks pass,
so that I have confidence in code quality tooling.

**Why this priority**: Quality gates must be in place from day one to prevent tech debt.

**Independent Test**: Run each command and verify zero errors/warnings.

**Acceptance Scenarios**:

1. **Given** the project is set up, **When** I run `pnpm typecheck`, **Then** TypeScript compilation succeeds with zero errors
2. **Given** the project is set up, **When** I run `pnpm lint`, **Then** ESLint passes with zero errors or warnings
3. **Given** the project is set up, **When** I run `pnpm test`, **Then** Vitest runs and all tests pass

---

### User Story 3 - Production Build (Priority: P2)

As a developer, I can run `pnpm build` and produce a working macOS `.app` bundle, so that I can
verify the build pipeline works end-to-end.

**Why this priority**: Build verification can happen after dev environment is working.

**Independent Test**: Run build, locate .app in dist/, launch it manually.

**Acceptance Scenarios**:

1. **Given** the project is set up, **When** I run `pnpm build`, **Then** build completes without errors
2. **Given** build completes, **When** I check `dist/`, **Then** I find a macOS `.app` bundle
3. **Given** the .app exists, **When** I launch it, **Then** it opens and shows the mdxpad window

---

### User Story 4 - Performance Benchmarking (Priority: P2)

As a developer, I can run `pnpm bench` and see cold start time and memory usage metrics, so that
I can track performance against constitution budgets.

**Why this priority**: Benchmarking enables performance regression detection but isn't blocking for initial development.

**Independent Test**: Run bench command, verify JSON output with metrics.

**Acceptance Scenarios**:

1. **Given** a built app, **When** I run `pnpm bench`, **Then** I see JSON output with `coldStartMs` metric
2. **Given** bench output, **When** I check `memoryMb`, **Then** it shows memory usage in MB
3. **Given** bench results, **When** I compare to budgets, **Then** cold start is < 2000ms and memory < 150MB

---

### User Story 5 - Security Verification (Priority: P1)

As a developer, I can verify that Electron security settings are correctly applied, so that the
app is secure by default.

**Why this priority**: Security is the highest priority per constitution Article I.

**Independent Test**: Run security verification script, all checks pass.

**Acceptance Scenarios**:

1. **Given** the app is running, **When** I check `contextIsolation`, **Then** it is `true`
2. **Given** the app is running, **When** I check `sandbox`, **Then** it is `true`
3. **Given** the app is running, **When** I check `nodeIntegration`, **Then** it is `false`
4. **Given** the app is running, **When** I check `webSecurity`, **Then** it is `true`
5. **Given** the renderer process, **When** I try to access Node APIs directly, **Then** they are undefined

---

### Edge Cases

- What happens when Node.js version is too old? → Build should fail with clear error message
- What happens when pnpm is not installed? → Package.json engines field should warn
- How does system handle missing Xcode tools? → electron-builder should provide clear error

## Requirements

### Functional Requirements

- **FR-001**: System MUST scaffold project structure per R1 specification
- **FR-002**: System MUST configure Electron with security settings per R2 (contextIsolation, sandbox, etc.)
- **FR-003**: System MUST expose typed API via contextBridge per R3
- **FR-004**: System MUST provide Result monad, typed IPC helpers, and event emitter per R4
- **FR-005**: System MUST render React shell showing "mdxpad" and version info per R5
- **FR-006**: System MUST configure TypeScript with strict mode per R6
- **FR-007**: System MUST provide benchmark harness measuring cold start and memory per R7
- **FR-008**: System MUST provide security verification script per R8
- **FR-009**: System MUST configure CI pipeline per R9

### Key Entities

- **BrowserWindow**: Electron main window with security configuration
- **MdxpadAPI**: Typed interface exposed to renderer via contextBridge
- **Result<T, E>**: Functional error handling monad
- **TypedEventEmitter**: Generic typed pub/sub for internal events

## Technology Stack (Verified December 2025)

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Runtime | Electron | **39.x** | Latest stable (39.2.7) |
| Bundler | electron-vite | **5.x** | Latest (5.0.0), requires Node 20.19+ |
| UI Framework | React | **19.x** | Latest (19.2.3) |
| Language | TypeScript | **5.9.x** | Latest stable |
| Styling | Tailwind CSS | **4.1.x** | Latest (4.1.18) |
| Package Manager | pnpm | **10.x** | Latest (10.26.2) |
| Linting | ESLint | **9.x** | Latest (9.39.2), flat config |
| Formatting | Prettier | **3.x** | Latest (3.7.4) |
| Unit Testing | Vitest | **4.x** | Latest (4.0.16), browser mode stable |
| E2E Testing | Playwright | **1.57.x** | Latest stable |
| Validation | zod | **4.x** | Latest (4.2.1) |

## Detailed Requirements

### R1: Project Structure

```
mdxpad/
├── package.json              # Workspace root, "type": "module"
├── pnpm-workspace.yaml       # Workspace config
├── tsconfig.json             # Base TypeScript config
├── tsconfig.node.json        # Node.js (main process) config
├── eslint.config.js          # Flat config ESLint
├── prettier.config.js        # Prettier config
├── tailwind.config.ts        # Tailwind v4 config
├── electron.vite.config.ts   # electron-vite 5.x config
├── playwright.config.ts      # E2E test config
├── vitest.config.ts          # Unit test config
│
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # Entry point
│   │   ├── window.ts         # BrowserWindow factory
│   │   ├── ipc/              # IPC handlers (empty, for 003+)
│   │   │   └── index.ts      # Handler registration stub
│   │   └── __tests__/        # Main process tests
│   │
│   ├── renderer/             # Electron renderer process
│   │   ├── index.html        # HTML entry
│   │   ├── main.tsx          # React entry
│   │   ├── App.tsx           # Root component (shell only)
│   │   ├── styles/           # Tailwind + global styles
│   │   │   ├── globals.css   # Tailwind directives + CSS vars
│   │   │   └── tokens.css    # Design tokens (colors, spacing)
│   │   ├── components/       # React components (empty, for 001+)
│   │   │   └── .gitkeep
│   │   ├── hooks/            # React hooks (empty, for 003+)
│   │   │   └── .gitkeep
│   │   ├── lib/              # Renderer utilities (empty, for 001+)
│   │   │   └── .gitkeep
│   │   └── __tests__/        # Renderer tests
│   │       └── setup.ts      # Test setup with happy-dom
│   │
│   ├── shared/               # Shared between main/renderer
│   │   ├── types/            # Type definitions
│   │   │   └── index.ts      # Re-export stub
│   │   ├── contracts/        # API contracts
│   │   │   └── index.ts      # Re-export stub
│   │   ├── lib/              # Shared utilities
│   │   │   ├── result.ts     # Result<T, E> monad
│   │   │   ├── ipc.ts        # Typed IPC invoke/handle helpers
│   │   │   ├── events.ts     # Typed event emitter
│   │   │   └── index.ts      # Re-exports
│   │   └── __tests__/        # Shared lib tests
│   │
│   └── preload/              # Preload scripts
│       ├── index.ts          # contextBridge exposure
│       └── api.ts            # API shape exposed to renderer
│
├── scripts/                  # Build and dev scripts
│   ├── bench.ts              # Performance benchmark harness
│   └── verify-security.ts    # Security settings verification
│
├── resources/                # App resources
│   └── icon.icns             # macOS app icon (placeholder)
│
└── tests/                    # E2E tests
    └── app.spec.ts           # Basic app launch test
```

### R2: Electron Security Configuration

BrowserWindow MUST be created with these security settings:

```typescript
const window = new BrowserWindow({
  width: 1200,
  height: 800,
  titleBarStyle: 'hiddenInset',  // macOS native
  trafficLightPosition: { x: 16, y: 16 },
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,      // REQUIRED per §3.2
    sandbox: true,               // REQUIRED per §3.2
    nodeIntegration: false,      // REQUIRED per §3.2
    webSecurity: true,           // REQUIRED per §3.2
    allowRunningInsecureContent: false,
  },
});
```

### R3: IPC Bridge via contextBridge

Preload script exposes typed API stub:

```typescript
// src/preload/api.ts
export interface MdxpadAPI {
  platform: NodeJS.Platform;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  file: {
    open: () => Promise<{ path: string; content: string } | null>;
    save: (path: string, content: string) => Promise<boolean>;
    saveAs: (content: string) => Promise<string | null>;
  };
}

// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { MdxpadAPI } from './api';

const api: MdxpadAPI = {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  file: {
    open: () => ipcRenderer.invoke('mdxpad:file:open'),
    save: (path, content) => ipcRenderer.invoke('mdxpad:file:save', path, content),
    saveAs: (content) => ipcRenderer.invoke('mdxpad:file:save-as', content),
  },
};

contextBridge.exposeInMainWorld('mdxpad', api);
```

### R4: Shared Utilities

#### R4.1: Result Type (src/shared/lib/result.ts)

```typescript
export type Result<T, E = Error> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export function ok<T>(value: T): Ok<T>;
export function err<E>(error: E): Err<E>;
export function isOk<T, E>(result: Result<T, E>): result is Ok<T>;
export function isErr<T, E>(result: Result<T, E>): result is Err<E>;
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>;
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>;
export function unwrap<T, E>(result: Result<T, E>): T;
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T;
```

#### R4.2: Typed IPC Helpers (src/shared/lib/ipc.ts)

```typescript
import { z } from 'zod';

export const IPC_CHANNELS = {
  FILE_OPEN: 'mdxpad:file:open',
  FILE_SAVE: 'mdxpad:file:save',
  FILE_SAVE_AS: 'mdxpad:file:save-as',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
```

#### R4.3: Typed Event Emitter (src/shared/lib/events.ts)

```typescript
type Listener<T> = (data: T) => void;

export class TypedEventEmitter<TEvents extends Record<string, unknown>> {
  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): void;
  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): void;
  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void;
  once<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): void;
}
```

### R5: React Shell

```typescript
// src/renderer/App.tsx
export function App() {
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-900 text-neutral-100">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">mdxpad</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Electron {window.mdxpad.versions.electron} • Node {window.mdxpad.versions.node}
        </p>
      </div>
    </div>
  );
}
```

### R6: TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ESNext",
    "paths": {
      "@shared/*": ["./src/shared/*"],
      "@renderer/*": ["./src/renderer/*"],
      "@main/*": ["./src/main/*"]
    }
  }
}
```

### R7: Benchmark Harness

Create `scripts/bench.ts` that:
- Launches the built app
- Measures time from spawn to window ready
- Queries memory usage via Electron APIs
- Outputs JSON with metrics

Target budgets (from constitution Article V):
- Cold start: < 2000ms
- Memory baseline: < 150MB (idle target, constitution says <200MB)

### R8: Security Verification Script

Create `scripts/verify-security.ts` that:
1. Launches app programmatically
2. Queries webContents for security settings
3. Asserts all required settings are correct
4. Exits 0 (pass) or 1 (fail)

### R9: CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
      - run: pnpm bench
```

## Success Criteria

### Functional

- [ ] `pnpm install` completes without errors
- [ ] `pnpm dev` launches Electron window showing "mdxpad" with version info
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero errors/warnings
- [ ] `pnpm test` runs and passes
- [ ] `pnpm build` produces working macOS `.app` in `dist/`
- [ ] `pnpm bench` outputs JSON with coldStartMs and memoryMb

### Security (per Constitution §3.2)

- [ ] `contextIsolation: true` verified
- [ ] `sandbox: true` verified
- [ ] `nodeIntegration: false` verified
- [ ] `webSecurity: true` verified
- [ ] Renderer cannot access Node APIs directly

### Performance (per Constitution §5)

- [ ] Cold start < 2000ms
- [ ] Memory baseline < 150MB

### Code Quality (per Constitution §6)

- [ ] No `any` types (explicit `unknown` allowed)
- [ ] Path aliases resolve correctly
- [ ] ESLint flat config works
- [ ] TypeScript strict mode enabled

## NOT IN SCOPE

Per constitution and spec boundaries:

- Actual editor functionality (Spec 001)
- File operations implementation (Spec 003)
- MDX compilation (Spec 004)
- Preview rendering (Spec 005)
- UI beyond centered "mdxpad" text
- Cross-platform support (deferred to v3.0+)
- Auto-update mechanism (deferred to v1.5+)

## Task Batching Guidance

**Batch 1** (Config files - no overlap):
- T001: package.json, pnpm-workspace.yaml, tsconfig.*.json
- T002: eslint.config.js, prettier.config.js
- T003: electron.vite.config.ts, tailwind.config.ts
- T004: vitest.config.ts, playwright.config.ts

**Batch 2** (Source directories - no overlap):
- T005: src/main/ (index.ts, window.ts, ipc/index.ts)
- T006: src/renderer/ (index.html, main.tsx, App.tsx, styles/)
- T007: src/preload/ (index.ts, api.ts)
- T008: src/shared/lib/ (result.ts, ipc.ts, events.ts)

**Batch 3** (Scripts and tests - no overlap):
- T009: scripts/bench.ts, scripts/verify-security.ts
- T010: src/*/__tests__/, tests/app.spec.ts

**Batch 4** (Integration):
- T011: CI workflow, final verification

## Constitution Compliance

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| I | Security > Performance > UX | ✅ PASS | Security settings prioritized |
| II | Electron 39.x | ✅ PASS | Using latest stable |
| II | TypeScript 5.9.x strict | ✅ PASS | Configured in R6 |
| II | React 19.x | ✅ PASS | Using latest stable |
| II | Tailwind 4.x | ✅ PASS | Using 4.1.x |
| II | pnpm 10.x | ✅ PASS | Using latest |
| II | Vitest 4.x | ✅ PASS | Using latest |
| II | Playwright 1.57.x | ✅ PASS | Using latest |
| II | zod 4.x | ✅ PASS | Added per §3.3 |
| III §3.2 | contextIsolation: true | ✅ PASS | R2 enforces |
| III §3.2 | sandbox: true | ✅ PASS | R2 enforces |
| III §3.2 | nodeIntegration: false | ✅ PASS | R2 enforces |
| III §3.2 | webSecurity: true | ✅ PASS | R2 enforces |
| III §3.3 | IPC channels in shared/ | ✅ PASS | R4.2 defines |
| III §3.3 | zod validation | ⏳ TBD | Stub in R4.2, full impl in 003 |
| V | Cold start < 2s | ⏳ TBD | R7 benchmark will verify |
| V | Memory < 200MB | ⏳ TBD | R7 benchmark will verify |
| V | Benchmark harness | ✅ PASS | R7 requires |
| VI §6.1 | strict: true | ✅ PASS | R6 enforces |
| VI §6.3 | ESLint flat config | ✅ PASS | R1 includes |
| VIII §8.1 | Conventional commits | ✅ PASS | Will use in implementation |
| XI | Feature 000 first | ✅ PASS | This is Feature 000 |
