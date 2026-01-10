# Tasks: Preview Pane

**Feature**: `/specs/003-preview-pane/`
**Generated**: 2026-01-09
**Optimized**: 2026-01-09 (max parallelization)
**Orchestration**: enabled

## Prerequisites

| Document | Status | Purpose |
|----------|--------|---------|
| plan.md | ✅ Present | Tech stack, structure, dependencies |
| spec.md | ✅ Present | User stories with priorities (6 stories) |
| data-model.md | ✅ Present | Entity definitions, state types |
| contracts/ | ✅ Present | Worker and iframe message contracts |
| research.md | ✅ Present | Technical decisions |
| quickstart.md | ✅ Present | Integration guide |

---

## Execution Constraints

```yaml
# Claude Code MAXIMUM POWER Config (Jan 2026 - Claude Max 20x)
# ⚡ SINGLE SESSION FULL THROTTLE - Token cost is not a concern ⚡

model: opus-4.5
max_parallel_subagents: 10
queue_overflow: true

# Async/Background Agents (v2.0.60+)
async_background:
  enabled: true
  hotkey: Ctrl+B
  wake_on_complete: true
  background_research: true

# Timeouts (generous for Opus deep reasoning)
default_task_timeout: 10m
gate_timeout: 2m
subagent_timeout: 15m

# Fault Tolerance
circuit_breaker:
  max_failures_per_batch: 5
  action: pause_and_report
retry_policy:
  max_attempts: 3
  backoff: exponential

# Subagent Dispatch Strategy
subagent_dispatch:
  strategy: greedy_queue
  refill_on_complete: true
  context_per_agent: 200k
  extended_thinking: true
  ultrathink: complex

# Batch Optimization
batch_strategy:
  prefer_wider_batches: true
  merge_small_batches: true
  max_batch_size: 10
```

---

## Quick Start

### Parallel Execution (Recommended) ⚡

This task list is optimized for **8 mega-batches** with maximum 10-slot parallelism:

1. **Greedy dispatch**: Spawn ALL tasks in current batch simultaneously (up to 10)
2. **Stream completions**: Process results as each subagent finishes
3. **Gate on batch complete**: Run validation after ALL batch tasks finish
4. **Cascade immediately**: Start next batch the instant gate passes

### Execution Flow

```
Batch 1 (2)  → Batch 2 (10) → Batch 3 (10) → Batch 4 (10) → Batch 5 (8) → Batch 6 (7) → Batch 7 (2) → Batch 8 (2)
   Setup        Types+UI       Worker+Comp    Interface      Hook+Int      PreviewPane     Polish        Verify
```

---

## Batch 1: Setup (2 parallel) ⚡

**Purpose**: Install dependencies and create directory structure
**Duration**: ~2 minutes
**Parallelism**: 2/10 slots

| Task | Description | Dependencies |
|------|-------------|--------------|
| T001 | ✅ Install MDX dependencies: `pnpm add @mdx-js/mdx @mdx-js/react remark-gfm remark-frontmatter rehype-highlight vfile-matter` | None |
| T002 | ✅ Create directory structure per plan.md (`src/renderer/components/preview/`, `src/renderer/workers/`, `src/renderer/stores/`, `src/renderer/hooks/`, `src/renderer/lib/mdx/`, `src/renderer/styles/preview/`, `src/preview-frame/`, `src/preview-frame/components/`) | None |

### Gate 1

```bash
test -d src/renderer/components/preview && \
test -d src/renderer/workers && \
test -d src/renderer/stores && \
test -d src/preview-frame/components && \
test -f package.json && grep -q "@mdx-js/mdx" package.json && \
echo "✓ Batch 1 complete"
```

---

## Batch 2: Types + Independent UI (10 parallel) ⚡

**Purpose**: Shared types AND all dependency-free UI components
**Duration**: ~5 minutes
**Parallelism**: 10/10 slots (FULL)

| Task | Description | Dependencies | User Story |
|------|-------------|--------------|------------|
| T003 | ✅ Create worker message types in `src/shared/types/preview-worker.ts` | T001,T002 | — |
| T004 | ✅ Create iframe message types in `src/shared/types/preview-iframe.ts` | T001,T002 | — |
| T005 | ✅ Create zod validation schemas in `src/shared/schemas/preview.ts` | T001,T002 | — |
| T010 | ✅ Create preview frame HTML in `src/preview-frame/index.html` (sandbox="allow-scripts", CSP meta tag per constitution III.5) | T002 | US1 |
| T013 | ✅ Create LoadingIndicator component in `src/renderer/components/preview/LoadingIndicator.tsx` | T002 | US1 |
| T018 | ✅ Create error styles in `src/renderer/styles/preview/error.css` | T002 | US2 |
| T029 | ✅ Create component styles in `src/renderer/styles/preview/components.css` (CSS variables for theming) | T002 | US3 |
| T036 | ✅ Create theme CSS variables in `src/renderer/styles/preview/theme.css` (light/dark tokens) | T002 | US6 |
| T040 | ✅ Create ErrorBoundary component in `src/preview-frame/components/ErrorBoundary.tsx` | T002 | — |
| T023 | ✅ Create code styles in `src/renderer/styles/preview/code.css` (syntax highlighting theme, copy button, line numbers) | T002 | US3 |

