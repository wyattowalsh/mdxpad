# Duplication Analysis: Application Shell (006)

**Analyzed Files**:
- `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/plan.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/tasks.md`

**Date**: 2026-01-10

---

## Duplication Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| D1 | MEDIUM | US3 AC4 (spec.md:85) vs US4 AC1 (spec.md:99) | Both describe dirty check dialog when opening another file vs closing window. US3 AC4 says "confirmation dialog appears asking to save, discard, or cancel" while US4 AC1 says "dialog appears with Save, Don't Save, and Cancel options". Same dialog, different wording for discard vs "Don't Save". | Consolidate terminology: use "Don't Save" consistently (matches macOS convention). Reference US4's dialog definition from US3. |
| D2 | LOW | US2 AC4 (spec.md:68) vs FR-008 (spec.md:188) | US2 AC4: "a dirty indicator appears in the status bar" overlaps with FR-008: "System MUST mark a document as dirty whenever content changes". Acceptance scenario is implementation detail covered by requirement. | Keep FR-008 as the canonical requirement. US2 AC4 is acceptable as user-observable behavior but consider rewording to focus on user observation rather than system behavior. |
| D3 | MEDIUM | US4 (spec.md:89-104) vs FR-024 to FR-027 (spec.md:218-222) | User Story 4 has 5 acceptance scenarios that map directly to 4 functional requirements (FR-024-027). US4 AC1/AC2/AC3/AC4/AC5 essentially restate FR-024/025/026/027 in Given/When/Then format. | This is expected overlap between acceptance criteria and requirements. No action needed, but ensure test cases reference FRs rather than duplicating verification logic. |
| D4 | HIGH | FR-017 (spec.md:204) vs FR-017a (spec.md:205) | FR-017: "show dirty check dialog before opening if current document has unsaved changes" vs FR-017a: "check if the current file has been modified externally when the window regains focus". These are different features with confusingly similar IDs. FR-017a is external modification detection, not a sub-requirement of FR-017 (dirty check). | Renumber FR-017a to a separate ID (e.g., FR-042 or FR-017.5) to avoid confusion during implementation. External modification detection is distinct from dirty-check-on-open. |
| D5 | LOW | US5 AC5 (spec.md:121) vs FR-031a (spec.md:229) | Both describe error click behavior with identical wording: "(1) jumping cursor to first error line in editor, (2) showing error details popover, and (3) scrolling preview to show the error". Verbatim duplicate. | Keep FR-031a as canonical. Simplify US5 AC5 to reference FR-031a or use shorter phrasing like "all error navigation actions occur per FR-031a". |
| D6 | MEDIUM | T003 AC (tasks.md:136-143) vs T011 AC (tasks.md:337-340) | T003 defines file commands with shortcuts (Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+W). T011 defines menu items with "correct accelerators (Cmd+N, Cmd+O, etc.)". Both tasks independently define the same keyboard shortcuts. | Reference a single source of truth for shortcuts. Either T003 defines shortcuts that T011 must match, or create a shared constants file referenced by both tasks. |
| D7 | LOW | spec.md Glossary "Dirty" (line 344) vs FR-008 (line 188) | Glossary defines dirty as "current content differs from last saved content". FR-008 says "mark a document as dirty whenever content changes from the last saved state". Same definition in two places. | Acceptable redundancy - glossary serves documentation purpose. No action needed. |
| D8 | MEDIUM | T001 AC "isDirty derived from content !== savedContent" (tasks.md:86) vs Glossary definition (spec.md:344) | Both define isDirty computation identically. T001 implementation detail duplicates spec glossary. | T001 should reference spec glossary rather than redefining. Change AC to "isDirty derived per spec glossary definition". |
| D9 | LOW | US1 AC3 (spec.md:50) vs US6 AC1 (spec.md:135) | US1 AC3: "new split ratio is preserved and restored on next app launch". US6 AC1: "user adjusts the split pane divider, When they relaunch the app, Then the split ratio is restored". Same functionality tested in two user stories. | US1 focuses on editing workflow, US6 on settings persistence. The overlap is intentional cross-story verification. Mark as "integration test" rather than duplicating unit tests. |
| D10 | MEDIUM | T004 AC (tasks.md:167-174) vs T007 AC (tasks.md:239-243) | T004 creates ErrorCount with "onErrorClick callback prop supported". T007 wires "error click from StatusBar to editor navigation". T007 depends on T004's callback but re-specifies the click behavior. | Clarify boundary: T004 implements the callback interface, T007 implements the handler. T007 ACs should not re-test that clicking works, only that the handler performs all three actions. |
| D11 | LOW | plan.md "Performance Goals" (line 25) vs tasks.md T014 AC (lines 408-414) | Plan states "Cold start < 2s, keystroke latency < 16ms, preview compile < 500ms". T014 lists same metrics plus additional ones (SC-003, SC-006, SC-009). Minor overlap between design goals and validation criteria. | Acceptable - plan states goals, T014 validates them. T014 is more comprehensive. No action needed. |
| D12 | MEDIUM | FR-037a (spec.md:243) vs Edge Cases preview compilation timeout (spec.md:167) | FR-037a: "timeout preview compilation after 3 seconds". Edge case: "timeout after 3 seconds and show error". Same timeout value and behavior defined in two sections. | Keep FR-037a as canonical requirement. Edge case section should reference FR-037a rather than redefining the timeout. |

---

## Summary by Severity

| Severity | Count | Action Required |
|----------|-------|-----------------|
| HIGH | 1 | Immediate renumbering needed (D4) |
| MEDIUM | 6 | Consolidation or reference updates recommended (D1, D3, D6, D8, D10, D12) |
| LOW | 5 | Minor wording or acceptable redundancy (D2, D5, D7, D9, D11) |

---

## Recommendations

### Immediate Actions (HIGH severity)

1. **D4**: Renumber FR-017a to FR-042 (External File Modification Detection) to clearly separate it from FR-017 (Dirty Check on Open). These are distinct features and the current numbering creates implementation ambiguity.

### Pre-Implementation Actions (MEDIUM severity)

2. **D1**: Standardize dialog terminology to "Save / Don't Save / Cancel" across all user stories and requirements (matches macOS Human Interface Guidelines).

3. **D6**: Create a `SHORTCUTS.md` or constants file that T003 and T011 both reference to prevent shortcut definition drift.

4. **D8**: Update T001 acceptance criteria to reference spec glossary definition rather than duplicating.

5. **D10**: Clarify T004 vs T007 boundary - T004 owns the component interface, T007 owns the integration behavior.

6. **D12**: Update Edge Cases section to say "timeout after 3 seconds per FR-037a" rather than duplicating the value.

### No Action Required (LOW severity)

Items D2, D5, D7, D9, and D11 represent acceptable specification redundancy that aids readability without creating implementation risk.

---

## Quality Assessment

The specification is generally well-structured with clear separation between user stories, functional requirements, and implementation tasks. The duplication found is mostly benign overlap between different abstraction levels (user stories vs requirements vs tasks).

The one HIGH severity issue (D4) should be addressed before implementation begins to prevent confusion during development. The MEDIUM severity items are recommendations for improved maintainability but do not block implementation.
