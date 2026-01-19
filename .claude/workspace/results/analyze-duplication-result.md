# Duplication Analysis: Frontmatter Visual Editor (020)

**Analyzed Files**:
- `/Users/ww/dev/projects/mdxpad-front/.specify/specs/020-frontmatter-editor/spec.md`
- `/Users/ww/dev/projects/mdxpad-front/.specify/specs/020-frontmatter-editor/plan.md`
- `/Users/ww/dev/projects/mdxpad-front/.specify/specs/020-frontmatter-editor/tasks.md`

**Analysis Date**: 2026-01-17

---

## Duplication Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| DUP-001 | Medium | FR-001, FR-002, FR-009 (spec.md lines 109, 110, 124) | Overlapping parsing/serialization/sync requirements. FR-001 covers parsing, FR-002 covers serialization, FR-009 covers bidirectional sync. These are conceptually related but FR-009 implicitly requires FR-001 and FR-002. | Consider consolidating FR-001, FR-002, and FR-009 into a single "bidirectional sync" requirement with sub-bullets for parse/serialize operations, OR clearly note that FR-009 supersedes FR-001/FR-002 for sync context. |
| DUP-002 | Low | US1-AC2 (spec.md ln 21), FR-009 (spec.md ln 124), SC-003 (spec.md ln 148), plan.md ln 18 | The 300ms sync latency requirement appears in 4 separate places with identical wording. | Consolidate to a single authoritative location (likely FR-009) and reference it elsewhere. Currently creates maintenance burden if timing changes. |
| DUP-003 | Low | US1-AC3, US1-AC4, US1-AC5, US3-AC2, US3-AC3, US3-AC4 (spec.md lines 22-24, 56-58) | Field type mentions are scattered across acceptance criteria. US1 mentions date/tags/boolean fields; US3 mentions title/date/tags. FR-005 already enumerates all field types comprehensively. | Remove specific field type mentions from AC where they duplicate FR-005. Keep only the behavioral aspect (e.g., "date field with date picker" becomes "appropriate input type"). |
| DUP-004 | Low | T005 (tasks.md ln 122), T018 (tasks.md ln 195), T037 (tasks.md ln 366) | Three separate tasks for updating the same barrel export file (`src/renderer/lib/frontmatter/index.ts`). Each adds new exports but could be consolidated. | Consider a single "Create and maintain lib barrel export" task that accumulates exports, OR note that T018/T037 are incremental updates to T005's output. |
| DUP-005 | Low | US4-AC1 (spec.md ln 73), US4-AC3 (spec.md ln 75) | AC1 and AC3 both describe validation error appearance/disappearance for the same scenario (invalid input -> error shown; valid input -> error cleared). AC3 is essentially the inverse/continuation of AC1. | Merge into single AC: "Given a field, when I enter an invalid value, then validation error appears; when I correct it, the error disappears immediately." |
| DUP-006 | Low | Edge case ln 102-103 (spec.md), US2-AC3 (spec.md ln 40) | Both mention preserving changes when switching modes. US2-AC3: "unsaved changes preserved when toggling". Edge case: "mode switch waits for pending changes to sync". | Keep US2-AC3 as the canonical requirement; remove or reference from edge case section. |
| DUP-007 | Informational | plan.md Summary (ln 8), spec.md line 6 | Near-duplicate feature descriptions. Plan summarizes spec input almost verbatim. | Acceptable duplication for context, no action needed. |

---

## Summary

**Total Issues Found**: 7 (1 Medium, 5 Low, 1 Informational)

**Most Impactful**: DUP-001 (FR-001/FR-002/FR-009 overlap) - These three requirements describe the same core capability (bidirectional YAML sync) from different angles. During implementation, a developer might implement them separately when they should be a single coherent subsystem.

**No Critical Duplication**: The specification is generally well-organized. Most duplication is low-severity repetition of performance targets or field type enumerations that provides redundancy without contradiction.

**Recommendations Summary**:
1. Consolidate the 300ms sync timing to FR-009 as the single source of truth
2. Review FR-001/FR-002/FR-009 relationship - consider making FR-009 the primary requirement with FR-001/FR-002 as implementation details
3. The barrel export tasks (T005, T018, T037) are acceptable as incremental updates but could note their relationship
