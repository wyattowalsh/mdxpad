<<<<<<< HEAD
# Ambiguity Analysis: Smart Filtering for File Tree

**Feature Branch:** `014-smart-filtering`

**Analyzed Documents:**
- `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/spec.md`
- `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/plan.md`
- `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/tasks.md`

**Analysis Date:** 2026-01-17

---
||||||| 908aacf
# Ambiguity Analysis: 006-Application-Shell spec.md
=======
# Ambiguity Analysis: Autosave & Crash Recovery
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
## Summary
||||||| 908aacf
## Summary
Analyzed spec.md (349 lines) against FR-001 to FR-042 functional requirements, SC-001 to SC-010 success criteria, and non-functional requirements for ambiguity issues.
=======
**Feature**: 011-autosave-recovery
**Analyzed Files**: spec.md, plan.md, tasks.md
**Date**: 2026-01-17
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
The Smart Filtering feature artifacts are well-specified overall, with most requirements having clear, measurable criteria. However, several ambiguity issues were identified that could impact implementation clarity.

**Total Ambiguity Issues Found: 10**

---

## Detailed Findings
||||||| 908aacf
**Total Ambiguity Issues Found: 4**

---

## Detailed Findings
=======
## Findings
>>>>>>> 011-autosave-recovery

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
<<<<<<< HEAD
| AMB-001 | MEDIUM | plan.md L13 | Unresolved clarification marker `(NEEDS CLARIFICATION)` for fuzzy library choice - "fzf-for-js or similar fuzzy library (NEEDS CLARIFICATION)" | Remove marker and confirm `fzf` library selection per tasks.md T001 which already specifies `npm install fzf` |
| AMB-002 | LOW | spec.md L139 | SC-001 states "Users can locate a specific file in a 500+ file project within 5 seconds" but lacks definition of starting/ending measurement points | Clarify: Timer starts when filter input receives first character, ends when user visually identifies target file (or clicks on it) |
| AMB-003 | LOW | spec.md L141 | SC-003 states "95% of users successfully find their target file on first filter attempt" - unmeasurable without user testing infrastructure | Reclassify as aspirational goal or define automated proxy metric (e.g., "filter query produces <=10 results 95% of the time for common patterns in test corpus") |
| AMB-004 | LOW | spec.md L142 | SC-004 "Keyboard shortcut to focus filter is discoverable (documented in UI or command palette)" - "discoverable" is subjective | Already addressed in tasks.md T013 (command palette integration); consider adding tooltip on filter input or menu item for full discoverability |
| AMB-005 | MEDIUM | spec.md L105 | Edge case "Parent folders of matching items remain visible" lacks depth specification - unclear if only immediate parent or entire ancestor chain | Clarify: ALL ancestor folders from root to matching item remain visible (entire path), not just immediate parent. This is implied by FR-004 but should be explicit |
| AMB-006 | MEDIUM | spec.md L108 | Edge case "Truncate or limit input length gracefully" - "gracefully" is vague and unmeasurable | Define specific behavior: truncate at MAX_FILTER_QUERY_LENGTH (100 chars per tasks.md T020 L341), prevent further input, no error toast/message shown |
| AMB-007 | HIGH | spec.md L80, L120; tasks.md L219, L256, L604 | **Keyboard shortcut inconsistency**: spec.md says `Cmd/Ctrl+Shift+F` (L80, L120), but tasks.md Phase 5 title says `Mod+P` (L219) and notes on L604 document conflict with Find/Replace | Resolve conflict immediately: Update spec.md FR-006 and User Story 4 acceptance scenarios to use `Cmd/Ctrl+P` (Mod+P) per the conflict analysis in tasks.md |
| AMB-008 | LOW | spec.md L49 | "all matching files are displayed ranked by match quality" lacks definition of ranking algorithm | Acceptable ambiguity: fzf library provides internal scoring algorithm; document that fzf's default scoring is used without custom re-ranking |
| AMB-009 | LOW | spec.md L106 | "Filter results update automatically" when files change - lacks timing specification | Acceptable given FR-009 exists; could add "within 100ms of file system event notification" for precision, or defer to debounce behavior |
| AMB-010 | MEDIUM | tasks.md L293 | "Clear on project close (optional, based on UX decision)" is an unresolved design decision | Make explicit decision: Recommend NOT clearing on project close to maintain user intent across sessions; update spec.md User Story 5 acceptance scenario if behavior changes |
||||||| 908aacf
|---|---|---|---|---|
| AMB-001 | HIGH | FR-006, Line 184 | "Custom titlebar region MUST be marked as a drag region" - no quantification of which DOM elements qualify or how they're identified. "Interactive elements excluded" lacks specification of which elements are interactive (buttons, links, input fields?). | Define explicit selector pattern or component prop for identifying interactive regions. Example: "All elements with `data-no-drag` attribute or `.no-drag` class are interactive regions. Button, input, and anchor elements within the drag region are non-interactive by default." |
| AMB-002 | MEDIUM | SC-003, Line 269 | "Restored within 100ms of app launch (no visible flash)" - "visible flash" is subjective. What constitutes a visible flash? Needs measurable definition (e.g., "screen rendered with default state for >16ms before preferences applied" or "DOM shows old values before update"). | Replace vague "visible flash" with objective metric: "Preferences must be applied before first paint" or "First visual frame must contain user preferences, not defaults" with acceptance test showing before/after timing. |
| AMB-003 | MEDIUM | SC-009, Line 275 | "MUST maintain at least 60 frames per second (16.67ms frame budget)" - spec says "at least 60 FPS" but then adds "with no dropped frames during continuous interaction." These are contradictory: maintaining 60 FPS allows ~1 dropped frame per second, while "no dropped frames" means 0 drops. | Clarify: either "maintain stable 60 FPS with <5% frame drops allowed" OR "zero dropped frames at 60+ FPS" - pick one and justify why. If zero drops required, acknowledge performance is much stricter than 60 FPS minimum. |
| AMB-004 | MEDIUM | FR-031b, Line 230 | "Error details popover MUST display... (4) dismiss on click outside or Escape key. Popover positioned below the error count badge with arrow pointing to badge." - "below" is positional but doesn't account for viewport edges. What happens if popover would render off-screen (e.g., error count near bottom)? Auto-position above? Clamp to viewport? | Specify collision behavior: "If positioned below would exceed viewport bounds, position above instead. Clamp horizontal position to remain fully visible within window bounds." |
=======
| A1 | HIGH | spec.md:21 (US1-Scenario 2) | "without interrupting the user's editing flow" is subjective and unmeasurable | Define measurable criteria: e.g., "main thread blocked < 16ms" or "no visible input lag during autosave" |
| A2 | HIGH | spec.md:116 (SC-002) | "without perceptible interruption to user typing (no visible lag or pause)" lacks quantified threshold | Define specific latency threshold: e.g., "keystroke-to-display latency increase < 5ms during autosave operations" |
| A3 | MEDIUM | spec.md:76-82 (Edge Cases) | Several edge cases listed as questions without answers: disk space insufficient, read-only documents, corrupted recovery data, large documents exceeding interval | Resolve each edge case with specific behavior: error handling, fallback strategies, and user notifications |
| A4 | MEDIUM | spec.md:99 (FR-013) | "subtle status indicator" is subjective - what constitutes subtle? | Specify indicator type: e.g., "icon-only indicator (no text), muted color, max 16x16px in toolbar" |
| A5 | MEDIUM | spec.md:115 (SC-001) | "at least 95% of their work" lacks measurement method | Define how recovery percentage is measured: character count, document count, or time-weighted content |
| A6 | MEDIUM | spec.md:52 (US3-Scenario 1) | "identifying information" is vague - what fields constitute identifying info? | Specify exact fields: file path, timestamp, document title, preview snippet length, character count |
| A7 | LOW | plan.md:18 (Performance Goals) | "Autosave < 16ms main thread impact" is good but "recovery dialog < 2s" lacks specificity on what 2s measures | Clarify: time to render, time to fetch data, or total time from app launch to dialog visible? |
| A8 | LOW | plan.md:20 (Scale/Scope) | "max 50 recovery files" - is this a hard limit or soft limit? What happens at 51? | Specify behavior when limit reached: error, oldest deleted, warning shown? |
| A9 | LOW | spec.md:139 (Assumptions) | "default autosave interval of 30 seconds balances protection with performance" - no rationale for why 30s is balanced | Consider documenting the tradeoff analysis or making this configurable with user research backing |
| A10 | LOW | tasks.md:176-177 (Phase 3 Independent Test) | "wait 30s" assumes default interval but user might have configured different value | Test should use known interval or reset to default before test |
>>>>>>> 011-autosave-recovery

