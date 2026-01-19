# Implementation Plan: Autosave & Crash Recovery

**Branch**: `011-autosave-recovery` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-autosave-recovery/spec.md`

## Summary

Implement automatic document saving at configurable intervals (default 30s) with crash recovery on restart. Uses atomic writes (temp + rename) to recovery files stored in Electron's userData directory. On startup, detects unsaved work and presents a recovery dialog allowing users to preview, selectively restore, or decline recovery. Integrates with existing document store for dirty state tracking.

## Technical Context

**Language/Version**: TypeScript 5.9.x with `strict: true`
**Primary Dependencies**: Electron 39.x, React 19.x, Zustand 5.x + Immer 11.x, zod 4.x, diff-match-patch (diff library)
**Storage**: File system (`{userData}/recovery/`), electron-store for settings
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: macOS (Electron desktop)
**Project Type**: Electron app (main + renderer processes)
**Performance Goals**: Autosave < 16ms main thread block (measured via performance.now()); recovery dialog < 2s from app ready to dialog rendered
**Constraints**: Atomic writes required, no UI blocking during save, max interval 30s per Constitution VII.3
**Scale/Scope**: Single document focus, max 50 recovery files (hard limit: oldest deleted when exceeded per FR-021)

## Constitution Check

*GATE: Verified before Phase 0 research. All requirements met.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x strict | PASS | All contracts use strict mode |
| III.1 | Main process owns file I/O | PASS | AutosaveService in main process |
| III.2 | contextIsolation: true | PASS | Inherits existing security config |
| III.3 | IPC invoke/handle + zod | PASS | All channels defined with zod schemas |
| III.3 | Channel naming mdxpad:domain:action | PASS | e.g., mdxpad:autosave:trigger |
| III.3 | Max 10 top-level channels | PASS | Uses nested :recovery: and :autosave: |
| V | Keystroke latency < 16ms | PASS | Async autosave, no renderer blocking |
| VI.1 | JSDoc with @param, @returns | PASS | All public APIs documented |
| VI.2 | Functions max 50 lines | PASS | Design respects limits |
| VI.4 | Integration tests for IPC | REQUIRED | All 10 channels listed below |
| VII.3 | Auto-save every 30s if dirty | PASS | Default intervalMs: 30000, max: 30000 |

### IPC Channel Enumeration (Constitution VI.4 Compliance)

All 10 channels requiring integration tests:

| # | Channel Name | Direction | Purpose |
|---|--------------|-----------|---------|
| 1 | `mdxpad:recovery:check` | invoke | Check if recovery data exists |
| 2 | `mdxpad:recovery:list` | invoke | List all recoverable documents |
| 3 | `mdxpad:recovery:preview` | invoke | Get full content for preview |
| 4 | `mdxpad:recovery:restore` | invoke | Restore selected documents |
| 5 | `mdxpad:recovery:discard` | invoke | Discard recovery data |
| 6 | `mdxpad:autosave:trigger` | invoke | Trigger autosave for document |
| 7 | `mdxpad:autosave:status` | invoke | Get current autosave status |
| 8 | `mdxpad:settings:get` | invoke | Get autosave settings |
| 9 | `mdxpad:settings:set` | invoke | Update autosave settings |
| 10 | `mdxpad:conflict:resolve` | invoke | Resolve file conflict |

## Project Structure

### Documentation (this feature)

```text
specs/011-autosave-recovery/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── index.ts
│   ├── autosave-schemas.ts
│   └── autosave-ipc.ts
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── services/
│   │   ├── autosave-service.ts      # Core autosave logic, atomic writes
│   │   ├── recovery-service.ts      # Startup recovery, restore/discard
│   │   └── autosave-settings.ts     # Settings persistence
│   └── ipc/
│       └── autosave-handlers.ts     # IPC handler registration
├── renderer/
│   ├── hooks/
│   │   └── use-autosave.ts          # Autosave orchestration hook
│   ├── stores/
│   │   └── autosave-store.ts        # Autosave status state
│   └── components/
│       ├── recovery-dialog.tsx       # Recovery dialog UI
│       ├── conflict-dialog.tsx       # Conflict resolution UI
│       └── autosave-indicator.tsx    # Status indicator
└── shared/
    ├── contracts/
    │   └── autosave-schemas.ts       # Zod schemas (from contracts/)
    └── types/
        └── autosave.ts               # Type re-exports

tests/
├── unit/
│   ├── autosave-service.test.ts
│   ├── recovery-service.test.ts
│   └── use-autosave.test.ts
├── integration/
│   └── autosave-ipc.test.ts          # All 10 IPC channels
└── e2e/
    └── autosave-recovery.spec.ts     # Full flow E2E
```

**Structure Decision**: Follows existing Electron app structure with main/renderer/shared separation. Services in main process for file I/O per Constitution III.1.

## Complexity Tracking

> No constitution violations requiring justification.

| Design Decision | Rationale | Alternative Considered |
|-----------------|-----------|------------------------|
| JSON recovery files | Human-readable, simple validation | SQLite (overkill for <50 files) |
| Single manifest file | O(1) startup check | Per-file metadata (slower enumeration) |
| Debounce + interval | Prevents mid-keystroke saves | Pure interval (excessive I/O) |

## Artifacts Generated

| Artifact | Path | Purpose |
|----------|------|---------|
| research.md | specs/011-autosave-recovery/ | Codebase analysis, decisions, constitution check |
| data-model.md | specs/011-autosave-recovery/ | Entity definitions, state transitions, invariants |
| quickstart.md | specs/011-autosave-recovery/ | Implementation guide, file map, testing strategy |
| contracts/ | specs/011-autosave-recovery/contracts/ | Zod schemas and IPC contracts |

## Next Steps

Run `/speckit.tasks` to generate tasks.md with implementation tasks.
