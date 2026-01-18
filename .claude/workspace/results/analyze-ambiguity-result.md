# Ambiguity Analysis: Smart Filtering for File Tree

**Feature Branch:** `014-smart-filtering`

**Analyzed Documents:**
- `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/spec.md`
- `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/plan.md`
- `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/tasks.md`

**Analysis Date:** 2026-01-17

---

## Summary

The Smart Filtering feature artifacts are well-specified overall, with most requirements having clear, measurable criteria. However, several ambiguity issues were identified that could impact implementation clarity.

**Total Ambiguity Issues Found: 10**

---

## Detailed Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
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

---

## Issues by Severity

### Critical Issues (0)

None identified. All requirements have sufficient detail to begin implementation.

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
