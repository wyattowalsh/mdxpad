# Clarification Analysis: Misc / Placeholders

**Spec**: `/Users/ww/dev/projects/mdxpad/specs/007-mdx-content-outline/spec.md`
**Category**: Misc / Placeholders
**Focus Areas**: TODO markers, unresolved decisions, ambiguous adjectives lacking quantification
**Analyzed**: 2026-01-17

---

## Summary

The spec is generally well-specified with most timing requirements quantified (500ms updates, 100ms navigation, etc.). However, several ambiguous adjectives and missing specifications were identified that require clarification before implementation.

| Status | Count |
|--------|-------|
| Clear | 3 |
| Partial | 4 |
| Missing | 2 |

---

## Findings

### 1. TODO Markers / Unresolved Decisions

**Status**: Clear
**Finding**: No explicit TODO markers, FIXME, or TBD annotations found in the spec.

---

### 2. Quantified Adjective: "briefly highlighted" (Line 160)

**Location**: FR-022
**Text**: "System MUST briefly highlight the target line after navigation (flash highlight for 500ms)"
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: The adjective "briefly" is properly quantified with "500ms" in parentheses. No ambiguity.

---

### 3. Ambiguous Adjective: "lightweight parser" (Line 174)

**Location**: FR-030
**Text**: "System MUST fall back to a lightweight parser if preview AST is unavailable"
**Status**: **Partial**
**Impact Score**: 3/5

**Question Candidate**: What constitutes a "lightweight" parser? Should it be defined by: (a) parsing time budget (e.g., <20ms), (b) memory footprint (e.g., <5MB), (c) feature set (heading-only vs full MDX parsing), or (d) a specific library/implementation (e.g., remark-parse without MDX)?

**Rationale**: Without a concrete definition, developers may choose different fallback parsers with varying performance characteristics. This affects consistency and testability. The parser choice also impacts what outline information is available in fallback mode.

---

### 4. Ambiguous Adjective: "common fields" (Line 152)

**Location**: FR-017
**Text**: "System MUST limit displayed frontmatter to common fields, with option to expand for all fields"
**Status**: **Partial**
**Impact Score**: 2/5

**Question Candidate**: What specific fields are considered "common"? FR-016 mentions title, date, author, description, tags - are these definitively the "common fields" referenced in FR-017? Should there be a configurable whitelist, or is this a fixed list?

**Rationale**: Inconsistency between FR-016 (explicit list) and FR-017 (vague "common") could lead to implementation confusion. Low impact since FR-016 provides reasonable guidance.

---

### 5. Quantified ARIA Roles: "appropriate ARIA roles" (Line 216)

**Location**: NFR Accessibility
**Text**: "All outline items must have appropriate ARIA roles (tree, treeitem)"
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: The parenthetical "(tree, treeitem)" provides specific roles. No ambiguity.

---

### 6. Ambiguous Phrase: "distinguish...visually" (Line 146)

**Location**: FR-014
**Text**: "System MUST distinguish between built-in components (Callout, CodeBlock, etc.) and custom/unknown components visually"
**Status**: **Partial**
**Impact Score**: 3/5

**Question Candidate**: How should built-in components be visually distinguished from custom components? Options include: (a) different icons, (b) different text colors/styles, (c) grouping/sorting within the Components section, (d) badge/label indicators. Additionally, what is the exhaustive list of "built-in" components (the "etc." is undefined)?

**Rationale**: Without visual design guidance, implementation requires additional design decisions. The incomplete list ("Callout, CodeBlock, etc.") leaves the built-in set undefined.

---

### 7. Partially Specified: Window Width Thresholds (Lines 117, 130)

**Location**: FR-004, Edge Cases
**Text**: "System MUST auto-hide the outline when window width is insufficient (below 600px with preview visible, or below 400px with preview hidden)"
**Status**: **Partial**
**Impact Score**: 2/5

**Question Candidate**: Are the thresholds (600px with preview, 400px without) final design decisions or placeholders? How do these interact with the existing preview auto-hide thresholds from spec-006 to ensure consistent responsive behavior?

