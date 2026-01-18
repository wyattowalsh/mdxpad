# Edge Cases Ambiguity Analysis

**Spec**: specs/014-smart-filtering/spec.md
**Category**: Edge Cases & Failure Handling
**Analysis Date**: 2026-01-17

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 2 |
| Partial | 7 |
| Missing | 5 |

---

## Detailed Findings

### 1. Empty/No Match State

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Clear
- **Location**: Lines 92, 112
- **Analysis**: Spec clearly states "Empty state with helpful message" (Edge Cases section) and FR-011 requires "System MUST display a clear empty state message when no files match the filter query"
- **Impact Score**: N/A (Clear)

---

### 2. Escape Key / Focus Management

- **Category**: Edge Cases
- **Status**: Clear
- **Location**: Lines 68-70 (US-4 AS-2, AS-3)
- **Analysis**: Clearly specifies two-stage Escape behavior - first clears filter text, second removes focus
- **Impact Score**: N/A (Clear)

---

### 3. Special Characters in Filter Query

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Partial
- **Location**: Line 95
- **Current Definition**: "Treat as literal characters for matching"
- **Question Candidate**: What specific special characters are supported? How should regex metacharacters (*, ?, [], etc.) be handled - strictly as literals or with any wildcard meaning? Should backslash escaping be supported?
- **Impact Score**: 3
- **Rationale**: Developers often expect glob-style wildcards in file search. Treating all special chars as literal may surprise users.

---

### 4. Very Long Filter Input

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Partial
- **Location**: Line 96
- **Current Definition**: "Truncate or limit input length gracefully"
- **Question Candidate**: What is the maximum allowed filter input length (characters)? What visual feedback is provided when truncation occurs? Should there be a visible indicator showing input was limited?
- **Impact Score**: 2
- **Rationale**: Low impact edge case, but specific limits are needed for implementation consistency.

---

### 5. Deep Nested Folder Structures

- **Category**: Edge Cases
- **Status**: Partial
- **Location**: Line 93
- **Current Definition**: "Parent folders of matching items remain visible"
- **Question Candidate**: What is the maximum supported nesting depth for display? How should the UI handle displaying very deep paths (truncation, horizontal scrolling, tooltips)? Are there performance considerations for trees with 50+ nesting levels?
- **Impact Score**: 3
- **Rationale**: Real monorepos can have deeply nested paths. Display strategy affects usability.

---

### 6. File System Changes During Active Filter

- **Category**: Edge Cases (Conflict Resolution)
- **Status**: Partial
- **Location**: Lines 94, 109
- **Current Definition**: "Filter results update automatically" (FR-009)
- **Question Candidate**: How quickly should filter results update after file system changes? What happens if a currently selected/focused file is deleted while filtered? Should there be a debounce period for rapid consecutive file system changes?
- **Impact Score**: 4
- **Rationale**: Critical for maintaining consistent UI state. Rapid file operations (git, npm) could overwhelm the filter.

---

### 7. Rapid Keystroke Input (Rate Limiting/Throttling)

- **Category**: Edge Cases (Rate Limiting)
- **Status**: Partial
- **Location**: Lines 111, 126-127
- **Current Definition**: FR-010 requires "without noticeable delay"; SC-002 requires "within 100ms for up to 10,000 files"
- **Question Candidate**: What debounce/throttle strategy should be used for filtering on keystroke? Should filtering be debounced (e.g., 50ms delay after typing stops) or throttled (e.g., max once per 100ms)? What happens if user types faster than filter can compute?
- **Impact Score**: 4
- **Rationale**: Critical for perceived performance. The 100ms SLA needs a clear timing relationship with user input.

---

### 8. Very Large File Trees (Performance Edge Case)

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Partial
- **Location**: Line 126
- **Current Definition**: SC-002 specifies "up to 10,000 files"
- **Question Candidate**: What is the behavior for projects exceeding 10,000 files? Should there be a warning, degraded mode, or background processing? What about 100,000+ file projects common in monorepos?
- **Impact Score**: 4
- **Rationale**: Real enterprise projects often exceed 10K files. No fallback or degradation strategy is defined.

---

### 9. Concurrent Filter and Bulk File Operations

- **Category**: Edge Cases (Conflict Resolution)
- **Status**: Missing
- **Question Candidate**: What happens if the user is typing a filter query while files are being added/removed in bulk (e.g., git checkout, npm install)? How should the system prioritize filter computation vs. file tree updates? Should there be a "busy" indicator?
- **Impact Score**: 4
- **Rationale**: Common scenario in development workflows. No specification for handling concurrent bulk operations.

---

### 10. Filter Persistence Corruption/Invalid State

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Missing
- **Question Candidate**: What happens if persisted filter state is corrupted, invalid, or references a deleted project? Should there be validation on load? What's the fallback behavior (empty filter, error toast, silent recovery)?
- **Impact Score**: 3
- **Rationale**: Storage corruption happens. No recovery or validation strategy is defined.

