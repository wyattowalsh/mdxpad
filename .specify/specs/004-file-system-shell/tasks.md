# Tasks: File System Shell (Optimized)

**Feature**: `.specify/specs/004-file-system-shell/`
**Generated**: 2026-01-09
**Optimized**: 2026-01-09 (massive parallelization)
**Orchestration**: enabled

## Prerequisites

| Document | Status | Purpose |
|----------|--------|---------|
| plan.md | Required | Tech stack, structure, dependencies |
| spec.md | Required | User stories with priorities |
| data-model.md | Available | Entity definitions |
| contracts/ | Available | IPC schema specifications |
| research.md | Available | Technical decisions |
| quickstart.md | Available | Validation scenarios |

---

## Execution Constraints

```yaml
# Claude Code MAXIMUM POWER Config (Jan 2026 - Claude Max 20x)
# OPTIMIZED FOR MASSIVE PARALLELIZATION

model: opus-4.5
max_parallel_subagents: 10
queue_overflow: true

async_background:
  enabled: true
  hotkey: Ctrl+B
  wake_on_complete: true
  background_research: true

default_task_timeout: 10m
gate_timeout: 2m
subagent_timeout: 15m

circuit_breaker:
  max_failures_per_batch: 5
  action: pause_and_report
retry_policy:
  max_attempts: 3
  backoff: exponential

subagent_dispatch:
  strategy: greedy_queue
  refill_on_complete: true
  context_per_agent: 200k
  extended_thinking: true
  ultrathink: complex

batch_strategy:
  prefer_wider_batches: true
  merge_small_batches: true
  max_batch_size: 10
```

---

## Quick Start

### Parallel Execution (Recommended)

```
Batch 1.1 ──────────────────────────────────────────────────────►
   │ 9 parallel subagents (foundation)
   ▼
Batch 2.1 ──────────────────────────────────────────►
   │ 3 parallel subagents (handlers)
   ▼
Batch 2.2 ──────────────────────────────────────────►
   │ 1 subagent (registration)
   ▼
Batch 3.1 ──────────────────────────────────────────►
   │ 4 parallel subagents (integration)
   ▼
Batch 4.1 ──────────────────────────────────────────►
   │ 3 parallel subagents (tests)
   ▼
Batch 4.2 ──────────────────────────────────────────►
   │ 1 subagent (final validation)
   ▼
   DONE
```

**Critical Path**: 6 batches, 6 sequential tasks
**Parallelism Factor**: 3.5x (21 tasks / 6 critical)
**Estimated Time**: ~25 minutes with full parallelization

---

## Phase 1: Foundation

**Purpose**: Create ALL schemas, services, and utilities in one massive parallel batch
**Max Parallelism**: 9 subagents (uses greedy queue if >10)

### Batch 1.1: Complete Foundation (parallel)

<!-- Context: contracts/file-ipc-schemas.md, data-model.md, research.md -->

- [ ] T01 [P:1.1] [FR-010,FR-013,FR-015] Install dependencies: `pnpm add chokidar@5.0.0 electron-store@11.0.2 glob@11.0.0`

- [ ] T02 [P:1.1] [FR-001,FR-002,FR-007,FR-008,FR-009] Create complete zod schemas for ALL IPC channels in `src/shared/contracts/file-schemas.ts`:
  - FileIdSchema, FilePathSchema, FileContentSchema
  - FileHandleSchema, FileErrorSchema, FileResultSchema factory
  - All request/response schemas per contracts/file-ipc-schemas.md
  - IPC_SCHEMAS registry mapping channels to schemas
  - createValidatedHandler utility function

- [ ] T03 [P:1.1] [FR-001,FR-002] Update shared exports:
  - Export all schemas from `src/shared/contracts/index.ts`
  - Add all IPC channel constants to `src/shared/lib/ipc.ts` (mdxpad:file:*, mdxpad:window:*, mdxpad:app:*)