## Summary

<<<<<<< HEAD
## Issues by Severity
||||||| 908aacf
## Requirements Coverage Assessment
=======
- **CRITICAL**: 0 issues
- **HIGH**: 2 issues (A1, A2) - both relate to "perceptible/visible" lag without quantified thresholds
- **MEDIUM**: 4 issues (A3-A6) - unresolved edge cases and vague UI descriptions
- **LOW**: 4 issues (A7-A10) - minor clarifications needed
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
### Critical Issues (0)
||||||| 908aacf
### Functional Requirements (FR-001 to FR-042)
- **FR-001 to FR-005**: Clear and testable
- **FR-006**: **AMBIGUOUS** - Drag region marking not precisely defined (see AMB-001)
- **FR-007 to FR-032**: Clear with measurable criteria
- **FR-031a, FR-031b**: **AMBIGUOUS** - Popover positioning behavior incomplete (see AMB-004)
- **FR-033 to FR-042**: Clear and testable
=======
## Priority Recommendations
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
None identified. All requirements have sufficient detail to begin implementation.
||||||| 908aacf
### Success Criteria (SC-001 to SC-010)
- **SC-001**: Clear ("under 5 seconds excluding typing time")
- **SC-002**: Clear (500ms)
- **SC-003**: **AMBIGUOUS** - "Visible flash" undefined (see AMB-002)
- **SC-004 to SC-006**: Clear with precise metrics
- **SC-007**: Clear
- **SC-008**: Clear (2 seconds)
- **SC-009**: **AMBIGUOUS** - Contradictory frame rate requirements (see AMB-003)
- **SC-010**: Clear with recovery scenarios defined
=======
1. **Address A1 and A2 first**: The vague "no visible lag" criteria in both the acceptance scenario and success criteria could lead to disputes about whether the feature meets requirements. Recommend defining specific latency budgets (e.g., "< 16ms main thread block" is already in plan.md but not reflected in spec.md success criteria).
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
### High Severity Issues (1)

