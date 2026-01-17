# Tasks: Application Shell

**Branch**: `006-application-shell` | **Date**: 2026-01-10 | **Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/shell-schemas.ts](./contracts/shell-schemas.ts)

---

## Execution Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 14 |
| Parallel Batches | 4 |
| Max Parallelism | 3 (Batch 2) |
| Critical Path | T001 → T003 → T008 → T009 → T012 → T013 → T014 |
| Estimated Effort | Medium (integration-heavy, minimal new logic) |

---

## Dependency Graph

```text
Batch 1 (Foundation)         Batch 2 (Shell)           Batch 3 (Lifecycle)      Batch 4 (Validation)
═══════════════════         ═══════════════           ═══════════════════      ════════════════════

┌─────────┐                 ┌─────────┐
│  T001   │────────────────▶│  T003   │──────┐
│ DocStore│                 │FileCmd  │      │        ┌─────────┐
└────┬────┘                 └────┬────┘      │        │  T008   │
     │                           │           ├───────▶│DirtyChk │
     │                           │           │        └────┬────┘
     │      ┌─────────┐          │           │             │
     ├─────▶│  T004   │──────────┼───────────┤             │
     │      │StatusBar│          │           │             ▼
     │      └────┬────┘          │           │        ┌─────────┐
     │           │               │           │        │  T009   │
     │           ▼               │           │        │WinClose │
     │      ┌─────────┐          │           │        └────┬────┘
     │      │  T007   │          │           │             │
     │      │ErrClick │          │           │             ▼
     │      └─────────┘          │           │        ┌─────────┐      ┌─────────┐
     │                           │           │        │  T010   │      │  T012   │
     │      ┌─────────┐          │           │        │ExtMod   │─────▶│IntTests │
     ├─────▶│  T005   │──────────┤           │        └─────────┘      └────┬────┘
     │      │EditPane │          │           │                              │
     │      └────┬────┘          │           │        ┌─────────┐           │
     │           │               │           │        │  T011   │           ▼
     │           │               │           └───────▶│MenuInt  │      ┌─────────┐
     │           ▼               │                    └─────────┘      │  T013   │
     │      ┌─────────┐          │                                     │E2ETests │
     │      │  T006   │          │                                     └────┬────┘
     │      │SplitPane│◀─────────┘                                          │
     │      └─────────┘                                                     ▼
     │                                                                 ┌─────────┐
┌────┴────┐                                                            │  T014   │
│  T002   │────────────────────────────────────────────────────────────│PerfVal  │
│UILayout │                                                            └─────────┘
└─────────┘
```

---

## Batch 1: Foundation (Parallel: 2)

> **Gate**: All foundation tasks must pass unit tests before Batch 2 begins.

### T001: Document Store

**Priority**: P1 | **Enables**: US1, US2, US3, US4, US5 | **Blocks**: T003, T004, T005, T008

**Description**: Create Zustand store with Immer for document state management. Tracks current file, content, dirty state, and modification time.

**Files**:
- `src/shared/types/document.ts` (CREATE) - DocumentId, DocumentState, FileHandle types
- `src/renderer/stores/document-store.ts` (CREATE) - Zustand store with actions
- `src/renderer/stores/document-store.test.ts` (CREATE) - Unit tests

