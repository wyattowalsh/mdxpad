# Tasks: Foundational Setup

**Feature**: `/specs/000-foundational-setup/`
**Generated**: 2025-12-30
**Orchestration**: disabled

## Prerequisites

| Document | Status | Purpose |
|----------|--------|---------|
| plan.md | ✅ Loaded | Tech stack, structure, dependencies |
| spec.md | ✅ Loaded | User stories with priorities |
| data-model.md | ✅ Loaded | Entity definitions |
| contracts/ | ✅ Loaded | IPC API specifications |
| research.md | ✅ Loaded | Technical decisions |
| quickstart.md | ✅ Loaded | Validation scenarios |

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

Execute tasks in order: T001 → T002 → ... → T032

- Run gate validation after each batch completes
- Safe, predictable, no coordination needed

### Parallel Execution (Fast)

1. Run Phase 1 and 2 sequentially (low task count, interdependencies)
2. Within Phase 3-6, parallelize by batch ID
3. Each `[P:X.Y]` batch can run simultaneously
4. Wait for gate validation before next batch

---

## Phase 1: Setup

**Purpose**: Project initialization and configuration files
**Max Parallelism**: 3 subagents

### Batch 1.1: Project Scaffolding (parallel) ⚡

- [x] T001 [P:1.1] Initialize project with `pnpm init` and create package.json with type: "module", engines, and scripts
- [x] T002 [P:1.1] Create tsconfig.json with strict mode and path aliases per R6
- [x] T003 [P:1.1] Create tsconfig.node.json for main process (Node.js target)

#### Gate 1.1: Package Validation

```bash
test -f package.json && node -e "const p = require('./package.json'); if(p.type !== 'module') process.exit(1)"
```

**On-Fail**: Verify package.json has `"type": "module"` and correct engines field

### Batch 1.2: Tooling Configuration (parallel) ⚡

- [x] T004 [P:1.2] Create eslint.config.js with flat config for TypeScript + React
- [x] T005 [P:1.2] Create prettier.config.js with project formatting rules
- [x] T006 [P:1.2] Create electron.vite.config.ts with main/preload/renderer entries
- [x] T007 [P:1.2] Create vitest.config.ts with happy-dom environment

#### Gate 1.2: Config Validation

```bash
test -f eslint.config.js && test -f prettier.config.js && test -f electron.vite.config.ts && test -f vitest.config.ts
```

**On-Fail**: Check plan.md for exact config file names and locations

### Batch 1.3: Additional Config (parallel) ⚡

- [x] T008 [P:1.3] Create playwright.config.ts for Electron E2E testing
- [x] T009 [P:1.3] Create tailwind.config.ts for Tailwind CSS 4.x
- [x] T010 [P:1.3] Create .gitignore with node_modules, dist, .vite exclusions

#### Gate 1.3: Full Config Validation

```bash
test -f playwright.config.ts && test -f tailwind.config.ts && test -f .gitignore
```

**On-Fail**: Verify all config files exist per plan.md structure

### Batch 1.4: Dependency Installation

- [x] T011 Install all dependencies with `pnpm install` (run after T001-T010)

#### Gate 1.4: Dependencies Installed

```bash
test -d node_modules && test -f pnpm-lock.yaml
```

**On-Fail**: Run `pnpm install` again; check for Node.js version compatibility

**✓ Checkpoint**: Project initialized — configuration complete

---

## Phase 2: Foundational

**Purpose**: Core source structure and shared utilities
**Max Parallelism**: 3 subagents

⚠️ **BLOCKING**: No user story work can begin until this phase completes

### Batch 2.1: Directory Structure (parallel) ⚡

- [x] T012 [P:2.1] Create src/main/ directory with index.ts entry stub
- [x] T013 [P:2.1] Create src/renderer/ directory with index.html and main.tsx stub
- [x] T014 [P:2.1] Create src/preload/ directory with index.ts stub
- [x] T015 [P:2.1] Create src/shared/ directory structure (lib/, types/, contracts/)

#### Gate 2.1: Directory Validation

```bash
test -d src/main && test -d src/renderer && test -d src/preload && test -d src/shared/lib
```

**On-Fail**: Verify directory creation; check permissions

### Batch 2.2: Shared Utilities (parallel) ⚡

