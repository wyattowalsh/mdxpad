# Clarification Analysis: Misc / Placeholders

**Spec**: `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/spec.md`
**Category**: Misc / Placeholders
**Focus Areas**: TODO markers, unresolved decisions, ambiguous adjectives lacking quantification
**Analyzed**: 2026-01-17

---

## Summary

The spec is reasonably well-specified with most performance metrics quantified (100ms latency, 80% match threshold). However, several ambiguous adjectives and unresolved decisions were identified that require clarification before implementation. No explicit TODO markers were found.

| Status | Count |
|--------|-------|
| Clear | 3 |
| Partial | 6 |
| Missing | 1 |

---

## Findings

### 1. TODO Markers / Unresolved Decisions

**Status**: Clear
**Finding**: No explicit TODO markers, FIXME, or TBD annotations found in the spec.

---

### 2. Ambiguous Adjective: "noticeable delay" (Line 111)

**Location**: FR-010
**Text**: "System MUST perform filtering without noticeable delay as the user types"
**Status**: **Partial**
**Impact Score**: 3/5

**Question Candidate**: What specific latency threshold (in milliseconds) defines "noticeable delay"? SC-002 specifies 100ms for 10k files - should FR-010 reference this explicitly?

**Rationale**: The term "noticeable delay" is subjective. While SC-002 provides a quantified metric (100ms), the functional requirement itself lacks precision. This creates potential ambiguity in implementation and testing.

---

### 3. Ambiguous Adjective: "very long string" (Line 96)

**Location**: Edge Cases
**Text**: "What happens when the user pastes a very long string into the filter? (Truncate or limit input length gracefully)"
**Status**: **Partial**
**Impact Score**: 3/5

**Question Candidate**: What is the maximum character limit for filter input? What constitutes "gracefully" handling overflow (silent truncation, warning message, visual indicator)?

**Rationale**: "Very long" is undefined. The resolution mentions truncation but doesn't specify the limit or the user feedback mechanism.

---

### 4. Ambiguous Adjective: "helpful message" (Line 92)

**Location**: Edge Cases
**Text**: "What happens when the filter query matches no files or folders? (Empty state with helpful message)"
**Status**: **Partial**
**Impact Score**: 2/5

**Question Candidate**: What specific text should the empty state message display? Should it provide suggestions for improving the query?

**Rationale**: "Helpful" is subjective. The specific message content and whether it should include actionable suggestions is not defined.

---

### 5. Unresolved Decision: Specific Keyboard Shortcut (Lines 68, 137)

**Location**: User Story 4, Assumptions
**Text**: "the designated keyboard shortcut" and "e.g., Cmd/Ctrl+Shift+E or similar unassigned shortcut"
**Status**: **Partial**
**Impact Score**: 4/5

**Question Candidate**: What is the definitive keyboard shortcut for focusing the filter input? How will conflicts with existing shortcuts be resolved?

**Rationale**: The specification mentions "designated" shortcut without defining it. The assumption section gives an example but uses tentative language ("or similar"). This is a UX decision that affects documentation and command palette integration.

---

### 6. Ambiguous Term: "match quality" (Line 38)

**Location**: User Story 2, Acceptance Scenario 3
**Text**: "all matching files are displayed ranked by match quality"
**Status**: **Partial**
**Impact Score**: 3/5

**Question Candidate**: What algorithm/criteria determines "match quality" ranking? (e.g., character proximity, position in filename, consecutive matches)

**Rationale**: While SC-006 defines fuzzy matching threshold (80% characters), the ranking algorithm for match quality is not specified. Different implementations could produce different orderings.

---

### 7. Ambiguous Adjective: "visually highlighted" / "visually distinguished" (Lines 52-54)

**Location**: User Story 3, Acceptance Scenarios
**Text**: "visually highlighted", "visually distinguished"
**Status**: **Partial**
**Impact Score**: 2/5

**Question Candidate**: What specific visual treatment should be used for match highlighting? (bold, color, background, underline) Should it follow existing UI conventions from the codebase?

**Rationale**: The visual style is not specified. Implementation could vary significantly (color highlighting, bold text, underline, background color).

