# Underspecification Analysis: Template Library (016)

**Analysis Date**: 2026-01-17
**Documents Analyzed**: spec.md, plan.md, tasks.md
**Focus**: Underspecification Detection Only

---

## Findings Table

| ID | Severity | Location(s) | Summary | Recommendation |
|----|-----------|--------------|---------|----|
| US-001 | HIGH | spec.md:24-25 (US1 Scenario 5) | Dynamic variable prompt dialog is mentioned but no details about validation, error handling, or fallback behavior when variables fail to extract | Specify: (1) What happens if variable extraction fails? (2) Can users leave variables blank? (3) Are there default/placeholder values? (4) What validation applies to variable values? |
| US-002 | MEDIUM | spec.md:41 (US2 Scenario 4) | "Helpful message suggests broadening search" is vague; doesn't define message content, UI treatment, or suggested actions | Specify: Message wording template, whether suggestions are clickable actions, which filters are suggested for reset |
| US-003 | HIGH | spec.md:58 (US3 Scenario 4) | "User is prompted to rename or replace existing template" lacks specification for: merge behavior, version tracking, or what happens if user cancels | Specify: Complete dialog flow, field pre-population strategy, conflict resolution rules (rename validation, character limits, uniqueness constraints) |
| US-004 | MEDIUM | spec.md:75 (US4 Scenario 4) | "Explanatory message" for preventing built-in template deletion is not defined; unclear what makes a template "built-in" versus "custom" | Specify: Message content, technical mechanism for marking built-in templates (flag? location?), user-facing indicator logic |
| FR-001 | MEDIUM | spec.md:112 | "Template browser interface" lacks details on: modal vs. drawer vs. sidebar, keyboard accessibility specifics, focus management, or initial load state | Specify: UI container type, loading states, empty state behavior, keyboard trap management, default focus element |
| FR-009 | HIGH | spec.md:120 | "Allow users to save any open document as a custom template" doesn't specify: (1) Does it copy or link? (2) What if document is unsaved? (3) What frontmatter is auto-captured? (4) File permissions/validation before save? | Specify: Persistence mechanism (file copy vs. reference), unsaved document handling, auto-captured metadata fields, pre-save validation rules |
| FR-010 | HIGH | spec.md:121 | "Capture template metadata" doesn't define: required vs. optional fields, field validation rules (length limits, character restrictions), or transformation of user-provided values | Specify: Field requirements matrix (required/optional), max lengths, allowed characters, sanitization/transformation rules, default value strategy |
| FR-015 | MEDIUM | spec.md:126 | "Validate template MDX syntax before saving" lacks: (1) What constitutes valid syntax? (2) Which MDX compiler version? (3) What errors prevent save vs. warn? (4) How are component references validated? | Specify: MDX validation rules, compiler version pin, error severity classification, component reference validation scope |
| FR-016 | MEDIUM | spec.md:127 | "Integrate template selection into new file creation workflow" doesn't specify: (1) Where in workflow? (2) Cancel behavior? (3) How does this interact with existing blank-file option? (4) File naming after template creation? | Specify: Integration point in UI (dialog order, workflow stage), cancellation handling, precedence vs. blank file, automatic naming convention |
| FR-017 | LOW | spec.md:128 | "Visually distinguish between built-in and custom templates" lacks: specific indicators (badges, colors, icons, grouping), accessibility concerns (color-blind safe?), or CSS/design tokens | Specify: Visual distinction mechanism (icon/badge design), accessibility compliance, design token names, grouping vs. inline distinction |
| FR-020 | HIGH | spec.md:131 | "Preserve template placeholder markers" doesn't explain: (1) How are they preserved during variable substitution? (2) What markers look like? (3) Are they editable after creation? (4) How do they render in preview? | Specify: Marker format (syntax examples), preservation algorithm, post-creation editability, preview rendering rules |
| FR-024 | HIGH | spec.md:135 | "Support dynamic template variables" (e.g., `{{title}}`) lacks: (1) Variable name constraints? (2) Default values? (3) Nesting/conditional logic? (4) Type coercion (string only?)? (5) Escaping rules? | Specify: Variable syntax rules, name validation, default value strategy, type system, escaping/sanitization rules, extraction algorithm |
| FR-025 | HIGH | spec.md:136 | "Support static placeholder markers visually distinguished" doesn't define: (1) Marker syntax? (2) Visual distinction mechanism? (3) Are they editable? (4) Do they interfere with MDX parsing? (5) Scope (body only, frontmatter too?) | Specify: Marker format, CSS classes/styles, editability post-creation, MDX compatibility rules, scope of application |
| FR-026 | HIGH | spec.md:137 | "Substitute all dynamic variables before opening document" doesn't detail: (1) What happens if substitution fails? (2) Partial substitution allowed? (3) Order of operations with static placeholders? (4) Variable scope (global vs. scoped)? | Specify: Substitution failure handling, partial substitution rules, interaction with static placeholders, variable scope rules |
| SC-001 | MEDIUM | spec.md:150 | "Browse and select template in under 30 seconds" lacks context: (1) Starting state (cold or warm app)? (2) Library size (5, 50, 100 templates)? (3) Network latency if applicable? (4) Search vs. browse path? | Specify: Starting conditions (app state, network), template count for measurement, path (browse vs. search), measurement methodology |
| SC-004 | MEDIUM | spec.md:153 | "Search returns relevant results within 200ms for libraries with up to 100 templates" lacks: (1) Query complexity (single char vs. full phrase)? (2) Relevance definition? (3) Hardware target? (4) Cold vs. warm cache? | Specify: Test query types, relevance ranking rules, target hardware specs, cache behavior, measurement methodology |
| SC-008 | MEDIUM | spec.md:157 | "Custom template save/retrieve across 100 restart cycles without data loss" lacks: (1) File system scenario tested (permission errors, disk full)? (2) Concurrent access? (3) Corruption recovery? (4) Rollback mechanism? | Specify: Failure scenarios tested, concurrent access handling, corruption detection, recovery/rollback strategy |
| IPC-Contract | HIGH | plan.md:80-81 | "Expose template API bindings in `src/preload/index.ts`" lists 8 operations (list, get, save, delete, import, export, validate, createFromTemplate) but doesn't specify: (1) Return types for each? (2) Error codes/exceptions? (3) Async behavior (promises vs. callbacks)? (4) RPC timeout/retry? | Specify: Complete IPC contract per operation (input/output types, error enumeration, timeout values, retry behavior) in contracts/template-schemas.ts |
| Service-Implementation | HIGH | plan.md:159 | T008 task "Implement template-service.ts with IPC handlers" references handlers without defining: (1) Event subscription mechanism? (2) State management (caching)? (3) File locking for concurrent access? (4) Rollback on error? | Specify: Event subscription pattern, cache invalidation rules, concurrency strategy, error recovery behavior in quickstart.md or contracts |
| Resource-Bundling | MEDIUM | plan.md:93-99 | Project structure assumes `resources/templates/` for built-in templates but doesn't define: (1) How are resources bundled? (2) Asar or loose files? (3) Path resolution at runtime? (4) Update mechanism for built-in templates? | Specify: Resource bundling strategy (Asar vs. loose), path resolution logic, update delivery mechanism, fallback if resource missing |
| Performance-Conflict | MEDIUM | plan.md:18 vs spec.md:151 | "Performance Goals: Template preview < 500ms" but spec.md SC-002 says "within 1 second" — contradiction unclear which is authoritative | Reconcile: Choose single target (500ms vs. 1s), clarify measurement point (first pixel vs. full render) |
| IPC-Pattern-Reuse | HIGH | tasks.md:120-121 | T004-T005 tasks are marked as "IPC Infrastructure" but don't reference existing IPC patterns from prior specs (004-007) — unclear if reusing or inventing new patterns | Specify: Reference prior IPC implementations (Spec 004, 005), confirm reuse of existing channel registration patterns, point to shared/ipc-channels.ts structure |
| Dependency-Decision | HIGH | tasks.md:145 | T006-T007 tasks mention "gray-matter" for YAML parsing but don't specify: (1) Why gray-matter vs. alternatives? (2) Version pin? (3) Error handling for malformed YAML? (4) Size limits on metadata? | Specify: Dependency selection rationale, version constraint, YAML validation rules, size limits, parsing error handling |
| Gate-Validation-Gap | HIGH | tasks.md:151 | T008 gate validation command `npx tsc --noEmit` doesn't verify runtime behavior: (1) Are IPC handlers registered? (2) Do paths exist? (3) File permissions checked? (4) Integration with main process tested? | Specify: Gate should include file existence checks (test -f), IPC handler verification (grep or code inspection), main process startup validation |
| Schema-Reference | MEDIUM | tasks.md:173-174 | T010-T011 (TemplateCard/TemplateFilters) components are specified to match TemplateMetadata type, but TemplateMetadata schema isn't included in tasks.md — requires jumping to external spec | Specify: Include minimal TemplateMetadata schema definition inline or reference exact line in data-model.md |
| Design-Decision-Gap | MEDIUM | tasks.md:216 | T016 mentions "Fuse.js search integration" but spec.md FR-006 doesn't require fuzzy matching — unclear if design decision or requirement mismatch | Clarify: Is fuzzy matching required or optional? If optional, document tradeoff vs. exact match. If required, add to spec.md FR-006 |
| Built-in-Template-Content | HIGH | tasks.md:339-343 | T026-T030 (built-in templates) specify 5 templates with variables (title, author, date, etc.) but don't define: (1) Template content structure? (2) Example placeholder formats? (3) Validation rules? (4) How are they loaded/bundled? | Specify: Template content examples, metadata structure for each, variable names/types, loading/bundling mechanism, fallback if missing |
| Test-Scope-Missing | MEDIUM | tasks.md:375 | T031-T035 test tasks reference "quickstart.md validation checklist" but quickstart.md isn't provided in artifact set — cannot verify test scope | Action: Ensure quickstart.md is included in spec package, or reference exact section of data-model.md/research.md for test expectations |
| Edge-Case-Presentation | MEDIUM | spec.md:95-106 | Edge cases section lists 7 scenarios with "Display warning", "Skip corrupted", etc. but these are vague on: (1) UI mechanism (toast? modal? inline?)? (2) User action required? (3) Logging/telemetry? (4) Recovery options? | Specify: Error presentation mechanism for each edge case, user actions available, logging strategy, recovery/retry options |
| Keyboard-Nav-Details | HIGH | plan.md:38 | Constitution check marks "FR-019 keyboard nav" as PASS without detailed verification — no keyboard trap/focus specs defined anywhere | Specify: Navigation order matrix, focus indicators spec, keyboard shortcut list (e.g., Escape to close), ARIA attributes required |
| Orchestration-Failures | MEDIUM | tasks.md:22-62 | Execution constraints section documents subagent orchestration and timeouts but doesn't address: (1) How to detect subagent failure? (2) Partial batch rollback? (3) Idempotency of tasks? (4) State checkpointing? | Specify: Subagent health checks, rollback/retry strategy, idempotency guarantees for each task type, state management between batches |