**Implementation Reference**: [quickstart.md#step-1](./quickstart.md#step-1-create-document-store), [contracts/shell-schemas.ts](./contracts/shell-schemas.ts)

**Acceptance Criteria**:
- [ ] Store exports `useDocumentStore` hook
- [ ] `newDocument()` resets state with new UUID
- [ ] `openDocument(handle, content)` loads file state
- [ ] `updateContent(content)` updates content and recomputes isDirty
- [ ] `markSaved(mtime?)` clears dirty state
- [ ] `isDirty` derived from `content !== savedContent`
- [ ] Unit tests cover all state transitions
- [ ] Types exported from `@shared/types/document`

**Constitution Check**: ✓ Zustand + Immer (Article II), ✓ TypeScript strict (Article II)

---

### T002: UI Layout Store Extension

**Priority**: P3 | **Enables**: US6 | **Blocks**: T006, T014

**Description**: Extend existing ui-layout-store with splitRatio state and persistence.

**Files**:
- `src/renderer/stores/ui-layout-store.ts` (MODIFY) - Add splitRatio state and setSplitRatio action
- `src/renderer/stores/ui-layout-store.test.ts` (MODIFY) - Add tests for splitRatio

**Implementation Reference**: [quickstart.md#step-2](./quickstart.md#step-2-extend-ui-layout-store)

**Acceptance Criteria**:
- [ ] `splitRatio` state added (default 0.5)
- [ ] `setSplitRatio(ratio)` action clamps to 0.1-0.9 range
- [ ] splitRatio persisted to localStorage with debounce (500ms)
- [ ] splitRatio loaded synchronously at module import time
- [ ] No flash of default splitRatio on app launch
- [ ] Unit tests cover persistence round-trip
- [ ] previewVisible state persisted and restored on app launch
- [ ] SCOPE: Theme and zoom persistence deferred to Spec 007 (out of scope)

**Constitution Check**: ✓ localStorage for UI state (Article II)

---

## Batch 2: Shell Components (Parallel: 3)

> **Gate**: All shell components must render without errors and pass integration tests.

### T003: File Lifecycle Commands

**Priority**: P1 | **Enables**: US2, US3, US7 | **Blocks**: T008, T011 | **Depends**: T001

**Description**: Implement file commands (new, open, save, saveAs, close) using command registration system from Spec 005.

**Files**:
- `src/renderer/commands/file-commands.ts` (CREATE) - Command definitions
- `src/renderer/commands/index.ts` (MODIFY) - Register file commands
- `tests/integration/file-commands.test.ts` (CREATE) - Integration tests

**Implementation Reference**: [quickstart.md#step-3](./quickstart.md#step-3-create-file-lifecycle-commands)

**Acceptance Criteria**:
- [ ] `file.new` command creates new document (with dirty check)
- [ ] `file.open` command shows file picker and loads file (with dirty check)
- [ ] `file.save` command saves to current path or shows save-as dialog
- [ ] `file.saveAs` command always shows save dialog
- [ ] `file.close` command triggers window close flow
- [ ] All commands have correct shortcuts (Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+W)
- [ ] Commands appear in command palette
- [ ] Integration tests verify IPC calls

**Constitution Check**: ✓ IPC invoke/handle pattern (Article III.3)

---

### T004: StatusBar Components

**Priority**: P2 | **Enables**: US5 | **Blocks**: T007 | **Depends**: T001

**Description**: Create StatusBar with FileInfo, CursorPosition, and ErrorCount subcomponents.

**Files**:
- `src/renderer/components/shell/StatusBar/StatusBar.tsx` (CREATE) - Main component
- `src/renderer/components/shell/StatusBar/FileInfo.tsx` (CREATE) - Filename + dirty indicator
- `src/renderer/components/shell/StatusBar/CursorPosition.tsx` (CREATE) - Line:Col display
- `src/renderer/components/shell/StatusBar/ErrorCount.tsx` (CREATE) - Error badge with popover
- `src/renderer/components/shell/StatusBar/types.ts` (CREATE) - Props interfaces
- `src/renderer/components/shell/StatusBar/index.ts` (CREATE) - Barrel export
- `src/renderer/components/shell/StatusBar/__tests__/StatusBar.test.tsx` (CREATE) - Tests

**Implementation Reference**: [quickstart.md#step-4](./quickstart.md#step-4-create-statusbar-component)

**Acceptance Criteria**:
- [ ] StatusBar displays filename (or "Untitled")
- [ ] Dirty indicator (•) shown when isDirty is true
- [ ] CursorPosition shows "Ln X, Col Y" format
- [ ] ErrorCount shows count with AlertCircle icon
- [ ] ErrorCount clickable with Popover showing error list
- [ ] onErrorClick callback prop supported
- [ ] Accessible (aria-labels, keyboard focus)
- [ ] Unit tests for all display states

**Constitution Check**: ✓ Accessibility (Article VII.2)

---

### T005: EditorPane Wrapper

**Priority**: P1 | **Enables**: US1 | **Blocks**: T006 | **Depends**: T001

**Description**: Create EditorPane wrapper that connects MDXEditor to document store.

**Files**:
- `src/renderer/components/shell/EditorPane.tsx` (CREATE) - Wrapper component
- `src/renderer/components/shell/EditorPane.test.tsx` (CREATE) - Unit tests

**Acceptance Criteria**:
- [ ] Renders MDXEditor with content from document store
- [ ] Calls `updateContent()` on editor changes
- [ ] Exposes cursor position via callback
- [ ] Exposes EditorView ref for programmatic control
- [ ] Handles error navigation (jumping to line)
- [ ] No double-binding (single source of truth)

**Constitution Check**: ✓ Single source of truth (NFR Maintainability)

---

### T006: Split-Pane Layout

**Priority**: P1 | **Enables**: US1 | **Blocks**: T012 | **Depends**: T002, T005

**Description**: Rewrite App.tsx with ResizablePanelGroup layout.

**Files**:
- `src/renderer/App.tsx` (REWRITE) - Main shell layout
- `src/renderer/components/shell/PreviewPane.tsx` (CREATE) - Preview wrapper

**Implementation Reference**: [quickstart.md#step-5](./quickstart.md#step-5-create-split-pane-layout)

**Acceptance Criteria**:
- [ ] Split-pane with editor left, preview right
- [ ] Divider draggable with 100px minimum pane width
- [ ] Preview can be toggled off (editor fills space)
- [ ] Split ratio persists via UI layout store
- [ ] macOS titlebar area with traffic lights support
- [ ] StatusBar at bottom
- [ ] CommandPalette overlay renders
- [ ] Preview compilation timeout enforced at 3s (FR-037a)
- [ ] 60fps during resize operations

**Constitution Check**: ✓ Performance (Article V)

---

### T007: Error Click Integration

**Priority**: P2 | **Enables**: US5 | **Blocks**: T012 | **Depends**: T004

**Description**: Wire error click from StatusBar to editor navigation and preview scroll.

**Files**:
- `src/renderer/App.tsx` (MODIFY) - Add error click handler
- `src/renderer/hooks/useErrorNavigation.ts` (CREATE) - Coordination hook

**Acceptance Criteria**:
- [ ] Click error count → cursor jumps to first error line
- [ ] Click error count → error popover shows details
- [ ] Click error count → preview scrolls to show error
- [ ] All three actions happen together (per spec clarification)
- [ ] Works with CodeMirror scrollIntoView API

**Constitution Check**: ✓ FR-031a compliance

---

## Batch 3: Document Lifecycle (Parallel: 2)

> **Gate**: Complete document lifecycle must work end-to-end before testing.

### T008: Dirty Check Dialog

**Priority**: P2 | **Enables**: US4 | **Blocks**: T009 | **Depends**: T001, T003

**Description**: Implement useDocumentLifecycle hook with dirty check dialog.

**Files**:
- `src/renderer/hooks/useDocumentLifecycle.ts` (CREATE) - Lifecycle hook
- `src/renderer/hooks/useDocumentLifecycle.test.ts` (CREATE) - Unit tests

**Implementation Reference**: [quickstart.md#step-6](./quickstart.md#step-6-implement-dirty-check-dialog)

**Acceptance Criteria**:
- [ ] `checkDirty()` returns 'save' | 'discard' | 'cancel'
- [ ] Dialog shows via Electron showMessageBox IPC
- [ ] Dialog message includes filename
- [ ] Returns immediately if not dirty (no dialog)
- [ ] `handleNew()`, `handleOpen()`, `handleSave()`, `handleSaveAs()`, `handleClose()` convenience methods
- [ ] Dialog receives keyboard focus when shown
- [ ] Focus returns to editor after dialog dismissal
- [ ] Unit tests mock IPC and verify all paths

**Constitution Check**: ✓ Graceful error handling (Article VII.3)

---

### T009: Window Close Interception

**Priority**: P2 | **Enables**: US4 | **Blocks**: T010, T012 | **Depends**: T008

**Description**: Intercept window close events to check for unsaved changes.

**Files**:
- `src/main/index.ts` (MODIFY) - Add close event handler
- `src/preload/api.ts` (MODIFY) - Add close check IPC
- `src/renderer/App.tsx` (MODIFY) - Register close handler

**Implementation Reference**: [quickstart.md#step-7](./quickstart.md#step-7-window-close-interception)

**Acceptance Criteria**:
- [ ] Window close event is intercepted (event.preventDefault())
- [ ] Renderer is asked via IPC if close is allowed
- [ ] Dirty check dialog shown if needed
- [ ] Window closes only after user confirmation or if clean
- [ ] Works for both Cmd+W and window close button

**Constitution Check**: ✓ contextIsolation: true (Article III.2), ✓ IPC pattern (Article III.3)

---

### T010: External Modification Detection

**Priority**: P2 | **Enables**: US3 (edge case) | **Blocks**: T012 | **Depends**: T001, T009

**Description**: Detect external file modifications on window focus.

**Files**:
- `src/main/index.ts` (MODIFY) - Add focus event handler
- `src/preload/api.ts` (MODIFY) - Add checkFileModification IPC
- `src/renderer/App.tsx` (MODIFY) - Handle focus events

**Implementation Reference**: [quickstart.md#step-8](./quickstart.md#step-8-external-modification-detection)

**Acceptance Criteria**:
- [ ] Window focus triggers mtime check via IPC
- [ ] If mtime changed, show "Reload" / "Keep Mine" dialog
- [ ] Reload option reloads file content
- [ ] Keep Mine option updates stored mtime (no repeat prompt)
- [ ] Only checks if file has a path (not untitled)
- [ ] Focus-based only (no continuous watching per spec)
- [ ] If file deleted externally, show "File not found" dialog with "Close" option

**Constitution Check**: ✓ Security > Performance (Article I) - simpler, more secure

---

### T011: Menu Integration

**Priority**: P3 | **Enables**: US7 | **Blocks**: T012 | **Depends**: T003

**Description**: Connect native menu to file commands.

**Files**:
- `src/main/menu.ts` (MODIFY) - Add file menu items with accelerators
- `src/main/ipc/index.ts` (MODIFY) - Route menu events to renderer

**Acceptance Criteria**:
- [ ] File menu has: New, Open, Save, Save As, Close
- [ ] Menu accelerators match T003 shortcut definitions (single source of truth)
- [ ] Menu clicks trigger corresponding commands
- [ ] Menu items enable/disable based on state (future)

**Constitution Check**: ✓ Keyboard accessibility (Article VII.2)

---

## Batch 4: Validation (Sequential)

> **Gate**: All validation tasks must pass before merge.

### T012: Integration Tests

**Priority**: P1 | **Enables**: Merge | **Blocks**: T013 | **Depends**: T006, T007, T009, T010, T011

**Description**: Write integration tests for document lifecycle.

**Files**:
- `tests/integration/document-lifecycle.test.ts` (CREATE) - Lifecycle tests
- `tests/integration/shell-layout.test.ts` (CREATE) - Layout tests

**Acceptance Criteria**:
- [ ] Test: new → edit → save → close flow
- [ ] Test: dirty check on close with save
- [ ] Test: dirty check on close with discard
- [ ] Test: dirty check on close with cancel
- [ ] Test: open file → verify content loaded
- [ ] Test: external modification detection
- [ ] Test: split ratio persistence
- [ ] Test: error state recovers after fixing MDX syntax error (SC-010)
- [ ] All tests pass in CI
- [ ] Unit test coverage >= 80% for new code (Constitution VI.4)

**Constitution Check**: ✓ Unit coverage > 80% (Article VI.4)

---

### T013: E2E Tests

**Priority**: P1 | **Enables**: Merge | **Blocks**: T014 | **Depends**: T012

**Description**: Write Playwright E2E tests for shell functionality.

**Files**:
- `tests/e2e/shell.spec.ts` (CREATE) - E2E test suite

**Acceptance Criteria**:
- [ ] Test: App launches with split-pane layout
- [ ] Test: Type content → preview updates
- [ ] Test: Drag divider → ratio persists on reload
- [ ] Test: Cmd+S on untitled → save dialog
- [ ] Test: Close dirty document → dirty check dialog
- [ ] Test: All keyboard shortcuts work (Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+W)
- [ ] Test: Complete P1 user story achievable via keyboard only (US1, US2, US3)
- [ ] Test: Status bar updates correctly
- [ ] All tests pass in CI

**Constitution Check**: ✓ E2E testing requirement

---

### T014: Performance Validation

**Priority**: P1 | **Enables**: Merge | **Blocks**: None | **Depends**: T013

**Description**: Validate performance requirements from spec.

**Files**:
- `tests/performance/shell-perf.test.ts` (CREATE) - Performance tests
- `.specify/specs/006-application-shell/checklists/performance.md` (CREATE) - Results

**Acceptance Criteria**:
- [ ] Cold start < 2s (SC-008)
- [ ] No flash of default layout (SC-003, < 100ms)
- [ ] Smooth 60fps divider dragging (SC-009)
- [ ] Status bar updates < 50ms (SC-006)
- [ ] Preview updates < 500ms of typing pause (SC-002)
- [ ] Document workflow < 5s excluding typing (SC-001)
- [ ] Memory < 200MB idle (Constitution V)

**Constitution Check**: ✓ Performance targets (Article V)

---

## User Story Coverage Matrix

| User Story | Tasks | Priority |
|------------|-------|----------|
| US1: Edit and Preview | T001, T002, T005, T006 | P1 |
| US2: Create and Save | T001, T003, T008 | P1 |
| US3: Open Existing | T001, T003, T008, T010 | P1 |
| US4: Safe Close | T001, T008, T009 | P2 |
| US5: Status Bar | T001, T004, T007 | P2 |
| US6: Settings Persistence | T002 | P3 |
| US7: Keyboard Workflow | T003, T011 | P3 |

---

## Functional Requirement Coverage

| Requirement | Task(s) |
|-------------|---------|
| FR-001 to FR-006 (Layout) | T002, T006 |
| FR-007 to FR-011 (Document State) | T001 |
| FR-012, FR-013 (New) | T003 |
| FR-014 to FR-017a (Open) | T003, T010 |
| FR-018 to FR-023 (Save) | T003 |
| FR-024 to FR-027 (Close) | T008, T009 |
| FR-028 to FR-032 (Status Bar) | T004, T007 |
| FR-033 to FR-036 (Settings) | T002 |
| FR-037 to FR-041 (Integration) | T005, T006, T007, T011 |

---

## Risk Mitigation

| Risk | Mitigation Task |
|------|-----------------|
| Split ratio persistence race | T002 debounce (500ms) |
| Focus detection false positive | T010 mtime comparison |
| State sync during rapid edits | T001 Zustand single source |
| Dialog focus management | T008 Electron dialog API |

---

## Next Steps

After task completion:
1. Run `pnpm test` to verify all tests pass
2. Run `pnpm build` to verify production build
3. Create PR from `006-application-shell` to `main`
4. Update CLAUDE.md with new patterns
