# Edge Cases Ambiguity Analysis

**Spec**: specs/007-mdx-content-outline/spec.md
**Category**: Edge Cases & Failure Handling
**Analysis Date**: 2026-01-17

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 3 |
| Partial | 5 |
| Missing | 6 |

---

## Detailed Findings

### 1. Empty Document State

- **Category**: Edge Cases
- **Status**: Clear
- **Location**: Line 112
- **Analysis**: The spec clearly defines behavior for documents with no headings, components, or frontmatter - show message "No outline available. Add headings, components, or frontmatter to see the document structure."

---

### 2. AST Parsing Errors

- **Category**: Edge Cases
- **Status**: Partial
- **Location**: Lines 113, 175-176
- **Current Definition**: "Show the last valid outline with a warning indicator, or show 'Unable to parse document' if no valid outline exists"
- **Question Candidate**: What should happen when partial parsing succeeds (e.g., headings parse but JSX components cause errors)? Should the outline show valid sections while indicating errors in failed sections?
- **Impact Score**: 4
- **Rationale**: Real MDX documents often have transient syntax errors during editing. Partial failure handling is common but undefined.

---

### 3. Long Heading Text Truncation

- **Category**: Edge Cases
- **Status**: Clear
- **Location**: Line 114, FR-009
- **Analysis**: Clearly defined - truncate after ~40 characters with ellipsis, show full on hover.

---

### 4. Narrow Panel Width

- **Category**: Edge Cases
- **Status**: Clear
- **Location**: Line 116
- **Analysis**: Clearly defined - minimum 150px width, text truncates with ellipsis.

---

### 5. Rapid Typing / Debounce Behavior

- **Category**: Edge Cases (Rate Limiting/Throttling)
- **Status**: Partial
- **Location**: Line 208 (NFR), FR-010, FR-015, FR-019
- **Current Definition**: "Debounce outline updates to avoid excessive re-parsing during rapid typing" and "update within 500ms of document changes"
- **Question Candidate**: What is the specific debounce delay? Is the 500ms update deadline measured from typing pause or from debounce trigger? What happens if AST parsing takes longer than 500ms on a large document?
- **Impact Score**: 3
- **Rationale**: The interaction between debounce timing and the 500ms update SLA is ambiguous. Could cause test failures or unexpected UX.

---

### 6. Concurrent AST Updates (Conflict Resolution)

- **Category**: Edge Cases (Conflict Resolution)
- **Status**: Missing
- **Question Candidate**: If the user edits the document while an AST parse is in-flight, should the in-progress parse be cancelled and restarted, or should it complete and be discarded if outdated? What mechanism prevents race conditions between AST parsing and outline updates?
- **Impact Score**: 4
- **Rationale**: Concurrent edits during parsing could cause stale outline states or race conditions. No cancellation or versioning strategy is defined.

---

### 7. Window Resize During Panel Animation

- **Category**: Edge Cases
- **Status**: Missing
- **Question Candidate**: What happens if the user resizes the window while the outline panel is animating open/close? Should the animation be interrupted, or should resize be deferred until animation completes?
- **Impact Score**: 2
- **Rationale**: Edge case but can cause jarring UX. Low impact since this is a polish concern.

---

### 8. Navigation Target No Longer Exists

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Missing
- **Question Candidate**: What happens if a user clicks an outline item but the target line no longer exists (e.g., content was deleted between outline render and click)? Should navigation fail silently, show an error, or navigate to the nearest valid position?
- **Impact Score**: 4
- **Rationale**: This is a common race condition in live-updating outlines. No fallback behavior is specified.

---

### 9. Very Large Documents

- **Category**: Edge Cases (Rate Limiting/Throttling)
- **Status**: Missing
- **Question Candidate**: Is there a maximum document size or heading/component count where the outline should degrade gracefully (e.g., collapse deeply nested items, limit displayed items, show "too many items" warning)? What is the performance threshold?
- **Impact Score**: 3
- **Rationale**: Performance NFRs mention "not blocking main thread" but no specific limits or degradation strategy is defined for extreme cases.

---

