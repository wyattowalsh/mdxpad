# Coverage Gap Analysis: Spec 007 - MDX Content Outline/Navigator

**Analysis Date**: 2026-01-17
**Spec Location**: `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/`
**Analyst**: Claude Code Coverage Analyzer

---

## Executive Summary

This analysis maps all User Stories (US1-US5), Functional Requirements (FR-001 to FR-032), and Success Criteria (SC-001 to SC-008) from spec.md to implementing tasks in tasks.md. The analysis identifies coverage gaps, orphan tasks, and missing edge case handling.

**Overall Coverage Assessment**:
- **User Stories**: 5/5 fully mapped (100%)
- **Functional Requirements**: 28/32 fully covered (87.5%)
- **Success Criteria**: 6/8 directly validated (75%)
- **Edge Cases**: 4/6 explicitly handled (67%)

---

## Traceability Matrix

### Section 1: User Stories to Tasks

| User Story | Priority | Description | Implementing Tasks | Status |
|------------|----------|-------------|-------------------|--------|
| US1 | P1 | Navigate Document via Headings | T004, T005, T006, T010, T011, T013, T014, T015, T016, T017, T018, T019, T020 | ✅ COVERED |
| US2 | P1 | Toggle Outline Panel Visibility | T003, T009, T012, T021, T022 | ✅ COVERED |
| US3 | P2 | View Component Usage | T004, T005, T023, T024, T025 | ✅ COVERED |
| US4 | P2 | View Frontmatter Summary | T004, T005, T026, T027, T028 | ✅ COVERED |
| US5 | P3 | Collapse/Expand Outline Sections | T007, T008, T029, T030 | ✅ COVERED |

**User Story Coverage: 100%**

---

### Section 2: Functional Requirements to Tasks

#### Outline Panel Layout (FR-001 to FR-005)

| FR ID | Requirement | Implementing Task(s) | Status |
|-------|-------------|---------------------|--------|
| FR-001 | Outline panel as collapsible sidebar on left | T013 (OutlinePanel), T019 (App integration) | ✅ COVERED |
| FR-002 | Toggle via keyboard shortcut (Cmd+Shift+O) | T012 (toggle command) | ✅ COVERED |
| FR-003 | Persist visibility preference across sessions | T009 (UI layout ext), T021 (persistence) | ✅ COVERED |
| FR-004 | Auto-hide when window width insufficient | T034 (auto-hide) | ✅ COVERED |
| FR-005 | Close button in panel header | T013 (OutlinePanel) | ✅ COVERED |

#### Headings Tree (FR-006 to FR-010)

| FR ID | Requirement | Implementing Task(s) | Status |
|-------|-------------|---------------------|--------|
| FR-006 | Parse document and extract all markdown headings (h1-h6) | T004 (outline extractor) | ✅ COVERED |
| FR-007 | Display headings in hierarchical tree structure | T014 (OutlineSection), T015 (OutlineItem) | ✅ COVERED |
| FR-008 | Show heading text content as tree node label | T015 (OutlineItem) | ✅ COVERED |
| FR-009 | Truncate heading labels >40 chars with ellipsis, full on hover | T018 (styling) | ✅ COVERED |
| FR-010 | Update headings tree within 500ms of document changes | T020 (store connection) | ✅ COVERED |

#### Component List (FR-011 to FR-015)

| FR ID | Requirement | Implementing Task(s) | Status |
|-------|-------------|---------------------|--------|
| FR-011 | Parse document and identify all JSX component usages | T004 (outline extractor), T024 (extractor grouping) | ✅ COVERED |
| FR-012 | Group components by type, show unique names with count | T024 (extractor grouping), T023 (ComponentGroup) | ✅ COVERED |
| FR-013 | Allow expanding component type to see individual instances | T023 (ComponentGroup) | ✅ COVERED |
| FR-014 | Distinguish between built-in and custom components visually | T024 (extractor grouping - BUILTIN_COMPONENTS) | ✅ COVERED |
| FR-015 | Update component list within 500ms of changes | T020 (store connection) | ✅ COVERED |

