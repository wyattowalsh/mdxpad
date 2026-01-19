# Implementation Plan: Bidirectional Preview Sync

**Branch**: `008-bidirectional-sync` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/008-bidirectional-sync/spec.md`

---

## Summary

Implement bidirectional scroll synchronization between the editor and preview panel. As users scroll in either pane, the other pane follows to show corresponding content. The feature includes configurable sync modes (disabled, editor-to-preview, preview-to-editor, bidirectional), smooth scrolling animations, scroll lock to prevent feedback loops, and position caching for instant synchronization.

**Key Technical Approach**:
- Create sync orchestration module to coordinate scroll events between panes
- Implement position mapping using AST source positions with proportional fallback
- Add scroll lock mechanism to prevent infinite feedback loops
- Integrate with existing settings persistence and command palette
- Follow existing store patterns for sync state management

> **Design Decision**: Use AST source positions from preview compilation (per FR-024) as primary mapping strategy, with proportional scroll ratio as fallback (per Edge Cases in spec.md).

---

## Technical Context

**Technical Stack**: Per AGENTS.md Active Technologies section and Constitution Article II.
**Storage**: localStorage for sync mode preference (`mdxpad:sync:mode`, `mdxpad:sync:last-active-mode`)
**Project Type**: Single Electron app (renderer process focus)
**Performance Goals**: <5ms scroll handler execution, <200ms total sync response (SYNC_DEBOUNCE_MS + SCROLL_ANIMATION_MS), <16ms keystroke latency unaffected
**Constraints**: Must not cause feedback loops, must not block main thread, must integrate with existing preview AST
**Scale/Scope**: Single document, optimized for documents up to 10,000 lines per spec assumptions

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x, strict: true | ✅ PASS | Using existing project config |
| II | React 19.x | ✅ PASS | Existing dependency |
| II | Zustand 5.x + Immer 11.x | ✅ PASS | Following existing store patterns |
| II | Tailwind CSS 4.x | ✅ PASS | Existing styling system |
| III.1 | Renderer process only | ✅ PASS | All sync code in renderer |
| III.4 | CodeMirror 6 owns editor state | ✅ PASS | Scroll via CM API |
| III.5 | Preview in sandboxed iframe | ✅ PASS | Scroll via postMessage |
| V | Keystroke latency <16ms | ✅ PASS | Sync debounced, async, does not affect typing |
| V | Renderer bundle <5MB | ⏳ PENDING | Estimated ~3KB new code, verification after implementation |
| VI.1 | No `any` types | ✅ PASS | Full type coverage in contracts |
| VI.2 | Functions <50 lines | ✅ PASS | Design follows limits |
| VI.4 | >80% unit coverage | ✅ TBD | Test plan includes coverage |
| VII.2 | Keyboard accessible | ✅ PASS | Toggle via Cmd+Shift+Y |
| VII.2 | Reduced motion respect | ✅ PASS | Instant scroll when prefers-reduced-motion |
| VIII.2 | Task-based commits | ✅ PASS | Will follow pattern |

**Post-Design Re-check**: All gates PASS. No violations requiring justification.

---

## Project Structure

### Documentation (this feature)

```text
.specify/specs/008-bidirectional-sync/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research findings
├── data-model.md        # Entity definitions
├── quickstart.md        # Implementation guide
├── contracts/           # TypeScript interfaces
│   ├── index.ts
│   ├── sync-store.ts
│   ├── sync-orchestrator.ts
│   └── position-mapping.ts
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/renderer/
├── stores/
│   ├── sync-store.ts              # NEW: Sync state management
│   ├── sync-store.test.ts         # NEW: Store tests
│   └── settings-store.ts          # EXTEND: Add sync mode setting
├── hooks/
│   ├── useScrollSync.ts           # NEW: Scroll sync orchestration
│   ├── useScrollSync.test.ts      # NEW: Orchestrator tests
│   ├── usePositionMapping.ts      # NEW: Position mapping hook
│   └── usePositionMapping.test.ts
├── lib/sync/
│   ├── scroll-lock.ts             # NEW: Feedback loop prevention
│   ├── position-mapper.ts         # NEW: Editor ↔ Preview position mapping
│   ├── position-cache.ts          # NEW: Position cache with TTL
│   └── index.ts                   # Barrel export
├── commands/
│   └── view-commands.ts           # EXTEND: Add toggle-sync command
└── App.tsx                        # EXTEND: Integrate sync hooks