| ID | Issue | Impact |
|----|-------|--------|
| AMB-007 | Keyboard shortcut conflict between spec (`Cmd/Ctrl+Shift+F`) and tasks (`Mod+P`) | Implementers will be confused which shortcut to use; spec and implementation will diverge |

**Required Action:** Update spec.md FR-006 from `Cmd/Ctrl+Shift+F` to `Cmd/Ctrl+P` to match the conflict resolution documented in tasks.md L604.

### Medium Severity Issues (4)

| ID | Issue |
|----|-------|
| AMB-001 | Unresolved `(NEEDS CLARIFICATION)` placeholder in plan.md |
| AMB-005 | Ancestor folder visibility depth unspecified |
| AMB-006 | "Gracefully" truncate is vague |
| AMB-010 | Unresolved UX decision for project close behavior |

### Low Severity Issues (5)

| ID | Issue |
|----|-------|
| AMB-002 | SC-001 timing measurement undefined |
| AMB-003 | SC-003 unmeasurable without user testing |
| AMB-004 | "Discoverable" is subjective |
| AMB-008 | Ranking algorithm not specified |
| AMB-009 | File change update timing unspecified |
||||||| 908aacf
### Non-Functional Requirements
- **Performance section**: Vague terms ("not cause visible jank") but not critical to implementation since more specific SCs override
- **Reliability section**: Clear with specific requirements
- **Accessibility section**: Clear requirements
- **Maintainability section**: Clear architectural directives
=======
2. **Resolve edge cases (A3)**: The edge cases section lists important scenarios as questions. Before implementation, each should have a defined behavior to prevent implementation ambiguity.
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
---

## Vague Terms Audit

| Term | Location | Status | Notes |
|------|----------|--------|-------|
| "quickly" | spec.md L22 (US1) | ACCEPTABLE | Quantified by SC-001 (5 seconds) and SC-002 (100ms) |
| "rapidly" | spec.md L22 (US1) | ACCEPTABLE | Same as above - covered by SCs |
| "gracefully" | spec.md L108 | VAGUE | Needs measurable definition (see AMB-006) |
| "discoverable" | spec.md L142 | VAGUE | Addressed by implementation (command palette) but subjective |
| "automatically" | spec.md L106, L123 | ACCEPTABLE | Clear intent; timing could be specified |
| "similar" | plan.md L13 | VAGUE | Placeholder marker present (see AMB-001) |

---

## Placeholder Audit

| Placeholder | Location | Status |
|-------------|----------|--------|
| `(NEEDS CLARIFICATION)` | plan.md L13 | UNRESOLVED - library choice documented elsewhere but marker remains |
| TODO | Not found | PASS |
| TKTK | Not found | PASS |
| ??? | Not found | PASS |
| TBD | plan.md L32 | ACCEPTABLE - "TBD" for Article V compliance will be validated at runtime |
| `<placeholder>` | Not found | PASS |

---

## Testing Feasibility Assessment

| Requirement Type | Testable? | Notes |
|------------------|-----------|-------|
| FR-001 to FR-013 | YES | All have clear acceptance criteria |
| SC-001 | PARTIAL | Timing measurement points unclear |
| SC-002 | YES | 100ms latency measurable |
| SC-003 | NO | Requires user study |
| SC-004 | YES | Command palette presence verifiable |
| SC-005 | YES | Persistence testable via restart |
| SC-006 | YES | fzf behavior well-defined |
| Acceptance Scenarios | YES | All use Given/When/Then format with verifiable outcomes |

