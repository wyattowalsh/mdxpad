# Duplication Analysis: Autosave & Crash Recovery (011)

**Feature**: `/specs/011-autosave-recovery/`
**Analysis Date**: 2026-01-17
**Scope**: DUPLICATION issues only (near-duplicate requirements, overlapping tasks, redundant entity definitions)

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
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

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Duplications Found | 5 |
| HIGH Severity | 1 |
| MEDIUM Severity | 2 |
| LOW Severity | 2 |
| Duplication Index | 3.1% (5 duplications across ~160 spec/task lines) |

---

## Risk Assessment

### High-Risk Duplications (Should Fix Before Implementation)
- **D1**: Atomic write pattern in 3 places risks divergent implementation if developers reference different sources

### Medium-Risk Duplications (Should Fix During Planning)
- **D2**: Conflict handling described 3 times; could lead to inconsistent UI/UX expectations
- **D3**: FR-007 vs Clarifications redundancy adds no value

### Low-Risk Duplications (Acceptable)
- **D4**: Storage path duplication is minor; both accurate
- **D5**: Phase/task duplication aids readability

---

## Recommended Resolution Priority

1. **Before Implementation (Gate)**: Fix D1
   - Atomic write is core safety mechanism; single source of truth required
   - Update FR-015 to be comprehensive; remove restates elsewhere

2. **During Planning Refinement**: Fix D2, D3
   - Clean up Clarifications section to avoid stale Q&A that duplicates FRs
   - Mark answered questions as resolved with FR references

3. **No Action Needed**: D4, D5
   - These duplications improve document usability without causing confusion

---

## Conclusion

The autosave-recovery specification exhibits **low duplication (3.1% index)** with **1 high-severity issue** requiring resolution. The primary duplication pattern is **answered clarification questions that redundantly restate functional requirements**. This is a common pattern after Q&A sessions and is easily resolved by trimming the Clarifications section.

**Overall Assessment**: Specification quality is good. Address D1 before implementation begins; other issues are minor housekeeping.