---

### 8. Assumption: "standard algorithm like fzf-style matching" (Line 138)

**Location**: Assumptions
**Text**: "Fuzzy matching uses a standard algorithm like fzf-style matching"
**Status**: **Partial**
**Impact Score**: 2/5

**Question Candidate**: Should the implementation use fzf algorithm specifically, or is any fuzzy matching algorithm acceptable? Are there specific fuzzy matching libraries preferred?

**Rationale**: The phrase "like fzf-style" is non-committal. For consistency and predictable behavior, a specific algorithm or library should be designated.

---

### 9. Clear Specification: Filter Persistence Scope (Line 86)

**Location**: User Story 5, Acceptance Scenario 3
**Text**: "the filter state is specific to that project"
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: Filter persistence is clearly scoped per-project/workspace. No ambiguity.

---

### 10. Clear Specification: Special Character Handling (Line 95)

**Location**: Edge Cases
**Text**: "special characters in the filter query? (Treat as literal characters for matching)"
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: Clearly resolved - special characters are treated as literals. No regex interpretation.

---

### 11. Missing Specification: Filter Input Length Limit

**Location**: Edge Cases (Line 96)
**Status**: **Missing**
**Impact Score**: 3/5

**Question Candidate**: What is the maximum allowed length for the filter input field? Should there be a character counter or visual indication when approaching the limit?

**Rationale**: The edge case mentions handling long strings but does not specify the actual limit.

---

## Summary Table

| # | Ambiguity | Status | Impact | Line(s) |
|---|-----------|--------|--------|---------|
| 1 | No TODO markers | Clear | 0/5 | - |
| 2 | "noticeable delay" | Partial | 3/5 | 111 |
| 3 | "very long string" + "gracefully" | Partial | 3/5 | 96 |
| 4 | "helpful message" | Partial | 2/5 | 92 |
| 5 | Keyboard shortcut undefined | Partial | 4/5 | 68, 137 |
| 6 | "match quality" ranking | Partial | 3/5 | 38 |
| 7 | "visually highlighted" style | Partial | 2/5 | 52-54 |
| 8 | "fzf-style" algorithm | Partial | 2/5 | 138 |
| 9 | Filter persistence scope | Clear | 1/5 | 86 |
| 10 | Special character handling | Clear | 1/5 | 95 |
| 11 | Input length limit | Missing | 3/5 | 96 |

---

## Recommended Priority for Clarification

**High Priority** (Impact 4-5):
1. **Keyboard shortcut** - What is the definitive keyboard shortcut for focusing the filter input, and how are conflicts resolved?

**Medium Priority** (Impact 3):
2. **Noticeable delay quantification** - Align FR-010 with SC-002's 100ms threshold or specify a different value
3. **Input length limit** - Specify maximum filter input length (e.g., 256 characters) and overflow handling behavior
4. **Match quality ranking** - Define the fuzzy matching scoring/ranking criteria or reference a specific library
5. **Long string handling** - Specify the character limit and user feedback mechanism for overflow

**Lower Priority** (Impact 1-2):
6. **Visual highlight style** - Define the specific CSS/visual treatment for match highlighting
7. **Helpful message content** - Specify the empty state message text
8. **Fuzzy algorithm specification** - Commit to fzf-style or specify acceptable alternatives

---

## Recommended Clarification Questions (Sorted by Impact)

1. **[Impact 4]** What is the definitive keyboard shortcut for focusing the filter input? How will conflicts with existing application shortcuts be detected and resolved?

2. **[Impact 3]** Should FR-010 ("without noticeable delay") explicitly reference SC-002's 100ms threshold, or is a different performance target intended?

3. **[Impact 3]** What is the maximum character limit for filter input, and what user feedback should be provided when the limit is reached or exceeded?

4. **[Impact 3]** What algorithm/criteria determines "match quality" for result ranking? Should the spec require a specific scoring approach (e.g., character proximity bonus, consecutive match bonus)?

5. **[Impact 2]** What specific visual treatment should be used for highlighting matched characters in filtered results (bold, background color, text color, underline)?
