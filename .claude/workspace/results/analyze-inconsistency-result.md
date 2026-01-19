# Inconsistency Analysis: Frontmatter Visual Editor (020)

**Analyzed Files**:
- `/Users/ww/dev/projects/mdxpad-front/.specify/specs/020-frontmatter-editor/spec.md`
- `/Users/ww/dev/projects/mdxpad-front/.specify/specs/020-frontmatter-editor/plan.md`
- `/Users/ww/dev/projects/mdxpad-front/.specify/specs/020-frontmatter-editor/tasks.md`

**Analysis Date**: 2026-01-17

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| INC-001 | Low | plan.md (lines 96-106), tasks.md (lines 410-413, 425) | **Test file path inconsistency**: plan.md specifies test files at `tests/unit/frontmatter/*.test.ts` and `tests/e2e/frontmatter-editor.spec.ts`, but tasks.md places tests at `src/renderer/lib/frontmatter/__tests__/*.test.ts` and `src/renderer/stores/frontmatter-store.test.ts` | Align on one convention. The tasks.md co-location pattern (`__tests__/` adjacent to source) appears to be the preferred modern approach. Update plan.md project structure section to match tasks.md. |
| INC-002 | Low | spec.md (line 139), tasks.md (Phase 3 Batch 3.1) | **FieldType enumeration completeness**: spec.md Key Entities defines FieldType as "text, textarea, number, boolean, date, array, object", but Phase 3 Batch 3.1 tasks (T007-T013) do not include ObjectField - it appears separately in Phase 8. This is not strictly inconsistent but could cause confusion. | Add a note in tasks.md Phase 3 clarifying ObjectField is deferred to Phase 8 as an edge case, or reference spec.md edge case section for nested objects. |
| INC-003 | Low | plan.md (line 14), tasks.md (lines 633-646, 652-656) | **Phase dependency diagram inconsistency**: The ASCII dependency chart (lines 633-646) shows Phases 3-8 branching directly from Phase 2, but the "User Story Independence" table (lines 652-656) correctly states US2-US5 depend on "US1 Batch 3.4" (T019 integration). The mermaid graph correctly shows T019 as the dependency point. | Update the text diagram at lines 633-646 to show Phases 4-8 branch from Phase 3 (after T019), not Phase 2, to match the dependency table and mermaid graph. |
| INC-004 | Medium | spec.md (line 128, FR-010), plan.md (lines 85-91), tasks.md (T028) | **Missing validation.ts in plan.md project structure**: spec.md FR-010 requires field validation, and tasks.md creates `validation.ts` (T028), but plan.md's project structure section (lines 85-91) does not list `src/renderer/lib/frontmatter/validation.ts` in the lib folder | Add `validation.ts` to the plan.md project structure under `src/renderer/lib/frontmatter/` |
| INC-005 | Low | spec.md (line 169), plan.md (line 19), tasks.md (passim) | **Panel location terminology consistency**: spec.md says "collapsible panel in the application sidebar", plan.md says "Collapsible sidebar panel" and "runs in sidebar alongside editor", tasks.md just says "panel". All consistent in meaning but slight terminology variation. | No action needed - semantically consistent. |

---

## Summary

**Total Issues Found**: 5
- **High Severity**: 0
- **Medium Severity**: 1 (INC-004)
- **Low Severity**: 4 (INC-001, INC-002, INC-003, INC-005)

The documents are generally well-aligned. The most actionable finding is **INC-004** where the plan.md project structure is missing the `validation.ts` file that is clearly required by the spec and created in tasks. The test path inconsistency (INC-001) should also be resolved before implementation begins.

No critical conflicts or blocking inconsistencies were detected. The feature can proceed to implementation with minor plan.md updates recommended.

---

## Detailed Analysis

### Areas Checked

1. **Terminology drift**: Checked naming of panel, form, fields, modes across all three files
2. **Data entities**: Verified FrontmatterData, FrontmatterField, FrontmatterSchema, FieldType, ValidationResult referenced consistently
3. **Task ordering**: Confirmed dependency graph matches stated dependencies
4. **File paths**: Compared project structure in plan.md vs actual task file paths
5. **Conflicting requirements**: None found - all three documents align on bidirectional sync, 300ms latency, validation feedback

### Consistency Verified

| Aspect | Status |
|--------|--------|
| Field types enumeration | Consistent (text, textarea, number, boolean, date, array, object) |
| Performance thresholds | Consistent (200ms panel open, 300ms sync, 100ms validation) |
| Storage mechanism | Consistent (localStorage for panel visibility) |
| Schema file name | Consistent (`frontmatter.schema.json`) |
| Store name | Consistent (`frontmatter-store.ts`) |
| Mode naming | Consistent (visual/raw modes) |
| Sync direction | Consistent (bidirectional) |

---

**Status**: PASSED with minor recommendations
**Confidence Level**: High
