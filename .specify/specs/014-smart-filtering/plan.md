# Implementation Plan: Smart Filtering for File Tree

**Branch**: `014-smart-filtering` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-smart-filtering/spec.md`

## Summary

Implement a fuzzy file tree filter for the file explorer sidebar, enabling users to quickly locate files using sequential character matching (fzf-style). The feature includes visual match highlighting, keyboard shortcut access (Cmd/Ctrl+P), filter persistence across sessions, and 50ms debounced input for optimal performance with up to 10,000 files.

## Technical Context

**Language/Version**: TypeScript 5.9.x, strict: true (per Constitution Article II)
**Primary Dependencies**: React 19.x, Zustand 5.x + Immer 11.x (per Constitution Article II), fzf (resolved per research.md)
**Storage**: localStorage for filter query persistence per project/workspace (established pattern from specs 005/006)
**Testing**: Vitest 4.x for unit tests, Playwright 1.57.x for E2E (per Constitution Article II)
**Target Platform**: macOS (Electron 39.x) per Constitution preamble
**Project Type**: Single Electron app with renderer process components
**Performance Goals**: Filter results within 100ms end-to-end for 10,000 files (SC-002). This 100ms budget includes the 50ms input debounce (FR-010), leaving 50ms maximum for filter computation.
**Constraints**: Keystroke latency < 16ms p99 per Constitution Article V
**Scale/Scope**: Projects with up to 10,000 files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x strict: true | PASS | Using established stack |
| II | React 19.x, Zustand 5.x | PASS | State management for filter |
| III.1 | Renderer process owns UI | PASS | Filter UI is renderer-only |
| III.4 | No React state duplication | PASS | Filter state in Zustand only |
| V | Keystroke latency < 16ms | TBD | 50ms debounce ensures compliance |
| V | Memory (idle) < 200MB | PASS | Filter adds minimal overhead |
| VI.1 | strict: true, JSDoc for public APIs | PASS | Will enforce |
| VI.2 | Functions < 50 lines, files < 400 lines | PASS | Will enforce |
| VI.4 | >80% unit coverage | PASS | Will test filter logic |
| VII.2 | Keyboard navigation, focus indicators | PASS | Shortcut + focus management |
| VII.2 | Color not sole indicator | PASS | Highlighting uses weight/underline |
| VI.4 | >80% unit coverage for lib/ | TBD | Will validate in T018/T019 |

**Gate Status**: PASS - No violations detected.

## Project Structure

### Documentation (this feature)

```text
.specify/specs/014-smart-filtering/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── renderer/
│   ├── components/
│   │   └── file-explorer/
│   │       ├── FileTreeFilter.tsx      # Filter input component
│   │       ├── FileTreeFilter.test.ts  # Unit tests
│   │       └── FilterHighlight.tsx     # Match highlighting component
│   ├── lib/
│   │   ├── fuzzy-match/
│   │   │   ├── matcher.ts              # Fuzzy matching logic
│   │   │   ├── matcher.test.ts         # Unit tests
│   │   │   └── types.ts                # Match result types
│   │   └── file-tree/
│   │       └── filter-utils.ts         # Tree filtering utilities
│   └── stores/
│       └── file-explorer-store.ts      # Extended with filter state
├── shared/
│   └── types/
│       └── file-tree.ts                # Shared filter types
└── preload/
    └── (no changes - filter is renderer-only)

tests/
├── unit/
│   └── fuzzy-match/                    # Colocated with src
└── e2e/
    └── file-tree-filter.spec.ts        # E2E filter tests
```

**Structure Decision**: Extends existing file-explorer component structure. Filter logic isolated in `lib/fuzzy-match/` for testability. State managed via existing Zustand store pattern.

## Complexity Tracking

> No violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | - | - |
