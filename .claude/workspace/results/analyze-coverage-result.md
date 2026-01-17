# Application Shell Coverage Gap Analysis

**Spec**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`
**Plan**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/plan.md`
**Tasks**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/tasks.md`
**Date**: 2026-01-10

---

## Coverage Summary Table - Functional Requirements

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 | Yes | T006 | Split-pane layout with editor left, preview right |
| FR-002 | Yes | T006 | Draggable divider |
| FR-003 | Yes | T006 | Minimum 100px pane width enforced |
| FR-004 | Yes | T006 | Preview can be toggled off |
| FR-005 | Yes | T004 | StatusBar at bottom |
| FR-006 | Yes | T006 | macOS titlebar area with traffic lights |
| FR-007 | Yes | T001 | Document state tracking |
| FR-008 | Yes | T001 | Dirty marking on content change |
| FR-009 | Yes | T001 | Clear dirty flag on save |
| FR-010 | Yes | T001 | State maintained across re-renders |
| FR-011 | Yes | T001 | Document state provided to all components |
| FR-012 | Yes | T003 | Empty "Untitled" document on launch |
| FR-013 | Yes | T003 | Cmd+N creates new document |
| FR-014 | Yes | T003 | Cmd+O shows file picker |
| FR-015 | Yes | T003 | File content loads into editor and preview |
| FR-016 | Yes | T003 | Document state updated with file handle |
| FR-017 | Yes | T008 | Dirty check dialog before open |
| FR-017a | Yes | T010 | External modification detection on window focus |
| FR-018 | Yes | T003 | Save via Cmd+S |
| FR-019 | Yes | T003 | Save-as dialog for untitled documents |
| FR-020 | Yes | T003 | Write content to file path |
| FR-021 | Yes | T003 | Save-as via Cmd+Shift+S |
| FR-022 | Yes | T003 | Update document state after save-as |
| FR-023 | Partial | T003 | Save error handling - not explicitly tested |
| FR-024 | Yes | T009 | Window close event interception |
| FR-025 | Yes | T008, T009 | Dirty check confirmation dialog |
| FR-026 | Yes | T008, T009 | Execute action based on dialog choice |
| FR-027 | Yes | T009 | Close without dialog when clean |
| FR-028 | Yes | T004 | Display filename in status bar |
| FR-029 | Yes | T004 | Display dirty indicator |
| FR-030 | Yes | T004 | Display cursor position |
| FR-031 | Yes | T004 | Display error count |
| FR-031a | Yes | T007 | Error click triggers 3 actions |
| FR-032 | Yes | T004 | Status bar real-time updates |
| FR-033 | Yes | T002 | Persist layout preferences |
| FR-034 | Partial | T002 | Persist user preferences (only splitRatio covered, not theme/zoom) |
| FR-035 | Yes | T002 | Load preferences before UI shown |
| FR-036 | Partial | T002 | Settings store - only layout, not theme/zoom |
| FR-037 | Yes | T005, T006 | Editor content changes trigger preview |
| FR-037a | No | - | **GAP: 3s preview compilation timeout not explicitly covered** |
| FR-038 | Yes | T003 | File operation commands wired to document state |
| FR-039 | Yes | T003 | CommandContext provided to command palette |
| FR-040 | Yes | T011 | Menu events routed to commands |
| FR-041 | Yes | T007 | Error click events wired to editor navigation |

---

## Coverage Summary Table - Success Criteria

| Success Criterion | Has Task? | Task IDs | Notes |
|-------------------|-----------|----------|-------|
| SC-001 | Yes | T014 | Document workflow < 5s validated |
| SC-002 | Yes | T014 | Preview updates < 500ms validated |
| SC-003 | Yes | T014 | Layout preferences < 100ms (no flash) |
| SC-004 | Partial | T012 | Dirty state accuracy - only save/edit flows tested, 100% claim unverified |
| SC-005 | Partial | T012 | Zero data loss - only close tested, not open/new interception |
| SC-006 | Yes | T014 | Status bar updates < 50ms validated |
| SC-007 | Partial | T013 | P1 stories via keyboard - not all P1 operations explicitly keyboard-tested |
| SC-008 | Yes | T014 | Cold start < 2s validated |
| SC-009 | Yes | T014 | 60fps during resize validated |
| SC-010 | No | - | **GAP: Error state recoverability not explicitly tested** |

---

## Coverage Summary Table - User Stories & Acceptance Scenarios

| User Story | Scenario | Has Task? | Task IDs | Notes |
|------------|----------|-----------|----------|-------|
| US1 | S1: Split-pane on launch | Yes | T006, T013 | E2E test covers |
| US1 | S2: Preview updates < 500ms | Yes | T006, T014 | Performance test covers |
| US1 | S3: Split ratio persists | Yes | T002, T013 | E2E test covers |
| US1 | S4: Preview toggle | Partial | T006 | Toggle mentioned but no dedicated test |
| US2 | S1: Empty editor on fresh launch | Partial | T003 | Command tested, not launch state |
| US2 | S2: Save dialog for untitled | Yes | T003, T013 | E2E test covers |
| US2 | S3: Status bar updates after save | Partial | T004, T013 | Not explicitly tested together |
| US2 | S4: Dirty indicator on changes | Yes | T004, T012 | Integration test covers |
| US3 | S1: File dialog filters MDX/MD | No | - | **GAP: File filter behavior not tested** |
| US3 | S2: Content appears in editor and preview | Yes | T003, T012 | Integration test covers |
| US3 | S3: Status bar shows filename, cursor at start | Partial | T004 | Cursor position at start not tested |
| US3 | S4: Dirty check before open | Yes | T008, T012 | Integration test covers |
| US4 | S1: Dialog on close with unsaved changes | Yes | T008, T009, T012 | Integration test covers |
| US4 | S2: Save option works | Yes | T012 | Integration test covers |
| US4 | S3: Don't Save option works | Yes | T012 | Integration test covers |
| US4 | S4: Cancel option works | Yes | T012 | Integration test covers |
| US4 | S5: No dialog when clean | Yes | T009, T012 | Integration test covers |
| US5 | S1: Filename displayed | Yes | T004 | Unit test covers |
| US5 | S2: Dirty indicator displayed | Yes | T004 | Unit test covers |
| US5 | S3: Cursor position updates | Yes | T004 | Unit test covers |
| US5 | S4: Error count displayed | Yes | T004 | Unit test covers |
| US5 | S5: Error click triggers 3 actions | Yes | T007 | Dedicated task covers |
| US6 | S1: Split ratio restored | Yes | T002, T013 | E2E test covers |
| US6 | S2: Preview visibility restored | No | - | **GAP: Preview visibility persistence not tested** |
| US6 | S3: Zoom level restored | No | - | **GAP: Zoom level persistence not in scope** |
| US6 | S4: No flash of default state | Yes | T002, T014 | Performance test covers |
| US7 | S1: Cmd+N | Yes | T003, T013 | E2E test covers |
| US7 | S2: Cmd+O | Yes | T003, T013 | E2E test covers |
| US7 | S3: Cmd+S | Yes | T003, T013 | E2E test covers |
| US7 | S4: Cmd+Shift+S | Yes | T003, T013 | E2E test covers |
| US7 | S5: Cmd+W | Yes | T003, T009, T013 | E2E test covers |
| US7 | S6: Cmd+\ (preview toggle) | Partial | T006 | Shortcut mentioned, not explicitly tested |

---

## Coverage Summary Table - Non-Functional Requirements

| NFR Category | Requirement | Has Task? | Task IDs | Notes |
|--------------|-------------|-----------|----------|-------|
| Performance | No jank during resize | Yes | T014 | 60fps target tested |
| Performance | Sync state updates | Yes | T001 | Zustand handles this |
| Performance | Debounced settings persistence | Yes | T002 | 500ms debounce specified |
| Reliability | No silent content loss | Partial | T008, T009 | Only close flow, not crash recovery |
| Reliability | Clear success/failure feedback | Partial | T003 | Save errors mentioned but not comprehensive |
| Reliability | Crash recovery design not precluded | No | - | **GAP: No task verifies crash recovery compatibility** |
| Accessibility | Keyboard accessible elements | Partial | T004, T011 | StatusBar accessible, others not explicit |
| Accessibility | Screen reader support for status bar | Partial | T004 | aria-labels mentioned in acceptance |
| Accessibility | Logical focus management | No | - | **GAP: Dialog focus management not explicitly tested** |
| Maintainability | Centralized document state | Yes | T001 | Zustand store |
| Maintainability | Props/context over global stores | Partial | T005, T006 | Some components may reach into stores |
| Maintainability | UI vs domain state separation | Yes | T001, T002 | Separate stores |

---

## Coverage Summary Table - Edge Cases

| Edge Case | Has Task? | Task IDs | Notes |
|-----------|-----------|----------|-------|
| File deleted/moved externally | No | - | **GAP: Orphaned file handling not implemented** |
| File modified externally | Yes | T010 | Focus-based detection |
| Disk full during save | No | - | **GAP: Disk full error handling not tested** |
| App crash with unsaved changes | No | - | Out of scope per spec (future autosave) |
| Preview compilation hangs | Partial | - | **GAP: 3s timeout behavior not tested** |
| Window resized very small | No | - | **GAP: Minimum window size enforcement not tested** |
| Rapid file opens | No | - | **GAP: Queue/serialization behavior not tested** |

---

## Identified Gaps

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| G1 | MEDIUM | FR-037a, Edge Cases | Preview compilation 3s timeout not explicitly covered in any task | Add acceptance criteria to T006 or create new task to test timeout behavior and user feedback |
| G2 | LOW | FR-023 | Save error handling (disk full, permissions) mentioned but not tested | Add acceptance criteria to T003 for error handling paths |
| G3 | MEDIUM | FR-034, FR-036 | Theme and zoom level persistence not implemented (only splitRatio) | Clarify scope: if theme/zoom ARE required, add to T002; if not, update spec to remove |
| G4 | LOW | US3-S1 | File dialog MDX/MD filter not tested | Add acceptance criteria to T003 or T013 to verify file picker filter |
| G5 | LOW | US3-S3 | Cursor positioned at start of document after open not tested | Add acceptance criteria to T003 to verify cursor position |
| G6 | MEDIUM | US6-S2 | Preview visibility persistence across sessions not tested | Add to T002 acceptance criteria: previewVisible persists |
| G7 | LOW | US7-S6 | Cmd+\ (preview toggle) shortcut not explicitly tested | Add to T013 E2E acceptance criteria |
| G8 | LOW | SC-004 | 100% dirty state accuracy claim not rigorously verified | Add stress/edge case tests for dirty state in T012 |
| G9 | LOW | SC-005 | Zero data loss for open/new (not just close) not explicitly tested | Add T012 tests for dirty check on file.new and file.open |
| G10 | MEDIUM | SC-007 | All P1 stories via keyboard not comprehensively tested | Add explicit keyboard-only flow test to T013 |
| G11 | HIGH | SC-010 | Error state recoverability not tested (no action leaves app unusable) | Add new test task or criteria to verify app recovery from all error states |
| G12 | MEDIUM | NFR-Accessibility | Dialog focus management not explicitly tested | Add accessibility test to T008 or T013 for focus trap in dialogs |
| G13 | MEDIUM | Edge Case | File deleted/moved externally (orphaned file) - mentioned in spec but no task | Add to T010 or create new task for orphan detection and "save elsewhere" prompt |
| G14 | LOW | Edge Case | Minimum window size enforcement not tested | Add to T006 or T013 acceptance criteria |
| G15 | LOW | Edge Case | Rapid file opens queue behavior not tested | Add to T012 acceptance criteria or create stress test |

---

## Tasks with No Mapped Requirement

All tasks in tasks.md are mapped to at least one requirement or user story. No orphan tasks found.

---

## Requirements with Zero Task Coverage

| Requirement | Status |
|-------------|--------|
| FR-037a | **NO TASK** - 3s preview compilation timeout |

All other FRs have at least partial coverage.

---

## Gap Summary by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| CRITICAL | 0 | - |
| HIGH | 1 | G11 |
| MEDIUM | 6 | G1, G3, G6, G10, G12, G13 |
| LOW | 8 | G2, G4, G5, G7, G8, G9, G14, G15 |

---

## Recommendations

### Priority 1 (Address before implementation)

1. **G11 (HIGH)**: Add explicit error recovery tests. Create acceptance criteria for T012 or T014 that verifies:
   - App recovers from preview compilation failure
   - App recovers from file operation failures
   - No error state leaves UI unresponsive

2. **G1 (MEDIUM)**: Add to T006 acceptance criteria:
   - Preview compilation timeout after 3s shows error state
   - User can continue editing during timeout
   - Error message is user-friendly

3. **G13 (MEDIUM)**: Add to T010 or create new task:
   - Detect when opened file is deleted/moved
   - Show "orphaned" warning
   - Offer "Save Elsewhere" option

### Priority 2 (Address during implementation)

4. **G3 (MEDIUM)**: Clarify spec: Either implement theme/zoom persistence in T002, or update spec to mark as out-of-scope for this feature.

5. **G6 (MEDIUM)**: Add to T002 acceptance criteria:
   - `previewVisible` state persists to localStorage
   - Preview visibility restored on app launch

6. **G10 (MEDIUM)**: Add to T013 E2E tests:
   - Explicit keyboard-only workflow test
   - All P1 user stories completable without mouse

7. **G12 (MEDIUM)**: Add to T008 or T013:
   - Focus trapped in dirty check dialog
   - Focus returns to editor after dialog dismissal

### Priority 3 (Nice to have)

8. **G2, G4, G5, G7, G8, G9, G14, G15 (LOW)**: Add these as secondary acceptance criteria to existing tasks. They improve completeness but are not blocking.

---

## Conclusion

The tasks.md file provides **good overall coverage** of the spec requirements. The main gaps are:

1. **One functional requirement (FR-037a)** has no task coverage - the 3s preview compilation timeout.
2. **One success criterion (SC-010)** - error state recoverability - has no explicit validation.
3. **Several edge cases** from the spec are not covered by any task.
4. **Theme/zoom persistence** is mentioned in requirements but not implemented in tasks.

The gap analysis reveals **0 CRITICAL**, **1 HIGH**, **6 MEDIUM**, and **8 LOW** severity gaps. Addressing the HIGH and MEDIUM gaps before implementation would strengthen the feature's robustness and align tasks more closely with the spec's stated requirements.
