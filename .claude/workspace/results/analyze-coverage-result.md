# Coverage Gap Analysis: Frontmatter Visual Editor

**Feature**: `020-frontmatter-editor`
**Analyzed**: 2026-01-17
**Documents**: spec.md, plan.md, tasks.md

---

## Coverage Mapping Table

### Functional Requirements Coverage

| Requirement | Has Task? | Task IDs | Notes |
|-------------|-----------|----------|-------|
| FR-001: Parse YAML frontmatter to form fields | Yes | T003 | Parser implementation |
| FR-002: Serialize form changes to YAML | Yes | T003 | Parser handles stringify |
| FR-003: Toggle visual/raw modes | Yes | T020, T021, T022 | Phase 4 |
| FR-004: Preserve data integrity on mode switch | Yes | T022, T023 | Mode toggle validation |
| FR-005: Support field types (text, textarea, number, boolean, date, array, object) | Partial | T007-T012, T038 | ObjectField in Phase 8 |
| FR-006: Common field suggestions | Yes | T024, T025 | AddFieldDropdown |
| FR-007: Allow adding custom fields | Partial | T026 | Implicit in addField action, no explicit custom field UX task |
| FR-008: Allow removing fields | **NO** | - | **GAP: No removeField task** |
| FR-009: Bidirectional sync < 300ms | Yes | T017, T018 | Sync implementation |
| FR-010: Validate and display errors | Yes | T028-T032 | Phase 6 |
| FR-011: Infer field types from values | Yes | T004 | Type inference |
| FR-012: Schema detection (project config, user settings) | Partial | T033-T037 | Project config handled, user settings default unclear |
| FR-013: Appropriate input controls per type | Yes | T007-T012, T013 | Field components + registry |
| FR-014: Handle empty frontmatter | Yes | T047 | Empty state UI |
| FR-015: Handle no frontmatter (offer to add) | Partial | T047 | Empty state, but no explicit "add frontmatter" action |
| FR-016: Preserve YAML formatting | Partial | T003 | Implied in parser, no explicit test task |
| FR-017: Validation indicators on toggle | Yes | T032 | Error badge |

### User Story Acceptance Criteria Coverage

#### User Story 1 - Edit Frontmatter via Form (P1)

| Acceptance Criterion | Has Task? | Task IDs | Notes |
|---------------------|-----------|----------|-------|
| AC1: Form populated from existing frontmatter | Yes | T003, T014 | Parser + FrontmatterForm |
| AC2: Text field changes sync < 300ms | Yes | T017, T018 | Sync implementation |
| AC3: Date field with date picker | Yes | T011 | DateField component |
| AC4: Tags/array with tag input | Yes | T012 | ArrayField component |
| AC5: Boolean with checkbox/switch | Yes | T010 | BooleanField component |

#### User Story 2 - Toggle Visual/Raw Modes (P1)

| Acceptance Criterion | Has Task? | Task IDs | Notes |
|---------------------|-----------|----------|-------|
| AC1: Toggle button shows raw YAML | Yes | T020, T021 | RawEditor + Toggle UI |
| AC2: Edit raw YAML, switch to visual shows updated | Yes | T022 | Mode state |
| AC3: Unsaved changes preserved on toggle | Yes | T022 | Mode state handling |
| AC4: Invalid YAML shows error, stays in raw | Yes | T023 | Mode switch validation |

#### User Story 3 - Add Common Fields (P2)

| Acceptance Criterion | Has Task? | Task IDs | Notes |
|---------------------|-----------|----------|-------|
| AC1: "Add Field" shows dropdown | Yes | T024 | AddFieldDropdown |
| AC2: Select "title" adds title field | Yes | T025, T026 | Suggestions + addField |
| AC3: Select "date" adds date picker | Yes | T025, T026 | Field type mapping |
| AC4: Select "tags" adds array field | Yes | T025, T026 | Field type mapping |
| AC5: Custom field name adds text input | Partial | T026 | addField action, but no explicit custom name UX |

#### User Story 4 - Field Validation (P2)

| Acceptance Criterion | Has Task? | Task IDs | Notes |
|---------------------|-----------|----------|-------|
| AC1: Invalid date shows error | Yes | T028, T031 | Validation + field display |
| AC2: Empty required field shows error | Partial | T028, T030 | Validation lib, but "required" needs schema |
| AC3: Correct value clears error | Yes | T030, T031 | Real-time validation state |
| AC4: Validation indicator on toggle | Yes | T032 | Error badge |

#### User Story 5 - Schema Detection (P3)

| Acceptance Criterion | Has Task? | Task IDs | Notes |
|---------------------|-----------|----------|-------|
| AC1: Schema applies field types/validation | Yes | T033, T034 | Schema loading + zod converter |
| AC2: No schema = infer from values | Yes | T004 | Type inference |
| AC3: Schema descriptions as tooltips | Yes | T036 | Tooltip integration |

### Success Criteria Coverage

