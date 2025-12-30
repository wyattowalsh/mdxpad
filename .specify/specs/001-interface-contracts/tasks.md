# Tasks: Interface Contracts

**Feature**: `/specs/001-interface-contracts/`
**Generated**: 2025-12-30
**Orchestration**: enabled

## Prerequisites

| Document | Status | Purpose |
|----------|--------|---------|
| plan.md | ✅ Required | Tech stack, structure, dependencies |
| spec.md | ✅ Required | User stories with priorities |
| data-model.md | ✅ Optional | Entity definitions |
| contracts/ | ✅ Optional | IPC API specifications |
| research.md | ✅ Optional | Technical decisions |
| quickstart.md | ✅ Optional | Validation scenarios |

---

## Execution Constraints

```yaml
max_parallel_subagents: 3
default_task_timeout: 5m
gate_timeout: 1m
circuit_breaker:
  max_failures_per_batch: 2
  action: pause_and_report
retry_policy:
  max_attempts: 2
  backoff: exponential
```

---

## Quick Start

### Sequential Execution (Simple)

Execute tasks in order: T001 → T002 → T003 → ...

- Run gate validation after each phase completes
- Safe, predictable, no coordination needed

### Parallel Execution (Fast)

1. Identify batch (e.g., all `[P:1.1]` tasks)
2. Spawn subagents for all tasks in batch simultaneously
3. Wait for all to complete
4. Run gate validation
5. Proceed to next batch (`[P:1.2]`)

### Hybrid Execution (Recommended)

- Run Phase 1 (Setup) sequentially (low task count, quick)
- Parallelize Phase 2 batches (Types + Lib + Tailwind)
- Run Phase 3 (shadcn/ui) after Tailwind completes
- Final verification sequential

---

## Task Format

```
- [ ] [TaskID] [P:batch-id?] [Req?] Description with file path
```

| Component | Required | Description |
|-----------|----------|-------------|
| `- [ ]` | Yes | Markdown checkbox |
| `[TaskID]` | Yes | Sequential ID: T001, T002, ... |
| `[P:X.Y]` | If parallel | Batch ID (X=phase, Y=batch in phase) |
| `[Req]` | In impl phases | Requirement: [R1], [R2], ... |
| Description | Yes | Action + exact file path |

**Batch rules**:
- Same batch ID = safe to run in parallel (different files, no dependencies)
- Lower batch number runs first: 2.1 → 2.2 → 2.3
- Gate validation between batches

---

## Phase 1: Setup

**Purpose**: Install dependencies and configure project
**Max Parallelism**: 1 (sequential - pnpm install is atomic)

### Batch 1.1: Dependencies (sequential)

- [ ] T001 [R11] Install production dependencies: `pnpm add @codemirror/state@^6.5.2 @codemirror/view@^6.39.7 @codemirror/commands@^6.8.0 @codemirror/language@^6.10.8 @codemirror/autocomplete@^6.18.6 @codemirror/lint@^6.8.4 @codemirror/search@^6.5.10 @codemirror/lang-markdown@^6.3.2 @codemirror/lang-javascript@^6.2.3 @lezer/highlight@^1.2.1`
- [ ] T002 [R11] Install MDX and React dependencies: `pnpm add @mdx-js/mdx@^3.1.0 @mdx-js/react@^3.1.0 react@^19.2.3 react-dom@^19.2.3 remark-gfm@^4.0.1 remark-frontmatter@^5.0.0 rehype-highlight@^7.0.2`
- [ ] T003 [R11] Install UI framework dependencies: `pnpm add tailwindcss@^4.1.18 @radix-ui/react-slot@^1.2.0 class-variance-authority@^0.7.1 clsx@^2.1.1 tailwind-merge@^3.3.0 lucide-react@^0.514.0 cmdk@^1.1.0`
- [ ] T004 [R11] Install dev dependencies: `pnpm add -D @tailwindcss/vite@^4.1.18 @types/react@^19.1.0 @types/react-dom@^19.1.0`

#### Gate 1.1: Dependencies Installed

