# Underspecification Analysis: Frontmatter Visual Editor (020)

**Analyzed Documents**:
- `/Users/ww/dev/projects/mdxpad-front/.specify/specs/020-frontmatter-editor/spec.md`
- `/Users/ww/dev/projects/mdxpad-front/.specify/specs/020-frontmatter-editor/plan.md`
- `/Users/ww/dev/projects/mdxpad-front/.specify/specs/020-frontmatter-editor/tasks.md`

**Analysis Date**: 2026-01-17

---

## Underspecification Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| US-001 | Medium | spec.md Edge Case (line 103) | "most recent change wins" for simultaneous edits lacks specification on how conflicts are detected, what "simultaneous" means (time window), and how users are notified of overwritten changes | Define conflict detection window (e.g., within 50ms), specify whether overwritten changes are logged/recoverable, and add acceptance scenario for conflict resolution |
| US-002 | Medium | spec.md FR-016 (line 131) | "preserve YAML formatting preferences when possible" - verb "preserve" has no measurable outcome; unclear what "when possible" means and what happens when not possible | Define specific formatting options to preserve (indent: 2 vs 4, quote style, etc.), specify fallback behavior, add acceptance scenario |
| US-003 | Low | spec.md User Story 4, scenario 2 (line 74) | "required field (if schema specifies)" - parenthetical condition lacks specification of default behavior when no schema present; should required fields be inferred from existing patterns? | Clarify whether required field validation only applies with schema, or if there's default required field detection (e.g., title field) |
| US-004 | Medium | spec.md Edge Case (line 99) | "editor shows a warning and offers raw mode for editing" complex YAML features - no specification of what the warning UI looks like, whether partial form editing is allowed, or how user transitions to raw mode | Add FR specifying warning UI component, define which fields remain editable vs locked, specify transition flow |
| US-005 | Low | spec.md Edge Case (line 101) | "offers to fix the formatting" for malformed frontmatter delimiters - no specification of what "fix" means (auto-fix vs manual guidance), what transformations are applied | Define specific fix behavior: insert missing delimiter, correct mismatched delimiters, or just provide error message with manual instructions |
| US-006 | Medium | tasks.md T019 (line 208) | "Integrate FrontmatterPanel into application shell layout" - references `src/renderer/App.tsx` in context comment but App.tsx is not defined in plan.md project structure | Add App.tsx or shell component to plan.md project structure, or reference existing integration point from Spec 006 |
| US-007 | Low | plan.md (line 17) | "electron-store for user schema defaults" - storage mechanism mentioned but no specification of schema/shape for user defaults, or how they're managed | Add data-model section for user settings schema, or reference existing user settings store from another spec |
| US-008 | Medium | spec.md FR-009 (line 124) | "within 300ms of change detection" - sync timing specified but no error handling for when sync fails (e.g., invalid YAML after form edit) | Add FR specifying sync error recovery: rollback behavior, error notification, retry mechanism |
| US-009 | Low | spec.md FR-005 (line 120) | "Object (nested form or key-value editor)" - two different UI approaches mentioned ("nested form or key-value editor") without decision criteria for which to use | Specify: use nested form for defined schema fields, key-value editor for arbitrary objects; or commit to single approach |
| US-010 | Medium | tasks.md Phase 8 (lines 380-398) | ObjectField component task references "depth limit (2 levels)" in gate on-fail comment (line 398) but this constraint is not specified in spec.md or plan.md | Add to spec.md: max nesting depth for visual editing (e.g., 2 levels), behavior beyond limit (switch to raw mode) |
| US-011 | Low | spec.md User Story 5, scenario 1 (line 90) | "project has a frontmatter schema definition" - no acceptance criteria for what happens when schema file exists but is invalid JSON/Schema | Add acceptance scenario: Given invalid schema file, When opening editor, Then fallback to type inference with warning |
| US-012 | Medium | spec.md FR-012 (line 127) | "user settings defaults" as fallback schema source - no specification of how user creates/manages these defaults, or default values for fresh installation | Add specification for user settings UI/management, define built-in defaults for common fields |
| US-013 | Low | tasks.md T046 (line 446) | "keyboard navigation support (Tab through fields, Escape to close)" - no corresponding FR in spec.md for keyboard accessibility | Add FR for keyboard navigation requirements including focus management, shortcuts, screen reader support |
| US-014 | Medium | spec.md Edge Case (line 102) | "Changes are debounced and mode switch waits for pending changes to sync" during active typing - no specification of debounce duration or maximum wait time before mode switch proceeds | Specify debounce duration (e.g., 150ms as in recovery playbook), max wait time, behavior if sync fails during mode switch |

---

## Summary

**Total Issues Found**: 14

| Severity | Count |
|----------|-------|
| High | 0 |
| Medium | 7 |
| Low | 7 |

**Key Areas Requiring Clarification**:
1. **Conflict resolution** (US-001, US-008): Simultaneous edit handling and sync failure recovery
2. **Formatting preservation** (US-002): YAML formatting options need concrete specification
3. **Nested objects** (US-009, US-010): Depth limits and UI approach need specification
4. **Schema handling** (US-003, US-011, US-012): Invalid schema and user defaults handling
5. **Integration points** (US-006, US-007): References to undefined files/stores

**Recommendation**: Address Medium severity issues before implementation begins, particularly US-001, US-006, US-008, and US-010 as these affect core functionality and could cause implementation ambiguity.
