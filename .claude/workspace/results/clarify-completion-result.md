# Completion Ambiguity Analysis: Smart Filtering for File Tree (014)

**Spec File**: `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/spec.md`
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

### 1. Fuzzy Matching Algorithm Definition

- **Category**: Completion
- **Status**: Partial
- **Spec Text (Lines 29-39, 103, 130, 138)**: "fuzzy matching where non-contiguous character sequences can match" and "fzf-style matching" in assumptions, but SC-006 states "80% of query characters present in any order"
- **Question Candidate**: What specific fuzzy matching algorithm should be used (fzf, Levenshtein, Smith-Waterman, custom)? How is "match quality" for ranking calculated, and what threshold score determines a valid match?
- **Impact Score**: 5
- **Rationale**: SC-006's "80% of query characters in any order" conflicts with fzf-style sequential matching. Tests cannot be deterministic without specifying the exact algorithm and scoring model. This is the core feature.

---

### 2. Match Quality Ranking Criteria

- **Category**: Completion
- **Status**: Missing
- **Spec Text (Line 38)**: "all matching files are displayed ranked by match quality"
- **Question Candidate**: How should match quality be calculated for ranking? Should ranking prioritize exact matches, contiguous character runs, filename vs path position, or recency of access?
- **Impact Score**: 4
- **Rationale**: "Ranked by match quality" cannot be tested without knowing the ranking algorithm. Different implementers would produce different orderings for the same query.

---

### 3. Case Sensitivity Behavior

- **Category**: Completion
- **Status**: Missing
- **Spec Text**: Not addressed anywhere in spec
- **Question Candidate**: Should the filter be case-sensitive, case-insensitive, or use smart-case matching (case-insensitive unless uppercase is present)?
- **Impact Score**: 4
- **Rationale**: Fundamental filter behavior affecting all test cases. User Story 2 examples use lowercase queries for CamelCase files, implying case-insensitivity, but this is never stated.

---

### 4. Keyboard Shortcut Definition

- **Category**: Completion
- **Status**: Missing
- **Spec Text (Lines 68, 107, 137)**: "designated keyboard shortcut" with assumption "Cmd/Ctrl+Shift+E or similar unassigned shortcut"
- **Question Candidate**: What is the specific keyboard shortcut for focusing the filter input? Should it be configurable by the user?
- **Impact Score**: 3
- **Rationale**: User Story 4 and FR-006 require a shortcut but none is specified. Assumption uses "or similar" which is not a testable definition.

---

### 5. Performance Threshold Measurement Methodology

- **Category**: Completion
- **Status**: Partial
- **Spec Text (Line 126)**: "Filter results update within 100ms of keystroke for projects with up to 10,000 files"
- **Question Candidate**: How should the 100ms threshold be measured - time to compute filter results or time until UI renders? What is expected behavior for projects exceeding 10,000 files?
- **Impact Score**: 4
- **Rationale**: Performance tests need clear measurement boundaries. Computation vs render can differ by 50-100ms. Degradation behavior above threshold is unspecified.

---

### 6. User Success Rate Measurement (SC-003)

- **Category**: Completion
- **Status**: Partial
- **Spec Text (Line 127)**: "95% of users successfully find their target file on first filter attempt"
- **Question Candidate**: How will "95% user success rate" be measured and validated? Should this be replaced with a deterministic test criterion based on algorithmic accuracy?
- **Impact Score**: 3
- **Rationale**: This is a UX research metric, not a code testable criterion. Cannot be automated in CI/CD. Needs reframing or removal from acceptance criteria.

---

### 7. File Location Time (SC-001)

- **Category**: Completion
- **Status**: Partial
- **Spec Text (Line 125)**: "Users can locate a specific file in a 500+ file project within 5 seconds using the filter"
- **Question Candidate**: Should SC-001 be reframed as a performance benchmark (filter UI responds in X ms) rather than a user behavior metric dependent on typing speed?
- **Impact Score**: 3
- **Rationale**: "Within 5 seconds" depends on user typing speed and familiarity. Not deterministically testable without specifying query length and expected keystrokes.

---

### 8. Visual Highlighting Style