src/shared/types/
└── sync.ts                        # NEW: Shared type definitions
```

**Structure Decision**: Single project structure (Option 1). All sync code lives in renderer process. Preview receives scroll commands via postMessage. No main process changes needed.

---

## Complexity Tracking

> **No violations requiring justification.**

The implementation follows existing patterns:
- Zustand store pattern (same as preview-store, ui-layout-store)
- Hook-based orchestration (similar to useErrorNavigation)
- Command registration pattern (same as view-commands)
- Settings persistence (same as ui-layout-store localStorage pattern)

---

## Implementation Phases

*See spec.md User Stories for full context on P1/P2/P3 priorities.*

### Phase 1: Core Infrastructure (US1, US2)

**Implements**: FR-010 through FR-024, FR-030 through FR-033, FR-040 through FR-042

1. Create sync-store for state management
2. Create scroll-lock module for feedback prevention
3. Create position-mapper for editor ↔ preview mapping
4. Create position-cache with TTL expiration
5. Create useScrollSync hook to orchestrate sync
6. Extend preview store to expose line position data

### Phase 2: Editor-to-Preview Sync (US1)

**Implements**: FR-010 through FR-014

1. Add editor scroll event listener
2. Implement debounced sync trigger
3. Calculate preview scroll target from visible lines
4. Send scroll command to preview iframe
5. Test with smooth animation

### Phase 3: Preview-to-Editor Sync (US2)

**Implements**: FR-020 through FR-024

1. Add preview scroll event listener (via postMessage)
2. Implement reverse position mapping
3. Scroll editor to target line
4. Handle AST source position lookup
5. Test bidirectional flow

### Phase 4: Configuration & Commands (US3, US5)

**Implements**: FR-001 through FR-005, FR-050 through FR-052

1. Extend settings store with sync mode
2. Add UI for sync mode selection
3. Register toggle command with command palette
4. Add keyboard shortcut (Cmd+Shift+Y)
5. Implement notification on toggle
6. Test persistence across restarts

### Phase 5: Typing Sync & Polish (US4)

**Implements**: FR-014, NFRs

1. Add cursor-position-based sync during typing
2. Implement SYNC_THRESHOLD_LINES gate
3. Add reduced motion support
4. Implement screen reader announcement
5. Final testing and polish

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Spec 002 (Editor Core) | Must exist | ✅ Complete |
| Spec 003 (Preview Pane) | Must exist | ✅ Complete |
| Spec 005 (Command Palette) | Must exist | ✅ Complete |
| Spec 006 (Application Shell) | Must exist | ✅ Complete |
| preview-store.ts | Extend | Exists |
| settings-store.ts | Extend | Exists (or create) |
| view-commands.ts | Extend | Exists |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Feedback loops (infinite scroll) | Scroll lock with source tracking, debounce |
| Position mapping accuracy | Three-tier strategy: AST → DOM → proportional |
| Preview iframe communication | Use existing postMessage pattern |
| Performance during rapid scroll | Debounce, cache positions, async |
| Reduced motion ignored | Check prefers-reduced-motion, use instant scroll |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Sync response time | <200ms | SYNC_DEBOUNCE_MS + SCROLL_ANIMATION_MS |
| Scroll handler execution | <5ms | Main thread time measurement |
| Position mapping accuracy | 90%+ | Within 5 lines of source |
| Keystroke latency | Unaffected | Remains <16ms |
| Mode persistence | 100% | E2E test across restart |
| No feedback loops | 100% | Stress test with rapid scrolling |

---

## Next Steps

Run `/speckit.tasks` to generate implementation tasks from this plan.