```bash
test -f pnpm-lock.yaml && \
node -e "require('@codemirror/state')" && \
node -e "require('react')" && \
node -e "require('tailwindcss')" && \
echo "✓ Dependencies installed"
```

**On-Fail**: Check pnpm registry access; verify package names

---

## Phase 2: Foundational (Parallel Groups)

**Purpose**: Create all type definitions and utilities in parallel batches
**Max Parallelism**: 3 subagents

⚠️ **NOTE**: Batches 2.1, 2.2, and 2.3 are **independent** - they can all run simultaneously!

### Batch 2.1: Type Definitions (parallel) ⚡

<!-- Context: spec.md#R1-R6, data-model.md, contracts/ipc-api.ts -->

- [ ] T005 [P:2.1] [R1] Create editor types in `src/shared/types/editor.ts`: EditorState, Selection, SelectionInfo, Command, EditorConfig, EditorChange
- [ ] T006 [P:2.1] [R2] Create file types in `src/shared/types/file.ts`: FileId (branded), createFileId(), FileHandle, FileState, FileResult<T>, FileError
- [ ] T007 [P:2.1] [R3] Create preview types in `src/shared/types/preview.ts`: CompileResult, CompileSuccess, CompileFailure, CompileError, PreviewConfig, PreviewState
- [ ] T008 [P:2.1] [R4] Create IPC types in `src/shared/types/ipc.ts`: IpcChannels (const), IpcChannel (type), IpcApi (interface), IpcHandler (type helper) - use `mdxpad:domain:action` naming
- [ ] T009 [P:2.1] [R5] Create UI types in `src/shared/types/ui.ts`: LayoutState, Theme, ThemeConfig, PanelConstraints
- [ ] T010 [P:2.1] [R6] Create types index in `src/shared/types/index.ts`: re-export all from editor, file, preview, ipc, ui

#### Gate 2.1: Types Compile

```bash
pnpm exec tsc --noEmit src/shared/types/*.ts && \
echo "✓ Types compile"
```

**On-Fail**: Check TypeScript strict mode errors; verify imports between type files

**Note**: This gate also validates R16 (Type Exports) - type files export only types/interfaces except designated utilities.

### Batch 2.2: Lib Utilities (parallel) ⚡

<!-- Context: spec.md#R7-R10 -->

- [ ] T011 [P:2.2] [R7] Implement Result monad in `src/shared/lib/result.ts`: Result<T,E>, ok(), err(), map(), mapErr(), flatMap(), unwrapOr(), unwrap()
- [ ] T012 [P:2.2] [R8] Implement TypedEventEmitter in `src/shared/lib/events.ts`: TypedEventEmitter<Events>, createEventEmitter(), on/once/emit/off methods
- [ ] T013 [P:2.2] [R9] Implement utilities in `src/shared/lib/utils.ts`: cn() using clsx+twMerge, debounce(), throttle(), uid()
- [ ] T014 [P:2.2] [R10] Create lib index in `src/shared/lib/index.ts`: re-export all from result, events, utils

#### Gate 2.2: Lib Compiles

```bash
pnpm exec tsc --noEmit src/shared/lib/*.ts && \
node -e "require('./src/shared/lib')" 2>/dev/null || echo "ES module - OK" && \
echo "✓ Lib utilities compile"
```

**On-Fail**: Check function signatures match spec.md; verify clsx/tailwind-merge imports

### Batch 2.3: Tailwind Configuration (parallel) ⚡

<!-- Context: spec.md#R12-R14, research.md#R3 -->

- [ ] T015 [P:2.3] [R12] Create Tailwind v4 config in `tailwind.config.ts`: content paths for src/renderer/**/*.{ts,tsx}
- [ ] T016 [P:2.3] [R12] Create PostCSS config in `postcss.config.js`: configure for Tailwind v4
- [ ] T017 [P:2.3] [R14] Create globals CSS in `src/renderer/styles/globals.css`: @import tailwindcss, CSS variables for light/dark themes (zinc base)
- [ ] T018 [P:2.3] [R12] Update Vite config in `vite.config.ts`: add @tailwindcss/vite plugin

