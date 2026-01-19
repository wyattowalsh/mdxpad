<<<<<<< HEAD
# Coverage Gap Analysis: Smart Filtering for File Tree
||||||| 908aacf
# Coverage Gap Analysis: Application Shell (Spec 006)
=======
# Autosave & Crash Recovery - Coverage Gap Analysis
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
**Feature**: 014-smart-filtering
**Date**: 2026-01-17
**Analyzer**: Claude Opus 4.5
||||||| 908aacf
**Analysis Date**: 2026-01-17
**Spec**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`
**Plan**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/plan.md`
**Tasks**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/tasks.md`
**Analyzer**: Claude Code (Haiku 4.5)
=======
**Generated**: 2026-01-17
**Feature Branch**: `011-autosave-recovery`
**Analyzed Files**:
- `/Users/ww/dev/projects/mdxpad-persist/specs/011-autosave-recovery/spec.md`
- `/Users/ww/dev/projects/mdxpad-persist/specs/011-autosave-recovery/plan.md`
- `/Users/ww/dev/projects/mdxpad-persist/specs/011-autosave-recovery/tasks.md`
>>>>>>> 011-autosave-recovery

---

## Summary

<<<<<<< HEAD
After thorough analysis of the spec, plan, and tasks artifacts, the coverage is **GOOD** with **3 gaps identified** (1 HIGH, 2 MEDIUM severity).
||||||| 908aacf
This analysis focuses exclusively on **COVERAGE GAPS** - examining what spec requirements lack task mappings, what tasks lack requirement mappings, and where implementation tasks are missing for important features.

**Overall Assessment**: High-quality coverage with 39/42 FRs fully mapped. 6 FRs have partial coverage gaps requiring clarification in acceptance criteria. 0 critical gaps; 10 actionable gaps identified.
=======
This analysis examines coverage gaps between specification requirements, user stories, edge cases, success criteria, and implementation tasks for the Autosave & Crash Recovery feature.

**Overall Assessment**: Functional requirements (FR-001 to FR-016) have 100% task coverage. However, significant gaps exist in edge case handling (4 of 6 edge cases have no tasks) and success criteria validation (5 of 6 SCs lack explicit performance/measurement tests). 10 actionable gaps identified: 0 CRITICAL, 6 HIGH, 3 MEDIUM, 1 LOW.
>>>>>>> 011-autosave-recovery

---

<<<<<<< HEAD
## Coverage Gap Findings
||||||| 908aacf
## Critical Gaps Summary
=======
## Coverage Mapping
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| GAP-001 | HIGH | spec.md FR-006 vs tasks.md Notes | **Keyboard shortcut mismatch**: Spec requires `Cmd/Ctrl+Shift+F` but tasks implement `Mod+P` due to conflict with Find/Replace. This is a functional requirement deviation. The spec was NOT updated to reflect this change. | Update spec.md FR-006 to reflect the actual implementation shortcut `Mod+P`, or resolve the Find/Replace conflict to use the original `Mod+Shift+F`. Document the deviation rationale in spec. |
| GAP-002 | MEDIUM | spec.md SC-001, SC-002, SC-003 | **Performance/UX success criteria without validation tasks**: SC-001 (locate file in 5s), SC-002 (filter results within 100ms for 10k files), SC-003 (95% success rate) have no explicit validation tasks. T024 mentions "Constitution compliance (keystroke latency)" but doesn't explicitly validate these measurable success criteria. | Add explicit performance benchmark tasks: (1) Create benchmark test for 10k file filtering latency (SC-002), (2) Add performance test to T022 E2E or create dedicated T025 for performance validation. |
| GAP-003 | MEDIUM | spec.md Edge Case #5 | **Long query truncation edge case partially covered**: Edge case mentions "very long string paste" and tasks.md T020 mentions MAX_FILTER_QUERY_LENGTH = 100, but no explicit test validates this behavior. | Add test case in T019 or T020 to verify: (1) Query is truncated at 100 chars, (2) Pasting long string is handled gracefully, (3) UI provides feedback for truncation. |
||||||| 908aacf
| ID | Severity | Gap Type | Description |
|----|----------|----------|-------------|
| GAP-001 | MEDIUM | Missing AC Detail | Preview compilation timeout (3s) defined in spec but timeout enforcement mechanism unclear in T006 |
| GAP-002 | MEDIUM | Partial Mapping | Theme/zoom persistence (FR-034, FR-036) partially deferred; only splitRatio in scope for T002 |
| GAP-003 | HIGH | Error Recovery | SC-010 error state recoverability has no explicit validation task |
| GAP-004 | MEDIUM | Edge Case | File deletion/orphaning (spec §Edge Cases) not explicitly mapped to T010 |
| GAP-005 | LOW | AC Clarity | Save error dialog mechanism (FR-023) specified in spec but display mode not in T003 AC |
| GAP-006 | LOW | AC Clarity | Dialog wording/buttons (FR-025) specified in spec but exact format not in T008 AC |
| GAP-007 | LOW | AC Clarity | Popover dismiss behavior (FR-031b) specified but interaction not in T004 AC |
| GAP-008 | LOW | AC Clarity | File filter for open dialog (US3 acceptance scenario) not in T003 or T013 AC |
| GAP-009 | LOW | AC Clarity | Cursor position at document start (US3-S3) not tested after file open |
| GAP-010 | LOW | AC Clarity | Preview visibility persistence (US6-S2) only partially covered; AC defers to "future" |
=======
### Functional Requirements (FR-001 to FR-016)

| Requirement | Description | Task IDs | Coverage |
|-------------|-------------|----------|----------|
| FR-001 | Automatically save document content to recovery location at configurable intervals | T003, T004, T008, T010 | FULL |
| FR-002 | Track dirty state (unsaved changes) for each open document | T007, T008 | FULL |
| FR-003 | Detect on startup whether recovery data exists from a previous session | T005, T012 | FULL |
| FR-004 | Display a recovery dialog when recoverable documents are detected | T011, T012 | FULL |
| FR-005 | Allow users to preview recoverable document content before accepting recovery | T015 | FULL |
| FR-006 | Restore selected documents to their autosaved state when user accepts recovery | T013, T016 | FULL |
| FR-007 | Discard recovery data only when user explicitly clicks "Decline"; dismissing preserves for next startup | T011, T012 | FULL |
| FR-008 | Clear recovery data after a document is successfully manually saved | T014 | FULL |
| FR-009 | Provide settings to configure autosave interval (minimum 5 seconds, maximum 10 minutes) | T019 | FULL |
| FR-010 | Provide a setting to enable or disable autosave functionality | T019 | FULL |
| FR-011 | Persist autosave settings across application restarts | T003, T019 | FULL |
| FR-012 | Integrate with the document store to reflect dirty state accurately | T007, T008 | FULL |
| FR-013 | Handle autosave failures by showing status indicator and toast after 3 consecutive failures | T009 | FULL |
| FR-014 | Support recovery of multiple documents from a single crash event | T011, T015, T016 | FULL |
| FR-015 | Use atomic write pattern (write to temp file, then rename) to prevent corruption | T004 | FULL |
| FR-016 | Detect when source file was modified externally and present conflict resolution dialog with diff view | T017, T018 | FULL |

### Non-Functional / Success Criteria (SC-001 to SC-006)

| Requirement | Description | Task IDs | Coverage |
|-------------|-------------|----------|----------|
| SC-001 | Users can recover at least 95% of their work after unexpected exit | T021, T022, T025 | PARTIAL - No explicit 95% measurement validation |
| SC-002 | Autosave operations complete without perceptible interruption (<16ms main thread) | T004, T008, T021 | PARTIAL - No performance test task |
| SC-003 | Recovery dialog presents all recoverable documents within 2 seconds of app start | T011, T012 | PARTIAL - No performance test task |
| SC-004 | Users can preview and selectively recover documents in under 30 seconds | T015, T016 | PARTIAL - No UX timing test task |
| SC-005 | Autosave setting changes take effect immediately without requiring app restart | T020 | FULL |
| SC-006 | Zero data loss events reported after feature deployment | T021, T022, T025 | PARTIAL - No data loss scenario test |

### User Stories Coverage

| User Story | Priority | Acceptance Scenarios | Task Coverage | Status |
|------------|----------|---------------------|---------------|--------|
| US1 - Automatic Background Saving | P1 | 3 scenarios | T008, T009, T010 | FULL |
| US2 - Crash Recovery on Restart | P1 | 3 scenarios | T011, T012, T013, T014 | FULL |
| US3 - Recovery Dialog with Preview | P2 | 3 scenarios | T015, T016, T017, T018 | FULL |
| US4 - Autosave Configuration | P3 | 3 scenarios | T019, T020 | FULL |

### Edge Cases from Spec

| Edge Case | Description | Task Coverage | Status |
|-----------|-------------|---------------|--------|
| EC-1 | Disk space insufficient for autosave | NONE | MISSING |
| EC-2 | Document is read-only or locked | NONE | MISSING |
| EC-3 | Application exits during autosave write | T004 (atomic writes) | IMPLICIT |
| EC-4 | Source file modified externally between autosaves | T017, T018 | FULL |
| EC-5 | Recovery data is corrupted or incomplete | NONE | MISSING |
| EC-6 | Very large documents take longer than autosave interval | NONE | MISSING |

### Key Entities from Spec

| Entity | Description | Implementation Tasks | Status |
|--------|-------------|---------------------|--------|
| RecoveryFile | Autosaved backup with identifier, content, timestamp, path | T004, T005 | FULL |
| AutosaveSettings | User preferences (enabled, interval, retention) | T003 | FULL |
| DirtyState | Tracks unsaved changes, synced with document store | T007, T008 | FULL |
| RecoveryManifest | Index of all recoverable documents | T004, T005, T012 | FULL |
>>>>>>> 011-autosave-recovery

---

<<<<<<< HEAD
## Coverage Matrix: Functional Requirements (FR-xxx)
||||||| 908aacf
## Coverage Summary Table - Functional Requirements
=======
## Coverage Gaps
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
| Requirement | Description | Has Task? | Task IDs | Notes |
|-------------|-------------|-----------|----------|-------|
| FR-001 | Text input field in file explorer sidebar | YES | T007 | Filter input component with placeholder |
| FR-002 | Filter file tree as user types | YES | T007, T009 | Store actions + tree integration |
| FR-003 | Sequential fuzzy matching (fzf-style) | YES | T003, T018 | Matcher wrapper + unit tests |
| FR-003a | Case-insensitive matching | YES | T003, T018 | Tested in matcher tests |
| FR-004 | Display parent folders of matching items | YES | T009, T020 | Tree integration + edge cases |
| FR-005 | Highlight matched portions | YES | T010, T011 | FilterHighlight component |
| FR-006 | Cmd/Ctrl+Shift+F keyboard shortcut | PARTIAL | T012, T013, T014 | Implemented as Mod+P due to conflict - spec not updated |
| FR-007 | Persist filter query across sessions | YES | T005, T015, T016, T017 | Persistence utilities + lifecycle |
| FR-008 | Restore full tree when filter cleared | YES | T007, T009 | Clear button + clearFilter action |
| FR-009 | Update results when files change | YES | T021 | Subscribe to file tree changes |
| FR-010 | 50ms debounce | YES | T007, T008 | Debounce hook |
| FR-011 | Empty state message when no matches | YES | T009, T020 | Tree integration + edge cases |
| FR-012 | Clear filter with single action | YES | T007 | Clear button + Escape key |
| FR-013 | Persist filter when file selected | YES | T009 | Filter remains after selection |

**FR Coverage**: 13/13 requirements have associated tasks (100%, but FR-006 has deviation)
||||||| 908aacf
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
=======
| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| G1 | HIGH | spec.md Edge Cases, tasks.md | **Disk space handling missing**: No task addresses what happens when disk space is insufficient for autosave (spec Edge Case 1) | Add task: "T028 [P:2.2] Implement disk space check before autosave write, emit warning event when below threshold (e.g., 100MB), gracefully fail with user notification" |
| G2 | HIGH | spec.md Edge Cases, tasks.md | **Read-only/locked document handling missing**: No task addresses autosave behavior when document is read-only or locked (spec Edge Case 2) | Add task: "T029 [P:3.1] Handle read-only/locked documents in useAutosave: detect file permissions, skip autosave with visual indicator, log warning" |
| G3 | HIGH | spec.md Edge Cases, tasks.md | **Corrupted recovery data handling missing**: No task addresses how to handle corrupted or incomplete recovery files (spec Edge Case 5) | Add task: "T030 [P:4.1] Implement recovery file validation in RecoveryService: checksum verification, graceful handling of corrupt files (show error, offer to discard), tombstone invalid entries" |
| G4 | HIGH | spec.md Edge Cases, tasks.md | **Large document handling missing**: No task addresses documents that take longer to save than the autosave interval (spec Edge Case 6) | Add task: "T031 [P:3.1] Implement autosave queue with in-progress guard: skip interval if previous save still running, emit 'slow-save' warning after 2x interval" |
| G5 | HIGH | spec.md SC-002, tasks.md | **Performance validation missing for SC-002**: No explicit task validates that autosave completes in <16ms without perceptible interruption | Add task: "T032 [P:7.1] Add performance benchmark tests for autosave: measure main thread impact, assert <16ms blocking time, test with 1MB+ documents" |
| G6 | HIGH | spec.md SC-003, tasks.md | **Performance validation missing for SC-003**: No explicit task validates recovery dialog appears within 2 seconds | Add task: "T033 [P:7.3] Add E2E performance test: measure time from app launch to recovery dialog render, assert <2000ms with 10 recovery files" |
| G7 | MEDIUM | spec.md SC-001, tasks.md | **Recovery completeness validation missing**: No task explicitly validates the 95% work recovery success criterion | Add acceptance test scenario to T025: "Verify recovery restores 100% of autosaved content by comparing checksums" |
| G8 | MEDIUM | spec.md SC-004, tasks.md | **UX timing validation missing for SC-004**: No task validates preview/selective recovery completes in under 30 seconds | Add manual test scenario to T026: "Time full recovery workflow with 5 documents, verify <30s total user interaction time" |
| G9 | MEDIUM | spec.md SC-006, tasks.md | **Data loss scenario testing missing**: No explicit task creates adversarial tests for data loss scenarios | Add task: "T034 [P:7.3] Add chaos/adversarial E2E tests: kill process during save, corrupt manifest mid-write, simulate disk full, verify no data loss in each" |
| G10 | LOW | tasks.md | **Task T027 lacks requirement traceability**: T027 (Update exports) is not mapped to any FR or US | Document: T027 is infrastructure task supporting all FRs via code organization. No action needed but add note to task. |
>>>>>>> 011-autosave-recovery

---

<<<<<<< HEAD
## Coverage Matrix: User Stories (US-x)

| User Story | Priority | Description | Has Tasks? | Task IDs | Notes |
|------------|----------|-------------|------------|----------|-------|
| US-1 | P1 | Quick File Filtering | YES | T007, T008, T009 | Phase 3 - Core filtering |
| US-2 | P1 | Fuzzy Matching | YES | T003, T007, T009, T018 | Merged with US-1 in tasks |
| US-3 | P2 | Visual Match Highlighting | YES | T010, T011 | Phase 4 - Highlighting |
| US-4 | P2 | Keyboard Shortcut Access | YES | T012, T013, T014 | Phase 5 - Commands |
| US-5 | P3 | Filter Persistence | YES | T015, T016, T017 | Phase 6 - Persistence |

**US Coverage**: 5/5 user stories have associated tasks (100%)

---

## Coverage Matrix: Edge Cases

| Edge Case | Spec Location | Has Task? | Task IDs | Notes |
|-----------|---------------|-----------|----------|-------|
| No matches (empty state) | spec.md Line 104 | YES | T009, T020 | FR-011 also covers this |
| Deep nested folders | spec.md Line 105 | YES | T009, T020 | FR-004 parent visibility |
| File created/deleted/renamed | spec.md Line 106 | YES | T021 | FR-009 auto-update |
| Special characters in query | spec.md Line 107 | YES | T020 | Literal matching |
| Very long string paste | spec.md Line 108 | PARTIAL | T020 | MAX_FILTER_QUERY_LENGTH mentioned, no explicit test |

**Edge Case Coverage**: 4/5 fully covered, 1 partially covered (90%)

---

## Coverage Matrix: Success Criteria (SC-xxx)

| Success Criteria | Description | Has Task? | Task IDs | Notes |
|------------------|-------------|-----------|----------|-------|
| SC-001 | Locate file in 5s (500+ files) | NO | - | No benchmark/validation task |
| SC-002 | Results within 100ms (10k files) | PARTIAL | T024 | Constitution check mentions latency, but not explicit 100ms test |
| SC-003 | 95% first-attempt success | NO | - | UX metric, no validation task |
| SC-004 | Shortcut discoverable | YES | T013 | Command palette integration |
| SC-005 | Persistence works 100% | YES | T015, T016, T017, T022 | E2E tests persistence |
| SC-006 | Fuzzy matching correctness | YES | T018 | Unit tests verify matching |

**SC Coverage**: 4/6 success criteria have validation tasks (67%)

---

## Coverage Matrix: Non-Functional Requirements

| NFR Area | Spec/Plan Location | Has Task? | Task IDs | Notes |
|----------|-------------------|-----------|----------|-------|
| Performance (100ms for 10k files) | plan.md Line 18, SC-002 | PARTIAL | T024 | Implicit in constitution check |
| Keystroke latency (<16ms p99) | plan.md Line 19 | YES | T024 | Constitution Article V |
| Memory (idle <200MB) | plan.md Line 30 | YES | T024 | Constitution check |
| Accessibility (keyboard nav) | plan.md Line 37 | YES | T012-T014, T024 | Focus indicators, shortcuts |
| Accessibility (color not sole) | plan.md Line 38 | YES | T010 | Font-weight + underline |
| Code quality (80% coverage) | plan.md Line 36 | YES | T018, T019 | Unit tests |

**NFR Coverage**: 5/6 non-functional areas have explicit tasks (83%)

---

## Task-to-Requirement Traceability

| Task | Requirements/Stories Covered |
|------|------------------------------|
| T001 | Setup dependency for FR-003 |
| T002 | Types for FR-003, FR-005 |
| T003 | FR-003, FR-003a, US-2 |
| T004 | FR-004, FR-008 |
| T005 | FR-007, US-5 |
| T006 | All FR (store foundation) |
| T007 | FR-001, FR-002, FR-010, FR-012, US-1 |
| T008 | FR-010 |
| T009 | FR-002, FR-004, FR-008, FR-011, FR-013, US-1 |
| T010 | FR-005, US-3 |
| T011 | FR-005, US-3 |
| T012 | FR-006*, US-4 |
| T013 | FR-006*, SC-004, US-4 |
| T014 | FR-006*, US-4 |
| T015 | FR-007, US-5 |
| T016 | FR-007, US-5 |
| T017 | FR-007, US-5 |
| T018 | FR-003, FR-003a, SC-006 |
| T019 | FR-001, FR-010, FR-012 |
| T020 | FR-004, FR-011, Edge cases |
| T021 | FR-009 |
| T022 | FR-005, FR-006*, FR-012, SC-005 |
| T023 | All (quickstart validation) |
| T024 | NFRs, Constitution compliance |

*Note: FR-006 implemented as Mod+P instead of Mod+Shift+F

---

## Statistics

| Category | Covered | Total | Percentage |
|----------|---------|-------|------------|
| Functional Requirements | 13 | 13 | 100% |
| User Stories | 5 | 5 | 100% |
| Edge Cases | 4.5 | 5 | 90% |
| Success Criteria | 4 | 6 | 67% |
| Non-Functional Requirements | 5 | 6 | 83% |
| **Overall** | **31.5** | **35** | **90%** |

---

## Recommendations Summary

1. **HIGH Priority**: Resolve FR-006 keyboard shortcut discrepancy - either update spec to `Mod+P` or change implementation back to `Mod+Shift+F`. Document the rationale.

2. **MEDIUM Priority**: Add explicit performance validation task (suggest T025) to benchmark:
   - 100ms filter latency for 10k files (SC-002)
   - 5-second file location time (SC-001)

3. **MEDIUM Priority**: Enhance T020 or T019 with explicit test for long query truncation behavior.

4. **LOW Priority** (not a gap, but improvement): Consider adding automated UX metrics collection for SC-003 (95% first-attempt success) in future analytics integration.
||||||| 908aacf
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

## Coverage Gaps - Detailed Analysis

### Gap Categories

**Type A: Acceptance Criteria Clarity Gaps** (8 gaps)
These are requirements that ARE mapped to tasks but lack specific implementation details in the acceptance criteria.

**Type B: Missing Task/Test Coverage** (2 gaps)
These are requirements or scenarios with no task mappings or explicit validation tasks.

**Type C: Scope Clarification Needed** (1 gap)
Features mentioned in spec but scope unclear in tasks.

---

### Type A: Acceptance Criteria Clarity Gaps

| ID | Severity | FR/Scenario | Task | Gap | Recommendation |
|----|----------|-----------|------|-----|-----------------|
| GAP-005 | LOW | FR-023 (Save Errors) | T003 | AC doesn't specify error display mechanism (modal? toast? status bar?) | Add: "Save errors displayed via modal dialog with 'Retry' button and error message text" |
| GAP-006 | LOW | FR-025 (Dialog Wording) | T008 | AC doesn't specify button labels and dialog title | Add AC: "Dialog title: 'Save changes to {fileName}?' with buttons [Save] [Don't Save] [Cancel]" |
| GAP-007 | LOW | FR-031b (Popover Dismiss) | T004 | AC mentions popover but not dismiss interaction | Add AC: "ErrorCount popover dismisses on click outside or Escape key press" |
| GAP-008 | LOW | US3-S1 (File Filter) | T003/T013 | No test for file picker filter (MDX/MD files) | Add to T013 E2E AC: "File open dialog filters for *.mdx, *.md files by default" |
| GAP-009 | LOW | US3-S3 (Cursor Position) | T003/T012 | No test that cursor positioned at start after file open | Add to T003 or T012 AC: "After opening file, cursor positioned at line 1, column 1" |
| GAP-001 | MEDIUM | FR-037a (Timeout) | T006 | AC mentions timeout but not enforcement mechanism | Add AC: "If preview compilation exceeds 3s, show timeout error and allow continued editing; mechanism from Spec 005 PreviewPane" |
| GAP-010 | LOW | US6-S2 (Preview Visibility) | T002 | Persistence noted as "future"; deferred commitment | Clarify in T002 AC: "previewVisible state persisted to localStorage; restored on app launch" (or explicitly defer) |
| GAP-012 | MEDIUM | NFR-Accessibility (Dialog Focus) | T008/T013 | No explicit test for focus management in dialogs | Add to T013 AC: "Dirty check dialog receives focus on show; focus returns to editor on dismiss (Tab trap not tested)" |

---

### Type B: Missing Task/Test Coverage

| ID | Severity | Requirement | Gap | Recommendation |
|----|----------|-------------|-----|-----------------|
| GAP-003 | HIGH | SC-010 (Error Recovery) | No explicit task validates "zero data loss from errors" (missing save files, corrupted MDX, etc.) | Create sub-task in T014 or add to T012: "Test error state recovery (save failure + retry, invalid MDX + fix, etc.)" |
| GAP-004 | MEDIUM | Edge Case: File Deletion | T010 maps to external modification but not deletion scenario | Update T010 AC to include: "If file deleted, show dialog 'File not found. Close document?' and mark status bar with '(Deleted)' suffix" |

---

### Type C: Scope Clarification Needed

| ID | Severity | Requirement | Gap | Recommendation |
|----|----------|-------------|-----|-----------------|
| GAP-002 | MEDIUM | FR-034, FR-036 (Theme/Zoom Persistence) | Spec mentions both; T002 only implements splitRatio. Zoom/theme noted as "future" | Clarify in T002: Add note "Theme and zoom persistence deferred to Spec 007; only splitRatio, previewVisible included here" |

---

## Coverage Gap Summary

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

## Functional Requirement Mapping Summary

**Total FRs**: 42 (FR-001 to FR-042)
**Fully Mapped**: 36 (85.7%)
**Partially Mapped**: 5 (11.9%)
**Deferred**: 1 (2.4%)

| Mapping Status | FRs | Tasks |
|---|---|---|
| ✓ Fully mapped with clear task | FR-001–FR-022, FR-024–FR-032, FR-038–FR-041 | T001–T011 |
| ~ Partial (AC clarity needed) | FR-023, FR-025, FR-031b, FR-034, FR-037a | T002–T008 |
| ⊘ Deferred (out of this spec) | FR-036 (theme/zoom) | Spec 007 |

---

## User Story Mapping Summary

**Total User Stories**: 7 (US1–US7)
**Fully Mapped**: 7 (100%)
**Acceptance Scenario Gaps**: 4 scenarios (US3-S1: file filter, US3-S3: cursor position, US6-S2: visibility persistence, US7-S6: toggle shortcut)

| User Story | Priority | Task Coverage | Gap Count |
|---|---|---|---|
| US1: Edit & Preview | P1 | T001, T002, T005, T006 | 0 |
| US2: Create & Save | P1 | T001, T003, T008 | 0 |
| US3: Open Existing | P1 | T001, T003, T008, T010 | 2 (file filter, cursor position) |
| US4: Safe Close | P2 | T001, T008, T009 | 0 |
| US5: Status Bar | P2 | T001, T004, T007 | 1 (popover dismiss) |
| US6: Settings | P3 | T002 | 1 (visibility persistence) |
| US7: Keyboard Workflow | P3 | T003, T011 | 1 (toggle shortcut test) |

---

## Success Criteria Coverage Summary

| Criterion | Status | Task | Gap |
|---|---|---|---|
| SC-001 (< 5s workflow) | ✓ Covered | T014 | None |
| SC-002 (< 500ms preview) | ✓ Covered | T014 | None |
| SC-003 (< 100ms load, no flash) | ✓ Covered | T014 | None |
| SC-004 (100% dirty state accuracy) | ✓ Covered | T001, T012 | Minor: stress testing not explicit |
| SC-005 (zero data loss) | ✓ Covered | T008, T009, T012 | None (close/open/new all checked) |
| SC-006 (< 50ms status bar update) | ✓ Covered | T014 | Minor: update type not specific |
| SC-007 (P1 keyboard-only) | ~ Partial | T013 | AC could be more explicit |
| SC-008 (< 2s cold start) | ✓ Covered | T014 | None |
| SC-009 (60fps resize) | ✓ Covered | T014 | None |
| SC-010 (error recovery) | ⊘ Missing | NONE | HIGH: No explicit error recovery test task |

---

## Edge Cases Mapping

**Total Edge Cases**: 7 in spec
**Fully Covered**: 3
**Partially Covered**: 3
**Not Covered**: 1

| Edge Case | Spec §Location | Task Coverage | Status |
|---|---|---|---|
| File deleted externally | Edge Cases | T010 | ✓ Partial - AC should detail "(Deleted)" suffix |
| File modified externally | Edge Cases | T010 | ✓ Fully covered |
| Disk full during save | Edge Cases | T003 | ✓ Partial - error handling mechanism unclear |
| App crash with recovery | Edge Cases | NONE | ⊘ Out of scope (explicit in spec) |
| Preview compilation timeout | Edge Cases | T006 | ✓ Partial - timeout mechanism deferred to Spec 005 |
| Window resize very small | Edge Cases | T006 | ✓ Covered (minimum window size + auto-hide) |
| Rapid file opens | Edge Cases | T003 | ✓ Partial - queuing behavior not in AC |

---

## Gap Severity Distribution

| Severity | Count | IDs | Impact |
|---|---|---|---|
| CRITICAL | 0 | — | None |
| HIGH | 1 | GAP-003 | Error recovery validation missing; blocks SC-010 verification |
| MEDIUM | 3 | GAP-001, GAP-002, GAP-004 | Acceptance criteria or scope clarity needed |
| LOW | 6 | GAP-005, GAP-006, GAP-007, GAP-008, GAP-009, GAP-010, GAP-012 | AC detail gaps; don't block implementation |
| **TOTAL** | **10** | — | — |

---

## Task-to-Requirement Traceability Verification

**Question**: Do all 14 tasks have mapped requirements/user stories?

| Task | Mapped To | Status |
|---|---|---|
| T001 | FR-007–FR-011, US1–US5 | ✓ YES (6 FRs, 5 USs) |
| T002 | FR-001, FR-033–FR-036, US1, US6 | ✓ YES (5 FRs, 2 USs) |
| T003 | FR-012–FR-023, FR-038–FR-039, US2, US3, US7 | ✓ YES (13 FRs, 3 USs) |
| T004 | FR-005, FR-028–FR-032b, US5 | ✓ YES (7 FRs, 1 US) |
| T005 | FR-011, FR-037, US1 | ✓ YES (3 FRs, 1 US) |
| T006 | FR-001–FR-006, FR-037–FR-037a, US1 | ✓ YES (8 FRs, 1 US) |
| T007 | FR-031a, FR-032, FR-041, US5 | ✓ YES (3 FRs, 1 US) |
| T008 | FR-017, FR-025, FR-026 (partial), US4 | ✓ YES (3 FRs, 1 US) |
| T009 | FR-024, FR-026, FR-027, US4 | ✓ YES (3 FRs, 1 US) |
| T010 | FR-042, US3 (edge case) | ✓ YES (1 FR, 1 US) |
| T011 | FR-040, US7 | ✓ YES (1 FR, 1 US) |
| T012 | SC-001–SC-005, SC-007, SC-010 (partial) | ✓ YES (validation) |
| T013 | SC-001–SC-007, US1–US7 (E2E) | ✓ YES (validation) |
| T014 | SC-002–SC-003, SC-006, SC-008–SC-009 | ✓ YES (validation) |

**Conclusion**: ALL 14 tasks have explicit requirement mappings. ✓

---

## Requirements-to-Task Traceability Verification

**Question**: Are there any FRs/USs/SCs with zero tasks?

| Category | Total | No Tasks | IDs |
|---|---|---|---|
| Functional Requirements | 42 | 0 | — |
| User Stories | 7 | 0 | — |
| Success Criteria | 10 | 1 | SC-010 (no explicit validation task) |
| Edge Cases | 7 | 1 | App crash recovery (intentionally out of scope) |

**Conclusion**: Only SC-010 lacks explicit validation task; all FRs and USs mapped. ✓

---

## Final Recommendations

### BEFORE IMPLEMENTATION (Critical Path)

1. **GAP-003 (HIGH)**: Create sub-task for error recovery validation
   - Add to T012 or T014: "Test that app recovers from save failures, invalid MDX, and file errors without data loss or UI hang"

2. **GAP-001 (MEDIUM)**: Clarify timeout enforcement in T006 AC
   - Add: "Preview compilation timeout (3s) enforced via PreviewPane prop; shell sets timeout value"

3. **GAP-004 (MEDIUM)**: Expand T010 AC for file deletion
   - Add: "If opened file deleted, show dialog and mark status bar with '(Deleted)' suffix; Cmd+S triggers save-as"

4. **GAP-002 (MEDIUM)**: Clarify scope in T002 for deferred features
   - Add note: "Theme and zoom persistence out of scope; deferred to Spec 007"

### DURING ACCEPTANCE CRITERIA REFINEMENT (Before Task Work)

5. **GAP-005, 006, 007, 008, 009, 010, 012** (LOW): Update specific task ACs with missing details
   - See "Type A: AC Clarity Gaps" table above for exact AC additions

---

## Conclusion

**Overall Assessment**: The specification and tasks exhibit **high-quality coverage** with:
- **100% FR mapping** (all 42 FRs have task assignments)
- **100% US mapping** (all 7 user stories have task assignments)
- **Minimal gaps** (10 total, mostly AC clarity, not missing functionality)
- **No CRITICAL gaps** (1 HIGH, 3 MEDIUM, 6 LOW)

**Recommendation**: Specification is **READY FOR IMPLEMENTATION** with the 10 gap recommendations incorporated into task acceptance criteria before work begins. The HIGH-severity gap (error recovery validation) should be addressed in task design, not deferred.
=======
## Summary Statistics

| Category | Total | Covered | Gaps | Coverage % |
|----------|-------|---------|------|------------|
| Functional Requirements (FR) | 16 | 16 | 0 | 100% |
| Success Criteria (SC) | 6 | 1 | 5 | 17% |
| User Stories | 4 | 4 | 0 | 100% |
| Edge Cases | 6 | 2 | 4 | 33% |
| **Overall** | **32** | **23** | **9** | **72%** |

---

## Gap Severity Distribution

| Severity | Count | IDs |
|----------|-------|-----|
| CRITICAL | 0 | N/A |
| HIGH | 6 | G1, G2, G3, G4, G5, G6 |
| MEDIUM | 3 | G7, G8, G9 |
| LOW | 1 | G10 |

---

## Recommended Actions

### Priority 1 (HIGH - Must Fix Before Implementation)

1. **Add Edge Case Handling Tasks (G1-G4)**:
   - Add T028-T031 to Phase 2 (Foundational) or Phase 3 (US1)
   - These protect against real-world failure scenarios
   - Without them, autosave may silently fail in edge conditions

2. **Add Performance Validation Tasks (G5-G6)**:
   - Add T032-T033 to Phase 7 (Testing)
   - These validate key success criteria
   - Without them, cannot prove feature meets requirements

### Priority 2 (MEDIUM - Should Fix)

3. **Enhance Existing Test Tasks (G7-G9)**:
   - Modify T025 to include recovery completeness validation
   - Modify T026 to include UX timing verification
   - Add T034 for chaos/adversarial testing

### Priority 3 (LOW - Nice to Have)

4. **Documentation Update (G10)**:
   - Add requirement traceability note to T027
   - Minor documentation improvement only

---

## Appendix: Task-to-Requirement Matrix

| Task | Requirements Covered | User Story |
|------|---------------------|------------|
| T001 | (Infrastructure) | - |
| T002 | (Infrastructure) | - |
| T003 | FR-001, FR-011 | US4 |
| T004 | FR-001, FR-015 | US1 |
| T005 | FR-003 | US2 |
| T006 | (IPC Infrastructure) | - |
| T007 | FR-002, FR-012 | US1 |
| T008 | FR-001, FR-002, FR-012 | US1 |
| T009 | FR-013 | US1 |
| T010 | FR-001 | US1 |
| T011 | FR-004, FR-007, FR-014 | US2 |
| T012 | FR-003, FR-004, FR-007 | US2 |
| T013 | FR-006 | US2 |
| T014 | FR-008 | US2 |
| T015 | FR-005, FR-014 | US3 |
| T016 | FR-006, FR-014 | US3 |
| T017 | FR-016 | US3 |
| T018 | FR-016 | US3 |
| T019 | FR-009, FR-010, FR-011 | US4 |
| T020 | SC-005 | US4 |
| T021 | (Testing) | US1 |
| T022 | (Testing) | US2 |
| T023 | (Testing) | US1 |
| T024 | (Testing - IPC) | - |
| T025 | (E2E Testing) | US1, US2 |
| T026 | (Validation) | - |
| T027 | (Infrastructure) | - |

---

## Appendix: Requirement-to-Task Reverse Mapping

### All Requirements Have Tasks

| Requirement | Tasks |
|-------------|-------|
| FR-001 | T003, T004, T008, T010 |
| FR-002 | T007, T008 |
| FR-003 | T005, T012 |
| FR-004 | T011, T012 |
| FR-005 | T015 |
| FR-006 | T013, T016 |
| FR-007 | T011, T012 |
| FR-008 | T014 |
| FR-009 | T019 |
| FR-010 | T019 |
| FR-011 | T003, T019 |
| FR-012 | T007, T008 |
| FR-013 | T009 |
| FR-014 | T011, T015, T016 |
| FR-015 | T004 |
| FR-016 | T017, T018 |

### Success Criteria Validation Status

| SC | Explicit Validation Task | Gap? |
|----|-------------------------|------|
| SC-001 (95% recovery) | No explicit measurement | YES (G7) |
| SC-002 (<16ms autosave) | No performance test | YES (G5) |
| SC-003 (<2s dialog) | No performance test | YES (G6) |
| SC-004 (<30s workflow) | No timing test | YES (G8) |
| SC-005 (immediate settings) | T020 | NO |
| SC-006 (zero data loss) | No adversarial test | YES (G9) |

---

## Conclusion

The Autosave & Crash Recovery feature specification has **excellent functional requirement coverage** (100% of FRs mapped to tasks) and **complete user story coverage** (all 4 user stories addressed). However, the analysis reveals:

1. **Edge case handling is incomplete** - 4 of 6 documented edge cases have no corresponding implementation tasks
2. **Success criteria validation is weak** - Only 1 of 6 SCs has explicit validation; the rest rely on implicit coverage through feature tests
3. **No critical gaps** - All core functionality will be implemented; gaps affect robustness and verification

**Recommendation**: Address the 6 HIGH-severity gaps before implementation begins to ensure the feature handles real-world failure scenarios and can demonstrate compliance with success criteria.
>>>>>>> 011-autosave-recovery