| Success Criterion | Has Task? | Task IDs | Notes |
|------------------|-----------|----------|-------|
| SC-001: Edit without YAML knowledge | Yes | T007-T016, T019 | Visual form implementation |
| SC-002: Mode toggle preserves data 100% | Partial | T022, T023 | Implementation tasks, but no E2E validation task |
| SC-003: Sync < 300ms | Partial | T050 | Performance validation task, but no performance test |
| SC-004: Type inference 95% accuracy | **NO** | - | **GAP: No accuracy validation task** |
| SC-005: Validation < 100ms | Partial | T050 | General performance check, no specific validation |
| SC-006: Panel open < 200ms | Partial | T050 | General performance check, no specific validation |
| SC-007: Code compiles and passes quality gates | Yes | T048 | Final build validation |

### Edge Cases Coverage

| Edge Case | Has Task? | Task IDs | Notes |
|-----------|-----------|----------|-------|
| Deeply nested objects (collapsible tree) | Yes | T038, T039 | ObjectField component |
| YAML features not in form (anchors, aliases) | **NO** | - | **GAP: No warning/raw mode fallback task** |
| No frontmatter (empty state, add option) | Partial | T047 | Empty state, no "add frontmatter" action |
| Malformed delimiters | **NO** | - | **GAP: No error display or fix task** |
| Mode switch during typing (debounce) | Implicit | T017 | Sync has debounce, no explicit test |
| Simultaneous panel/document edits | Partial | T017 | Last-write-wins in sync, no conflict test |

---

## Gap Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| GAP-001 | **HIGH** | FR-008 | **No task for removeField action** - Users cannot delete frontmatter fields | Add task T051: "Add removeField action to store and delete button to field components" |
| GAP-002 | **MEDIUM** | SC-004 | **No type inference accuracy validation** - 95% accuracy criterion has no test | Add task T052: "Create type inference accuracy test suite with >= 50 sample values" |
| GAP-003 | **MEDIUM** | Edge Case | **No handling for unsupported YAML features** - Anchors, aliases, complex multi-line need warning + raw mode | Add task T053: "Detect unsupported YAML features and display warning with raw mode option" |
| GAP-004 | **MEDIUM** | Edge Case | **No malformed frontmatter handling** - Broken `---` delimiters not addressed | Add task T054: "Detect malformed frontmatter delimiters and offer fix/recovery" |
| GAP-005 | **MEDIUM** | FR-015 | **No explicit "add frontmatter" action** - T047 covers empty state UI but not the action to add frontmatter block | Extend T047 or add T055: "Implement addFrontmatter action for documents without frontmatter" |
| GAP-006 | **LOW** | SC-003, SC-005, SC-006 | **No specific performance test tasks** - T050 is manual verification, no automated perf tests | Add task T056: "Create performance test suite for panel open < 200ms, sync < 300ms, validation < 100ms" |
| GAP-007 | **LOW** | FR-012 | **User settings defaults for schema unclear** - Tasks cover project config but not user settings fallback | Clarify T035: Ensure loadSchema falls back to user settings when no project schema exists |
| GAP-008 | **LOW** | FR-016 | **YAML formatting preservation not explicitly tested** - Parser task implicit, no dedicated test | Add test case in T040: "Verify YAML formatting (indentation, quote style) preserved after round-trip" |
| GAP-009 | **LOW** | US3-AC5 | **Custom field name UX not explicit** - addField action exists but no task for custom field name input UI | Extend T024/T025: Add custom field name input option to AddFieldDropdown |
| GAP-010 | **LOW** | SC-002, Edge Cases | **No E2E test for mode toggle data integrity** - Implementation tasks exist but no E2E validation | Add E2E test case: "Verify data integrity across 10+ mode toggles with various field types" |

---

## Summary

### Coverage Statistics

| Category | Total | Covered | Partial | Gaps |
|----------|-------|---------|---------|------|
| Functional Requirements (FR-001 to FR-017) | 17 | 12 | 4 | **1** |
| User Story Acceptance Criteria | 18 | 15 | 3 | **0** |
| Success Criteria (SC-001 to SC-007) | 7 | 4 | 2 | **1** |
| Edge Cases | 6 | 2 | 2 | **2** |
| **TOTAL** | 48 | 33 (69%) | 11 (23%) | **4 (8%)** |

### Critical Gaps (HIGH severity)

1. **GAP-001**: No removeField capability - blocks core editing workflow

### Recommended Actions

1. **Immediate**: Add T051 for removeField action (blocks complete form editing)
2. **Before Phase 9**: Add T052-T054 for edge cases and validation accuracy
3. **Before Phase 10**: Add T055-T056 for add frontmatter and performance tests
4. **During Implementation**: Address LOW severity gaps as part of existing tasks

### Orphaned Tasks Analysis

All tasks (T001-T050) map to requirements, user stories, or support infrastructure. No orphaned tasks detected.

### Unmapped Stories/Requirements

- FR-008 (removeField) has zero task coverage - **CRITICAL**
- SC-004 (type inference accuracy) has zero validation task - **MEDIUM**
