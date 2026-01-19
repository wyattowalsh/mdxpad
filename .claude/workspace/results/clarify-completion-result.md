# Completion Ambiguity Analysis: Bidirectional Preview Sync (008)

**Spec File**: `/Users/ww/dev/projects/mdxpad-sync/.specify/specs/008-bidirectional-sync/spec.md`
**Analysis Date**: 2026-01-17
**Focus Area**: Completion Signals (Acceptance Criteria Testability, Measurable Definition of Done)

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 8 |
| Partial | 6 |
| Missing | 3 |

---

## Ambiguity Findings

### 1. User Story 1 - Acceptance Scenario 2: Position Approximation

**Category**: Completion
**Status**: Partial
**Spec Text (Lines 51-52)**: "the preview shows the rendered output of **approximately** those same lines"
**Question Candidate**: What is the acceptable line deviation for position mapping accuracy? Should it be within 3 lines, 5 lines, or a percentage of visible viewport?
**Impact Score**: 4
**Rationale**: The word "approximately" is vague and not deterministically testable. Without a concrete tolerance, testers cannot write reliable assertions. Automated tests need a numeric threshold to pass/fail.

---

### 2. Success Criteria SC-004: Position Mapping Accuracy Measurement

**Category**: Completion
**Status**: Partial
**Spec Text (Line 216)**: "Position mapping accuracy achieves 90%+ for documents with AST source positions (rendered content within 5 lines of source)"
**Question Candidate**: How should the 90% position mapping accuracy be measured - per sync event, per document tested, or aggregated across a test suite? What sample size validates this metric?
**Impact Score**: 4
**Rationale**: The "within 5 lines" clarifies the tolerance, but "90%+" lacks measurement methodology. Is it 90% of individual sync events accurate, 90% of test documents pass, or 90% of mapped lines within tolerance? Without clear methodology, the success criterion cannot be objectively verified.

---

### 3. Success Criteria SC-003: Main Thread Performance Measurement

**Category**: Completion
**Status**: Partial
**Spec Text (Line 215)**: "Scroll synchronization adds less than 5ms to the main thread during scroll events"
**Question Candidate**: What test methodology should verify the 5ms main thread constraint? Should this be measured via Performance API, Chrome DevTools, or a specific testing framework? What constitutes the reference test environment (hardware, document size)?
**Impact Score**: 3
**Rationale**: Performance metrics without measurement methodology are not reliably testable. Different measurement approaches yield different results. CI environments may have different performance characteristics than developer machines.

---

### 4. Success Criteria SC-001 & SC-002: Subjective Qualifier

**Category**: Completion
**Status**: Partial
**Spec Text (Lines 213-214)**: "within SYNC_DEBOUNCE_MS + SCROLL_ANIMATION_MS (perceived as immediate)"
**Question Candidate**: Should acceptance tests verify only the objective timing (< 200ms total) or also include user perception testing? If perception-based, what testing methodology validates "perceived as immediate"?
**Impact Score**: 2
**Rationale**: The numeric values (50ms + 150ms = 200ms) provide concrete testable criteria, but the parenthetical "perceived as immediate" introduces subjectivity. The subjective qualifier could cause confusion in test acceptance reviews.

---

### 5. User Story 5 - Acceptance Scenario 4: Notification Specification

**Category**: Completion
**Status**: Missing
**Spec Text (Line 120)**: "a brief notification confirms the new state"
**Question Candidate**: What should the sync toggle notification contain (text format, message content), how long should it display (duration in ms), and where should it appear in the UI (toast, status bar, inline)?
**Impact Score**: 3
**Rationale**: "Brief notification" is undefined. Testers cannot verify correct notification behavior without knowing expected appearance, content, position, and duration. Multiple valid implementations could exist.

---

### 6. FR-052: Notification Requirements

**Category**: Completion
**Status**: Missing
**Spec Text (Line 193)**: "System MUST show a brief notification when sync is toggled via command or shortcut"
**Question Candidate**: Define "brief notification" - what is the minimum/maximum display duration in milliseconds? What exact text content should the notification contain for each sync state transition?
**Impact Score**: 3
**Rationale**: Same issue as User Story 5 - AS4. The requirement uses vague language ("brief") and lacks concrete specification. Cannot be verified without notification duration, content, and styling specification.

---

### 7. NFR Accessibility: Screen Reader Announcement

**Category**: Completion
**Status**: Missing
**Spec Text (Line 234)**: "Sync state must be announced to screen readers when changed"
**Question Candidate**: What exact text should be announced to screen readers when sync state changes? Should it announce the mode name (e.g., "Bidirectional sync enabled"), a descriptive message, or both? What ARIA live region politeness level?
**Impact Score**: 3
**Rationale**: Accessibility requirements need concrete implementation details for verification. Screen reader testing requires knowing the expected announcement text and ARIA attributes.

---

### 8. Edge Case: Simultaneous Scroll Precedence