- **Category**: Completion
- **Status**: Partial
- **Spec Text (Lines 52-54, 105)**: "visually highlighted" and "each matched character is individually highlighted"
- **Question Candidate**: What visual style should be used for match highlighting (background color, text weight, text color, underline)? Should there be a specific color from the application theme?
- **Impact Score**: 2
- **Rationale**: "Visually highlighted" is ambiguous. Multiple valid implementations exist. Lower impact as any highlighting satisfies the requirement, but visual regression tests need specificity.

---

### 9. Empty State Message Content

- **Category**: Completion
- **Status**: Partial
- **Spec Text (Lines 92, 112)**: "Empty state with helpful message" and "clear empty state message"
- **Question Candidate**: What should the empty state message say? Should it include suggestions (e.g., "No files match 'query'" or "Try a different search term")?
- **Impact Score**: 2
- **Rationale**: Tests can verify an empty state exists, but without exact text, implementation varies. Low impact as any message satisfies the requirement.

---

### 10. Filter Input Length Limit

- **Category**: Completion
- **Status**: Partial
- **Spec Text (Line 96)**: "Truncate or limit input length gracefully"
- **Question Candidate**: What is the maximum character length for the filter input? Should truncation occur at input level or display level?
- **Impact Score**: 2
- **Rationale**: Edge case handling needs a specific limit for testing. 100 characters? 255? 1000? Affects both UX and performance testing.

---

### 11. Project/Workspace Scope Identification

- **Category**: Completion
- **Status**: Partial
- **Spec Text (Lines 86, 108, 117)**: "filter state is specific to that project" and "persist filter query across application sessions per project/workspace"
- **Question Candidate**: How is a project/workspace uniquely identified for filter persistence (folder path hash, project config file, user-defined project ID)?
- **Impact Score**: 3
- **Rationale**: Persistence tests need to know how "project" boundaries are determined. Opening a subfolder vs root folder may behave differently.

---

### 12. Keyboard Shortcut Discoverability Requirement

- **Category**: Completion
- **Status**: Partial
- **Spec Text (Line 128)**: "Keyboard shortcut to focus filter is discoverable (documented in UI or command palette)"
- **Question Candidate**: Must the keyboard shortcut be registered in the command palette, shown in a UI tooltip, or both? What counts as "discoverable"?
- **Impact Score**: 2
- **Rationale**: "Or" implies either satisfies the requirement. Tests need to know which documentation method is required for acceptance.

---

### 13. Filter Input UI Placement

- **Category**: Completion
- **Status**: Partial
- **Spec Text (Line 102)**: "text input field in the file explorer sidebar"
- **Question Candidate**: Where exactly should the filter input be positioned within the file explorer sidebar (top of sidebar, above file tree, collapsible header, floating)?
- **Impact Score**: 2
- **Rationale**: Layout verification tests need specific placement expectations. "In the sidebar" allows multiple valid positions.

---

### 14. Debounce Timing

- **Category**: Completion
- **Status**: Partial
- **Spec Text (Lines 102, 111)**: "as the user types" and "without noticeable delay"
- **Question Candidate**: Should filtering be immediate on each keystroke, or should there be a debounce delay (e.g., 50-150ms) to optimize performance?
- **Impact Score**: 3
- **Rationale**: Performance tests need to account for debounce. "As the user types" suggests real-time, but performance requirements may need debouncing. If debounced, timing affects test wait strategies.

---

### 15. Basic Filtering Mechanism

- **Category**: Completion
- **Status**: Clear
- **Spec Text (Lines 20-22)**: Given/When/Then for basic filter display
- **Question Candidate**: N/A
- **Impact Score**: 1
- **Rationale**: Acceptance scenarios are testable with clear inputs and expected outputs.

---

### 16. Filter Clear Behavior

- **Category**: Completion
- **Status**: Clear
- **Spec Text (Lines 21, 109, 113)**: "clear the filter input, Then the full file tree is restored"
- **Question Candidate**: N/A
- **Impact Score**: 1
- **Rationale**: Clear action and expected result are specified. Testable.

---

### 17. Parent Folder Visibility

- **Category**: Completion
- **Status**: Clear
- **Spec Text (Lines 93, 104)**: "Parent folders of matching items remain visible" and FR-004
- **Question Candidate**: N/A
- **Impact Score**: 1
- **Rationale**: Explicitly defined behavior for tree structure preservation. Testable.