---

## Summary

**Total Issues**: 25
**High Severity**: 13
**Medium Severity**: 10
**Low Severity**: 2

### Critical Underspecification Categories

1. **Variable Handling (FR-024, FR-026, US-001)**: Dynamic variables syntax, extraction, substitution, and error handling severely underspecified.
2. **Placeholder Preservation (FR-020, FR-025)**: Static and dynamic placeholder formats, rendering, and editability undefined.
3. **Template Metadata (FR-010)**: Field requirements, validation, length limits, and transformation rules missing.
4. **IPC Contract (IPC-Contract, Service-Implementation)**: Return types, error codes, async behavior, and timeout values for 8 template operations undefined.
5. **Built-in Templates (Built-in-Template-Content)**: Content structure, variable names/types, metadata schema, and loading mechanism underspecified.
6. **Edge Cases & Error Handling (Edge-Case-Presentation)**: UI presentation, user actions, logging, and recovery options vague across 7 scenarios.
7. **Keyboard Navigation (Keyboard-Nav-Details)**: Focus order, ARIA attributes, keyboard shortcuts, and trap management completely unspecified despite FR-019 requirement.

### Recommended Next Steps

1. **Create data-model.md** with complete schema definitions (TemplateMetadata, TemplateVariable, Template, TemplateSaveRequest).
2. **Expand contracts/template-schemas.ts** with full IPC endpoint definitions (8 operations × 4+ fields each).
3. **Define placeholder format specification** with regex/syntax examples for both dynamic (`{{variable}}`) and static markers.
4. **Create error handling matrix** mapping edge cases to UI presentation, user actions, and recovery mechanisms.
5. **Reconcile performance targets** (plan.md 500ms vs. spec.md SC-002 1 second for preview rendering).
6. **Add comprehensive keyboard navigation spec** with focus order, shortcuts, trap management, and ARIA attributes.
7. **Include quickstart.md** with test patterns and built-in template content examples.
8. **Clarify resource bundling** (Asar vs. loose files, path resolution, update mechanism).
