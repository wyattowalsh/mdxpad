# Implementation Plan: Application Shell

**Branch**: `006-application-shell` | **Date**: 2026-01-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-application-shell/spec.md`

## Summary

The Application Shell integrates existing components (MDXEditor, PreviewPane, CommandPalette, file operations) into a cohesive document-editing experience. It provides:

1. **Resizable split-pane layout** using `react-resizable-panels` (already installed)
2. **Document state management** via new Zustand store tracking file, content, dirty state
3. **Settings persistence** using established hybrid approach (localStorage for UI state)
4. **Status bar** displaying filename, cursor position, dirty indicator, error count
5. **Complete document lifecycle** (new, open, edit, save, close with dirty check)
6. **Focus-based external file modification detection**

## Technical Context

**Language/Version**: TypeScript 5.9.x with `strict: true` (per Constitution Article II)
**Primary Dependencies**: React 19.x, Zustand 5.x + Immer 11.x, react-resizable-panels 4.1.0, electron-store 11.0.2
**Storage**: localStorage (UI state), electron-store (recent files, window bounds)
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: macOS (Electron 39.x)
**Project Type**: Electron desktop application (main + renderer processes)
**Performance Goals**: Cold start < 2s, keystroke latency < 16ms, preview compile < 500ms (3s timeout for edge cases)
**Constraints**: contextIsolation: true, sandbox: true, <200MB memory idle
**Window Chrome**: macOS hiddenInset titlebar with traffic lights inset via electron BrowserWindow config (titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 10, y: 10 })
**Scale/Scope**: Single-document model, local files only

## Constitution Check

*GATE: PASSED - All requirements verified*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| I | Security > Performance > UX | PASS | Focus-based detection (simpler, more secure) over continuous watching |
| II | Technology stack | PASS | All existing dependencies; no new packages |
| II | Zustand + Immer for state | PASS | Document store uses Zustand + Immer |
| II | zod for validation | PASS | File operation payloads validated with zod |
| III.2 | contextIsolation: true | PASS | No changes to Electron config |
| III.3 | IPC invoke/handle pattern | PASS | File operations use existing IPC handlers |
| III.5 | Preview in sandboxed iframe | PASS | Existing pattern maintained |
| V | Cold start < 2s | PASS | No new heavy dependencies; sync localStorage load |
| V | Keystroke latency < 16ms | PASS | Document store is lightweight |
| V | Preview compile < 500ms | PASS | Existing 500ms target; 3s timeout for edge cases only |
| VI.1 | JSDoc for public APIs | WILL COMPLY | |
| VI.2 | Functions < 50 lines | WILL COMPLY | |
| VI.4 | Unit coverage > 80% | WILL COMPLY | |
| VII.2 | Keyboard navigation | PASS | All shortcuts defined in spec |
| VII.3 | Graceful error handling | PASS | Dirty check dialogs, focus-based detection with fallbacks |

## Project Structure

### Documentation (this feature)

```text
.specify/specs/006-application-shell/
├── plan.md              # This file
├── research.md          # Phase 0 output (completed)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── shell-schemas.ts # Zod schemas for document state, layout, settings
├── tasks.md             # Phase 2 output (/speckit.tasks command)
└── checklists/          # Validation outputs
    ├── requirements.md  # Requirements checklist (existing)
    └── performance.md   # Performance validation results (T014 output)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── index.ts                  # Window creation, menu setup
│   ├── menu.ts                   # Native menu (existing, extend)
│   └── ipc/                      # IPC handlers (existing, extend)
├── renderer/
│   ├── App.tsx                   # Root component (MODIFY: add shell layout)
│   ├── components/
│   │   ├── shell/                # NEW: Application shell components
│   │   │   ├── EditorPane.tsx    # Editor wrapper with shell integration
│   │   │   ├── PreviewPane.tsx   # NEW: Preview wrapper for shell integration
│   │   │   └── StatusBar/             # NEW: Status bar component directory
│   │   │       ├── StatusBar.tsx      # Main StatusBar component
│   │   │       ├── FileInfo.tsx       # Filename + dirty indicator
│   │   │       ├── CursorPosition.tsx # Line:Col display
│   │   │       ├── ErrorCount.tsx     # Error badge with popover
│   │   │       ├── types.ts           # Props interfaces
│   │   │       └── index.ts           # Barrel export
│   │   ├── ui/
│   │   │   └── resizable.tsx     # EXISTING: react-resizable-panels wrapper
│   │   └── preview/
│   │       └── PreviewFrame.tsx  # EXISTING: Preview component
│   ├── stores/
│   │   ├── document-store.ts     # NEW: Document state management
│   │   ├── ui-layout-store.ts    # MODIFY: Add splitRatio
│   │   └── command-registry-store.ts # EXISTING
│   ├── commands/
│   │   ├── file-commands.ts      # NEW: File lifecycle commands
│   │   └── index.ts              # MODIFY: Register file commands
│   └── hooks/
│       ├── useDocumentLifecycle.ts # NEW: Hook for dirty check logic
│       └── useErrorNavigation.ts    # NEW: Error click coordination hook
├── preload/
│   └── api.ts                    # MODIFY: Add focus detection IPC
└── shared/
    └── types/
        └── document.ts           # NEW: Document state types

tests/
├── integration/
│   └── document-lifecycle.test.ts # Document lifecycle integration tests
└── e2e/
    └── shell.spec.ts             # E2E tests for shell functionality
```

**Structure Decision**: Follows existing Electron architecture. New components placed in `shell/` subdirectory to isolate from existing components. Document store is separate from UI layout store to maintain clear separation between domain state and UI state.

## Complexity Tracking

> No violations requiring justification. All requirements met within existing patterns.

## Parallelization Notes

> T010 (External Modification Detection) lists dependency on T009 (Window Close Interception) in tasks.md, but these tasks are independent. T010 requires:
> - T001: Document store for file state (mtime tracking)
> - IPC patterns for focus events (no dependency on close interception)
>
> **Recommendation**: T010 can execute in parallel with T009 if resources permit. Both require main process modifications but operate on different events (focus vs close).

## Phase Summary

| Phase | Deliverables | Status |
|-------|--------------|--------|
| Phase 0 | research.md | COMPLETE |
| Phase 1 | data-model.md, contracts/, quickstart.md | COMPLETE |
| Phase 2 | tasks.md, tasks.execution.yaml (via /speckit.tasks) | COMPLETE |
