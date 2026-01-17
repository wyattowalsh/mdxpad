# Tasks: Keyboard Shortcuts & Command Palette

**Feature**: `/specs/005-command-palette/`
**Generated**: 2026-01-10
**Orchestration**: disabled

## Prerequisites

| Document | Status | Purpose |
|----------|--------|---------|
| plan.md | ✅ Required | Tech stack, structure, dependencies |
| spec.md | ✅ Required | User stories with priorities |
| data-model.md | ✅ Available | Entity definitions |
| contracts/ | ✅ Available | Zod validation schemas |
| research.md | ✅ Available | Technical decisions |
| quickstart.md | ✅ Available | Validation scenarios |

---

## Execution Constraints

```yaml
# Claude Code MAXIMUM POWER Config (Jan 2026 - Claude Max 20x)
# ⚡ SINGLE SESSION FULL THROTTLE - Token cost is not a concern ⚡

model: opus-4.5                    # Most capable model (slower but smarter)
max_parallel_subagents: 10         # Hard cap enforced by Claude Code
queue_overflow: true               # Tasks beyond 10 auto-queue, refill on complete

# Async/Background Agents (v2.0.60+)
async_background:
  enabled: true
  hotkey: Ctrl+B                   # Background running agents while continuing work
  wake_on_complete: true           # v2.0.64: agents wake main when done
  background_research: true        # Auto-background exploration/research tasks

# Timeouts (generous for Opus deep reasoning)
default_task_timeout: 10m
gate_timeout: 2m
subagent_timeout: 15m

# Fault Tolerance (high tolerance for complex tasks)
circuit_breaker:
  max_failures_per_batch: 5
  action: pause_and_report
retry_policy:
  max_attempts: 3
  backoff: exponential

# Subagent Dispatch Strategy
subagent_dispatch:
  strategy: greedy_queue           # Launch all 10 immediately, queue remainder
  refill_on_complete: true         # Start next queued task as soon as slot frees
  context_per_agent: 200k          # Each subagent gets full 200k context window
  extended_thinking: true          # Enable deep reasoning per agent
  ultrathink: complex              # Use ultrathink for architecture/design tasks

# Batch Optimization
batch_strategy:
  prefer_wider_batches: true       # More parallel tasks over deeper chains
  merge_small_batches: true        # Combine batches with <3 tasks when safe
  max_batch_size: 10               # Match hard cap for maximum throughput
```

---

## Quick Start

### Sequential Execution (Simple)

Execute tasks in order: T001 → T002 → T003 → ...

- Run gate validation after each phase completes
- Safe, predictable, no coordination needed

### Parallel Execution (Recommended) ⚡

