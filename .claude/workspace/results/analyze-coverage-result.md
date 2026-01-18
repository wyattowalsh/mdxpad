# Autosave & Crash Recovery - Coverage Gap Analysis

**Generated**: 2026-01-17
**Feature Branch**: `011-autosave-recovery`
**Analyzed Files**:
- `/Users/ww/dev/projects/mdxpad-persist/specs/011-autosave-recovery/spec.md`
- `/Users/ww/dev/projects/mdxpad-persist/specs/011-autosave-recovery/plan.md`
- `/Users/ww/dev/projects/mdxpad-persist/specs/011-autosave-recovery/tasks.md`

---

## Executive Summary

This analysis examines coverage gaps between specification requirements, user stories, edge cases, success criteria, and implementation tasks for the Autosave & Crash Recovery feature.

**Overall Assessment**: Functional requirements (FR-001 to FR-016) have 100% task coverage. However, significant gaps exist in edge case handling (4 of 6 edge cases have no tasks) and success criteria validation (5 of 6 SCs lack explicit performance/measurement tests). 10 actionable gaps identified: 0 CRITICAL, 6 HIGH, 3 MEDIUM, 1 LOW.

---

## Coverage Mapping

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

---

## Coverage Gaps

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

---

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
