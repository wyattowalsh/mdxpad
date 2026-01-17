# Clarification Analysis: Misc / Placeholders

**Spec**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`
**Category**: Misc / Placeholders
**Focus Areas**: TODO markers, unresolved decisions, ambiguous adjectives lacking quantification
**Analyzed**: 2026-01-10

---

## Summary

The spec is relatively well-defined with most requirements quantified. However, several ambiguous adjectives and unresolved decisions were identified that could benefit from clarification.

---

## Findings

### 1. Ambiguous Adjective: "reasonable period" (Line 155)

**Location**: Edge Cases section
**Text**: "...timeout after reasonable period"
**Status**: **Missing**
**Impact Score**: 4/5

**Question Candidate**: What specific timeout value should be used when preview compilation takes too long? Should this be configurable, and what is the default (e.g., 5 seconds, 10 seconds, 30 seconds)?

**Rationale**: This directly affects user experience and testability. Without a specific value, developers cannot implement consistent behavior and QA cannot verify correctness.

---

### 2. Ambiguous Adjective: "user-friendly error message" (Line 201, FR-023)

**Location**: Requirements > Document Lifecycle - Save
**Text**: "...showing user-friendly error message..."
**Status**: **Partial**
**Impact Score**: 3/5

**Question Candidate**: What constitutes a "user-friendly" error message? Should there be specific guidance on: (a) reading level/complexity, (b) whether to include technical details, (c) actionable next steps, (d) localization requirements?

**Rationale**: "User-friendly" is subjective. While the phrase "specific problem" provides some guidance, more concrete criteria would ensure consistent UX across all error scenarios.

---

### 3. Ambiguous Adjective: "usability threshold" (Line 169, FR-003)

**Location**: Requirements > Layout & Panels
**Text**: "...neither can be resized below usability threshold"
**Status**: **Missing**
**Impact Score**: 4/5

**Question Candidate**: What are the specific minimum pixel widths for each pane? Should these be based on content requirements (e.g., minimum 200px for editor, 250px for preview), or should they be expressed as percentages of the container?

**Rationale**: This directly affects implementation and testing. Without specific values, different developers may choose different thresholds leading to inconsistent behavior.

---

### 4. Ambiguous Adjective: "standard hardware" (Line 258, SC-008)

**Location**: Success Criteria
**Text**: "...within 2 seconds on standard hardware"
**Status**: **Partial**
**Impact Score**: 2/5

**Question Candidate**: What defines "standard hardware"? Should there be a baseline specification (e.g., M1 MacBook Air, 8GB RAM) or a performance budget that scales with hardware capability?

**Rationale**: While 2 seconds is quantified, the hardware baseline is vague. This could lead to confusion about whether performance issues are bugs or expected on lower-spec machines.

---

### 5. Unresolved Decision: Theme values (Line 241)

**Location**: Key Entities > Settings
**Text**: "theme ('light' | 'dark' | 'system')"
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: This is actually well-defined. No ambiguity found.

---

### 6. Ambiguous Adjective: "clear" error feedback (Line 273)

**Location**: Non-Functional Requirements > Reliability
**Text**: "...clear success/failure feedback"
**Status**: **Partial**
**Impact Score**: 2/5

**Question Candidate**: What form should "clear feedback" take? Should this be visual (toast notification, status bar update), auditory, or both? How long should feedback be displayed?

**Rationale**: While the requirement for feedback is stated, the implementation details that ensure "clarity" are not specified.

---

### 7. Ambiguous Phrase: "logical during dialog flows" (Line 282)

**Location**: Non-Functional Requirements > Accessibility
**Text**: "Focus management must be logical during dialog flows"
**Status**: **Partial**
**Impact Score**: 3/5

**Question Candidate**: What specific focus management pattern should be followed? Should this conform to WAI-ARIA dialog patterns, and should focus trap be implemented for modal dialogs?

**Rationale**: "Logical" is subjective. Referencing an accessibility standard would provide concrete implementation guidance.

---

### 8. Ambiguous Reference: "certain thresholds" (Line 156)

**Location**: Edge Cases
**Text**: "...gracefully collapse panels below certain thresholds"
**Status**: **Missing**
**Impact Score**: 3/5

**Question Candidate**: What are the specific thresholds for panel collapse behavior? At what window width should: (a) preview auto-hide, (b) status bar elements stack or hide, (c) minimum viable layout be enforced?

**Rationale**: Related to the "usability threshold" ambiguity but specific to window resize behavior. Without concrete values, responsive behavior cannot be consistently implemented.

---

### 9. Implicit Decision: Error count click behavior (Lines 109, FR-031)

**Location**: User Story 5 / FR-031
**Text**: "Clicking the error count shows error details" / "error details are shown (or focus moves to first error in preview)"
**Status**: **Partial**
**Impact Score**: 2/5

**Question Candidate**: Should clicking the error count: (a) show a popup/tooltip with error list, (b) navigate to first error in preview, (c) navigate to first error line in editor, or (d) open a dedicated error panel? The current wording suggests options but doesn't make a decision.

**Rationale**: The parenthetical "(or focus moves to first error in preview)" suggests this is an unresolved design decision that should be finalized before implementation.

---

### 10. Ambiguous Adjective: "smooth" window operations (Line 259, SC-009)

**Location**: Success Criteria
**Text**: "Window operations (resize, divider drag) feel smooth with no perceptible lag (60fps target)"
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: This is actually well-defined with the "60fps target" quantification. No ambiguity.

---

## Summary Table

| # | Ambiguity | Status | Impact | Line(s) |
|---|-----------|--------|--------|---------|
| 1 | "reasonable period" timeout | Missing | 4/5 | 155 |
| 2 | "user-friendly error message" | Partial | 3/5 | 201 |
| 3 | "usability threshold" for panes | Missing | 4/5 | 169 |
| 4 | "standard hardware" baseline | Partial | 2/5 | 258 |
| 5 | "clear" feedback | Partial | 2/5 | 273 |
| 6 | "logical" focus management | Partial | 3/5 | 282 |
| 7 | "certain thresholds" for collapse | Missing | 3/5 | 156 |
| 8 | Error count click behavior | Partial | 2/5 | 109 |

---

## Recommended Priority for Clarification

**High Priority** (Impact 4-5):
1. "usability threshold" for panes (FR-003) - affects core layout implementation
2. "reasonable period" timeout - affects preview compilation behavior

**Medium Priority** (Impact 3):
3. "user-friendly error message" - affects error handling consistency
4. "logical" focus management - affects accessibility compliance
5. "certain thresholds" for collapse - affects responsive behavior

**Lower Priority** (Impact 1-2):
6. "standard hardware" baseline
7. "clear" feedback
8. Error count click behavior
