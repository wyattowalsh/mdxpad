<<<<<<< HEAD
# Duplication Analysis: Smart Filtering for File Tree (014)
||||||| 908aacf
# Duplication Analysis: Application Shell (006)
=======
# Duplication Analysis: Autosave & Crash Recovery (011)
>>>>>>> 011-autosave-recovery

**Feature**: `/specs/011-autosave-recovery/`
**Analysis Date**: 2026-01-17
<<<<<<< HEAD
**Spec**: spec.md | **Plan**: plan.md | **Tasks**: tasks.md
**Focus**: Functional Requirements (FR-001 to FR-013), User Stories (US1-US5), and Tasks (T001-T024)
||||||| 908aacf
**Spec**: spec.md | **Tasks**: tasks.md
**Focus**: Functional Requirements (FR-001 to FR-042) and User Stories (US1-US7) vs Tasks (T001-T014)
=======
**Scope**: DUPLICATION issues only (near-duplicate requirements, overlapping tasks, redundant entity definitions)
>>>>>>> 011-autosave-recovery

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
<<<<<<< HEAD
| DUP-001 | MEDIUM | spec.md: FR-003 (line 116) + FR-003a (line 117) | FR-003 describes fuzzy matching, FR-003a adds case-insensitivity as a sub-requirement. While logically related, case-insensitivity could be folded into FR-003. The sub-numbering (FR-003a) creates ambiguity about whether it's a separate testable requirement. | Merge FR-003a into FR-003: "System MUST support sequential fuzzy matching (fzf-style) with case-insensitive comparison where query characters must appear in order within file/folder names, but not contiguously" |
| DUP-002 | MEDIUM | spec.md: US2 Scenario 4 (line 50) + FR-003a (line 117) | US2 Scenario 4 states "MYCOMP" or "mycomp" matches "MyComponent.tsx" (case-insensitive). FR-003a states "System MUST perform case-insensitive matching." These express the same requirement in different sections. | Keep FR-003a as normative requirement; treat US2 Scenario 4 as test case. Add cross-reference comment: "Tests FR-003a" |
| DUP-003 | MEDIUM | tasks.md: T020 (lines 337-341) + spec.md: Edge Cases (lines 104-108) | T020 explicitly lists edge cases (empty state, deep nesting, special chars, long query) that are already specified in spec.md. The task duplicates the edge case list rather than referencing it, creating maintenance burden if spec changes. | Reference spec.md edge cases rather than copying: "T020: Implement edge cases per spec.md lines 104-108" |
| DUP-004 | LOW | spec.md: US1 Scenario 4 (line 33) + FR-013 (line 127) | US1 Scenario 4: "the filter remains active and the filtered view persists" after file selection. FR-013: "System MUST persist the active filter when a file is selected." Near-identical requirement stated in scenario and requirement format. | Accept as intentional spec/test pairing pattern. US scenario serves as test case for FR-013. |
| DUP-005 | LOW | spec.md: US1 Scenario 1 (line 30) + FR-002 (line 115) | US1 Scenario 1: "only files and folders matching the query are displayed." FR-002: "System MUST filter the file tree to show only items matching the current query." Same concept in different phrasing. | Accept as intentional spec/test pairing pattern. |
| DUP-006 | LOW | spec.md: US4 Scenario 1 (line 80) + FR-006 (line 120) | US4 Scenario 1: "I press Cmd/Ctrl+Shift+F, Then the filter input receives focus." FR-006: "System MUST provide Cmd/Ctrl+Shift+F keyboard shortcut to focus the filter input." Near-identical statement. | Accept as intentional spec/test pairing pattern. |
| DUP-007 | LOW | spec.md: US5 Scenario 1 (line 96) + FR-007 (line 121) | US5 Scenario 1: "filter query is restored and applied to the file tree." FR-007: "System MUST persist the filter query across application sessions." Same persistence requirement in scenario vs. requirement format. | Accept as intentional spec/test pairing pattern. |
||||||| 908aacf
|----|-----------|-----------|---------|----|
| DUP-001 | HIGH | Spec US1 (lines 38-51) + Spec US6 (lines 125-138) | Layout preferences persistence described twice: US1 includes "layout remembers their preference for next time" (line 50), US6 fully specifies preference restoration (lines 125-138). These describe the same functional capability from different angles but with different priority levels (P1 vs P3). | Merge US1 and US6 into single P1 story focused on editing experience, moving preference persistence to explicit P3 acceptance criterion. Current split creates ambiguity about when persistence actually takes effect. |
| DUP-002 | HIGH | Spec FR-003 (line 181) + Spec FR-035 (line 237) | Minimum pane width enforced in FR-003 ("100px minimum") also discussed in edge case handling (line 168: "100px editor min + 100px preview min"). Specification is consistent but enforced differently: FR-003 is design constraint, edge case implies runtime logic. These should be consolidated into single requirement with clear enforcement point. | Move minimum width constraint to dedicated NFR (Non-Functional Requirement) section with explicit enforcement points, remove duplication from FR-003 and edge cases. |
| DUP-003 | MEDIUM | Spec US5 (lines 108-121) + Spec FR-031a (lines 229-230) | Error click behavior defined twice: US5 acceptance scenario 5 (line 121) states three actions "cursor jumps to first error line in editor, error details popover is shown, and preview scrolls to show error". FR-031a (lines 229-230) repeats identical three-action requirement with numbered list. Both describe exact same user interaction. | Consolidate into single FR-031a requirement; reference it from US5 acceptance criteria by number rather than restating. |
| DUP-004 | MEDIUM | Spec US2 (lines 55-68) + Spec US3 (lines 72-85) + Tasks T003 | Save/Open workflows described separately in US2 and US3, but T003 "File Lifecycle Commands" (lines 124-148) implements both in single task without distinguishing between them. Acceptance criteria for T003 lists all file commands together (lines 138-145), but task lacks sub-tasks to separate new/open/save logic. | Split T003 into T003a (Save Commands: new, save, saveAs) and T003b (Open Commands: open) to maintain 1:1 traceability with US2 and US3. Update task dependencies accordingly. |
| DUP-005 | MEDIUM | Spec US3 (line 85) + Spec US4 (lines 98-102) + Tasks T008 | Dirty check dialog requirement appears in three places: US3 acceptance scenario 4 (line 85: "confirmation dialog appears asking to 'Save', 'Don't Save', or 'Cancel'"), US4 acceptance scenarios 1-4 (lines 98-102), and T008 "Dirty Check Dialog" (lines 256-277). US3 treats it as edge case during open; US4 treats it as primary feature during close; T008 implements both. No clear demarcation of when dialog appears. | Create separate task T008a (Dirty Check on Close) and T008b (Dirty Check on Open) with distinct acceptance criteria. Make task dependencies more granular: US3→T008b, US4→T008a. |
| DUP-006 | MEDIUM | Spec FR-012 + FR-013 (lines 196-197) + Spec US2 (lines 55-68) + Tasks T003 | New document creation specified in FR-012/FR-013 ("start with empty Untitled document", "allow creating new document") and restated in US2 narrative and T003 acceptance criteria. Three separate statements of same requirement without clear integration point. | Consolidate FR-012/FR-013 into single "New Document" requirement; reference from both US2 and T003 by requirement number to avoid narrative duplication. |
| DUP-007 | MEDIUM | Spec FR-014 + FR-015 (lines 201-202) + Spec US3 (lines 72-85) + Tasks T003/T010 | Open file workflow split across FR-014/FR-015 (functional requirements), US3 (user story with test scenarios), and two tasks (T003 File Lifecycle Commands + T010 External Modification Detection). The sequence "show file picker → load file → update state" is described in all three locations with no cross-reference. | Create traceability matrix in spec linking US3 acceptance scenarios 1-3 to FR-014/FR-015; update T003 to reference spec by line number rather than restating. Keep T010 focused on post-load edge case (external modification). |
| DUP-008 | LOW | Spec FR-033 + FR-034 (lines 235-236) + Spec US6 (lines 125-138) + Tasks T002 | Preference persistence requirements (FR-033, FR-034) are restated verbatim in US6 acceptance scenarios (lines 135-138). Both say: split ratio restored, preview visibility restored, zoom restored (with FR-034 noting zoom is future scope). Redundant statements. | Remove narrative restatement from US6; replace with: "Acceptance Criteria: As per FR-033, FR-034 with focus on split ratio and preview visibility (zoom deferred)." Single source of truth. |
| DUP-009 | LOW | Spec US2 Acceptance Scenario 3 (lines 66-67) + Spec FR-009 (line 190) | US2 acceptance scenario 3: "the status bar updates to show the filename and the dirty indicator disappears" (line 67). FR-009: "System MUST clear the dirty flag when a document is successfully saved" (line 190). Both describe clearing dirty flag on save but from different perspectives (UI manifestation vs. state change). Minor redundancy but natural to different concerns. | No action needed; represents legitimate separation of concerns (user-facing vs. internal state). Keep both but add cross-reference comment in spec: "FR-009 (internal) manifests as dirty indicator disappearance per US2-S3 (user-facing)." |
| DUP-010 | LOW | Spec T001 Acceptance Criteria (lines 81-86) + Spec T002 Acceptance Criteria (lines 107-114) | Both T001 and T002 require "Unit tests cover..." statements (line 87: "Unit tests cover all state transitions"; line 112: "Unit tests cover persistence round-trip"). Redundant reminder of testing requirement across multiple tasks. | Extract testing requirement into shared task template or project standard rather than repeating in each task. Keep individual acceptance criteria scoped to task-specific testing (state transitions vs. persistence) but remove redundant "unit tests" intro language. |
=======
| D1 | HIGH | spec.md FR-015 (line 101) + spec.md Clarifications (line 126) + spec.md Edge Cases (line 78) | Atomic write pattern described 3 times with varying detail. FR-015: "use atomic write pattern (write to temp file, then rename) to prevent recovery file corruption"; Clarifications: "Write to temp file, then atomic rename (standard crash-safe pattern)"; Edge Cases: "Atomic write pattern (temp file + rename) ensures recovery file integrity". Same concept, three restatements. | Consolidate into FR-015 as single source of truth. Remove from Clarifications (it's now an answered question, not open). Update Edge Cases to reference "per FR-015" instead of restating the pattern. |
| D2 | MEDIUM | spec.md FR-016 (line 102) + spec.md Clarifications (line 128) + spec.md Edge Cases (line 79) | External file conflict handling described 3 times. FR-016 defines requirement; Clarifications Q&A restates it; Edge Cases asks the question with answer inline. All three say essentially "show conflict warning with diff view, let user choose version". | Keep FR-016 as authoritative. Move answered edge case question to Clarifications section with reference to FR-016. Remove restatement from Clarifications if FR-016 is clear enough. |
| D3 | MEDIUM | spec.md FR-007 (line 93) + spec.md Clarifications (line 129) | Dismiss vs decline recovery dialog behavior stated twice. FR-007: "dismissing the dialog (ESC, X, click outside) preserves recovery data for next startup"; Clarifications: "Preserve recovery data for next startup (dismiss ≠ decline)". Identical semantics. | Keep FR-007 as canonical. Remove Clarifications entry or replace with "See FR-007" reference. |
| D4 | LOW | plan.md Summary (line 8) + spec.md Assumptions (line 138) | Recovery file storage location mentioned twice. plan.md: "stored in Electron's userData directory"; spec.md Assumptions: "stored in Electron's userData directory (`app.getPath('userData')/recovery`)". Assumptions has more detail (includes path). | Minor duplication; both are accurate. For consistency, could update plan.md to include the full path, or explicitly reference spec.md Assumptions. No blocking action needed. |
| D5 | LOW | tasks.md Phase 3 Goal (line 176) + tasks.md T008 description (line 183) | "Automatically save document content to recovery location at configurable intervals" restated across Phase 3 Goal and T008 context comment. | Acceptable duplication for task document readability. Phase goals provide context; task descriptions provide specificity. No action needed. |

---

## Entity Definition Analysis

**Key Entities (spec.md lines 106-109)** vs **data-model.md (referenced in plan.md)**:

| Entity | spec.md Definition | Expected data-model.md Definition | Assessment |
|--------|-------------------|----------------------------------|------------|
| RecoveryFile | Business description (identifier, content, timestamp, path) | Zod schema with field types | Proper layering |
| AutosaveSettings | Business description (enabled, interval, retention) | Zod schema + defaults | Proper layering |
| DirtyState | Business description (tracks unsaved changes) | Zustand state shape | Proper layering |
| RecoveryManifest | Business description (index of recoverable docs) | Zod schema + persistence format | Proper layering |

**Assessment**: Entity definitions in spec.md are business-level descriptions appropriate for a specification. The plan.md references data-model.md and contracts/ for implementation schemas. This is **NOT problematic duplication** - it represents proper separation of concerns between specification (what) and implementation (how).

---

## Task Overlap Analysis

Reviewed 27 tasks in tasks.md for overlapping functionality:

| Task Pair | Overlap Assessment | Verdict |
|-----------|-------------------|---------|
| T004 (AutosaveService) vs T021 (Unit tests for AutosaveService) | One implements, one tests | Not duplicates |
| T005 (RecoveryService) vs T022 (Unit tests for RecoveryService) | One implements, one tests | Not duplicates |
| T011 (RecoveryDialog) vs T015 (Content preview) | T015 extends T011 dialog | Not duplicates - additive |
| T012 (Recovery flow) vs T013 (Document restore) | T012 = startup + dialog; T013 = load + open | Distinct responsibilities |
| T016 (Selective recovery) vs T017 (Conflict detection) | T16 = checkbox UI; T17 = mtime comparison | Distinct responsibilities |

**Assessment**: Task descriptions are well-differentiated. No consolidation needed.

---

## Requirement Cross-Reference Check

Checked for requirements that should reference each other but don't:

| Requirement | Should Reference | Issue |
|-------------|------------------|-------|
| FR-008 (clear recovery on save) | FR-001 (autosave interval) | None - independent concerns |
| FR-013 (failure notification) | FR-001 (autosave) | Could clarify "autosave failure" specifically |
| FR-016 (conflict) | FR-015 (atomic write) | None - FR-015 prevents internal corruption; FR-016 handles external changes |

**Assessment**: Requirements are well-isolated. No missing cross-references found.
>>>>>>> 011-autosave-recovery

---

## Summary Statistics

| Metric | Value |
|--------|-------|
<<<<<<< HEAD
| Total Duplications Found | 7 |
| CRITICAL Severity | 0 |
| HIGH Severity | 0 |
| MEDIUM Severity | 3 |
| LOW Severity | 4 |
| Duplication Index | 3.2% (7 duplications across ~220 distinct statements) |

---

## Analysis Details

### Spec.md Duplication Patterns

The spec.md file follows a standard specification pattern where:
1. **User Stories** describe scenarios in Given/When/Then format (test-oriented)
2. **Functional Requirements (FR-xxx)** state the same requirements normatively (implementation-oriented)

This is an **intentional design pattern** (scenarios as test cases, FRs as implementation requirements) and should NOT be consolidated. Issues DUP-004 through DUP-007 reflect this pattern and are marked LOW severity.

### True Duplicates Requiring Attention

1. **DUP-001 (MEDIUM)**: FR-003 and FR-003a represent a structural issue. The sub-numbering suggests a related but distinct requirement, but case-insensitivity is intrinsic to the fuzzy matching specification. Consolidation would improve clarity.

2. **DUP-003 (MEDIUM)**: tasks.md T020 copies edge cases from spec.md rather than referencing them. This creates a maintenance burden - if edge cases are updated in spec.md, tasks.md must be manually synchronized.

### Tasks.md Quality Assessment

The tasks.md file demonstrates good organization:
- No duplicate task definitions
- Clear phase separation with proper sequencing
- No redundant gate validations
- User story tagging ([US1], [US2], etc.) provides traceability
- Dependency graph accurately reflects task relationships

### Plan.md Quality Assessment

The plan.md file has:
- No duplicate sections
- Clean separation of concerns (summary, context, structure, complexity)
- Constitution check table is comprehensive without redundancy
- No duplicate project structure definitions

### Cross-Document Consistency

| Check | Status |
|-------|--------|
| FR numbers match across spec/tasks | PASS |
| User story priorities consistent | PASS |
| Keyboard shortcut consistent | CONFLICT: spec says Cmd/Ctrl+Shift+F, tasks.md note says Mod+P due to conflict |
| Debounce timing consistent | PASS (50ms in all locations) |
| Performance targets consistent | PASS (100ms for 10k files) |

**Note**: The keyboard shortcut discrepancy (Cmd/Ctrl+Shift+F in spec vs Mod+P in tasks) is not duplication but a documented deviation. Tasks.md notes this change was made due to conflict with Find/Replace.
||||||| 908aacf
| Total Duplications Found | 10 |
| HIGH Severity | 2 |
| MEDIUM Severity | 6 |
| LOW Severity | 2 |
| Duplication Index | 7.1% (10 duplications across ~140 requirements) |
=======
| Total Duplications Found | 5 |
| HIGH Severity | 1 |
| MEDIUM Severity | 2 |
| LOW Severity | 2 |
| Duplication Index | 3.1% (5 duplications across ~160 spec/task lines) |
>>>>>>> 011-autosave-recovery

---

## Risk Assessment

<<<<<<< HEAD
### No High-Risk Issues

No duplications create implementation ambiguity or conflicting requirements.
||||||| 908aacf
### High-Risk Duplications (Must Fix)
- **DUP-001**: US1/US6 split creates priority ambiguity for core feature
- **DUP-002**: Minimum width constraint scattered across three locations
=======
### High-Risk Duplications (Should Fix Before Implementation)
- **D1**: Atomic write pattern in 3 places risks divergent implementation if developers reference different sources
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
### Medium-Risk Duplications (Should Fix)
||||||| 908aacf
### Medium-Risk Duplications (Should Fix)
- **DUP-003**: Error click behavior duplicated in two requirement formats
- **DUP-004**: File commands (T003) lack sub-task granularity for separate features
- **DUP-005**: Dirty check triggers not clearly demarcated by context (close vs. open)
- **DUP-007**: Open file workflow traced to three independent sources without clear hierarchy
=======
### Medium-Risk Duplications (Should Fix During Planning)
- **D2**: Conflict handling described 3 times; could lead to inconsistent UI/UX expectations
- **D3**: FR-007 vs Clarifications redundancy adds no value
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
- **DUP-001**: FR-003/FR-003a split creates minor ambiguity about requirement boundaries
- **DUP-002**: Case-insensitivity stated twice could lead to over-testing
- **DUP-003**: Edge case list copied to tasks creates sync maintenance burden

### Low-Risk Duplications (Acceptable)

- **DUP-004 through DUP-007**: These follow the standard spec/test pairing pattern and represent legitimate separation of concerns (requirements vs. test scenarios)
||||||| 908aacf
### Low-Risk Duplications (Nice to Fix)
- **DUP-008**: Preference persistence already well-defined; restatement just verbose
- **DUP-009**: Legitimate separation of concerns; minor redundancy acceptable
- **DUP-010**: Testing requirements naturally repeated; extract to template
=======
### Low-Risk Duplications (Acceptable)
- **D4**: Storage path duplication is minor; both accurate
- **D5**: Phase/task duplication aids readability
>>>>>>> 011-autosave-recovery

---

## Recommended Resolution Priority

<<<<<<< HEAD
1. **Before Implementation**: Fix DUP-001, DUP-003
   - Merge FR-003a into FR-003 for cleaner requirement numbering
   - Update T020 to reference spec.md edge cases by section rather than copying
||||||| 908aacf
1. **Immediate (Block Merge)**: Fix DUP-001, DUP-002
   - These create feature ambiguity and structural inconsistency
   - Corrections required before task start
=======
1. **Before Implementation (Gate)**: Fix D1
   - Atomic write is core safety mechanism; single source of truth required
   - Update FR-015 to be comprehensive; remove restates elsewhere
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
2. **Documentation Enhancement**: Address DUP-002
   - Add cross-reference comment to US2 Scenario 4: "Validates FR-003a"
||||||| 908aacf
2. **Before Testing (Batch Completion)**: Fix DUP-003, DUP-004, DUP-005, DUP-007
   - These reduce traceability and test clarity
   - Address during T012 (Integration Tests) review
=======
2. **During Planning Refinement**: Fix D2, D3
   - Clean up Clarifications section to avoid stale Q&A that duplicates FRs
   - Mark answered questions as resolved with FR references
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
3. **No Action Required**: DUP-004 through DUP-007
   - These represent intentional spec/test separation
   - Maintain as-is for traceability purposes
||||||| 908aacf
3. **Documentation (Post-Merge)**: Fix DUP-008, DUP-010
   - These are efficiency/clarity improvements
   - Can be addressed in CLAUDE.md or project standards

4. **Acceptable As-Is**: DUP-009
   - Represents legitimate separation of user-facing vs. internal concerns

---

## Implementation Guidance

When implementing tasks based on this spec:

1. **Use Requirement Numbers as Primary Reference**: Task developers should work from FR numbers, not from narrative restates
2. **Establish Traceability First**: Create mapping document linking each task to its source requirements before coding
3. **Treat User Stories as Test Scripts**: Each acceptance scenario should map to exactly one task acceptance criterion
4. **Consolidate Before Coding**: Resolve DUP-001, DUP-002, DUP-003 before T001/T003/T004 development to prevent implementation confusion
=======
3. **No Action Needed**: D4, D5
   - These duplications improve document usability without causing confusion
>>>>>>> 011-autosave-recovery

---

## Conclusion

<<<<<<< HEAD
The Smart Filtering specification artifacts exhibit **minimal duplication (3.2% index)** with **no critical or high-severity issues**. The codebase follows good specification practices with clear separation between normative requirements (FR-xxx) and testable scenarios (User Stories).
||||||| 908aacf
The specification exhibits **moderate duplication (7.1% index)** with **2 high-severity issues** requiring resolution before development begins. Most duplication stems from legitimate separation of concerns (requirements vs. user stories vs. tasks) but insufficient cross-referencing. The corrective actions are straightforward—primarily adding cross-references and consolidating redundant statements.
=======
The autosave-recovery specification exhibits **low duplication (3.1% index)** with **1 high-severity issue** requiring resolution. The primary duplication pattern is **answered clarification questions that redundantly restate functional requirements**. This is a common pattern after Q&A sessions and is easily resolved by trimming the Clarifications section.
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
The 3 medium-severity findings are straightforward to resolve:
1. Merge FR-003a into FR-003
2. Update T020 to reference spec.md edge cases
3. Add cross-reference comment to US2 Scenario 4

The 4 low-severity findings represent intentional design patterns and should be preserved for traceability.

**Overall Assessment**: The specification is well-structured and ready for implementation with minor cleanup recommended.
||||||| 908aacf
**Recommended Action**: Fix high-severity issues (DUP-001, DUP-002) before task execution. Address medium-severity issues (DUP-003 through DUP-007) during task planning refinement. Remaining duplications are manageable through careful implementation.
=======
**Overall Assessment**: Specification quality is good. Address D1 before implementation begins; other issues are minor housekeeping.
>>>>>>> 011-autosave-recovery
