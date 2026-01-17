# Completion Ambiguity Analysis: MDX Content Outline/Navigator (007)

**Spec File**: `/Users/ww/dev/projects/mdxpad/specs/007-mdx-content-outline/spec.md`
**Analysis Date**: 2026-01-17
**Focus Area**: Completion Signals (Acceptance Criteria Testability, Measurable Definition of Done)

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 8 |
| Partial | 9 |
| Missing | 4 |

---

## Ambiguity Findings

### 1. US1-AS1: Headings Tree Nesting Structure

**Category**: Completion
**Status**: Partial
**Spec Text (Line 35)**: "Then all headings appear in a hierarchical tree reflecting their nesting structure"
**Question Candidate**: What is the expected behavior when heading levels skip (e.g., h1 directly to h3)? Should h3 be nested under h1, shown flat, or create a placeholder h2?
**Impact Score**: 4
**Rationale**: "Nesting structure" is ambiguous for non-sequential heading levels. Test cases cannot be written without knowing expected behavior for malformed heading hierarchies.

---

### 2. US1-AS3: Brief Highlight Duration

**Category**: Completion
**Status**: Clear
**Spec Text (Line 37)**: "Then the heading line is briefly highlighted to help the user locate it"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: FR-022 specifies "flash highlight for 500ms" which makes this testable.

---

### 3. US1-AS4: Outline Update Timing Reference Point

**Category**: Completion
**Status**: Partial
**Spec Text (Line 38)**: "outline updates within 500ms to reflect the changes"
**Question Candidate**: Is the 500ms measured from when typing stops (debounce), from the last keystroke, or from when the AST becomes available?
**Impact Score**: 3
**Rationale**: The timing trigger is ambiguous. Tests need to know the exact start point of the 500ms window to write deterministic assertions.

---

### 4. US2-AS1/AS2: Toggle Shortcut

**Category**: Completion
**Status**: Clear
**Spec Text (Line 52)**: "Cmd+Shift+O"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Specific shortcut is defined. Testable via keyboard simulation.

---

### 5. US2-AS3: Persistence Verification Scope

**Category**: Completion
**Status**: Partial
**Spec Text (Line 54)**: "restart the app, Then the outline remains hidden (persistence)"
**Question Candidate**: What constitutes an "app restart" for testing purposes - full quit and relaunch, window close and reopen, or F5 refresh in dev mode?
**Impact Score**: 2
**Rationale**: Different persistence mechanisms may be tested differently. Need clarity for automated test design and CI/CD.

---

### 6. FR-014: Component Visual Distinction Treatment

**Category**: Completion
**Status**: Missing
**Spec Text (Line 146)**: "MUST distinguish between built-in components...and custom/unknown components visually"
**Question Candidate**: What specific visual treatment differentiates built-in from custom components? Different icons, colors, labels, badges, or prefixes?
**Impact Score**: 4
**Rationale**: Cannot write visual regression tests or verify implementation without knowing the expected visual distinction. Implementers will make arbitrary choices.

---

### 7. FR-014: Built-in Component List Definition

**Category**: Completion
**Status**: Missing
**Spec Text (Line 146)**: "built-in components (Callout, CodeBlock, etc.)"
**Question Candidate**: What is the complete, exhaustive list of "built-in" components that should be recognized? The spec only gives examples with "etc."
**Impact Score**: 4
**Rationale**: Tests cannot verify correct classification without an authoritative list of built-in components. What about `<Note>`, `<Warning>`, `<Tip>`, `<Tabs>`?

---

### 8. FR-016/FR-017: Frontmatter Fields Enumeration

**Category**: Completion
**Status**: Partial
**Spec Text (Lines 151-152)**: "display key fields (title, date, author, description, tags)" and "limit displayed frontmatter to common fields, with option to expand for all fields"
**Question Candidate**: What is the exact list of "common fields" that are always shown vs expanded? Is the list in FR-016 exhaustive or just examples?
**Impact Score**: 3
**Rationale**: Test cases need to know which fields are "common" (always shown) vs "other" (shown on expand). The word "key" suggests priority but doesn't enumerate.

---

### 9. SC-001: Navigation Timing

**Category**: Completion
**Status**: Clear
**Spec Text (Line 196)**: "within 100ms (perceived instant)"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Specific, measurable timing provided. Testable with performance testing tools and assertions.

---

### 10. SC-004: Parsing Overhead Measurement

**Category**: Completion
**Status**: Partial
**Spec Text (Line 197)**: "less than 50ms overhead to the existing preview compilation cycle"
**Question Candidate**: How should this be measured? Delta between preview-only compilation vs preview+outline compilation? What document size is the baseline for testing?
**Impact Score**: 3
**Rationale**: Performance tests need baseline document specification and measurement methodology defined. Results vary dramatically by document complexity.

---

### 11. SC-005: Heading Representation Scope

**Category**: Completion
**Status**: Partial
**Spec Text (Line 198)**: "100% of headings in the document are represented in the outline"
**Question Candidate**: Does this include headings inside JSX components, code blocks (as examples), or markdown blocks within JSX? Only top-level markdown headings?
**Impact Score**: 4
**Rationale**: Edge cases around heading location affect what "100%" means. A heading inside `<CodeBlock>` is fundamentally different from a parsed heading.

---

### 12. SC-006: Component Identification Scope

**Category**: Completion
**Status**: Partial
**Spec Text (Line 199)**: "100% of JSX component usages are identified"
**Question Candidate**: Does this include components inside code blocks (shown as examples), MDX expressions like `{MyComponent}`, or only directly rendered `<Component>` tags?
**Impact Score**: 3
**Rationale**: False positives from code examples would fail this criterion if not scoped correctly. Need to define what counts as "usage" vs "reference."

