# Inconsistency Analysis: Template Library Specification

**Analysis Date**: 2026-01-17
**Documents Analyzed**: spec.md, plan.md, tasks.md, data-model.md, template-schemas.ts
**Focus**: Terminology drift, entity mismatches, task ordering, conflicting requirements, schema violations

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|---|---|---|---|---|
| INC-001 | Medium | tasks.md (T004), plan.md (Project Structure) | IPC channel naming inconsistency: T004 asks to add `TEMPLATE_IPC_CHANNEL` and `TEMPLATE_CREATE_CHANNEL` exports to `src/shared/ipc-channels.ts`, but these are already defined in `template-schemas.ts` lines 336-341 | Move IPC channel constants to `ipc-channels.ts` per plan.md structure, or remove T004's instruction to duplicate them. Update template-schemas.ts to import from ipc-channels.ts |
| INC-002 | High | spec.md (FR-020), tasks.md (T012), plan.md (components) | Inconsistency in placeholder terminology: spec.md FR-020 refers to "template placeholder markers" but never explicitly separates static vs. dynamic placeholders in requirements. Spec.md clarifications session (line 165) discusses both `{{title}}` (dynamic) and static markers, but FR-020 and FR-025 don't clearly distinguish them | Clarify FR-020 and FR-025 to explicitly state static placeholders are visually distinguished in editor (separate from dynamic variables which prompt user). Update spec.md edge cases section |
| INC-003 | Medium | plan.md (Project Structure), tasks.md (T008, Phase 2.1) | Task T004 references `src/shared/ipc-channels.ts` in Phase 2.1, but plan.md Project Structure shows `src/shared/` contains only `ipc-channels.ts` with a comment to "Add template IPC channels". This is contradictory—either the file exists or doesn't | Clarify: does `src/shared/ipc-channels.ts` already exist in the project? If yes, T004 should say "add exports to existing". If no, T003 should create it, not just copy contracts |
| INC-004 | Medium | data-model.md (File System Layout, lines 199-211), plan.md (plan.md line 14, Technical Context) | Discrepancy in validation of custom template location: data-model.md specifies custom templates at `~/.mdxpad/templates/` and built-in at app resources. However, no validation rule in data-model.md (V-T007) specifies what "allowed directories" means—conflicts with contract security requirements | Add explicit validation rule in data-model.md: "Custom templates must be in ~/.mdxpad/templates/; built-in templates must be in app resources directory; reject templates outside these paths" |
| INC-005 | Low | spec.md (Requirements FR-018), tasks.md (Phase 7.1, T026-T030), data-model.md (Data Volume Estimates) | Inconsistency in built-in template count: spec.md FR-018 says "minimum set of built-in templates covering common document types" (no specific count). SC-006 specifies "at least 5 common document types". tasks.md Phase 7.1 creates exactly 5 templates (blog, docs, presentation, notes, tutorial). data-model.md Data Volume Estimates lists 5 templates. This is consistent overall but FR-018 is vague | Update FR-018 to explicitly state "System MUST provide at least 5 built-in templates" to match SC-006 |
| INC-006 | Medium | template-schemas.ts (line 81), data-model.md (Template entity, line 21) | Version field required vs. optional mismatch: template-schemas.ts line 81 requires strict semver format `/^\d+\.\d+\.\d+$/` with default "1.0.0" (making it effectively required). data-model.md line 21 says version is "No" (not required). These conflict in requirement status | Update data-model.md line 21 to mark version as "Yes" (required) with default "1.0.0", aligning with template-schemas.ts behavior |
| INC-007 | Low | plan.md (line 14), tasks.md (Phase 7 built-in template tasks), data-model.md (line 210) | Built-in template path clarity: plan.md Technical Context mentions "built-in templates bundled in app resources" but doesn't specify macOS app bundle path. data-model.md line 210 shows `/Applications/mdxpad.app/Contents/Resources/templates/` explicitly. plan.md should match this specificity | Update plan.md Technical Context to specify: "built-in templates bundled in `/Applications/mdxpad.app/Contents/Resources/templates/` per Constitution Article X (macOS target)" |
| INC-008 | High | tasks.md (T005 description, line 121), template-schemas.ts (exports), plan.md (line 80-82) | Preload API bindings mismatch: T005 says expose "list, get, save, delete, import, export, validate, createFromTemplate" (8 operations). template-schemas.ts defines TemplateRequestSchema with 7 action types (lines 265-272: list, get, save, delete, import, export, validate) but CreateFromTemplateRequest is separate (line 308), NOT in the discriminated union. This creates inconsistency | Either add `CreateFromTemplate` action to TemplateRequestSchema discriminated union, or remove "createFromTemplate" from T005 description and handle via separate TEMPLATE_CREATE_CHANNEL |
| INC-009 | Medium | spec.md (FR-024, FR-026), template-schemas.ts (TemplateVariable), tasks.md (T014 description) | Variable substitution flow unclear: FR-024 says "support dynamic template variables that prompt user for values during document creation". FR-026 says "substitute all dynamic variables before opening document". But VariableDialog (T014) description doesn't specify handling of optional vs. required variables. Template-schemas.ts TemplateVariable.required defaults to false, implying optional variables exist, but spec doesn't explain user experience for optional ones | Clarify in spec.md: are optional variables skipped if user leaves blank, or must all variables be provided? Update VariableDialog implementation note with validation rules for required vs. optional |
| INC-010 | Low | data-model.md (Storage Schema example, line 182), template-schemas.ts (TemplateVariableSchema, line 46) | Example default value suggests special date handling: data-model.md shows `default: ""` with comment "Empty = use current date". But template-schemas.ts allows any string as default with no special parsing. This suggests built-in logic for date substitution that isn't reflected in schema or T007 | Either (1) clarify that empty string defaults are literal and template authors handle date logic, or (2) add special case handling for date variables in template-variables.ts (T007) implementation |
| INC-011 | High | plan.md (line 102 "Structure Decision"), spec.md (Clarifications line 167), data-model.md (File System Layout) | Built-in template update mechanism undefined: Clarifications session says "Automatic - built-in templates update silently with the application". But plan.md and data-model.md provide no implementation mechanism. Are templates hard-coded, fetched from remote, or bundled in app? | Add design decision to plan.md: specify whether built-in templates are (A) included in app bundle and update on app version upgrade, (B) cached locally from remote on startup, or (C) bundled and immutable. Current spec assumes (A) but provides no implementation path |
| INC-012 | High | tasks.md (Batch 3.6, T015 description), plan.md (Project Structure, no integration section) | Integration task T015 is underspecified: "Wire up template browser in application shell, connect store to components, handle template selection and document creation flow" lacks concrete acceptance criteria. Missing: (1) where to place browser modal, (2) how new file dialog triggers browser (moved to T024), (3) editor support for static placeholder highlighting (FR-020) | Break T015 into subtasks with clear acceptance criteria: "TemplateBrowser modal renders in application shell, search/filters functional, preview updates on template selection, document creation opens new document in editor with populated content" |
| INC-013 | Low | spec.md (FR-019), tasks.md (T013 description) | Keyboard navigation requirement vague: FR-019 specifies "keyboard navigation within the template browser" but doesn't detail implementation (arrow keys? tab order? Enter to select?). T013 includes "(FR-019)" but provides no implementation guidance. No design document provided | Add keyboard navigation spec to FR-019: "System MUST support arrow keys to navigate templates, Enter to select, Escape to close, Tab/Shift-Tab to move between filters/search/results" |
| INC-014 | Medium | tasks.md (Phase 3.6, T016), plan.md (line 18), spec.md (SC-004 line 153) | Search performance validation gap: spec.md SC-004 targets "200 milliseconds for libraries with up to 100 templates". T016 specifies "Fuse.js search integration" but no performance testing task exists. plan.md includes no benchmark validation | Add performance validation task to Phase 7 (Polish): benchmark Fuse.js with 100-template library, verify < 200ms latency. If threshold not met, add fallback optimization task |
| INC-015 | Medium | data-model.md (Validation Rules V-T006, line 150), template-schemas.ts (TemplateSchema), plan.md | ID uniqueness validation not expressible in schema: data-model.md V-T006 requires "id must be unique within template collection". template-schemas.ts TemplateSchema only validates format (lines 59), not uniqueness. Zod can't express collection-level uniqueness; runtime validation required but no task specifies this | Add implementation note to T008 (template-service.ts): "Validate template ID uniqueness against existing collection on save; return ALREADY_EXISTS error if duplicate; treat name as secondary uniqueness check per FR-010" |