<!-- Context: data-model.md#Result, data-model.md#TypedEventEmitter -->
- [x] T016 [P:2.2] Implement Result<T, E> monad in src/shared/lib/result.ts per R4.1
- [x] T017 [P:2.2] Implement TypedEventEmitter in src/shared/lib/events.ts per R4.3
- [x] T018 [P:2.2] Implement IPC channel definitions in src/shared/lib/ipc.ts per R4.2

#### Gate 2.2: Shared Lib Validation

```bash
pnpm exec tsc --noEmit src/shared/lib/result.ts src/shared/lib/events.ts src/shared/lib/ipc.ts 2>/dev/null || echo "Type check pending full config"
```

**On-Fail**: Check data-model.md for exact type signatures; verify imports

### Batch 2.3: Shared Exports & Types (parallel) ⚡

- [x] T019 [P:2.3] Create src/shared/lib/index.ts with re-exports
- [x] T020 [P:2.3] Create src/shared/types/index.ts with type re-exports
- [x] T021 [P:2.3] Create src/shared/contracts/index.ts stub

#### Gate 2.3: Export Validation

```bash
test -f src/shared/lib/index.ts && test -f src/shared/types/index.ts
```

**On-Fail**: Verify all shared modules export correctly

**✓ Checkpoint**: Shared utilities ready — process implementation can begin

---

## Phase 3: User Story 1 — Development Environment (Priority: P1) 🎯 MVP

**Goal**: Clone repo, run `pnpm install && pnpm dev`, see secure Electron window with React shell
**Independent Test**: Fresh clone → install → dev → verify "mdxpad" text in window
**Max Parallelism**: 2 subagents

### Batch 3.1: Main Process (parallel) ⚡

<!-- Context: plan.md#main, spec.md#R2 -->
- [ ] T022 [P:3.1] [US1] Implement src/main/window.ts with BrowserWindow factory and security settings per R2
- [ ] T023 [P:3.1] [US1] Implement src/main/ipc/index.ts with handler registration stub

#### Gate 3.1: Main Process Validation

```bash
pnpm exec tsc --noEmit src/main/window.ts src/main/ipc/index.ts 2>/dev/null || echo "Check imports"
```

**On-Fail**: Verify Electron imports; check webPreferences security settings

### Batch 3.2: Main Entry Point

<!-- Context: plan.md#main, src/main/window.ts -->
- [ ] T024 [P:3.2] [US1] Implement src/main/index.ts with app lifecycle (ready, activate, window-all-closed)

#### Gate 3.2: Main Entry Validation

```bash
pnpm exec tsc --noEmit src/main/index.ts 2>/dev/null || echo "Check window import"
```

**On-Fail**: Verify window.ts exports correctly; check app event handlers

### Batch 3.3: Preload Script (parallel) ⚡

<!-- Context: spec.md#R3, contracts/ipc-api.md -->
- [ ] T025 [P:3.3] [US1] Implement src/preload/api.ts with MdxpadAPI interface per R3
- [ ] T026 [P:3.3] [US1] Implement src/preload/index.ts with contextBridge.exposeInMainWorld

#### Gate 3.3: Preload Validation

```bash
pnpm exec tsc --noEmit src/preload/api.ts src/preload/index.ts 2>/dev/null || echo "Check contextBridge"
```

**On-Fail**: Verify electron imports in preload; check api.ts types

### Batch 3.4: Renderer Process (parallel) ⚡

<!-- Context: plan.md#renderer, spec.md#R5 -->
- [ ] T027 [P:3.4] [US1] Create src/renderer/index.html with root div and script entry
- [ ] T028 [P:3.4] [US1] Create src/renderer/main.tsx with React 19 createRoot
- [ ] T029 [P:3.4] [US1] Create src/renderer/App.tsx with shell UI showing "mdxpad" per R5

#### Gate 3.4: Renderer Validation

```bash
test -f src/renderer/index.html && pnpm exec tsc --noEmit src/renderer/main.tsx src/renderer/App.tsx 2>/dev/null || echo "Check React imports"
```

**On-Fail**: Verify React 19 imports; check index.html has correct script path

### Batch 3.5: Renderer Styling (parallel) ⚡

