# Implementation Plan: File System Shell

**Branch**: `004-file-system-shell` | **Date**: 2026-01-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.specify/specs/004-file-system-shell/spec.md`

## Summary

Implement file system operations for mdxpad in the Electron main process. This feature covers file open/save/watch operations, IPC handlers for all file and window channels, native dialogs, auto-save with crash recovery, and recent files tracking. All operations run in the main process per Constitution §3.1, communicating with renderer via typed IPC channels using zod validation per §3.3.

## Technical Context

**Language/Version**: TypeScript 5.9.x, strict: true (per Constitution Article II)
**Primary Dependencies**: Electron 39.2.7, chokidar 5.0.0 (file watching), zod 4.3.5 (validation)
**Storage**: File system (Node.js fs/promises), electron-store for recent files persistence
**Testing**: Vitest 4.0.16 (unit), Playwright 1.57.0 (E2E)
**Target Platform**: macOS (darwin) only through v2.0 (per Constitution Preamble)
**Project Type**: Electron app (main/preload/renderer structure exists from Spec 000)
**Performance Goals**: File open 1MB < 500ms, File open 10MB < 2s (per Constitution Article V)
**Constraints**: contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true (per Constitution §3.2)
**Scale/Scope**: Single document editing, max 10MB files per performance budget

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x strict: true | PASS | Project configured in Spec 000 |
| II | Electron 39.x | PASS | Using 39.2.7 |
| II | zod 4.x | PASS | Using 4.3.5 |
| III.1 | File ops in main process only | PASS | All handlers in src/main/ipc/ |
| III.2 | contextIsolation: true | PASS | Verified in Spec 000 |
| III.2 | sandbox: true | PASS | Verified in Spec 000 |
| III.2 | nodeIntegration: false | PASS | Verified in Spec 000 |
| III.3 | IPC invoke/handle pattern | PASS | Using ipcMain.handle |
| III.3 | zod validation both ends | PASS | Will implement zod schemas |
| III.3 | Channel naming mdxpad:domain:action | PASS | Using mdxpad:file:*, mdxpad:window:* |
| V | File open 1MB < 500ms | TBD | Will benchmark in E2E tests |
| V | File open 10MB < 2s | TBD | Will benchmark in E2E tests |
| VI.1 | JSDoc on public APIs | PASS | Will document all handlers |
| VI.2 | Functions max 50 lines | PASS | Will split as needed |
| VI.4 | Integration tests for IPC | PASS | Required for all channels |
| VI.4 | E2E for open/save | PASS | Required per spec |
| VII.3 | Auto-save every 30s | PASS | FR-014 implements this |
| VII.3 | User-friendly errors | PASS | FR-007, FR-008 implement this |

## Project Structure

### Documentation (this feature)

```text
.specify/specs/004-file-system-shell/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (zod schemas)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── ipc/
│   │   ├── index.ts           # Handler registration (extend)
│   │   ├── file-handlers.ts   # NEW: File operation handlers
│   │   └── window-handlers.ts # NEW: Window operation handlers
│   ├── services/
│   │   ├── file-service.ts    # NEW: File read/write/watch logic
│   │   ├── auto-save.ts       # NEW: Auto-save manager
│   │   ├── recent-files.ts    # NEW: Recent files persistence
│   │   └── file-watcher.ts    # NEW: chokidar wrapper
│   ├── index.ts               # Entry (extend for recovery dialog)
│   └── window.ts              # Window creation (extend for dirty check)
├── preload/
│   ├── api.ts                 # MdxpadAPI interface (extend)
│   └── index.ts               # contextBridge (extend)
├── shared/
│   ├── contracts/
│   │   ├── index.ts           # Export barrel (extend)
│   │   └── file-schemas.ts    # NEW: zod schemas for file IPC
│   ├── lib/
│   │   └── ipc.ts             # IPC channel definitions (extend)
│   └── types/
│       ├── file.ts            # READ-ONLY from Spec 001
│       └── ipc.ts             # READ-ONLY from Spec 001
└── renderer/                  # No changes (uses IPC via preload)

tests/
├── integration/
│   └── ipc/
│       └── file-handlers.test.ts  # NEW: IPC handler tests
└── e2e/
    └── file-operations.spec.ts    # NEW: E2E file workflow tests
```

**Structure Decision**: Extend existing Electron structure from Spec 000. Add services layer in main/ for business logic separation. Keep handlers thin (delegate to services).

## Complexity Tracking

> No violations to justify. Design follows Constitution requirements.

| Consideration | Decision | Rationale |
|--------------|----------|-----------|
| File watching library | chokidar 5.0.0 | Constitution §3.1 specifies chokidar |
| Recent files storage | electron-store | Simple key-value, no custom DB needed |
| Auto-save location | OS temp directory | Standard pattern, no user config needed |
