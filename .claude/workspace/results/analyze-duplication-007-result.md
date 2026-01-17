# Duplication Analysis: Spec 007 - MDX Content Outline/Navigator

**Analysis Date**: 2026-01-17
**Analyzed Files**:
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/spec.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/tasks.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/plan.md`

---

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 2     |
| MEDIUM   | 4     |
| LOW      | 3     |
| **Total** | **9** |

---

## Duplication Findings

### DUP-001

**Severity**: HIGH
**Type**: Repeated Functional Requirements

**Location(s)**:
- `spec.md` lines 139-140 (FR-010): "System MUST update the headings tree within 500ms of document changes"
- `spec.md` lines 147-148 (FR-015): "System MUST update the component list within 500ms of document changes"
- `spec.md` lines 154-155 (FR-019): "System MUST update the frontmatter display within 500ms of document changes"

**Summary**: The 500ms update requirement is stated three separate times for headings, components, and frontmatter. This creates redundancy and maintenance burden if the timing needs to change.

**Recommendation**: Consolidate into a single requirement: "FR-010: System MUST update all outline sections (headings, components, frontmatter) within 500ms of document changes." Remove FR-015 and FR-019 as independent requirements.

---

### DUP-002

**Severity**: HIGH
**Type**: Duplicate Performance Metrics

**Location(s)**:
- `spec.md` line 196 (SC-002): "Outline updates reflect document changes within 500ms of typing pause"
- `spec.md` lines 139, 147, 154 (FR-010, FR-015, FR-019): "within 500ms of document changes"
- `plan.md` line 28: "<500ms outline update after typing"
- `plan.md` line 201: "Outline update latency | <500ms"

**Summary**: The 500ms update latency is specified in 6 different places across spec.md and plan.md. This violates DRY principles and creates risk of inconsistency if changed.

**Recommendation**: Define the 500ms threshold once in spec.md under "Performance Constants" and reference it elsewhere. Plan.md should reference the spec rather than restating the value.

---

### DUP-003

**Severity**: MEDIUM
**Type**: Repeated User Story Descriptions

**Location(s)**:
- `spec.md` lines 25-39: User Story 1 describes heading navigation workflow
- `tasks.md` lines 166-169: Phase 3 header re-describes the same goal and test
- `plan.md` lines 126-135: Phase 1/2 descriptions overlap with spec user stories

**Summary**: User Story 1's core description (click heading, jump to line, highlight) appears in three places with slight variations.

**Recommendation**: tasks.md and plan.md should reference the spec.md user stories rather than restating them. Use format: "See spec.md User Story 1" with only task-specific implementation details.

---

### DUP-004

**Severity**: MEDIUM
**Type**: Duplicate Acceptance Criteria

**Location(s)**:
- `spec.md` lines 52-56: User Story 2 acceptance scenarios for toggle shortcut
- `tasks.md` lines 220-224: Phase 4 restates toggle test criteria

**Summary**: The Cmd+Shift+O toggle behavior and persistence testing is described in both spec.md (acceptance scenarios) and tasks.md (independent test description).

**Recommendation**: tasks.md should reference spec acceptance scenarios: "Verify acceptance scenarios 1-4 from User Story 2" rather than restating them.

---

### DUP-005

**Severity**: MEDIUM
**Type**: Repeated Navigation Behavior

**Location(s)**:
- `spec.md` lines 159-164 (FR-020 to FR-024): Navigation requirements (cursor position, scroll, highlight)
- `spec.md` lines 36-37 (User Story 1 AC-2, AC-3): Same navigation behavior in acceptance criteria
- `plan.md` lines 14-16: "Reuse and extend useErrorNavigation pattern for cursor positioning with line highlighting"

**Summary**: The navigation behavior (position cursor at line start, scroll to center, highlight briefly) is specified in functional requirements AND in acceptance criteria with overlapping wording.

**Recommendation**: Define navigation behavior once in FR section. Acceptance criteria should reference: "navigation behavior per FR-020 through FR-024" rather than restating.

---

### DUP-006

**Severity**: MEDIUM
**Type**: Redundant Panel Visibility Requirements

**Location(s)**:
- `spec.md` lines 127-131 (FR-001 to FR-005): Panel visibility requirements
- `spec.md` lines 42-56: User Story 2 (same toggle/persistence behaviors)

**Summary**: FR-002 (toggle via Cmd+Shift+O), FR-003 (persist preference), FR-005 (close button) duplicate the acceptance criteria in User Story 2.

**Recommendation**: User Story 2 should focus on user perspective; FR section should focus on technical requirements. Remove implementation details from user story or consolidate into FR section only.

---

### DUP-007

**Severity**: LOW
**Type**: Repeated Technology Stack

**Location(s)**:
- `plan.md` lines 22-27: Lists TypeScript 5.9.x, React 19.x, Zustand 5.x, etc.
- `tasks.md` lines 22-57: Execution constraints YAML repeats model/timeout info
- Implicit: Same stack info in CLAUDE.md and AGENTS.md

**Summary**: Technology versions are listed in plan.md's Technical Context section, which duplicates information already available in project-level configuration files.

**Recommendation**: plan.md should reference project configuration: "Technology stack per AGENTS.md Active Technologies section" rather than restating versions.

---

### DUP-008

**Severity**: LOW
**Type**: Repeated AST Reuse Statement

**Location(s)**:
- `spec.md` line 19: "leverages the existing MDX AST parsing from the preview pane"
- `spec.md` line 174 (FR-029): "reuse AST data from the preview pane's MDX compilation"
- `spec.md` lines 207-208: "Reuse AST from preview compilation to avoid duplicate parsing"
- `plan.md` line 15: "Extend preview store to expose lightweight AST data"
- `plan.md` line 29: "reuse existing AST from preview compilation"

**Summary**: The concept of reusing the preview pane's AST is stated 5 times across spec.md and plan.md.

**Recommendation**: State this design decision once in the Executive Summary or a dedicated "Design Decisions" section. Other references should be brief: "per AST reuse decision" rather than restating.

---

### DUP-009

**Severity**: LOW
**Type**: Repeated Empty State Description

**Location(s)**:
- `spec.md` line 112: Edge case describes empty state message
- `tasks.md` line 178 (T016): Describes OutlineEmptyState component purpose

**Summary**: The empty state message and purpose is described in both the edge cases and the task description.

**Recommendation**: Task should reference: "Implement empty state per spec.md Edge Cases" rather than restating the message content.

---

## Consolidation Recommendations

### Priority 1 (Address Before Implementation)

1. **Consolidate 500ms timing requirement** (DUP-001, DUP-002)
   - Define once as a named constant: `OUTLINE_UPDATE_DEBOUNCE_MS = 500`
   - Single FR requirement referencing the constant
   - Plan.md references spec, not restating values

2. **Deduplicate navigation behavior** (DUP-005)
   - Single FR block defines complete navigation behavior
   - Acceptance criteria reference FRs rather than restating

### Priority 2 (Recommended)

3. **Reference user stories from tasks** (DUP-003, DUP-004)
   - tasks.md phases should reference spec user stories
   - Only include implementation-specific details in tasks

4. **Consolidate visibility requirements** (DUP-006)
   - User Story focuses on user experience
   - FR section handles technical requirements
   - No overlap between sections

### Priority 3 (Nice to Have)

5. **Remove tech stack repetition** (DUP-007)
   - Reference project-level config files

6. **Single AST reuse statement** (DUP-008)
   - One authoritative statement of design decision

7. **Reference edge cases from tasks** (DUP-009)
   - Tasks reference spec rather than restating

---

## Impact Assessment

| Aspect | Current State | After Consolidation |
|--------|---------------|---------------------|
| Lines of spec text | ~324 | ~290 (10% reduction) |
| Maintenance burden | HIGH - 6 places to update timing | LOW - single source |
| Consistency risk | MEDIUM - variations possible | LOW - single definition |
| Clarity | MEDIUM - repetition obscures structure | HIGH - clear hierarchy |

---

## Conclusion

Spec 007 has moderate duplication issues, primarily around performance timing requirements (500ms stated 6 times) and navigation behavior (described in both requirements and acceptance criteria). The most critical consolidation is unifying the 500ms update timing into a single authoritative definition.

The spec follows good structure overall, but would benefit from:
1. A "Constants" or "Performance Thresholds" section for numeric requirements
2. Clear delineation between user-facing acceptance criteria and technical requirements
3. tasks.md and plan.md referencing spec.md rather than restating content