---

### 18. Escape Key Behavior

- **Category**: Completion
- **Status**: Clear
- **Spec Text (Lines 69-70)**: Two-step Escape behavior (clear text first, then blur)
- **Question Candidate**: N/A
- **Impact Score**: 1
- **Rationale**: Specific two-step behavior defined. Testable via keyboard simulation.

---

### 19. Real-time File System Updates

- **Category**: Completion
- **Status**: Clear
- **Spec Text (Lines 94, 110)**: "Filter results update automatically when files are added, removed, or renamed"
- **Question Candidate**: N/A
- **Impact Score**: 1
- **Rationale**: FR-009 explicitly requires automatic updates. Testable via file system events.

---

### 20. Special Characters Handling

- **Category**: Completion
- **Status**: Clear
- **Spec Text (Line 95)**: "Treat as literal characters for matching"
- **Question Candidate**: N/A
- **Impact Score**: 1
- **Rationale**: Explicit handling specified. Regex special chars become literal. Testable.

---

### 21. Persistence Reliability (SC-005)

- **Category**: Completion
- **Status**: Clear
- **Spec Text (Line 129)**: "Filter state persists correctly across 100% of application restart cycles"
- **Question Candidate**: N/A
- **Impact Score**: 1
- **Rationale**: Deterministic 100% reliability criterion. Testable with repeated restart cycles.

---

## Severity Summary

| Impact Score | Count |
|--------------|-------|
| 5 (Critical) | 1     |
| 4 (High)     | 3     |
| 3 (Medium)   | 5     |
| 2 (Low)      | 5     |
| 1 (Clear)    | 7     |

---

## High-Impact Questions (Impact >= 4)

1. **[Impact 5] Fuzzy Matching Algorithm**: What specific fuzzy matching algorithm should be used, and how is the matching threshold/scoring defined? The assumption mentions "fzf-style" but SC-006 describes "80% of characters in any order" which is inconsistent.

2. **[Impact 4] Match Quality Ranking**: How is "match quality" calculated for ranking results? What factors determine ordering (contiguity, position, exact match bonus)?

3. **[Impact 4] Case Sensitivity**: Should filtering be case-sensitive, case-insensitive, or smart-case?

4. **[Impact 4] Performance Measurement**: How is the 100ms threshold measured (computation time vs render time)? What happens with >10,000 files?

---

## Recommended Clarification Questions (Priority Order)

1. **[Impact 5]** What fuzzy matching algorithm should be implemented? Please specify: (a) exact algorithm (fzf, Levenshtein, custom), (b) minimum match threshold, and (c) scoring weights for ranking.

2. **[Impact 4]** Should filtering be case-sensitive, case-insensitive, or use smart-case matching (case-insensitive unless query contains uppercase)?

3. **[Impact 4]** How should match quality ranking work? Please specify factors in priority order (e.g., exact match > prefix match > contiguous > scattered).

4. **[Impact 4]** For the 100ms performance criterion (SC-002): is this measured to filter computation completion or to UI render completion? What is the expected behavior for projects exceeding 10,000 files?

5. **[Impact 3]** What is the specific keyboard shortcut for focusing the filter input?

---

## Overall Assessment

The spec has **solid structural foundations** with Given/When/Then acceptance scenarios and explicit functional requirements. The edge cases section anticipates important behaviors.

**Strengths:**
- Clear acceptance scenarios for basic filtering workflow
- Explicit persistence behavior per project
- Well-defined Escape key two-step behavior
- Real-time file system update requirement

**Critical Gaps:**
1. **Fuzzy matching algorithm undefined** - This is the core feature and cannot be tested without algorithmic specification
2. **Case sensitivity unaddressed** - Fundamental behavior affecting all filtering tests
3. **Ranking algorithm undefined** - "Match quality" has no testable definition
4. **Performance measurement methodology** - Unclear what the 100ms measures

**Non-critical Gaps:**
- Visual highlighting style
- Exact keyboard shortcut
- Empty state message text
- Input length limit

The spec is approximately **65% complete** from a testability standpoint. The core fuzzy matching functionality lacks sufficient detail for deterministic implementation and testing. Addressing the 4 high-impact clarifications would bring testability to production-ready levels.