**Category**: Completion
**Status**: Partial
**Spec Text (Line 127)**: "The most recently scrolled pane takes precedence; a 'scroll lock' prevents feedback loops for SYNC_DEBOUNCE_MS after a sync scroll"
**Question Candidate**: When both panes receive scroll events within SYNC_DEBOUNCE_MS of each other, which one takes precedence? Should the first event win, the last event win, or should both be ignored?
**Impact Score**: 3
**Rationale**: "Most recently" is ambiguous given the 50ms debounce window. If events arrive 10ms apart, determining "most recent" depends on whether we use arrival time, debounce trigger time, or event timestamp. This affects edge case test design and could lead to flaky tests.

---

### 9. NFR Performance: 60fps Scroll Smoothness

**Category**: Completion
**Status**: Partial
**Spec Text (Line 227)**: "Scroll event handlers must complete within 5ms to maintain 60fps scroll smoothness"
**Question Candidate**: What percentage of frames can drop below 60fps before the requirement is considered failed? How should frame rate be measured during scroll tests - average, P95, minimum sustained?
**Impact Score**: 2
**Rationale**: While the 5ms handler time provides a proxy metric (60fps = 16.67ms per frame), direct 60fps verification methodology is unclear. The 5ms target is testable, but "60fps scroll smoothness" as a direct metric lacks tolerance specification.

---

## Clear Criteria (No Issues)

The following completion criteria are clear and testable:

1. **FR-001 through FR-004** (Sync Mode Configuration): Four enumerated modes, explicit default, persistence via settings store, immediate application - all objectively verifiable via state inspection

2. **SC-005**: "persists correctly across 100% of app restarts" - binary pass/fail criterion, testable via restart-and-verify automation

3. **SC-006**: "No feedback loops occur during normal usage (sync does not trigger infinite scroll cycles)" - testable by monitoring scroll event counts and detecting oscillation patterns

4. **SC-007**: "maintains <16ms keystroke-to-render per Constitution Article V" - references existing specification with concrete threshold, measurable via Performance API

5. **User Story 3 - All Acceptance Scenarios**: Clear Given/When/Then format with specific mode values, immediate effect, and persistence verification

6. **User Story 4 - Acceptance Scenario 3**: Debounce behavior testable via scroll event counting during rapid input

7. **Performance Constants Table (Lines 28-34)**: All timing values are concrete and measurable:
   - `SYNC_DEBOUNCE_MS` = 50ms
   - `SCROLL_ANIMATION_MS` = 150ms
   - `POSITION_CACHE_TTL_MS` = 1000ms
   - `SYNC_THRESHOLD_LINES` = 3
   - `SCROLL_MARGIN_PERCENT` = 10

8. **Scroll Lock Algorithm (Lines 137-141)**: Steps 1-4 are implementation-specific but have clear verification criteria (lock state, timing windows, manual scroll break)

---

## Severity Summary

| Impact Score | Count |
|--------------|-------|
| 5 (Critical) | 0 |
| 4 (High) | 2 |
| 3 (Medium) | 5 |
| 2 (Low) | 2 |
| 1 (Clear) | 8 |

---

## High-Impact Questions (Impact >= 4)

1. **[Impact 4] Position Approximation Tolerance (US1-AS2)**: What is the acceptable line deviation for "approximately" in position mapping? Should acceptance tests verify the preview is within N lines of the editor's visible content?

2. **[Impact 4] 90% Accuracy Measurement Methodology (SC-004)**: How should the 90% position mapping accuracy be measured - per sync event, per test document, or aggregated across a test suite? What sample size and document corpus validates this metric?

---

## Recommended Clarification Questions (Priority Order)

1. **[Impact 4]** What concrete line tolerance defines "approximately those same lines" in US1-AS2? (e.g., within 5 lines, within 10% of viewport)

2. **[Impact 4]** How should the 90% position mapping accuracy success criterion be measured? Please specify:
   - Unit of measurement (per-event, per-document, aggregate)
   - Required sample size
   - Test document characteristics (size, content types)

3. **[Impact 3]** What should the sync toggle notification display? Please specify:
   - Text content for each state transition (enabled/disabled)
   - Display duration in milliseconds
   - UI location (toast, status bar, etc.)

4. **[Impact 3]** What exact text should be announced to screen readers when sync mode changes?

5. **[Impact 3]** When simultaneous scroll events occur in both panes within the debounce window, which pane takes precedence - first event or last event?

---

## Overall Assessment

The spec has **strong measurable outcomes** in the Performance Constants table with specific timing values (50ms debounce, 150ms animation, 1000ms cache TTL). The success criteria section provides concrete metrics for most performance targets.

**Strengths:**
- Explicit timing constants with named references throughout spec
- Detailed scroll lock algorithm with clear state machine behavior
- Given/When/Then acceptance scenarios for all user stories
- Edge cases enumerated with explicit handling rules
- FR requirements use testable MUST/MUST NOT language

**Gaps requiring clarification:**
1. **Position tolerance** - "Approximately" needs numeric definition
2. **Accuracy measurement** - 90% lacks methodology specification
3. **Notification specification** - "Brief" undefined, content unspecified
4. **Screen reader text** - Accessibility announcement content missing
5. **Simultaneous scroll precedence** - Race condition handling unclear

The spec is approximately **75-80% complete** from a testability standpoint. The numeric timing constants are excellent, but the measurement methodology gaps for accuracy metrics and the missing notification/accessibility specifications prevent complete Definition of Done verification. Addressing the 2 high-impact clarifications would bring it to production-ready quality.