### Gate 2

```bash
pnpm tsc --noEmit src/shared/types/preview-worker.ts src/shared/types/preview-iframe.ts src/shared/schemas/preview.ts && \
test -f src/preview-frame/index.html && \
grep -q 'sandbox="allow-scripts"' src/preview-frame/index.html && \
pnpm tsc --noEmit src/renderer/components/preview/LoadingIndicator.tsx && \
pnpm tsc --noEmit src/preview-frame/components/ErrorBoundary.tsx && \
echo "✓ Batch 2 complete"
```

---

## Batch 3: Worker + Built-in Components (10 parallel) ⚡

**Purpose**: MDX compilation worker AND all built-in MDX components
**Duration**: ~8 minutes
**Parallelism**: 10/10 slots (FULL)

| Task | Description | Dependencies | User Story |
|------|-------------|--------------|------------|
| T006 | ✅ Implement MDX compilation Web Worker in `src/renderer/workers/mdx-compiler.worker.ts` (compile MDX with remark-gfm, remark-frontmatter, rehype-highlight; outputFormat: 'function-body'; VFileMessage error extraction) | T003,T004,T005 | — |
| T011 | ✅ Create MDX runtime renderer in `src/preview-frame/renderer.tsx` (receive postMessage, eval compiled code, render with React, send ready/size/error signals) | T004 | US1 |
| T017 | ✅ Create ErrorDisplay component in `src/renderer/components/preview/ErrorDisplay.tsx` (display CompileError list, clickable line:column) | T003 | US2 |
| T021 | ✅ Create typography components in `src/preview-frame/components/typography.tsx` (h1-h6, p, a, ul, ol, li, blockquote, hr, table elements per FR-009) | T002 | US3 |
| T022 | ✅ Create CodeBlock component in `src/preview-frame/components/CodeBlock.tsx` (syntax highlighting, copy-to-clipboard, title, line numbers per FR-010) | T002 | US3 |
| T024 | ✅ Create Callout component in `src/preview-frame/components/Callout.tsx` (variants: info, warning, error, success, note, tip per FR-011) | T002 | US3 |
| T025 | ✅ Create Tabs/Tab components in `src/preview-frame/components/Tabs.tsx` (controlled state, tab list, tab panels per FR-012) | T002 | US3 |
| T026 | ✅ Create Card/CardGrid components in `src/preview-frame/components/Card.tsx` (link cards, icon support, grid layout per FR-013) | T002 | US3 |
| T027 | ✅ Create FileTree component in `src/preview-frame/components/FileTree.tsx` (recursive tree, file/directory icons per FR-014) | T002 | US3 |
| T008 | ✅ Create preview store in `src/renderer/stores/preview-store.ts` (Zustand + Immer; state transitions: idle→compiling→success\|error; cache lastSuccessfulRender) | T003,T004,T005 | — |

### Gate 3

```bash
pnpm tsc --noEmit src/renderer/workers/mdx-compiler.worker.ts && \
pnpm tsc --noEmit src/preview-frame/renderer.tsx && \
pnpm tsc --noEmit src/renderer/components/preview/ErrorDisplay.tsx && \
pnpm tsc --noEmit src/preview-frame/components/typography.tsx && \
pnpm tsc --noEmit src/preview-frame/components/CodeBlock.tsx && \
pnpm tsc --noEmit src/preview-frame/components/Callout.tsx && \
pnpm tsc --noEmit src/preview-frame/components/Tabs.tsx && \
pnpm tsc --noEmit src/preview-frame/components/Card.tsx && \
pnpm tsc --noEmit src/preview-frame/components/FileTree.tsx && \
pnpm tsc --noEmit src/renderer/stores/preview-store.ts && \
echo "✓ Batch 3 complete"
```

---

## Batch 4: Interfaces + Integration Layer (10 parallel) ⚡

**Purpose**: Worker interface, component registry, and renderer extensions
**Duration**: ~6 minutes
**Parallelism**: 10/10 slots (FULL)

