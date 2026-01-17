# Data Model Ambiguity Analysis

**Spec**: `specs/007-mdx-content-outline/spec.md`
**Category**: Data Model
**Analyzed**: 2026-01-17

---

## Summary

The spec defines three key entities (`OutlineItem`, `OutlineSection`, `OutlineState`) in the "Key Entities" section (lines 180-186). While the basic structure is provided, several important data model concerns remain underspecified.

---

## Ambiguity Findings

### 1. OutlineItem Identity & Uniqueness

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | OutlineItem identity/key |
| **Question Candidate** | How should OutlineItems be uniquely identified? Is `(type, line, column)` sufficient, or do we need a generated ID? What happens when two headings have identical text on different lines? |
| **Impact Score** | 4 |
| **Rationale** | React requires stable keys for list rendering. Without clear identity rules, outline updates may cause unnecessary re-renders or lose collapse/selection state. The spec mentions `line` and `column` but doesn't confirm these form a unique key. |

---

### 2. Component Instance Attributes

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | OutlineItem for components |
| **Question Candidate** | What attributes should a component OutlineItem have beyond type, label, line, column? Should it include: component props summary, opening/closing tag line range, self-closing indicator, nested children count? |
| **Impact Score** | 3 |
| **Rationale** | FR-013 says "show individual instances with line numbers" and FR-014 mentions "distinguish built-in vs custom components", but the OutlineItem entity doesn't have a field for built-in/custom classification or prop info. |

---

### 3. Frontmatter Field Representation

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | Frontmatter OutlineItem structure |
| **Question Candidate** | How are frontmatter fields modeled as OutlineItems? Should each field (title, date, tags) be a separate OutlineItem child, or is frontmatter a single item with metadata? How are complex values (arrays like `tags`, nested objects) represented? |
| **Impact Score** | 3 |
| **Rationale** | FR-016/FR-017 describe displaying frontmatter fields, but the OutlineItem entity uses a flat `label` field. The spec doesn't clarify if frontmatter is a single item or multiple items, or how to represent array/object values. |

---

### 4. Heading Nesting Algorithm

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | OutlineItem children relationship |
| **Question Candidate** | How exactly should heading nesting work? If document has `# A`, `### B`, `## C` (skipped h2), should B be a child of A or standalone? What about `## D`, `# E` - does E reset the hierarchy? |
| **Impact Score** | 4 |
| **Rationale** | FR-007 says "hierarchical tree structure reflecting their nesting based on level" but doesn't specify how to handle level-skipping (h1 -> h3) or descending levels (h3 -> h1). This affects the `children` array population algorithm. |

---

### 5. Data Volume / Scale Assumptions

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | Scale limits and performance bounds |
| **Question Candidate** | What are the expected upper bounds for: max headings per document, max components per document, max frontmatter fields, max nesting depth? Should there be virtualization for very large outlines (100+ items)? |
| **Impact Score** | 3 |
| **Rationale** | The spec mentions 500ms update requirement but doesn't specify data volume assumptions. A 10,000-line MDX document could have hundreds of headings/components. Without scale bounds, performance requirements are untestable. |

---

### 6. OutlineState Lifecycle & Initialization

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | OutlineState transitions |
| **Question Candidate** | What is the initial OutlineState when: (a) no document is open, (b) document is loading, (c) empty document is open? Should there be explicit loading/error states beyond `parseError`? |
| **Impact Score** | 2 |
| **Rationale** | OutlineState has `parseError` for failures but no explicit loading state. The edge case mentions "no outline available" empty state but this isn't modeled in the entity. State transitions (loading -> parsed -> error) aren't defined. |

---

### 7. Section Collapse State Persistence Scope

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | OutlineSection.isCollapsed persistence |
| **Question Candidate** | Is collapse state per-document or global? If I collapse "Components" in doc A, then switch to doc B and back to doc A, is "Components" still collapsed? FR-026 says "during the editing session" but doesn't clarify document scope. |
| **Impact Score** | 2 |
| **Rationale** | OutlineSection has `isCollapsed` but the spec doesn't clarify if this is document-specific or application-wide. FR-028 says "start expanded on app launch" but doesn't address document switching. |

---

### 8. AST Node Position Precision

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | OutlineItem line/column source |
| **Question Candidate** | Should `line` and `column` point to: (a) the start of the element syntax (e.g., `#` for heading), (b) the start of content (e.g., first letter of heading text), (c) the AST-reported position? Different MDX parsers may report positions differently. |
| **Impact Score** | 3 |
| **Rationale** | FR-032 says "extract source position information (line, column) from AST nodes" but AST parsers vary in position reporting (0-indexed vs 1-indexed, start of token vs start of content). This affects navigation accuracy. |

---

### 9. Component Type Grouping Key

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | Component grouping/deduplication |
| **Question Candidate** | How should component types be grouped? Is `<Callout>` the same as `<callout>` (case sensitivity)? Is `<Callout type="warning">` grouped with `<Callout type="info">`? Is `<components.Callout>` grouped with `<Callout>`? |
| **Impact Score** | 2 |
| **Rationale** | FR-012 says "group components by type" but doesn't define what constitutes the same "type". JSX component names can include namespaces (`ns.Component`), and JSX is case-sensitive. Grouping rules affect the outline structure. |

---

### 10. Relationship to Document Store

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | OutlineState relationship to DocumentState |
| **Question Candidate** | Is OutlineState stored within the document store (as a derived field of DocumentState), in a separate outline store, or computed on-the-fly from AST? How does outline state relate to the document's dirty/saved state? |
| **Impact Score** | 3 |
| **Rationale** | The spec mentions "integrate with existing Zustand store pattern" but doesn't specify if outline is part of document state, a separate store, or a derived selector. This affects architecture and data flow. |

---

## Summary Statistics

| Status | Count |
|--------|-------|
| Clear | 0 |
| Partial | 6 |
| Missing | 4 |
| **Total Ambiguities** | **10** |

| Impact Score | Count |
|--------------|-------|
| 5 (Critical) | 0 |
| 4 (High) | 2 |
| 3 (Medium) | 4 |
| 2 (Low) | 4 |

---

## Recommended Clarification Priority

1. **OutlineItem Identity & Uniqueness** (Impact: 4) - Blocks stable React rendering
2. **Heading Nesting Algorithm** (Impact: 4) - Core feature correctness
3. **AST Node Position Precision** (Impact: 3) - Navigation accuracy
4. **Component Instance Attributes** (Impact: 3) - Feature completeness
5. **Relationship to Document Store** (Impact: 3) - Architecture decision
6. **Data Volume / Scale Assumptions** (Impact: 3) - Performance testability
7. **Frontmatter Field Representation** (Impact: 3) - Data structure clarity
8. **OutlineState Lifecycle & Initialization** (Impact: 2) - State machine completeness
9. **Section Collapse State Persistence Scope** (Impact: 2) - UX consistency
10. **Component Type Grouping Key** (Impact: 2) - Grouping logic clarity