---

## Summary Statistics

- **Total Inconsistencies Found**: 15
- **High Severity**: 4 (INC-001, INC-008, INC-011, INC-012)
- **Medium Severity**: 7 (INC-002, INC-003, INC-004, INC-006, INC-007, INC-014, INC-015)
- **Low Severity**: 4 (INC-005, INC-010, INC-013)

---

## Categories

**Terminology/Naming Drift**: INC-001, INC-007
**Data Model/Schema Mismatches**: INC-006, INC-010, INC-015
**Task Specification Gaps**: INC-002, INC-008, INC-012, INC-013, INC-014
**Conflicting Assumptions/Requirements**: INC-003, INC-004, INC-009, INC-011

---

## Recommended Remediation Priority

**Critical (Block Implementation)**:
1. INC-001: Resolve IPC channel location before Phase 2
2. INC-008: Align preload API bindings with contract before Phase 2
3. INC-003: Clarify ipc-channels.ts existence before Phase 1 setup
4. INC-011: Document built-in template update mechanism before Phase 1

**High (Before Phase 3 User Story Work)**:
5. INC-012: Expand T015 acceptance criteria
6. INC-006: Align version field requirement
7. INC-002: Clarify static vs. dynamic placeholder handling

**Medium (Before Polish Phase)**:
8. INC-004, INC-009, INC-014, INC-015
9. INC-005, INC-007, INC-010, INC-013