| Task | Description | Dependencies | User Story |
|------|-------------|--------------|------------|
| T007 | ✅ Create worker message interface in `src/renderer/lib/mdx/compiler.ts` (spawn worker, send CompileRequest, handle CompileResponse, request ID tracking for debounce cancellation) | T006 | — |
| T012 | ✅ Create PreviewFrame component in `src/renderer/components/preview/PreviewFrame.tsx` (render iframe with sandbox, postMessage communication, handle ready/size signals) | T004,T011 | US1 |
| T028 | ✅ Create component registry in `src/preview-frame/components/index.ts` (export BuiltInComponents map for MDX provider) | T021-T027 | US3 |
| T030 | ✅ Register components in `src/preview-frame/renderer.tsx` (pass BuiltInComponents to MDX runtime) | T011,T028 | US3 |
| T031 | ✅ Update `mdx-compiler.worker.ts` to extract frontmatter using vfile-matter (parse YAML, include in CompileResponseSuccess.frontmatter) | T006 | US4 |
| T032 | ✅ Update `renderer.tsx` to pass frontmatter to MDX content (make available via props or context) | T011 | US4 |
| T033 | ✅ Add scroll command handling in `src/preview-frame/renderer.tsx` (receive ScrollCommand, scroll to proportional position with smooth behavior) | T011 | US5 |
| T037 | ✅ Add theme command handling in `src/preview-frame/renderer.tsx` (receive ThemeCommand, apply data-theme attribute) | T011 | US6 |
| T041 | ✅ Wrap MDX content in ErrorBoundary in `src/preview-frame/renderer.tsx` (send RuntimeErrorSignal to parent on catch) | T011,T040 | — |
| T044 | ✅ Create preview styles barrel in `src/renderer/styles/preview/index.css` (import error.css, code.css, components.css, theme.css) | T018,T023,T029,T036 | — |

### Gate 4

```bash
pnpm tsc --noEmit src/renderer/lib/mdx/compiler.ts && \
pnpm tsc --noEmit src/renderer/components/preview/PreviewFrame.tsx && \
pnpm tsc --noEmit src/preview-frame/components/index.ts && \
grep -q "BuiltInComponents" src/preview-frame/renderer.tsx && \
grep -q "frontmatter" src/renderer/workers/mdx-compiler.worker.ts && \
grep -q "scroll" src/preview-frame/renderer.tsx && \
grep -q "theme" src/preview-frame/renderer.tsx && \
grep -q "ErrorBoundary" src/preview-frame/renderer.tsx && \
test -f src/renderer/styles/preview/index.css && \
echo "✓ Batch 4 complete"
```

---

## Batch 5: Hook + Component Integration (8 parallel) ⚡

**Purpose**: Core usePreview hook and cross-component wiring
**Duration**: ~6 minutes
**Parallelism**: 8/10 slots

| Task | Description | Dependencies | User Story |
|------|-------------|--------------|------------|
| T009 | ✅ Create usePreview hook in `src/renderer/hooks/usePreview.ts` (debounced compilation via worker, state management integration, request ID tracking; 300ms debounce per FR-004) | T007,T008 | US1 |
| T034 | ✅ Add scrollRatio prop handling in `PreviewFrame.tsx` (send ScrollCommand to iframe when scrollRatio prop changes) | T012 | US5 |
| T042 | ✅ Handle RuntimeErrorSignal in `PreviewFrame.tsx` (display error in preview, cache last good render) | T012,T041 | — |
| T045 | ✅ Verify CSP compliance (FR-017): ensure preview iframe CSP blocks network requests, matches constitution III.5 | T010 | — |
| T019 | ✅ Integrate ErrorDisplay into PreviewPane pattern (show errors when status==='error', hide on success, cache last successful render) — prepare integration code | T017 | US2 |
| T020 | ✅ Add onErrorClick callback pattern for PreviewPane props (navigate editor to error line) — prepare type and handler | T017 | US2 |
| T038 | ✅ Add theme prop pattern for PreviewFrame (send ThemeCommand when theme changes) — prepare prop wiring | T012 | US6 |
| T039 | ✅ Connect preview to app theme context pattern (subscribe to theme changes, propagate to iframe) — prepare context integration | T012 | US6 |

### Gate 5

```bash
pnpm tsc --noEmit src/renderer/hooks/usePreview.ts && \
grep -q "scrollRatio" src/renderer/components/preview/PreviewFrame.tsx && \
grep -q "RuntimeErrorSignal\|runtime-error" src/renderer/components/preview/PreviewFrame.tsx && \
echo "✓ Batch 5 complete"
```