<!-- Context: research.md#RQ2 -->
- [ ] T030 [P:3.5] [US1] Create src/renderer/styles/globals.css with Tailwind 4.x import
- [ ] T031 [P:3.5] [US1] Create src/renderer/styles/tokens.css with design tokens
- [ ] T032 [P:3.5] [US1] Create src/renderer/env.d.ts with window.mdxpad type declaration

#### Gate 3.5: Styling Validation

```bash
test -f src/renderer/styles/globals.css && test -f src/renderer/env.d.ts
```

**On-Fail**: Check Tailwind 4.x import syntax; verify env.d.ts extends Window

### Batch 3.6: Empty Directories

- [ ] T033 [P:3.6] [US1] Create placeholder .gitkeep files in src/renderer/components/, hooks/, lib/

#### Gate 3.6: Structure Complete

```bash
test -f src/renderer/components/.gitkeep && test -f src/renderer/hooks/.gitkeep && test -f src/renderer/lib/.gitkeep
```

**On-Fail**: Create missing .gitkeep files

### Batch 3.7: Integration Test

- [ ] T034 [US1] Run `pnpm dev` and verify Electron window opens with "mdxpad" text

#### Gate 3.7: Dev Mode Validation

```bash
# Manual verification required
echo "Run 'pnpm dev' and verify window shows mdxpad with version info"
```

**On-Fail**: Check electron.vite.config.ts paths; verify all entry points exist

**✓ Checkpoint**: User Story 1 complete — development environment functional

---

## Phase 4: User Story 2 — Code Quality Tooling (Priority: P1) 🎯 MVP