1. **Greedy dispatch**: Spawn subagents for ALL tasks in current batch simultaneously
2. **Stream completions**: Process results as each subagent finishes (don't wait for slowest)
3. **Gate on batch complete**: Only run validation after ALL batch tasks finish
4. **Cascade immediately**: Start next batch's tasks the instant gate passes

---

## Phase 2: Foundational

**Purpose**: Core infrastructure that MUST complete before ANY user story
**Estimated Duration**: 25-35 minutes
**Max Parallelism**: 10 subagents

⚠️ **BLOCKING**: No user story work can begin until this phase completes

### Batch 2.1: Types & Utilities (parallel) ⚡

<!-- Context: plan.md#types, data-model.md, contracts/command-schemas.ts -->
- [ ] T001 [P:2.1] Create command type definitions in src/shared/types/commands.ts
- [ ] T002 [P:2.1] Implement VS Code-style fuzzy search algorithm in src/renderer/lib/fuzzy-search.ts
- [ ] T003 [P:2.1] Create fuzzy search tests in src/renderer/lib/fuzzy-search.test.ts

#### Gate 2.1: Types & Utilities Validation

```bash
npx tsc --noEmit src/shared/types/commands.ts src/renderer/lib/fuzzy-search.ts
npx vitest run src/renderer/lib/fuzzy-search.test.ts --reporter=verbose
```

**On-Fail**: Check data-model.md entity definitions; verify HighlightSegment interface matches contracts/command-schemas.ts

### Batch 2.2: Stores (parallel) ⚡

<!-- Context: plan.md#stores, contracts/command-schemas.ts, src/renderer/stores/preview-store.ts (pattern) -->
- [ ] T004 [P:2.2] Implement UI layout store in src/renderer/stores/ui-layout-store.ts
- [ ] T005 [P:2.2] Create UI layout store tests in src/renderer/stores/ui-layout-store.test.ts
- [ ] T006 [P:2.2] Implement command registry store in src/renderer/stores/command-registry-store.ts
- [ ] T007 [P:2.2] Create command registry store tests in src/renderer/stores/command-registry-store.test.ts

#### Gate 2.2: Stores Validation

```bash
npx tsc --noEmit src/renderer/stores/ui-layout-store.ts src/renderer/stores/command-registry-store.ts
npx vitest run src/renderer/stores/*.test.ts --reporter=verbose
```

**On-Fail**: Check Zustand 5.x + immer patterns in preview-store.ts; verify STORAGE_KEYS from contracts/command-schemas.ts

### Batch 2.3: Hooks & IPC (parallel) ⚡

<!-- Context: plan.md#hooks, research.md#accessibility, src/main/menu.ts, src/preload/api.ts -->
- [ ] T008 [P:2.3] Implement focus trap hook in src/renderer/hooks/useFocusTrap.ts
- [ ] T009 [P:2.3] Implement keyboard shortcuts hook in src/renderer/hooks/useKeyboardShortcuts.ts
- [ ] T010 [P:2.3] Implement command palette hook in src/renderer/hooks/useCommandPalette.ts
- [ ] T011 [P:2.3] Add command palette accelerator and menu events to src/main/menu.ts
- [ ] T012 [P:2.3] Add menu event listeners to preload API in src/preload/api.ts

#### Gate 2.3: Hooks & IPC Validation

```bash
npx tsc --noEmit src/renderer/hooks/useFocusTrap.ts src/renderer/hooks/useKeyboardShortcuts.ts src/renderer/hooks/useCommandPalette.ts
npx tsc --noEmit src/main/menu.ts src/preload/api.ts
```

**On-Fail**: Check research.md#accessibility for focus trap pattern; verify IPC channel naming follows mdxpad:{domain}:{action} convention

**✓ Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 & 2 — Command Palette + File Operations (Priority: P1) 🎯 MVP

**Goal**: Implement searchable command palette (Cmd+Shift+P) and wire file shortcuts (Cmd+S, Cmd+O, Cmd+N)
**Independent Test**: Open palette, search for "save", execute command, verify file dialog appears
**Estimated Duration**: 30-40 minutes
**Max Parallelism**: 10 subagents

### Batch 3.1: Palette Base Components (parallel) ⚡

<!-- Context: plan.md#components, research.md#accessibility, quickstart.md#accessibility -->
- [ ] T013 [P:3.1] [US1] Create CommandItem component in src/renderer/components/CommandPalette/CommandItem.tsx
- [ ] T014 [P:3.1] [US1] Create SearchInput component in src/renderer/components/CommandPalette/SearchInput.tsx
- [ ] T015 [P:3.1] [US1] Create CommandList component in src/renderer/components/CommandPalette/CommandList.tsx

#### Gate 3.1: Base Components Validation

```bash
npx tsc --noEmit src/renderer/components/CommandPalette/CommandItem.tsx src/renderer/components/CommandPalette/SearchInput.tsx src/renderer/components/CommandPalette/CommandList.tsx
```

**On-Fail**: Check ARIA patterns in research.md#accessibility; verify role="option" and aria-selected attributes

### Batch 3.2: Main Palette Component (parallel) ⚡

<!-- Context: plan.md#components, src/renderer/components/CommandPalette/*.tsx, research.md#accessibility -->
- [ ] T016 [P:3.2] [US1] Create main CommandPalette component in src/renderer/components/CommandPalette/CommandPalette.tsx
- [ ] T017 [P:3.2] [US1] Create barrel export in src/renderer/components/CommandPalette/index.ts

#### Gate 3.2: Main Component Validation

```bash
npx tsc --noEmit src/renderer/components/CommandPalette/CommandPalette.tsx src/renderer/components/CommandPalette/index.ts
```

**On-Fail**: Verify all sub-components exist; check ARIA combobox pattern with listbox popup

### Batch 3.3: Integration & File Commands (parallel) ⚡

<!-- Context: plan.md#integration, spec.md#US1, spec.md#US2, src/shared/lib/ipc.ts -->
- [ ] T018 [P:3.3] [US1] Create CommandPalette component tests in src/renderer/components/CommandPalette/CommandPalette.test.tsx
- [ ] T019 [P:3.3] [US1] Wire CommandPalette into App.tsx with global shortcut listener
- [ ] T020 [P:3.3] [US2] Register built-in file commands (file.save, file.saveAs, file.open, file.new, file.close) in src/renderer/commands/file-commands.ts

#### Gate 3.3: Integration Validation

```bash
npx tsc --noEmit src/renderer/components/CommandPalette/*.tsx src/renderer/commands/file-commands.ts
npx vitest run src/renderer/components/CommandPalette/*.test.tsx --reporter=verbose
```

**On-Fail**: Check IPC_CHANNELS from src/shared/lib/ipc.ts; verify App.tsx renders CommandPalette

**✓ Checkpoint**: MVP complete — Command palette opens with Cmd+Shift+P, file shortcuts work

---

## Phase 4: User Story 3 & 4 — Editor Formatting + View Controls (Priority: P2)

**Goal**: Implement editor shortcuts (Cmd+B, Cmd+I, Cmd+K) and view controls (Cmd+\, Cmd++/-)
**Independent Test**: Select text, press Cmd+B, verify bold markdown applied; press Cmd+\ to toggle preview
**Estimated Duration**: 20-25 minutes
**Max Parallelism**: 10 subagents

### Batch 4.1: Editor & View Commands (parallel) ⚡

<!-- Context: spec.md#US3, spec.md#US4, src/renderer/hooks/useCodeMirror/commands.ts, research.md#codemirror -->
- [ ] T021 [P:4.1] [US3] Add insertCodeBlock and toggleComment commands to src/renderer/hooks/useCodeMirror/commands.ts
- [ ] T022 [P:4.1] [US3] Register built-in editor commands (edit.bold, edit.italic, edit.link, edit.codeBlock, edit.toggleComment, edit.find, edit.findNext) in src/renderer/commands/editor-commands.ts
- [ ] T023 [P:4.1] [US4] Register built-in view commands (view.togglePreview, view.toggleSidebar, view.zoomIn, view.zoomOut, view.resetZoom) in src/renderer/commands/view-commands.ts

#### Gate 4.1: Editor & View Commands Validation

```bash
npx tsc --noEmit src/renderer/hooks/useCodeMirror/commands.ts src/renderer/commands/editor-commands.ts src/renderer/commands/view-commands.ts
```

**On-Fail**: Verify EditorView.dispatch pattern from research.md#codemirror; check ui-layout-store actions for zoom

### Batch 4.2: Command Registration Wiring

<!-- Context: plan.md#integration, src/renderer/commands/*.ts -->
- [ ] T024 [US3] [US4] Create command registration entry point in src/renderer/commands/index.ts that registers all built-in commands on app init

#### Gate 4.2: Full Command Wiring

```bash
npx tsc --noEmit src/renderer/commands/index.ts
```

**On-Fail**: Ensure all command files export registerCommands function; verify CommandContext interface

**✓ Checkpoint**: P2 features complete — all editor shortcuts and view toggles work

---

## Phase 5: User Story 5 & 6 — Recent Commands + Categories (Priority: P3)

**Goal**: Show recently used commands at palette top; organize commands by category when not searching
**Independent Test**: Execute command, reopen palette, verify command in "Recent" section
**Estimated Duration**: 15-20 minutes
**Max Parallelism**: 10 subagents

### Batch 5.1: Recent & Category Features (parallel) ⚡

<!-- Context: spec.md#US5, spec.md#US6, contracts/command-schemas.ts#RecentCommandEntry -->
- [ ] T025 [P:5.1] [US5] Implement recent commands persistence in command-registry-store (recordUsage, clearRecent, localStorage sync)
- [ ] T026 [P:5.1] [US6] Add category grouping to CommandList component (show headers when query is empty)

#### Gate 5.1: Recent & Category Validation

```bash
npx tsc --noEmit src/renderer/stores/command-registry-store.ts src/renderer/components/CommandPalette/CommandList.tsx
```

**On-Fail**: Check STORAGE_KEYS.recentCommands from contracts/command-schemas.ts; verify RecentCommandEntry schema

### Batch 5.2: Feature Polish

<!-- Context: spec.md#edge-cases, quickstart.md -->
- [ ] T027 [US5] [US6] Update CommandPalette.test.tsx with recent commands and category tests

#### Gate 5.2: Feature Polish Validation

```bash
npx vitest run src/renderer/components/CommandPalette/*.test.tsx --reporter=verbose
```

**On-Fail**: Ensure test mocks localStorage; verify category sort order

**✓ Checkpoint**: P3 features complete — recent commands and categories work

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Quality improvements, testing, and documentation
**Estimated Duration**: 20-25 minutes

### Batch 6.1: Integration Tests (parallel) ⚡

<!-- Context: spec.md, plan.md#testing -->
- [ ] T028 [P:6.1] Create IPC integration tests in tests/integration/commands.test.ts
- [ ] T029 [P:6.1] Create E2E command palette tests in tests/e2e/command-palette.spec.ts

#### Gate 6.1: Test Validation

```bash
npx vitest run tests/integration/commands.test.ts --reporter=verbose
npx playwright test tests/e2e/command-palette.spec.ts --reporter=list
```

**On-Fail**: Check Playwright configuration; verify IPC mocking in integration tests

### Batch 6.2: Final Validation

- [ ] T030 Run all quickstart.md validation scenarios manually
- [ ] T031 Verify Constitution Article V constraints: bundle size < 5MB, keystroke latency < 16ms
- [ ] T032 Run full type check and test suite

#### Gate 6.2: Final Validation

```bash
npx tsc --noEmit
npx vitest run --reporter=verbose
npm run build && du -sh dist/renderer.js
```

**On-Fail**: Review bundle analysis; check for unnecessary dependencies

---

## Parallel Execution Summary

| Phase | Name | Batches | Tasks | Max Parallel | Critical Path | Independent |
|-------|------|---------|-------|--------------|---------------|-------------|
| 2 | Foundational | 3 | 12 | 5 | T001 → T004 → T008 | No |
| 3 | US1+US2 (P1) | 3 | 8 | 4 | T013 → T016 → T019 | **Yes** |
| 4 | US3+US4 (P2) | 2 | 4 | 3 | T021 → T024 | **Yes** |
| 5 | US5+US6 (P3) | 2 | 3 | 2 | T025 → T027 | **Yes** |
| 6 | Polish | 2 | 5 | 2 | T028 → T032 | No |
| **Total** | | **12** | **32** | **10 (hard cap)** | **Critical: 8 tasks** | **Interleaved** |

### Parallelism Metrics (Jan 2026 - Claude Max 20x)

| Metric | Value | Notes |
|--------|-------|-------|
| **Total Tasks** | 32 | Sum of all tasks |
| **Critical Path Length** | 8 | Longest sequential chain |
| **Parallelism Factor** | 4.0x | 32 tasks / 8 critical |
| **Max Concurrent Subagents** | **10** | Hard cap per Claude session |
| **Queue Overflow** | Unlimited | Tasks >10 auto-queue, greedy refill |
| **Theoretical Speedup** | 4.0x | With unlimited parallelism |
| **Practical Speedup** | 3.5x | With 10 slots + greedy refill |
| **Background Agents** | Ctrl+B | Research tasks can run async (v2.0.60+) |

### Parallel Execution Windows (Single Session)

```
Time →
├─ Foundational (12 tasks, 3 batches) ──────────┤  ← Sequential batches, parallel within
├─ [10 slots: 4 US1+US2 + 3 US3+US4 + 3 US5+US6]┤  ← Interleaved after P2 gate
├─ [Queue refills as slots free] ───────────────┤  ← Greedy refill
├─ Polish (5 tasks, 2 batches) ─────────────────┤
```

---

## Dependencies

### Phase Dependencies

```
Phase 2 (Foundational) ← BLOCKS ALL USER STORIES
    ↓
┌───────────────┬───────────────┐
↓               ↓               ↓
Phase 3 (P1)    Phase 4 (P2)    Phase 5 (P3)  ← Can interleave after Foundational
└───────────────┴───────────────┘
                ↓
        Phase 6 (Polish)
```

### User Story Independence

| Story | Can Start After | Dependencies on Other Stories |
|-------|-----------------|------------------------------|
| US1 (Palette) | Phase 2 complete | None |
| US2 (File Ops) | Phase 2 complete | None (shares batch with US1) |
| US3 (Editor) | Phase 2 complete | None |
| US4 (View) | Phase 2 complete | None (shares batch with US3) |
| US5 (Recent) | Phase 3 complete | Requires command-registry-store |
| US6 (Categories) | Phase 3 complete | Requires CommandList component |

### Critical Path Analysis

```
T001 → T004 → T008 → T013 → T016 → T019 → T025 → T030
  ↑       ↑       ↑       ↑       ↑       ↑       ↑       ↑
Types   Store   Hooks   Item   Palette  Wire  Recent   QA
```

**Bottleneck**: Phase 2 Foundational — stores must exist before any commands can register

---

## Recovery Playbook

### Partial Batch Failure

**Symptoms**: Some tasks in batch succeed, others fail

**Recovery**:
1. Check gate output for specific failures
2. Fix failing task(s) individually
3. Re-run only failed tasks, not entire batch
4. Re-run gate validation

### Gate Validation Failure

**Symptoms**: All tasks complete but gate fails

**Recovery**:
1. Read gate error output carefully
2. Common causes:
   - Import errors → missing dependency or typo
   - Type errors → run `npx tsc --noEmit` on specific file for details
   - Missing file → task didn't create expected output
3. Fix identified issue
4. Re-run gate only: copy/paste gate command

### Cross-Story Dependency Error

**Symptoms**: US5/US6 fails because it needs something from US1

**Recovery**:
1. This indicates Phase 3 incomplete
2. Verify Gate 3.3 passed
3. Check command-registry-store exports recordUsage action
4. Re-run Phase 3 tasks if needed

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Store import fails | Missing types export | Check src/shared/types/commands.ts exports |
| Hook can't find store | Store not registered | Verify store file has `export const useXxx = create<...>()` |
| ARIA test fails | Missing aria-* attribute | Review research.md#accessibility for required attributes |
| Menu event not firing | IPC channel mismatch | Check mdxpad: prefix in both menu.ts and api.ts |
| Shortcut doesn't work | Not registered in registry | Verify command registered on app init |
| Fuzzy search scores wrong | Algorithm bug | Check scoring bonuses in research.md#fuzzy-search |

---

## Notes

- **[P:X.Y]** = Batch identifier; same ID means parallel-safe
- **[USn]** = User story tag for traceability
- **Gates** = Validation checkpoints; don't skip them
- **Checkpoints** = Safe stopping points; story is complete and testable
- Commit after each gate passes
- Each P1/P2/P3 user story group should work independently
- Stop at any checkpoint to validate incrementally
- File paths are relative to repository root