---

## Batch 6: PreviewPane + Final Integration (7 parallel) ⚡

**Purpose**: Main PreviewPane container and all feature integrations
**Duration**: ~5 minutes
**Parallelism**: 7/10 slots

| Task | Description | Dependencies | User Story |
|------|-------------|--------------|------------|
| T014 | Create PreviewPane container in `src/renderer/components/preview/PreviewPane.tsx` (orchestrate usePreview hook, show loading/success/error states, warning indicator per FR-025 "Preview executes code") | T009,T012,T013 | US1 |
| T015 | Create preview component barrel export in `src/renderer/components/preview/index.ts` | T012,T013,T014,T017 | US1 |
| T016 | Add performance warning logic to PreviewPane (FR-023: warn when source.length > 50000, non-blocking) | T014 | US1 |
| T035 | Wire scrollRatio through usePreview hook and PreviewPane (pass from editor scroll handler to iframe) | T009,T033,T034 | US5 |
| T046 | Verify security indicator (FR-025): ensure "Preview executes code" warning displays in PreviewPane | T014 | — |
| T048 | Verify FR-026 compliance: audit PreviewFrame.tsx and renderer.tsx to ensure no auth tokens, file paths, or editor state passed to iframe | T012,T011 | — |
| T043 | Update barrel exports in `src/renderer/components/preview/index.ts` (include ErrorDisplay, LoadingIndicator, PreviewFrame, PreviewPane) | T015 | — |

### Gate 6

```bash
pnpm tsc --noEmit src/renderer/components/preview/PreviewPane.tsx && \
pnpm tsc --noEmit src/renderer/components/preview/index.ts && \
grep -q "ErrorDisplay" src/renderer/components/preview/PreviewPane.tsx && \
grep -q "scrollRatio" src/renderer/components/preview/PreviewPane.tsx && \
grep -q "executes code\|warning" src/renderer/components/preview/PreviewPane.tsx && \
echo "✓ Batch 6 complete"
```

---

## Batch 7: Polish (2 parallel) ⚡

**Purpose**: Final validation and integration scenarios
**Duration**: ~3 minutes
**Parallelism**: 2/10 slots

| Task | Description | Dependencies | User Story |
|------|-------------|--------------|------------|
| T047 | Run quickstart.md integration scenarios manually (verify all 6 user stories work end-to-end) | All | — |
| T049 | Create security checklist documentation summarizing FR-017, FR-018, FR-026 compliance | T045,T046,T048 | — |

### Gate 7

```bash
pnpm tsc --noEmit && \
pnpm lint src/renderer/components/preview/ src/preview-frame/ src/renderer/hooks/ src/renderer/stores/ src/renderer/lib/mdx/ && \
echo "✓ Batch 7 complete - All type checks and linting passed"
```

---

## Batch 8: Final Verification (2 sequential)

**Purpose**: Full build verification
**Duration**: ~2 minutes
**Parallelism**: Sequential (validation)

| Task | Description | Dependencies |
|------|-------------|--------------|
| T050 | Run full TypeScript build: `pnpm tsc --noEmit` | All |
| T051 | Verify no console errors in dev mode with sample MDX | T050 |

### Gate 8 (Final)

```bash
pnpm tsc --noEmit && \
echo "✓ Feature complete - All 51 tasks implemented and validated"
```

---

## Parallel Execution Summary

| Batch | Name | Tasks | Parallelism | Critical Path Tasks | Duration Est. |
|-------|------|-------|-------------|---------------------|---------------|
| 1 | Setup | 2 | 2/10 | T001 | ~2 min |
| 2 | Types + UI | 10 | **10/10** | T003,T004,T005 | ~5 min |
| 3 | Worker + Components | 10 | **10/10** | T006,T008 | ~8 min |
| 4 | Interfaces | 10 | **10/10** | T007 | ~6 min |
| 5 | Hook + Integration | 8 | 8/10 | T009 | ~6 min |
| 6 | PreviewPane | 7 | 7/10 | T014 | ~5 min |
| 7 | Polish | 2 | 2/10 | — | ~3 min |
| 8 | Verification | 2 | Sequential | — | ~2 min |
| **Total** | | **51** | **Avg: 6.4/batch** | **9 critical** | **~37 min** |

### Optimization Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Batches | 20 | 8 | **60% fewer** |
| Avg Tasks/Batch | 2.4 | 6.4 | **2.7x denser** |
| Max Parallelism Used | 5/10 | 10/10 | **2x utilization** |
| Critical Path Length | 12 | 9 | **25% shorter** |
| Parallelism Factor | 3.9x | 5.7x | **46% better** |
| Estimated Wall-Clock | ~45 min | ~37 min | **18% faster** |