#### Frontmatter Section (FR-016 to FR-019)

| FR ID | Requirement | Implementing Task(s) | Status |
|-------|-------------|---------------------|--------|
| FR-016 | Parse YAML frontmatter and display key fields | T027 (extractor frontmatter), T026 (FrontmatterSection) | ✅ COVERED |
| FR-017 | Limit displayed fields to common, with expand option | T026 (FrontmatterSection - "Show all" expansion) | ✅ COVERED |
| FR-018 | Hide Frontmatter section if no frontmatter | T026 (FrontmatterSection), T007 (outline store - isEmpty) | ✅ COVERED |
| FR-019 | Update frontmatter display within 500ms | T020 (store connection) | ✅ COVERED |

#### Navigation (FR-020 to FR-024)

| FR ID | Requirement | Implementing Task(s) | Status |
|-------|-------------|---------------------|--------|
| FR-020 | Navigate editor to clicked outline item's source location | T010 (nav hook - navigateToItem) | ✅ COVERED |
| FR-021 | Position cursor at start of target line | T010 (nav hook - cursor positioning) | ✅ COVERED |
| FR-022 | Briefly highlight target line (500ms flash) | T010 (nav hook - line highlighting), T011 (nav tests) | ✅ COVERED |
| FR-023 | Use existing useErrorNavigation hook pattern | T010 (nav hook - follows pattern) | ✅ COVERED |
| FR-024 | Scroll editor to center target line in view | T010 (nav hook - scroll-to-center) | ✅ COVERED |

#### Collapsible Sections (FR-025 to FR-028)

| FR ID | Requirement | Implementing Task(s) | Status |
|-------|-------------|---------------------|--------|
| FR-025 | Allow each main section to be collapsed/expanded | T014 (OutlineSection - collapse toggle), T007 (toggleSectionCollapse) | ✅ COVERED |
| FR-026 | Preserve collapse state during editing session | T029 (collapse state preservation) | ✅ COVERED |
| FR-027 | Allow nested heading levels to be collapsed | T030 (collapse UI), T029 (collapse state) | ✅ COVERED |
| FR-028 | Start with all sections expanded on app launch | T007 (outline store - initial state) | ✅ COVERED |

#### AST Integration (FR-029 to FR-032)

| FR ID | Requirement | Implementing Task(s) | Status |
|-------|-------------|---------------------|--------|
| FR-029 | Reuse AST data from preview pane's MDX compilation | T006 (preview store ext - selectOutlineAST) | ✅ COVERED |
| FR-030 | Fall back to lightweight parser if preview AST unavailable | **NONE** | ⚠️ **GAP** |
| FR-031 | Handle AST parsing failures gracefully | T007 (setParseError), T008 (error handling tests) | ✅ COVERED |
| FR-032 | Extract source position info (line, column) from AST nodes | T004 (outline extractor) | ✅ COVERED |

**Functional Requirements Coverage: 31/32 (96.9%)**

---

### Section 3: Success Criteria to Validating Tasks

| SC ID | Criterion | Validating Task(s) | Status |
|-------|-----------|-------------------|--------|
| SC-001 | Navigate from outline click to editor position within 100ms | T011 (nav hook tests), T036 (manual validation) | ✅ COVERED |
| SC-002 | Outline updates within 500ms of typing pause | T020 (store connection), T036 (manual validation) | ✅ COVERED |
| SC-003 | Panel toggle responds within 50ms | T012 (toggle command), T036 (manual validation) | ⚠️ **PARTIAL** |
| SC-004 | Outline parsing adds <50ms overhead to preview compilation | **NONE** | ⚠️ **GAP** |
| SC-005 | 100% of headings represented in outline | T005 (extractor tests), T036 (manual validation) | ✅ COVERED |
| SC-006 | 100% of JSX component usages identified | T005 (extractor tests), T024 (grouping) | ✅ COVERED |
| SC-007 | Full navigation workflow in under 3 seconds | T036 (manual validation) | ✅ COVERED |
| SC-008 | Visibility preference persists across app restarts | T022 (persistence tests), T036 (manual validation) | ✅ COVERED |