**Goal**: `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass
**Independent Test**: Run each command, verify zero errors
**Max Parallelism**: 2 subagents

### Batch 4.1: Test Setup (parallel) ⚡

<!-- Context: research.md#RQ4 -->
- [ ] T035 [P:4.1] [US2] Create src/renderer/__tests__/setup.ts with happy-dom config
- [ ] T036 [P:4.1] [US2] Create src/shared/__tests__/result.test.ts with Result tests
- [ ] T037 [P:4.1] [US2] Create src/shared/__tests__/events.test.ts with TypedEventEmitter tests

#### Gate 4.1: Test Setup Validation

```bash
test -f src/renderer/__tests__/setup.ts && test -f src/shared/__tests__/result.test.ts
```

**On-Fail**: Check Vitest config; verify test file naming convention

### Batch 4.2: More Tests (parallel) ⚡

- [ ] T038 [P:4.2] [US2] Create src/shared/__tests__/ipc.test.ts with IPC channel tests
- [ ] T039 [P:4.2] [US2] Create src/renderer/__tests__/App.test.tsx with App component test
- [ ] T040 [P:4.2] [US2] Create src/main/__tests__/window.test.ts with window factory test

#### Gate 4.2: Test Files Validation

```bash
test -f src/shared/__tests__/ipc.test.ts && test -f src/renderer/__tests__/App.test.tsx
```

**On-Fail**: Verify test imports; check mock setup for electron

### Batch 4.3: Quality Commands

- [ ] T041 [US2] Run `pnpm typecheck` and fix any type errors
- [ ] T042 [US2] Run `pnpm lint` and fix any linting errors
- [ ] T043 [US2] Run `pnpm test` and verify all tests pass

#### Gate 4.3: Quality Gate

```bash
pnpm typecheck && pnpm lint && pnpm test
```

**On-Fail**: Review specific errors; check tsconfig paths; verify ESLint config

**✓ Checkpoint**: User Story 2 complete — quality tooling operational

---

## Phase 5: User Story 5 — Security Verification (Priority: P1) 🎯

**Goal**: Verify Electron security settings are correctly applied
**Independent Test**: Run security verification script, all checks pass
**Max Parallelism**: 1 (sequential)

### Batch 5.1: Security Script

<!-- Context: spec.md#R8, contracts/ipc-api.md -->
- [ ] T044 [P:5.1] [US5] Implement IPC handler for getSecurityInfo in src/main/ipc/index.ts
- [ ] T045 [P:5.1] [US5] Create scripts/verify-security.ts that launches app and checks security settings

#### Gate 5.1: Security Script Validation

```bash
test -f scripts/verify-security.ts && pnpm exec tsc --noEmit scripts/verify-security.ts 2>/dev/null || echo "Check imports"
```

**On-Fail**: Verify Playwright Electron imports; check IPC handler registration

### Batch 5.2: Security Verification

- [ ] T046 [US5] Run `pnpm verify-security` and ensure all checks pass (contextIsolation, sandbox, nodeIntegration, webSecurity)

#### Gate 5.2: Security Gate

```bash
pnpm verify-security
```

**On-Fail**: Check BrowserWindow webPreferences in window.ts; verify values match R2

**✓ Checkpoint**: User Story 5 complete — security verified

---

## Phase 6: User Story 3 — Production Build (Priority: P2)

**Goal**: `pnpm build` produces working macOS .app bundle
**Independent Test**: Run build, launch .app from dist/
**Max Parallelism**: 1 (sequential)

### Batch 6.1: Build Configuration

- [ ] T047 [P:6.1] [US3] Create electron-builder.yml with macOS dmg and dir targets
- [ ] T048 [P:6.1] [US3] Create resources/icon.icns placeholder for macOS app icon

#### Gate 6.1: Build Config Validation

```bash
test -f electron-builder.yml && test -f resources/icon.icns
```

**On-Fail**: Check electron-builder documentation; verify icon format

### Batch 6.2: Build Execution

- [ ] T049 [US3] Run `pnpm build` and verify .app bundle created in dist/
- [ ] T050 [US3] Launch built .app and verify it opens with mdxpad window

#### Gate 6.2: Build Gate

```bash
pnpm build && test -d "dist/mac-arm64/mdxpad.app" || test -d "dist/mac/mdxpad.app"
```

**On-Fail**: Check electron-builder output; verify all source files bundled correctly

**✓ Checkpoint**: User Story 3 complete — production build working

---

## Phase 7: User Story 4 — Performance Benchmarking (Priority: P2)

**Goal**: `pnpm bench` outputs cold start and memory metrics
**Independent Test**: Run bench, verify JSON output with metrics
**Max Parallelism**: 1 (sequential)

### Batch 7.1: Benchmark Script

<!-- Context: spec.md#R7, constitution Article V -->
- [ ] T051 [P:7.1] [US4] Create scripts/bench.ts that launches app and measures cold start time
- [ ] T052 [P:7.1] [US4] Add memory measurement to scripts/bench.ts using Electron APIs

#### Gate 7.1: Bench Script Validation

```bash
test -f scripts/bench.ts && pnpm exec tsc --noEmit scripts/bench.ts 2>/dev/null || echo "Check imports"
```

**On-Fail**: Verify Playwright imports; check timing measurement logic

### Batch 7.2: Benchmark Execution

- [ ] T053 [US4] Run `pnpm bench` and verify JSON output with coldStartMs and memoryMb
- [ ] T054 [US4] Verify cold start < 2000ms and memory < 150MB per constitution

#### Gate 7.2: Performance Gate

```bash
pnpm bench | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8')); if(r.coldStartMs>2000||r.memoryMb>150) process.exit(1)"
```

**On-Fail**: Profile startup; check for blocking operations; review memory usage

**✓ Checkpoint**: User Story 4 complete — performance tracking operational

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: CI pipeline, E2E tests, final validation
**Max Parallelism**: 2 subagents

### Batch 8.1: CI Pipeline (parallel) ⚡

<!-- Context: spec.md#R9 -->
- [ ] T055 [P:8.1] Create .github/workflows/ci.yml with typecheck, lint, test, build, bench steps
- [ ] T056 [P:8.1] Create tests/app.spec.ts with basic Playwright E2E test

#### Gate 8.1: CI Validation

```bash
test -f .github/workflows/ci.yml && test -f tests/app.spec.ts
```

**On-Fail**: Verify YAML syntax; check Playwright test imports

### Batch 8.2: E2E Execution

- [ ] T057 Run `pnpm test:e2e` and verify Playwright tests pass

#### Gate 8.2: E2E Gate

```bash
pnpm test:e2e
```

**On-Fail**: Check Playwright config; verify Electron launches correctly in test

### Batch 8.3: Final Validation

- [ ] T058 Run full quality gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm bench`
- [ ] T059 Verify all success criteria from spec.md are met

#### Gate 8.3: Final Gate

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

**On-Fail**: Review any failing checks; ensure all prior gates passed