### Parallel Execution Windows

```
Time →
├─ B1: Setup (2) ─────────────────────────────────────────────────────────┤
├─ B2: Types+UI (10) ─────────────────────────────────────────────────────┤
├─ B3: Worker+Components (10) ────────────────────────────────────────────┤
├─ B4: Interfaces (10) ───────────────────────────────────────────────────┤
├─ B5: Hook+Integration (8) ──────────────────────────────────────────────┤
├─ B6: PreviewPane (7) ───────────────────────────────────────────────────┤
├─ B7: Polish (2) ────────────────────────────────────────────────────────┤
├─ B8: Verify (2) ────────────────────────────────────────────────────────┤
```

---

## Dependencies

### Critical Path (Shortest Possible)

```
T001 → T003 → T006 → T007 → T009 → T014 → T043 → T050 → T051
  ↑      ↑      ↑      ↑      ↑      ↑      ↑      ↑      ↑
Setup  Types  Worker  Intfc  Hook   Pane  Export Build  Test
```

**Bottleneck**: T006 (Web Worker) is complex but unblocks massive parallelism in Batch 4.

### Batch Dependency Graph

```
Batch 1 (Setup)
    ↓
Batch 2 (Types + Independent UI) ← 10 parallel, no inter-deps
    ↓
Batch 3 (Worker + Components) ← 10 parallel, types required
    ↓
Batch 4 (Interfaces) ← 10 parallel, worker/components required
    ↓
Batch 5 (Hook + Integration) ← hook needs interface
    ↓
Batch 6 (PreviewPane) ← main container needs hook
    ↓
Batch 7 (Polish) ← validation
    ↓
Batch 8 (Verify) ← final gate
```

---

## Recovery Playbook

### Partial Batch Failure

1. Check gate output for specific failures
2. Fix failing task(s) individually
3. Re-run only failed tasks (not entire batch)
4. Re-run gate validation

### Gate Validation Failure

Common causes:
- Type errors → `pnpm tsc --noEmit <file>`
- Missing file → task didn't create expected output
- Import errors → check export/import paths

### Subagent Timeout

If a task exceeds 15min timeout:
1. Check task complexity
2. Split into subtasks if needed
3. Re-dispatch with extended timeout

---

## Task Reference

### Quick Lookup by User Story

| User Story | Tasks | Batch |
|------------|-------|-------|
| US1: Live Preview | T009,T010,T011,T012,T013,T014,T015,T016 | 2,3,4,5,6 |
| US2: Error Display | T017,T018,T019,T020 | 2,3,5 |
| US3: Components | T021-T030 | 2,3,4 |
| US4: Frontmatter | T031,T032 | 4 |
| US5: Scroll Sync | T033,T034,T035 | 4,5,6 |
| US6: Theme Sync | T036,T037,T038,T039 | 2,4,5 |

### Quick Lookup by File

| File | Tasks |
|------|-------|
| `src/shared/types/preview-worker.ts` | T003 |
| `src/shared/types/preview-iframe.ts` | T004 |
| `src/shared/schemas/preview.ts` | T005 |
| `src/renderer/workers/mdx-compiler.worker.ts` | T006,T031 |
| `src/renderer/lib/mdx/compiler.ts` | T007 |
| `src/renderer/stores/preview-store.ts` | T008 |
| `src/renderer/hooks/usePreview.ts` | T009 |
| `src/preview-frame/index.html` | T010 |
| `src/preview-frame/renderer.tsx` | T011,T030,T032,T033,T037,T041 |
| `src/renderer/components/preview/PreviewFrame.tsx` | T012,T034,T038,T042 |
| `src/renderer/components/preview/LoadingIndicator.tsx` | T013 |
| `src/renderer/components/preview/PreviewPane.tsx` | T014,T016,T019,T020,T035,T039 |
| `src/renderer/components/preview/index.ts` | T015,T043 |
| `src/renderer/components/preview/ErrorDisplay.tsx` | T017 |
| `src/preview-frame/components/*.tsx` | T021-T027,T040 |
| `src/preview-frame/components/index.ts` | T028 |
| `src/renderer/styles/preview/*.css` | T018,T023,T029,T036,T044 |

---

## Notes

- **Batches 2-4 run at FULL 10-slot capacity** — maximum parallelism
- **Tasks are numbered by original ID** for traceability to spec/plan
- **New tasks T048-T051** added for security verification and final validation
- Commit after each gate passes: `git commit -m "feat(preview): batch N complete"`
- Constitution compliance verified in plan.md and enforced in gates