### 10. Malformed Frontmatter YAML

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Partial
- **Location**: FR-016, FR-018
- **Current Definition**: "parse YAML frontmatter if present" and "hide if no frontmatter"
- **Question Candidate**: What should happen when frontmatter exists but contains invalid YAML syntax? Should it be treated as "no frontmatter" (hidden), show an error indicator, or display partially parsed content?
- **Impact Score**: 3
- **Rationale**: YAML parsing errors are common during editing. The spec doesn't distinguish between "no frontmatter" and "invalid frontmatter".

---

### 11. Duplicate Heading Text

- **Category**: Edge Cases
- **Status**: Missing
- **Question Candidate**: How are multiple headings with identical text distinguished in the outline? Should they show line numbers, or is the tree position sufficient? Could this cause navigation ambiguity?
- **Impact Score**: 2
- **Rationale**: Common in documents with repeated section names (e.g., multiple "Example" headings). Minor UX concern.

---

### 12. Nested Component Edge Cases

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Partial
- **Location**: FR-011, FR-013
- **Current Definition**: "identify all JSX component usages" and "show each instance with its line number"
- **Question Candidate**: How should deeply nested components be handled (component inside component)? Should both the outer and inner components appear in the list? What about self-closing vs. container components?
- **Impact Score**: 2
- **Rationale**: MDX allows complex component nesting. The flat listing approach may not capture nesting relationships clearly.

---

### 13. Panel Visibility Persistence Failure

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Missing
- **Question Candidate**: What happens if localStorage is unavailable or corrupted? Should the outline default to visible or hidden? Should there be a fallback storage mechanism?
- **Impact Score**: 2
- **Rationale**: Edge case for storage failures. Low impact since a default state can be assumed.

---

### 14. Keyboard Navigation Conflicts

- **Category**: Edge Cases (Conflict Resolution)
- **Status**: Missing
- **Question Candidate**: If the outline has keyboard focus and the user presses a key that conflicts with editor shortcuts (e.g., arrow keys, Enter), how is focus management handled? Should Tab move between outline and editor?
- **Impact Score**: 3
- **Rationale**: Accessibility NFR mentions keyboard navigation but doesn't address focus trapping or keyboard shortcut conflicts.

---

## Impact Summary

| Score | Count | Topics |
|-------|-------|--------|
| 4 (High) | 3 | AST parsing partial failures, concurrent AST updates, navigation target deleted |
| 3 (Medium) | 4 | Debounce timing, large documents, malformed YAML, keyboard navigation conflicts |
| 2 (Low) | 4 | Window resize animation, duplicate headings, nested components, persistence failure |

---

## Recommendations

### High Priority (Impact 4+)
1. **Clarify concurrent AST update handling** - Define cancellation/versioning strategy
2. **Define navigation fallback for deleted targets** - Specify behavior when outline item's target no longer exists
3. **Specify partial parsing failure behavior** - Define per-section error handling

### Medium Priority (Impact 3)
1. **Clarify debounce timing vs 500ms SLA** - Make the timing relationship explicit
2. **Define large document degradation strategy** - Set thresholds and fallback behaviors
3. **Specify invalid YAML frontmatter handling** - Distinguish from "no frontmatter"
4. **Address keyboard focus conflicts** - Define focus management between outline and editor

### Low Priority (Impact 2)
1. **Clarify duplicate heading display** - Consider showing line numbers
2. **Specify nested component display** - Define depth handling
3. **Document storage failure fallback** - Define default state
4. **Address window resize during animation** - Define interruption behavior

---

## Questions for Clarification

1. When the user edits the document during an in-flight AST parse, should the parse be cancelled and restarted, or complete and be discarded if stale?

2. If a user clicks an outline item that has been deleted from the document, should navigation fail silently, show a toast notification, or attempt to navigate to the nearest valid line?

3. What is the exact debounce delay for outline updates, and how does it relate to the 500ms update deadline?

4. For documents with syntax errors, should partially valid sections (e.g., valid headings but broken JSX) still be displayed?

5. Is there a maximum heading/component count threshold beyond which the outline should show a "truncated" indicator or collapse by default?

6. How should invalid YAML frontmatter be displayed - as an error state, hidden, or showing raw unparsed content?