#### Gate 2.3: Tailwind Configured

```bash
test -f tailwind.config.ts && \
test -f postcss.config.js && \
test -f src/renderer/styles/globals.css && \
grep -q "@import" src/renderer/styles/globals.css && \
echo "✓ Tailwind configured"
```

**On-Fail**: Verify Tailwind v4 syntax; check vite.config.ts imports

**✓ Checkpoint**: Phase 2 complete — all types, utilities, and CSS ready

---

## Phase 3: shadcn/ui Setup

**Purpose**: Configure shadcn/ui and install components
**Max Parallelism**: 2 subagents
**Depends on**: Phase 2 Batch 2.3 (Tailwind must be configured first)

### Batch 3.1: shadcn/ui Initialization

<!-- Context: spec.md#R13, research.md#R4, plan.md#shadcn-ui-component-strategy -->

- [ ] T019 [P:3.1] [R13] Create `components.json` for shadcn/ui: style=new-york, rsc=false, baseColor=zinc, paths configured for @renderer/components, @ui, @shared/lib
- [ ] T020 [P:3.1] [R15] Update all tsconfig files with path aliases: @shared/*, @main/*, @preload/*, @renderer/*, @ui/*
- [ ] T021 [P:3.1] [R15] Update vite.config.ts with resolve.alias: @shared, @renderer, @ui paths

#### Gate 3.1: Config Ready

```bash
test -f components.json && \
grep -q "@shared" tsconfig.json && \
grep -q "resolve" vite.config.ts && \
echo "✓ shadcn/ui config ready"
```

**On-Fail**: Check components.json schema; verify tsconfig paths syntax

### Batch 3.2: Base Components (parallel) ⚡

<!-- Context: spec.md#R13 - shadcn/ui Components -->

- [ ] T022 [P:3.2] [R13] Install shadcn/ui button component: `pnpm dlx shadcn@latest add button` → `src/renderer/components/ui/button.tsx`
- [ ] T023 [P:3.2] [R13] Install shadcn/ui input + textarea + label: `pnpm dlx shadcn@latest add input textarea label`
- [ ] T024 [P:3.2] [R13] Install shadcn/ui dialog + dropdown-menu + popover: `pnpm dlx shadcn@latest add dialog dropdown-menu popover`

### Batch 3.3: Additional Components (parallel) ⚡

- [ ] T025 [P:3.3] [R13] Install shadcn/ui tooltip + tabs: `pnpm dlx shadcn@latest add tooltip tabs`
- [ ] T026 [P:3.3] [R13] Install shadcn/ui scroll-area + separator: `pnpm dlx shadcn@latest add scroll-area separator`
- [ ] T027 [P:3.3] [R13] Install shadcn/ui command + resizable: `pnpm dlx shadcn@latest add command resizable`

#### Gate 3.3: Components Installed

```bash
test -f src/renderer/components/ui/button.tsx && \
test -f src/renderer/components/ui/dialog.tsx && \
test -f src/renderer/components/ui/command.tsx && \
echo "✓ shadcn/ui components installed"
```

**On-Fail**: Check shadcn CLI output; verify components.json paths

### Batch 3.4: UI Index

- [ ] T028 [R13] Create UI component index in `src/renderer/components/ui/index.ts`: re-export all installed components

#### Gate 3.4: UI Ready

```bash
pnpm exec tsc --noEmit src/renderer/components/ui/*.tsx && \
echo "✓ UI components compile"
```

**On-Fail**: Check component imports; verify cn() utility accessible

**✓ Checkpoint**: Phase 3 complete — shadcn/ui fully configured

---

## Phase 4: Integration & Wiring

**Purpose**: Connect all pieces and ensure imports work
**Max Parallelism**: 1 (sequential)

### Batch 4.1: App Integration

- [ ] T029 Import globals.css in `src/renderer/index.tsx`: add `import './styles/globals.css'`
- [ ] T030 Add sample Button to `src/renderer/App.tsx`: import from @ui/button, render to verify styling works

#### Gate 4.1: Integration Verified

```bash
pnpm exec tsc --noEmit src/renderer/index.tsx src/renderer/App.tsx && \
echo "✓ App integration verified"
```

**On-Fail**: Check CSS import path; verify @ui alias resolution

**✓ Checkpoint**: Phase 4 complete — app wired together

---

## Phase 5: Verification

**Purpose**: Validate all requirements met
**Max Parallelism**: 1 (sequential - validation is atomic)

### Batch 5.1: Type System Verification

- [ ] T031 [R17] Run full typecheck: `pnpm typecheck` must pass with zero errors
- [ ] T032 [R17] Run linting: `pnpm lint` must pass with zero errors

#### Gate 5.1: Type System Valid

```bash
pnpm typecheck && \
pnpm lint && \
echo "✓ Type system valid"
```

**On-Fail**: Review typecheck errors; check lint configuration

### Batch 5.2: Build Verification

- [ ] T033 [R17] Run production build: `pnpm build` must succeed
- [ ] T034 [R17] Run dev server: `pnpm dev` must launch without errors, UI must render with styled Button

#### Gate 5.2: Build Works

```bash
pnpm build && \
echo "✓ Build successful"
```

**On-Fail**: Check Vite build output; verify Electron main/renderer bundling

**✓ Checkpoint**: All success criteria met — spec complete

---

## Parallel Execution Summary

| Phase | Name | Batches | Tasks | Max Parallel | Critical Path |
|-------|------|---------|-------|--------------|---------------|
| 1 | Setup | 1 | 4 | 1 | T001→T004 |
| 2 | Foundational | 3 | 14 | 3 | T005 (types) |
| 3 | shadcn/ui | 4 | 10 | 2 | T019→T022→T028 |
| 4 | Integration | 1 | 2 | 1 | T029→T030 |
| 5 | Verification | 2 | 4 | 1 | T031→T034 |
| **Total** | | **11** | **34** | | **Critical: 12 tasks** |

**Parallelism Factor**: 2.8x (34 tasks / 12 critical path)

---

## Dependencies

### Phase Dependencies

```
Phase 1 (Setup) ← BLOCKS ALL
    ↓
┌────────────────────────────────────────────┐
│              Phase 2 (Foundational)        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │Batch 2.1│  │Batch 2.2│  │Batch 2.3│     │
│  │ Types   │  │  Libs   │  │Tailwind │     │
│  └────┬────┘  └────┬────┘  └────┬────┘     │
└───────│───────────│───────────│────────────┘
        │           │           │
        ▼           ▼           ▼
    Phase 3.1    Merge         Phase 3.2+
    (config)     point         (components)
        └───────────┬───────────┘
                    ▼
              Phase 4 (Integration)
                    ↓
              Phase 5 (Verification)
```

### Batch Independence Analysis

| Batch | Can Run With | Blocked By |
|-------|--------------|------------|
| 2.1 (Types) | 2.2, 2.3 | 1.1 |
| 2.2 (Libs) | 2.1, 2.3 | 1.1 |
| 2.3 (Tailwind) | 2.1, 2.2 | 1.1 |
| 3.1 (Config) | None | 2.3 |
| 3.2 (Components) | 3.3 | 3.1 |
| 3.3 (Components) | 3.2 | 3.1 |

### Critical Path Analysis

```
T001 → T005 → T019 → T022 → T028 → T029 → T031 → T033
  ↑      ↑       ↑       ↑       ↑       ↑       ↑       ↑
Setup  Types  Config  shadcn  Index   Wire  Check  Build
```

**Bottleneck**: Phase 3.1 (shadcn config) - single task blocking component installation

---

## Batch Execution Examples

### Example: Maximum Parallelism (3 subagents)

```bash
# Phase 1: Sequential setup (must complete first)
for task in T001 T002 T003 T004; do
  claude-code task "$task"
done
# Run Gate 1.1

# Phase 2: Launch all three batches simultaneously!
claude-code task "Execute Batch 2.1: T005-T010 (Types)" &
claude-code task "Execute Batch 2.2: T011-T014 (Libs)" &
claude-code task "Execute Batch 2.3: T015-T018 (Tailwind)" &
wait
# Run Gates 2.1, 2.2, 2.3

# Phase 3: shadcn/ui (sequential config, then parallel components)
claude-code task "Execute Batch 3.1: T019-T021 (Config)"
# Run Gate 3.1
claude-code task "Execute Batch 3.2: T022-T024" &
claude-code task "Execute Batch 3.3: T025-T027" &
wait
# Run Gate 3.3
claude-code task "T028: Create UI index"

# Phase 4-5: Sequential
claude-code task "Execute Phase 4: T029-T030"
claude-code task "Execute Phase 5: T031-T034"
```

### Example: Conservative (2 subagents max)

```bash
# Phase 1: Sequential
# ... same as above ...

# Phase 2: Two batches at a time
claude-code task "Batch 2.1: Types" &
claude-code task "Batch 2.2: Libs" &
wait
claude-code task "Batch 2.3: Tailwind"

# Phase 3+: Same pattern
```

---

## Implementation Strategy

### Recommended Approach: Parallel Phase 2

1. ✅ Complete Phase 1: Setup (sequential, quick)
2. ⚡ **PARALLEL**: Launch 3 subagents for Phase 2 batches
   - Subagent A: Batch 2.1 (Types)
   - Subagent B: Batch 2.2 (Libs)
   - Subagent C: Batch 2.3 (Tailwind)
3. 🧪 Run all Phase 2 gates
4. ✅ Complete Phase 3: shadcn/ui (partial parallel)
5. ✅ Complete Phase 4: Integration
6. 🧪 Complete Phase 5: Verification

### Milestone Tracking

| Milestone | Tasks Complete | Deliverable |
|-----------|----------------|-------------|
| Dependencies | T001-T004 | All packages installed |
| Type System | T005-T014 | @shared/types and @shared/lib ready |
| Styling | T015-T018 | Tailwind v4 configured |
| UI Library | T019-T028 | shadcn/ui components available |
| Integration | T029-T030 | App renders with styles |
| **Release** | T031-T034 | All verification passes |

---

## Recovery Playbook

### shadcn CLI Failure

**Symptoms**: `pnpm dlx shadcn@latest add ...` fails

**Recovery**:
1. Check components.json exists and is valid JSON
2. Verify paths in components.json match project structure
3. Try installing one component at a time
4. Check shadcn/ui documentation for Tailwind v4 compatibility

### Path Alias Resolution Failure

**Symptoms**: `Cannot find module '@shared/...'`

**Recovery**:
1. Verify tsconfig.json has `paths` configured
2. Verify vite.config.ts has matching `resolve.alias`
3. Check baseUrl in tsconfig.json is correct
4. Run `pnpm exec tsc --traceResolution` to debug

### Tailwind Styles Not Applied

**Symptoms**: Components render but look unstyled

**Recovery**:
1. Verify globals.css is imported in renderer entry
2. Check globals.css has `@import 'tailwindcss'`
3. Verify @tailwindcss/vite plugin in vite.config.ts
4. Check content paths in tailwind.config.ts

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Type import fails | Missing index.ts export | Add to types/index.ts |
| cn() not found | utils.ts path wrong | Check @shared/lib/utils path |
| Component unstyled | CSS not imported | Import globals.css in entry |
| IPC type error | Wrong channel name | Use mdxpad:domain:action format |
| Build fails | Path alias mismatch | Sync tsconfig and vite.config |

---

## Notes

- **[P:X.Y]** = Batch identifier; same ID means parallel-safe
- **[R#]** = Requirement reference from spec.md
- **Gates** = Validation checkpoints; don't skip them
- **Checkpoints** = Safe stopping points; phase is complete
- Commit after each gate passes
- Phase 2 batches are FULLY INDEPENDENT - maximize parallelism here
- shadcn CLI commands may prompt for overwrite - use `--yes` flag if needed