**Rationale**: Thresholds are numerically specified, but the relationship to existing spec-006 preview behavior and whether these are configurable needs clarification.

---

### 8. Missing Specification: Debounce Timing (Line 210)

**Location**: NFR Performance
**Text**: "Debounce outline updates to avoid excessive re-parsing during rapid typing"
**Status**: **Missing**
**Impact Score**: 4/5

**Question Candidate**: What is the specific debounce interval for outline updates? The 500ms update requirement (FR-010, FR-015, FR-019) implies a maximum latency, but the debounce value itself is unspecified. Should it match the preview pane debounce timing for consistency?

**Rationale**: Without a specific debounce value, implementations may vary, affecting UX consistency and perceived responsiveness. This is a performance-critical parameter that needs specification.

---

### 9. Missing Specification: Panel Width Constraints (Line 116)

**Location**: Edge Cases
**Text**: "Enforce minimum width of 150px"
**Status**: **Missing**
**Impact Score**: 3/5

**Question Candidate**: What is the default width of the outline panel? What is the maximum width (if any)? Is the panel resizable by the user via drag handle, and if so, should the width be persisted across sessions?

**Rationale**: Only minimum width is specified. Default width, maximum width, resize behavior, and persistence are unspecified but essential for layout implementation and consistency with spec-006 panel patterns.

---

### 10. Quantified Timing: Success Criteria Metrics

**Location**: Success Criteria (Lines 194-201)
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: SC-001 through SC-008 all have specific quantified targets (100ms, 500ms, 50ms, etc.). No ambiguous adjectives found in success criteria.

---

## Summary Table

| # | Ambiguity | Status | Impact | Line(s) |
|---|-----------|--------|--------|---------|
| 1 | No TODO markers | Clear | 0/5 | - |
| 2 | "briefly highlighted" | Clear | 1/5 | 160 |
| 3 | "lightweight parser" | Partial | 3/5 | 174 |
| 4 | "common fields" | Partial | 2/5 | 152 |
| 5 | "appropriate ARIA roles" | Clear | 1/5 | 216 |
| 6 | "visually" distinguish + "etc." list | Partial | 3/5 | 146 |
| 7 | Window width threshold interaction | Partial | 2/5 | 117, 130 |
| 8 | Debounce timing unspecified | Missing | 4/5 | 210 |
| 9 | Panel width (default/max/resize) | Missing | 3/5 | 116 |

---

## Recommended Priority for Clarification

**High Priority** (Impact 4-5):
1. **Debounce timing** - What is the specific debounce interval (in ms) for outline updates during typing? Should it match the preview pane debounce timing?

**Medium Priority** (Impact 3):
2. **Lightweight parser definition** - What constitutes a "lightweight parser" for the fallback scenario - specific performance budget, feature constraints, or recommended library?
3. **Visual distinction for components** - How should built-in components be visually distinguished from custom components, and what is the complete list of built-in components?
4. **Panel width specification** - What are the default and maximum widths for the outline panel, and should the panel be user-resizable with persisted width?

**Lower Priority** (Impact 1-2):
5. **Common fields clarification** - Confirm whether FR-016's list (title, date, author, description, tags) is the definitive "common fields" list
6. **Window threshold interaction** - Confirm thresholds are final and document interaction with spec-006 preview auto-hide

---

## Recommended Clarification Questions (Sorted by Impact)

1. **[Impact 4]** What is the specific debounce interval (in ms) for outline updates during typing? Should it match the preview pane debounce timing for consistency?

2. **[Impact 3]** What constitutes a "lightweight parser" for the fallback scenario - specific performance budget (e.g., <20ms), feature constraints (heading-only), or recommended library?

3. **[Impact 3]** How should built-in components be visually distinguished from custom components (icons, colors, badges)? What is the complete list of built-in components beyond Callout and CodeBlock?

4. **[Impact 3]** What are the default and maximum widths for the outline panel? Should the panel be user-resizable via drag handle, and if so, should width be persisted across sessions?