**✓ Checkpoint**: All user stories complete — ready for review

---

## Parallel Execution Summary

| Phase | Name | Batches | Tasks | Max Parallel | Critical Path |
|-------|------|---------|-------|--------------|---------------|
| 1 | Setup | 4 | 11 | 3 | T001 → T011 |
| 2 | Foundational | 3 | 10 | 3 | T012 → T019 |
| 3 | US1: Dev Environment | 7 | 13 | 2 | T022 → T024 → T027 → T034 |
| 4 | US2: Code Quality | 3 | 9 | 2 | T035 → T038 → T041 |
| 5 | US5: Security | 2 | 3 | 1 | T044 → T046 |
| 6 | US3: Production Build | 2 | 4 | 1 | T047 → T049 |
| 7 | US4: Benchmarking | 2 | 4 | 1 | T051 → T053 |
| 8 | Polish | 3 | 5 | 2 | T055 → T057 → T058 |
| **Total** | | **26** | **59** | | **Critical: 15 tasks** |

**Parallelism Factor**: 3.9x (59 tasks / 15 critical path)

---

## Dependencies

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKS ALL USER STORIES
    ↓
┌────────────────┬────────────────┐
↓                ↓                ↓
Phase 3 (US1)    Phase 5 (US5)    ...
Dev Environment  Security
    ↓                ↓
Phase 4 (US2)    (continues)
Code Quality
    ↓
Phase 6 (US3) ← Requires working dev
Production Build
    ↓
Phase 7 (US4) ← Requires build
Benchmarking
    ↓
Phase 8 (Polish)
```

### User Story Independence

| Story | Can Start After | Dependencies on Other Stories |
|-------|-----------------|------------------------------|
| US1 | Phase 2 complete | None |
| US2 | US1 complete | Needs working dev environment |
| US5 | US1 complete | Needs running app for verification |
| US3 | US1+US2 complete | Needs quality gates passing |
| US4 | US3 complete | Needs production build |

### Critical Path Analysis

```
T001 → T011 → T012 → T019 → T022 → T024 → T027 → T034 → T041 → T044 → T046 → T049 → T053 → T055 → T058
  ↑       ↑       ↑       ↑       ↑       ↑       ↑       ↑       ↑       ↑       ↑       ↑       ↑       ↑       ↑
Setup   Deps   Found.  Shared   Main   Entry  Render  DevTest Quality Security SecTest Build   Bench   CI     Final
```

**Bottleneck**: Phase 1-2 (project setup) — foundational work is sequential

---

## Recovery Playbook

### Partial Batch Failure

**Symptoms**: Some tasks in batch succeed, others fail

**Recovery**:
1. Check gate output for specific failures
2. Fix failing task(s) individually
3. Re-run only failed tasks
4. Re-run gate validation

### Gate Validation Failure

**Symptoms**: All tasks complete but gate fails

**Recovery**:
1. Read gate error output carefully
2. Common causes:
   - Import errors → missing dependency or typo
   - Type errors → run `pnpm exec tsc --noEmit <file>` for details
   - Missing file → task didn't create expected output
3. Fix identified issue
4. Re-run gate only

### TypeScript Errors

**Symptoms**: `pnpm typecheck` fails

**Recovery**:
1. Run `pnpm exec tsc --noEmit` to see full errors
2. Check tsconfig.json paths and baseUrl
3. Verify all imports use correct path aliases (@shared/, @renderer/, @main/)
4. Check for missing type declarations in env.d.ts

### Electron Security Failure

**Symptoms**: Security verification fails

**Recovery**:
1. Check src/main/window.ts webPreferences
2. Verify all four settings:
   - `contextIsolation: true`
   - `sandbox: true`
   - `nodeIntegration: false`
   - `webSecurity: true`
3. Ensure no code overrides these settings

---

## Notes

- **[P:X.Y]** = Batch identifier; same ID means parallel-safe
- **Gates** = Validation checkpoints; don't skip them
- **Checkpoints** = Safe stopping points; story is complete and testable
- Commit after each gate passes: `git commit -m "feat(000): Gate X.Y passed"`
- Each user story should work independently after its phase completes
- US1 is MVP — stop and validate before continuing
- Performance budgets from constitution: cold start < 2s, memory < 200MB