---

## What Was Checked

1. **Vague adjectives:** Searched for "fast", "scalable", "secure", "intuitive", "robust" - none found without measurable criteria
2. **Placeholders:** Found one `(NEEDS CLARIFICATION)` marker in plan.md and one `TBD` (acceptable)
3. **Undefined terms:** All key terms (FilterQuery, MatchResult, fzf-style, etc.) are defined in spec or referenced documents
4. **Untestable acceptance criteria:** All acceptance scenarios use Given/When/Then format with verifiable outcomes
5. **"Should" statements:** Reviewed for clarity - all converted to MUST in functional requirements
6. **Cross-document consistency:** Identified keyboard shortcut discrepancy

---

## Recommendations Priority

### P0 (Resolve before implementation)
1. **AMB-007** - Keyboard shortcut conflict must be resolved to prevent spec/implementation divergence

### P1 (Resolve before Phase 3)
2. **AMB-001** - Remove `(NEEDS CLARIFICATION)` marker from plan.md
3. **AMB-010** - Make explicit decision on project close behavior

### P2 (Resolve before testing)
4. **AMB-005** - Clarify ancestor visibility in edge cases
5. **AMB-006** - Define graceful truncation behavior

### P3 (Documentation improvements)
6. AMB-002, AMB-003, AMB-004, AMB-008, AMB-009 - Minor clarifications

---

## Conclusion

**Spec Quality: GOOD** - The artifacts are implementation-ready with 10 ambiguity issues identified, only 1 at HIGH severity. The keyboard shortcut inconsistency (AMB-007) is the only blocking issue that should be resolved before implementation begins.

### Metrics Summary

| Metric | Value |
|--------|-------|
| Total issues | 10 |
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 5 |
| Unresolved placeholders | 1 |

### Immediate Actions Required

1. Update spec.md FR-006 and User Story 4 to use `Cmd/Ctrl+P` instead of `Cmd/Ctrl+Shift+F`
2. Remove `(NEEDS CLARIFICATION)` from plan.md L13 since library is confirmed as `fzf`
3. Document decision on project close filter behavior in spec.md User Story 5
||||||| 908aacf
---

## Vague Terms Audit
The following terms appear but are either:
1. Defined by success criteria with measurable values, or
2. Used in accepted technical contexts

| Term | Location | Status | Notes |
|---|---|---|---|
| "real-time" | SC-002 | ✓ Quantified | Defined as "within 500ms of typing pause" |
| "visible jank" | NFR Performance | ⚠ Informal | Not critical; SC-009 provides measurable alternative (60 FPS) |
| "user-friendly error message" | FR-023 | ⚠ Subjective | Acceptable - implementation detail; clear intent of "not cryptic" |
| "gracefully" | FR-023 | ✓ Defined by context | Combined with SC-010 for error recovery behavior |
| "no visible flash" | SC-003 | ✗ Undefined | **AMBIGUOUS** - needs measurable definition (see AMB-002) |

---

## Unresolved Placeholders Check
✓ **PASS** - No unresolved placeholders (TODO, TKTK, ???, etc.) found in spec

---

## Testing Feasibility Assessment

| Category | Status | Notes |
|---|---|---|
| FR requirements | TESTABLE | All FRs have clear acceptance scenarios or measurable criteria |
| SC criteria | MOSTLY TESTABLE | SC-003 and SC-009 require clarification |
| Non-functional | TESTABLE | Measurable performance targets defined in SCs |

---

## Recommendations Priority

### P0 (Resolve before implementation)
1. **AMB-003** (SC-009) - Frame rate contradiction must be resolved; conflicting requirements can cause acceptance failures

### P1 (Resolve before testing)
2. **AMB-001** (FR-006) - Drag region specification needed for QA verification
3. **AMB-002** (SC-003) - "Visible flash" definition needed for performance acceptance testing

### P2 (Resolve before production)
4. **AMB-004** (FR-031b) - Popover positioning edge cases impact UX quality

---

## Conclusion

**Spec Quality: GOOD** - Ambiguity is limited to 4 issues, mostly edge cases and visual behaviors. The core 32 functional requirements and 8 core success criteria are well-defined and testable. The three high-priority issues should be resolved before implementation begins, particularly the contradictory frame rate requirement in SC-009.

### Next Steps
1. Clarify SC-009 frame rate requirement with stakeholder
2. Define SC-003 "visible flash" with technical acceptance test
3. Add drag region selector specification to FR-006
4. Add popover collision handling behavior to FR-031b
=======
3. **Quantify "identifying information" (A6)**: The recovery dialog's content should be explicitly specified to ensure consistent implementation.
>>>>>>> 011-autosave-recovery