---

### 13. SC-007: Full Workflow Timing

**Category**: Completion
**Status**: Clear
**Spec Text (Line 200)**: "under 3 seconds"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Specific, measurable timing provided. End-to-end test can verify with stopwatch.

---

### 14. Edge Case: Empty State Message

**Category**: Completion
**Status**: Clear
**Spec Text (Line 112)**: "Show an empty state message: 'No outline available. Add headings, components, or frontmatter to see the document structure.'"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Exact text specified makes this testable via DOM assertion.

---

### 15. Edge Case: Syntax Error Warning Indicator

**Category**: Completion
**Status**: Partial
**Spec Text (Line 113)**: "show the last valid outline with a warning indicator"
**Question Candidate**: What does the "warning indicator" look like? Icon, color, text, tooltip, banner? How is "last valid outline" cached across parse failures?
**Impact Score**: 3
**Rationale**: Tests need to verify warning indicator appearance and outline caching behavior. Without visual spec, multiple implementations are valid.

---

### 16. Edge Case/FR-004: Auto-hide Threshold

**Category**: Completion
**Status**: Clear
**Spec Text (Lines 117, 130)**: "below 600px with preview visible, or below 400px with preview hidden"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Exact pixel values make this testable via window resize assertions.

---

### 17. NFR: Keyboard Navigation Keys

**Category**: Completion
**Status**: Clear
**Spec Text (Line 215)**: "arrow keys to move, Enter to select"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Specific keys defined. Testable via keyboard simulation.

---

### 18. NFR: ARIA Roles

**Category**: Completion
**Status**: Clear
**Spec Text (Line 216)**: "tree, treeitem"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Specific ARIA roles defined. Testable via DOM role assertions.

---

### 19. FR-029: AST Reuse Verification Method

**Category**: Completion
**Status**: Missing
**Spec Text (Line 173)**: "MUST reuse AST data from the preview pane"
**Question Candidate**: How do we verify AST is actually being reused vs re-parsed? What metric, assertion, or observable behavior proves reuse?
**Impact Score**: 3
**Rationale**: Implementation detail that affects performance testing. Need observable verification method (e.g., parse count counter, shared reference check).

---

### 20. NFR: Debounce Configuration

**Category**: Completion
**Status**: Missing
**Spec Text (Line 209)**: "Debounce outline updates to avoid excessive re-parsing"
**Question Candidate**: What is the debounce duration? Is it the same as the 500ms update window, or a separate configuration?
**Impact Score**: 3
**Rationale**: Tests need to know debounce timing to set appropriate wait times. If different from 500ms update target, could create race conditions.

---

### 21. Edge Case: Minimum Panel Width

**Category**: Completion
**Status**: Clear
**Spec Text (Line 116)**: "Enforce minimum width of 150px"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Specific pixel value. Testable via CSS/DOM assertions during resize.

---

## Severity Summary

| Impact Score | Count |
|--------------|-------|
| 5 (Critical) | 0     |
| 4 (High)     | 4     |
| 3 (Medium)   | 7     |
| 2 (Low)      | 1     |
| 1 (Clear)    | 9     |

---

## High-Impact Questions (Impact >= 4)

1. **[Impact 4] Heading Nesting for Skipped Levels**: What is the expected behavior when heading levels skip (e.g., h1 directly to h3)? Should h3 be nested under h1, shown flat, or create a phantom/placeholder h2?

2. **[Impact 4] Built-in Component Visual Distinction**: What specific visual treatment differentiates built-in from custom components? (icon, color, label, badge)

3. **[Impact 4] Built-in Component List**: What is the complete, authoritative list of "built-in" components that should be recognized and classified specially?

4. **[Impact 4] Heading Scope for 100% Coverage (SC-005)**: Does 100% heading representation include headings inside JSX components, code blocks, or only top-level markdown headings?

---

## Recommended Clarification Questions (Priority Order)

1. **[Impact 4]** Please enumerate the complete list of built-in MDX components that should be visually distinguished from custom components.

2. **[Impact 4]** What visual treatment (icon, color, label) should differentiate built-in components from custom/unknown components in the outline?

3. **[Impact 4]** When heading levels skip (e.g., `# H1` followed by `### H3` with no H2), how should the outline tree represent this - nest H3 under H1, show H3 at root level, or create a placeholder?

4. **[Impact 4]** Should headings inside JSX components or code blocks be included in the "100% of headings represented" success criterion?

5. **[Impact 3]** What is the debounce duration for outline updates, and is it the same as or separate from the 500ms update window in SC-002?

---

## Overall Assessment

The spec has **strong measurable outcomes** in the Success Criteria section with specific timing targets (100ms navigation, 500ms update, 50ms overhead, 3s workflow). The acceptance scenarios follow Given/When/Then format and most have clear assertions.

**Strengths:**
- Specific timing metrics for performance testing
- Exact pixel thresholds for responsive behavior
- Explicit ARIA roles for accessibility testing
- Precise keyboard shortcuts defined

**Gaps requiring clarification:**
1. **Visual specifications** - Component distinction treatment undefined
2. **Data enumeration** - Built-in component list incomplete
3. **Edge case handling** - Skipped heading levels behavior undefined
4. **Scope boundaries** - What counts as "heading" or "component usage" in edge cases

The spec is approximately **80% complete** from a testability standpoint. Addressing the 4 high-impact clarifications above would bring it to production-ready Definition of Done quality.