**Success Criteria Coverage: 6/8 directly validated (75%)**

---

### Section 4: Edge Cases to Handling Tasks

| Edge Case | Description | Handling Task(s) | Status |
|-----------|-------------|-----------------|--------|
| EC-001 | Document has no headings/components/frontmatter | T016 (OutlineEmptyState) | ✅ COVERED |
| EC-002 | Syntax errors prevent AST parsing | T007 (setParseError), T031 (warning indicator) | ✅ COVERED |
| EC-003 | Heading text very long (>40 chars) | T018 (styling - truncation) | ✅ COVERED |
| EC-004 | User rapidly scrolls document | N/A (spec says no scroll tracking) | ✅ N/A (OUT OF SCOPE) |
| EC-005 | Outline panel width very narrow | T018 (styling - min-w-[150px]) | ✅ COVERED |
| EC-006 | Window too narrow for outline + editor + preview | T034 (auto-hide) | ✅ COVERED |

**Edge Case Coverage: 5/5 in-scope cases handled (100%)**

---

## Identified Gaps

### GAP-001: Missing Fallback Parser for FR-030

- **ID**: GAP-001
- **Type**: Unmapped Functional Requirement
- **Source**: FR-030 - "System MUST fall back to a lightweight parser if preview AST is unavailable"
- **Impact**: If the preview pane compilation fails or is disabled, the outline will show nothing or an error state instead of attempting a lightweight parse. This degrades the user experience when working with documents that have temporary syntax errors but valid structure.
- **Recommendation**: Add a task in Phase 2 (Batch 2.1 or 2.2) to implement a fallback lightweight parser using remark-parse directly when preview AST is null. Suggested task:
  ```
  T004a [P:2.1] [FR-030] Create fallback-outline-parser.ts implementing lightweight markdown parsing using remark-parse when preview AST unavailable
  ```

### GAP-002: Missing Performance Benchmark for SC-004

- **ID**: GAP-002
- **Type**: Unmapped Success Criterion
- **Source**: SC-004 - "Outline parsing adds less than 50ms overhead to the existing preview compilation cycle"
- **Impact**: There is no explicit task to measure and validate that the AST extraction overhead stays below 50ms. Without benchmarking, performance regressions could slip through.
- **Recommendation**: Add an explicit performance validation task in Phase 8 (Batch 8.3). Suggested task:
  ```
  T035a [P:8.3] [SC-004] Add performance benchmark test in outline-extractor.test.ts measuring extraction time with large documents (500+ lines), asserting <50ms
  ```

### GAP-003: Missing Explicit Toggle Latency Test for SC-003

- **ID**: GAP-003
- **Type**: Partial Success Criterion Coverage
- **Source**: SC-003 - "Outline panel toggle responds within 50ms of keyboard shortcut"
- **Impact**: T012 registers the command and T022 tests persistence, but no task explicitly measures toggle latency. The 50ms response time is a performance target that needs validation.
- **Recommendation**: Enhance T022 or add explicit performance assertion:
  ```
  T022a [P:4.1] [SC-003] Add latency measurement test verifying toggleOutline completes state update within 50ms
  ```

### GAP-004: Missing Non-Standard Heading Edge Case Test

- **ID**: GAP-004
- **Type**: Missing Edge Case
- **Source**: Clarification Q2 documents "strict nesting" behavior for non-standard heading sequences (h1 followed by h3, skipping h2)
- **Impact**: While the nesting algorithm is specified in the clarifications, there is no explicit test case in T005 for validating this behavior.
- **Recommendation**: Ensure T005 explicitly includes test case:
  ```
  In T005: Add test "handles non-standard heading sequences (h1 → h3 → h2)" validating strict nesting per clarification Q2
  ```