- [ ] T04 [P:1.1] [FR-003,FR-004,FR-005,FR-006,FR-007,FR-008,FR-017] Create FileService with ALL file operations in `src/main/services/file-service.ts`:
  - readFile(path) → FileResult<string>
  - writeFile(path, content) → FileResult<void>
  - createFileId() using crypto.randomUUID()
  - createNewFile() → FileHandle with name="Untitled", path=null
  - Error mapping: ENOENT→NOT_FOUND, EACCES→PERMISSION_DENIED
  - Console.error logging for all errors (FR-017)

- [ ] T05 [P:1.1] [FR-010,FR-011,FR-012] Create FileWatcher service in `src/main/services/file-watcher.ts`:
  - Constructor taking BrowserWindow for IPC
  - watch(fileId, path) method
  - unwatch(fileId) method
  - chokidar config: awaitWriteFinish.stabilityThreshold=500 (FR-011)
  - Emit FileChangeEvent via webContents.send
  - close() method for cleanup

- [ ] T06 [P:1.1] [FR-013] Create RecentFilesService in `src/main/services/recent-files.ts`:
  - electron-store with JSON schema validation
  - addRecent(path) - deduplicates, maintains max 10 (FR-013)
  - getRecent() → RecentFileEntry[]
  - removeRecent(path) - for invalid entries
  - Persist at app.getPath('userData')

- [ ] T07 [P:1.1] [FR-014,FR-015] Create AutoSaveManager in `src/main/services/auto-save.ts`:
  - 30-second interval timer (FR-014)
  - Temp file path: `${app.getPath('temp')}/mdxpad-autosave-${fileId}.mdx`
  - saveDirty(fileId, content) method
  - findRecoverable() → AutoSaveEntry[]
  - cleanupEntry(fileId) method
  - start()/stop() lifecycle methods

- [ ] T08 [P:1.1] [FR-001,FR-002] Extend MdxpadAPI interface in `src/preload/api.ts`:
  - File methods: openFile, saveFile, saveFileAs, readFile, writeFile
  - Window methods: closeWindow, minimizeWindow, maximizeWindow
  - App methods: getVersion, signalReady
  - Event listener: onFileChange(callback)
  - Return types using FileResult<T>

#### Gate 1.1: Foundation Validation

```bash
pnpm typecheck && \
node -e "require('./src/shared/contracts/file-schemas')" && \
node -e "require('./src/main/services/file-service')" && \
node -e "require('./src/main/services/file-watcher')" && \
node -e "require('./src/main/services/recent-files')" && \
node -e "require('./src/main/services/auto-save')" && \
grep -q "stabilityThreshold: 500" src/main/services/file-watcher.ts
```

**On-Fail**:
- Schema errors → Check contracts/file-ipc-schemas.md, verify zod 4.x syntax
- Service errors → Check research.md patterns, verify imports
- Debounce missing → Ensure awaitWriteFinish.stabilityThreshold=500 per FR-011

**Checkpoint**: All building blocks ready — handlers can now be implemented

---

## Phase 2: Handlers

**Purpose**: Implement ALL IPC handlers and preload bridge
**Max Parallelism**: 3 subagents

### Batch 2.1: Handler Implementation (parallel)