---

### 11. Project/Workspace Switch During Active Filter

- **Category**: Edge Cases (Conflict Resolution)
- **Status**: Missing
- **Question Candidate**: What happens to the filter input UI state when switching projects/workspaces? Should the old filter be cleared immediately, after the new project loads, or persisted visually until new filter state loads? What if the new project load fails?
- **Impact Score**: 3
- **Rationale**: US-5 AS-3 says "filter state is specific to that project" but doesn't address transition behavior.

---

### 12. Keyboard Shortcut Conflicts

- **Category**: Edge Cases (Conflict Resolution)
- **Status**: Missing
- **Question Candidate**: What happens if the designated keyboard shortcut conflicts with an existing application shortcut, OS shortcut, or browser shortcut? Is there a fallback? Can users customize the shortcut? What if the shortcut is already used by Command Palette?
- **Impact Score**: 3
- **Rationale**: FR-006 requires a keyboard shortcut; Assumptions mention "standard conventions" but no conflict resolution is specified.

---

### 13. Unicode/Internationalization in Filter Input

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Missing
- **Question Candidate**: How should the fuzzy matching algorithm handle Unicode characters, combining characters, diacritics, or non-Latin scripts in file names? Should matching be case-insensitive across all Unicode ranges (e.g., `a` matches `A`, but does `a` match `a` with accent)?
- **Impact Score**: 3
- **Rationale**: Many projects have non-ASCII file names. No i18n considerations are specified.

---

### 14. Case Sensitivity Behavior

- **Category**: Edge Cases
- **Status**: Partial
- **Location**: Lines 36-37 (US-2 AS-1)
- **Current Definition**: Example shows "mycmp" matching "MyComponent.tsx" implying case-insensitivity
- **Question Candidate**: Should filter matching be case-sensitive, case-insensitive, or smart-case (case-insensitive unless uppercase is used, like VS Code search)? How does this interact with case-sensitive vs. case-insensitive file systems?
- **Impact Score**: 3
- **Rationale**: Case handling significantly affects user expectations. Implied behavior is not explicitly stated as a requirement.

---

## Impact Summary

| Score | Count | Topics |
|-------|-------|--------|
| 4 (High) | 4 | File system changes during filter, rapid keystroke handling, very large file trees, concurrent bulk operations |
| 3 (Medium) | 6 | Special characters, deep nesting, persistence corruption, project switch, keyboard conflicts, Unicode/i18n, case sensitivity |
| 2 (Low) | 1 | Long filter input length |

---

## Recommendations

### High Priority (Impact 4) - Must Clarify Before Implementation
1. **Clarify debounce/throttle strategy for keystroke input** - Define exact timing relationship between typing and filter execution
2. **Define file system change handling** - Specify debounce for file events, selection state preservation
3. **Specify large project degradation** - Define behavior for projects exceeding 10,000 files
4. **Address concurrent bulk operations** - Define priority and busy state handling

### Medium Priority (Impact 3) - Should Clarify
1. **Clarify special character handling** - Decide on strict literal vs. glob-style wildcards
2. **Define case sensitivity behavior** - Explicitly state case handling rules
3. **Specify persistence failure recovery** - Define validation and fallback
4. **Address project switch transition** - Define UI behavior during workspace change
5. **Document keyboard shortcut conflict resolution** - Define fallback or customization
6. **Address Unicode/i18n** - Define matching behavior for non-ASCII characters

### Low Priority (Impact 2) - Nice to Clarify
1. **Specify max input length** - Define exact character limit and truncation feedback

---

## Questions for Clarification

1. What debounce/throttle strategy should be used for filter input? (e.g., 50ms debounce after typing stops, or throttle to max once per 100ms?)

2. When files are rapidly created/deleted (e.g., during `npm install`), should filter updates be debounced? If so, what delay? Should there be a "updating..." indicator?

3. What happens for projects exceeding 10,000 files? Options: a) Accept slower performance, b) Show warning, c) Use background worker, d) Limit displayed results

4. If the user is actively typing while a bulk git checkout occurs, which operation takes priority for updating the file tree view?

5. Should special characters like `*`, `?`, `[` be treated as: a) Strict literals, b) Glob-style wildcards, c) Configurable?

6. What is the exact case sensitivity rule? Options: a) Always case-insensitive, b) Smart-case (insensitive unless query contains uppercase), c) Respect file system case sensitivity

7. If persisted filter state is corrupted on load, what should happen? Options: a) Silent recovery to empty filter, b) Show error toast, c) Log warning only

8. When switching projects, what happens to the visible filter input? Options: a) Clear immediately, b) Show loading state, c) Retain old text until new state loads

9. What is the designated keyboard shortcut, and what happens if it conflicts with Command Palette or other app shortcuts?

10. How should fuzzy matching handle Unicode? Should `cafe` match `cafe` (with accent) in file names?