### GAP-005: Missing Error State Visual Indicator Task

- **ID**: GAP-005
- **Type**: Missing Edge Case Implementation Detail
- **Source**: Edge Case EC-002 - "Show the last valid outline with a warning indicator"
- **Impact**: T007 implements setParseError and T008 tests error handling, but there is no explicit UI task for rendering the warning indicator when showing stale outline data.
- **Recommendation**: Add UI detail to T013 or create new task:
  ```
  T013a [P:3.1] [EC-002] Add error/warning indicator to OutlinePanel header when parseError is set, showing "Outline may be outdated" tooltip
  ```

---

## Orphan Task Analysis

All 36 tasks in tasks.md trace back to at least one requirement source. No orphan tasks identified.

| Task Range | Purpose | Requirement Source |
|------------|---------|-------------------|
| T001-T003 | Shared types | Infrastructure for FR-001 to FR-032 |
| T004-T005 | AST extraction | FR-006, FR-011, FR-016, FR-032 |
| T006-T009 | Store extensions | FR-003, FR-029, FR-025-FR-028 |
| T010-T011 | Navigation hook | FR-020 to FR-024, SC-001 |
| T012 | Command registration | FR-002, US2 |
| T013-T020 | US1 Components | US1, FR-001, FR-005-FR-010 |
| T021-T022 | US2 Persistence | US2, FR-003, SC-008 |
| T023-T025 | US3 Components | US3, FR-011-FR-015, SC-006 |
| T026-T028 | US4 Frontmatter | US4, FR-016-FR-019 |
| T029-T030 | US5 Collapse | US5, FR-025-FR-028 |
| T031-T034 | Accessibility/Polish | NFR (Accessibility), FR-004 |
| T035-T036 | Final validation | SC-001 to SC-008 |

**Orphan Tasks: 0**

---

## Gap Summary Table

| Gap ID | Type | Source | Severity | Recommendation |
|--------|------|--------|----------|----------------|
| GAP-001 | Unmapped FR | FR-030 | Medium | Add fallback parser task |
| GAP-002 | Unmapped SC | SC-004 | Medium | Add performance benchmark task |
| GAP-003 | Partial SC | SC-003 | Low | Add toggle latency test |
| GAP-004 | Missing Edge Case | Clarification Q2 | Low | Ensure test coverage in T005 |
| GAP-005 | Missing UI Detail | EC-002 | Low | Add warning indicator to OutlinePanel |

---

## Coverage Summary

| Category | Total | Covered | Gaps | Coverage % |
|----------|-------|---------|------|------------|
| User Stories (US1-US5) | 5 | 5 | 0 | 100% |
| Functional Requirements (FR-001 to FR-032) | 32 | 31 | 1 | 96.9% |
| Success Criteria (SC-001 to SC-008) | 8 | 6 | 2 | 75% |
| Edge Cases (in-scope) | 5 | 5 | 0 | 100% |
| Orphan Tasks | 36 | 36 traced | 0 | 0 orphans |

**Overall Assessment**: The spec has excellent User Story and Functional Requirements coverage. The main gaps are around performance validation (SC-003, SC-004) and the fallback parser requirement (FR-030). These should be addressed before implementation begins.

---

## Recommendations

### Priority 1 (Address Before Implementation)
1. **GAP-001**: Add fallback parser task - This is a MUST requirement that has no implementing task
2. **GAP-002**: Add performance benchmark task - SC-004 needs explicit validation

### Priority 2 (Address During Implementation)
3. **GAP-003**: Add toggle latency assertion to existing persistence tests
4. **GAP-004**: Ensure non-standard heading sequence test exists in T005
5. **GAP-005**: Add error state visual indicator to OutlinePanel component

### Implementation Notes
- All gaps are additive - no existing tasks need modification
- Gaps can be addressed by adding 2-3 new sub-tasks
- No architectural changes required
- Coverage will reach 100% with minimal additional effort

---

*Analysis complete. 5 gaps identified across 36 tasks and 45 requirement items.*
