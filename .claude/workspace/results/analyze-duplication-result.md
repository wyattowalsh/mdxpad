# Duplication Analysis: Application Shell (006)

**Analysis Date**: 2026-01-17
**Spec**: spec.md | **Tasks**: tasks.md
**Focus**: Functional Requirements (FR-001 to FR-042) and User Stories (US1-US7) vs Tasks (T001-T014)

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
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

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Duplications Found | 10 |
| HIGH Severity | 2 |
| MEDIUM Severity | 6 |
| LOW Severity | 2 |
| Duplication Index | 7.1% (10 duplications across ~140 requirements) |

---

## Risk Assessment

### High-Risk Duplications (Must Fix)
- **DUP-001**: US1/US6 split creates priority ambiguity for core feature
- **DUP-002**: Minimum width constraint scattered across three locations

### Medium-Risk Duplications (Should Fix)
- **DUP-003**: Error click behavior duplicated in two requirement formats
- **DUP-004**: File commands (T003) lack sub-task granularity for separate features
- **DUP-005**: Dirty check triggers not clearly demarcated by context (close vs. open)
- **DUP-007**: Open file workflow traced to three independent sources without clear hierarchy

### Low-Risk Duplications (Nice to Fix)
- **DUP-008**: Preference persistence already well-defined; restatement just verbose
- **DUP-009**: Legitimate separation of concerns; minor redundancy acceptable
- **DUP-010**: Testing requirements naturally repeated; extract to template

---

## Recommended Resolution Priority

1. **Immediate (Block Merge)**: Fix DUP-001, DUP-002
   - These create feature ambiguity and structural inconsistency
   - Corrections required before task start

2. **Before Testing (Batch Completion)**: Fix DUP-003, DUP-004, DUP-005, DUP-007
   - These reduce traceability and test clarity
   - Address during T012 (Integration Tests) review

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

---

## Conclusion

The specification exhibits **moderate duplication (7.1% index)** with **2 high-severity issues** requiring resolution before development begins. Most duplication stems from legitimate separation of concerns (requirements vs. user stories vs. tasks) but insufficient cross-referencing. The corrective actions are straightforward—primarily adding cross-references and consolidating redundant statements.

**Recommended Action**: Fix high-severity issues (DUP-001, DUP-002) before task execution. Address medium-severity issues (DUP-003 through DUP-007) during task planning refinement. Remaining duplications are manageable through careful implementation.