<!-- Context: src/shared/contracts/file-schemas.ts, src/main/services/*.ts, research.md -->

- [ ] T09 [P:2.1] [US1-4] Create file-handlers.ts with ALL file and app IPC handlers in `src/main/ipc/file-handlers.ts`:
  - `mdxpad:file:open` - dialog.showOpenDialog with filters [{name:'MDX/Markdown',extensions:['mdx','md']}], return FileHandle
  - `mdxpad:file:save` - write using FileService, return FileResult<void>
  - `mdxpad:file:save-as` - dialog.showSaveDialog, write, return new FileHandle
  - `mdxpad:file:read` - FileService.readFile
  - `mdxpad:file:write` - FileService.writeFile
  - `mdxpad:app:version` - return app.getVersion()
  - `mdxpad:app:ready` - signal renderer ready
  - Use createValidatedHandler wrapper for all handlers
  - Export registerFileHandlers(ipcMain, window) function

- [ ] T10 [P:2.1] [US5] Create window-handlers.ts with ALL window IPC handlers in `src/main/ipc/window-handlers.ts`:
  - `mdxpad:window:close` - check dirty via IPC, show dialog.showMessageBox({type:'question', buttons:['Save','Discard','Cancel'], defaultId:0, cancelId:2})
  - `mdxpad:window:minimize` - window.minimize()
  - `mdxpad:window:maximize` - window.isMaximized() ? restore : maximize
  - Use createValidatedHandler wrapper
  - Export registerWindowHandlers(ipcMain, window) function

- [ ] T11 [P:2.1] [US1-5] [FR-009] Implement preload bridge in `src/preload/index.ts`:
  - Implement all MdxpadAPI methods using ipcRenderer.invoke
  - Add zod request validation before invoke using schema.safeParse() (Constitution §3.3 - sender side)
  - Add zod response validation after invoke using FileResultSchema.safeParse() (Constitution §3.3 - receiver side)
  - Expose via contextBridge.exposeInMainWorld('mdxpad', api)
  - Add IPC listener bridge for onFileChange events

#### Gate 2.1: Handler Validation

```bash
pnpm typecheck && \
node -e "require('./src/main/ipc/file-handlers')" && \
node -e "require('./src/main/ipc/window-handlers')"
```

**On-Fail**:
- Import errors → Verify service exports, check file-schemas.ts
- Dialog errors → Check Electron dialog API usage per research.md
- Validation errors → Ensure createValidatedHandler wraps all handlers

### Batch 2.2: Handler Registration (sequential)

<!-- Context: src/main/ipc/index.ts, src/main/ipc/file-handlers.ts, src/main/ipc/window-handlers.ts -->

- [ ] T12 [P:2.2] [US1-5] [FR-001,FR-002] Register ALL handlers in `src/main/ipc/index.ts`:
  - Import registerFileHandlers, registerWindowHandlers
  - Call both in registerIpcHandlers(ipcMain, window) function
  - Ensure handlers registered before window loads

#### Gate 2.2: Registration Validation

```bash
pnpm typecheck && node -e "require('./src/main/ipc')"
```

**On-Fail**: Check handler imports; verify function signatures match

**Checkpoint**: All IPC channels operational — integration can begin

---

## Phase 3: Integration

**Purpose**: Wire services together and add app-level features
**Max Parallelism**: 4 subagents

### Batch 3.1: Service Integration + App Features (parallel)

<!-- Context: src/main/services/*.ts, src/main/window.ts, src/main/index.ts -->

- [ ] T13 [P:3.1] [US5-7] Integrate ALL services with FileService in `src/main/services/file-service.ts`:
  - Inject FileWatcher, RecentFilesService, AutoSaveManager via constructor or init
  - On successful file open: start watching, add to recent files
  - On file close: stop watching, stop auto-save for that file
  - On content change (dirty): trigger auto-save registration
  - On successful save: cleanup auto-save temp file, clear dirty

- [ ] T14 [P:3.1] [US5] Add window close handler in `src/main/window.ts`:
  - Listen to 'close' event on BrowserWindow
  - Query renderer for dirty state via IPC
  - If dirty: event.preventDefault(), show confirmation dialog
  - Handle Save (save then close), Discard (close), Cancel (stay open)

- [ ] T15 [P:3.1] Add crash recovery in `src/main/index.ts`:
  - On app 'ready': call AutoSaveManager.findRecoverable()
  - If entries found: show dialog.showMessageBox with checkbox list
  - Use AutoSaveEntry.displayName for labels, savedAt for timestamps
  - On confirm: read selected temp files, restore as untitled documents
  - Cleanup recovered entries

- [ ] T16 [P:3.1] [US7] Add Recent Files menu in `src/main/menu.ts`:
  - Create "Recent Files" submenu under File menu
  - Populate from RecentFilesService.getRecent()
  - Click handler: invoke file open with selected path
  - Handle missing files: show error, remove from recent list
  - Add "Clear Recent" menu item

#### Gate 3.1: Integration Validation

```bash
pnpm typecheck
```

**On-Fail**:
- Service integration → Verify service constructors/init signatures
- Menu errors → Check Electron Menu.buildFromTemplate API
- Recovery errors → Verify glob pattern for temp files

**Checkpoint**: All features integrated — ready for testing

---

## Phase 4: Validation

**Purpose**: Comprehensive testing and final build validation
**Max Parallelism**: 3 subagents

### Batch 4.1: Tests (parallel)

<!-- Context: quickstart.md, spec.md#acceptance-scenarios -->

- [ ] T17 [P:4.1] Create IPC integration tests in `tests/integration/ipc/file-handlers.test.ts`:
  - Test all file handlers with mock FileService
  - Test zod validation rejects invalid payloads
  - Test error code mapping (NOT_FOUND, PERMISSION_DENIED, CANCELLED, UNKNOWN)
  - Test window handlers with mock BrowserWindow
  - Verify Constitution §3.3 compliance (validated inputs)

- [ ] T18 [P:4.1] Create E2E file operation tests in `tests/e2e/file-operations.spec.ts`:
  - Test Cmd+O opens file dialog (US1)
  - Test Cmd+S saves file / shows dialog for untitled (US2)
  - Test Cmd+Shift+S shows Save As dialog (US3)
  - Test Cmd+N creates untitled document (US4)
  - Test close with unsaved changes shows dialog (US5)
  - Test external file change notification (US6)
  - Test Recent Files menu population (US7)

- [ ] T19 [P:4.1] Create performance benchmark tests in `tests/e2e/file-performance.spec.ts`:
  - Test 1MB file opens in < 500ms (SC-001, Constitution Article V)
  - Test 10MB file opens in < 2s (SC-002, Constitution Article V)
  - Generate test files in beforeAll
  - Use performance.now() for timing
  - Fail test if budget exceeded

#### Gate 4.1: Test Validation

```bash
pnpm typecheck && \
pnpm test --run tests/integration/ipc/ && \
pnpm test:e2e tests/e2e/file-operations.spec.ts
```

**On-Fail**:
- Test discovery fails → Check vitest/playwright config
- Assertions fail → Review spec.md acceptance scenarios
- Performance fails → Profile file read path, check Constitution Article V

### Batch 4.2: Final Validation (sequential)

- [ ] T20 [P:4.2] Run full validation suite:
  ```bash
  pnpm typecheck && pnpm lint && pnpm build
  ```
  - Fix any type errors
  - Fix any lint violations
  - Verify production build succeeds
  - Run quickstart.md validation scenarios manually

#### Gate 4.2: Release Validation

```bash
pnpm typecheck && pnpm lint && pnpm build && \
echo "All validations passed"
```

**On-Fail**: Review specific errors; check Constitution compliance

**Checkpoint**: Feature complete and validated

---

## Parallel Execution Summary

| Batch | Tasks | Parallelism | Output Files | Critical? |
|-------|-------|-------------|--------------|-----------|
| 1.1 | 8 | **9 subagents** | 10 files | Yes |
| 2.1 | 3 | 3 subagents | 3 files | Yes |
| 2.2 | 1 | 1 subagent | 1 file | Yes |
| 3.1 | 4 | 4 subagents | 4 files | Yes |
| 4.1 | 3 | 3 subagents | 3 files | Yes |
| 4.2 | 1 | 1 subagent | validation | Yes |
| **Total** | **20** | **Max 9** | **21 files** | **6 batches** |

### Optimization Metrics

| Metric | Original | Optimized | Improvement |
|--------|----------|-----------|-------------|
| Total Tasks | 43 | 20 | **-53%** |
| Total Batches | 21 | 6 | **-71%** |
| Critical Path | 12 | 6 | **-50%** |
| Max Parallelism | 4 | 9 | **+125%** |
| Parallelism Factor | 3.6x | 3.3x | Similar |

### Execution Timeline

```
Time ────────────────────────────────────────────────────────────────────►

Batch 1.1 ███████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░
          [T01][T02][T03][T04][T05][T06][T07][T08]  (9 parallel, ~8 min)

Batch 2.1 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█████████████░░░░░░░░░░░░
                                                  [T09][T10][T11]  (3 parallel, ~5 min)

Batch 2.2 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░███░░░░░░░░
                                                               [T12]  (1, ~2 min)

Batch 3.1 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████
                                                                  [T13][T14][T15][T16]  (4 parallel, ~5 min)

Batch 4.1 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█████
                                                                          [T17][T18][T19]  (3 parallel, ~5 min)

Batch 4.2 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██
                                                                               [T20]  (1, ~3 min)

Total: ~25 minutes with full parallelization (vs ~45+ sequential)
```

---

## Dependencies

### Batch Dependencies

```
Batch 1.1 (Foundation)
    │
    │ All services + schemas exist
    ▼
Batch 2.1 (Handlers) ────────► Batch 2.2 (Registration)
    │                              │
    │ Handlers registered          │
    ▼                              ▼
Batch 3.1 (Integration) ◄──────────┘
    │
    │ All features wired
    ▼
Batch 4.1 (Tests) ────────► Batch 4.2 (Final)
```

### File Output Matrix

| Batch | Files Created/Modified |
|-------|------------------------|
| 1.1 | package.json, file-schemas.ts, contracts/index.ts, lib/ipc.ts, file-service.ts, file-watcher.ts, recent-files.ts, auto-save.ts, preload/api.ts |
| 2.1 | file-handlers.ts, window-handlers.ts, preload/index.ts |
| 2.2 | ipc/index.ts |
| 3.1 | file-service.ts (extend), window.ts, main/index.ts, menu.ts |
| 4.1 | tests/integration/*, tests/e2e/* |
| 4.2 | (validation only) |

### Critical Path

```
T01 → T09 → T12 → T13 → T17 → T20
 ↑      ↑      ↑      ↑      ↑      ↑
Deps  Handlers Reg  Integrate Test  Build
```

**Length**: 6 tasks (minimum sequential execution)

---

## Constitution Compliance

| Article | Requirement | Task | Status |
|---------|-------------|------|--------|
| §3.1 | File ops in main process | T04, T09 | Covered |
| §3.2 | contextIsolation: true | (Spec 000) | Verified |
| §3.3 | Zod validation both ends | T02, T11 | **Covered** |
| §3.3 | invoke/handle pattern | T09, T10, T11 | Covered |
| §3.3 | Channel naming | T03 | Covered |
| §6.4 | Integration tests for IPC | T17 | Covered |
| §6.4 | E2E for open/save | T18 | Covered |
| §7.3 | Auto-save every 30s | T07 | Covered |
| §7.3 | User-friendly errors | T04, T09 | Covered |
| Article V | 1MB < 500ms | T19 | **Covered** |
| Article V | 10MB < 2s | T19 | **Covered** |

---

## Recovery Playbook

### Batch Failure Recovery

```bash
# 1. Identify failed tasks from gate output
# 2. Fix specific task(s)
# 3. Re-run only failed tasks (subagents are stateless)
# 4. Re-run gate validation
```

### Common Issues

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Schema validation fails | Zod 4.x syntax | Check discriminatedUnion, brand syntax |
| Handler import error | Missing export | Add to file-handlers.ts exports |
| Preload API missing | contextBridge | Check exposeInMainWorld call |
| Service integration | Circular import | Use dependency injection pattern |
| Performance test fails | I/O bottleneck | Profile with --inspect, check async |

---

## Notes

- **[P:X.Y]** = Batch identifier; same ID means parallel-safe (no file conflicts)
- **Gates** = Must pass before next batch; commit after each gate
- **9 subagents max** in Batch 1.1 utilizes near-full Claude capacity
- All tasks include complete implementation (not partial)
- Each task is self-contained with full context in description
- Constitution §3.3 compliance: T11 adds preload-side zod validation
