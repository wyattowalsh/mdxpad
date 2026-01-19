# Clarification Analysis: Misc / Placeholders

**Spec**: `/Users/ww/dev/projects/mdxpad-sync/.specify/specs/008-bidirectional-sync/spec.md`
**Feature**: Bidirectional Preview Sync
**Category**: Misc / Placeholders
**Focus Areas**: TODO markers, unresolved decisions, ambiguous adjectives lacking quantification
**Analyzed**: 2026-01-17

---

## Summary

The specification is well-structured with explicit performance constants and measurable success criteria. Analysis focused on TODO markers, unresolved decisions, and ambiguous adjectives lacking quantification.

| Status | Count |
|--------|-------|
| Clear | 5 |
| Partial | 4 |
| Missing | 1 |

---

## Findings

### 1. TODO Markers / Unresolved Decisions

**Status**: Clear
**Impact Score**: 0/5

**Finding**: No explicit TODO markers, FIXME, TBD, or unresolved decision annotations found in the spec. All sections appear complete.

---

### 2. Quantified Adjective: "Smooth scroll" (Lines 19, 52-53, 69)

**Location**: Executive Summary, User Stories 1 & 2
**Text**: "Smooth scrolling - Synchronized scrolls animate smoothly without jarring jumps"
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: The adjective "smooth" is properly quantified via SCROLL_ANIMATION_MS = 150ms in the Performance Constants table. No ambiguity.

---

### 3. Quantified Adjective: "instant sync" / "perceived as immediate" (Lines 213-214)

**Location**: Success Criteria SC-001, SC-002
**Text**: "perceived as immediate"
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: Properly quantified as SYNC_DEBOUNCE_MS + SCROLL_ANIMATION_MS = 200ms total. Clear definition of what constitutes "immediate" from user perception standpoint.

---

### 4. Ambiguous Adjective: "brief notification" (Lines 120, 193)

**Location**: User Story 5 Acceptance Scenario 4, FR-052
**Text**: "a brief notification confirms the new state" / "show a brief notification"
**Status**: **Partial**
**Impact Score**: 2/5

**Question Candidate**: What is the exact duration (in milliseconds) for the sync toggle notification, and what notification style should be used (toast, snackbar, status bar message)?

**Rationale**: "Brief" is not quantified. Unlike other timing values in this spec, notification duration is unspecified. Implementation could proceed with a reasonable default (e.g., 2000ms toast) but should be explicitly defined for consistency with other app notifications.

---

### 5. Ambiguous Phrase: "approximately those same lines" (Line 51)

**Location**: User Story 1, Acceptance Scenario 2
**Text**: "the preview shows the rendered output of approximately those same lines"
**Status**: **Partial**
**Impact Score**: 2/5

**Question Candidate**: Should acceptance scenario 2 be updated to reference the concrete tolerance defined in SC-004 (within 5 lines), or is there a different tolerance expected for this specific scenario?

**Rationale**: "Approximately" is vague for testing purposes. SC-004 quantifies accuracy as "within 5 lines" for 90%+ cases, but the acceptance scenario language itself is imprecise. The disconnect between acceptance scenario language and success criteria could cause test ambiguity.

---

### 6. Ambiguous Phrase: "reasonable document sizes" (Line 251)

**Location**: Assumptions, item 5
**Text**: "Reasonable document sizes: Documents are typically under 10,000 lines; extreme documents may have degraded sync accuracy."
**Status**: **Partial**
**Impact Score**: 3/5

**Question Candidate**: For documents exceeding 10,000 lines, what is the expected degradation behavior? Should sync accuracy targets be relaxed (e.g., from 5 lines to 10 lines tolerance), should sync be disabled with a user warning, or should sync continue with best-effort accuracy?

**Rationale**: While 10,000 lines is quantified as the threshold, "degraded sync accuracy" is undefined. Without clear degradation behavior specification, implementation may vary and user experience for large documents becomes unpredictable.

---

### 7. Ambiguous Phrase: "most recently scrolled pane takes precedence" (Line 127)

**Location**: Edge Cases
**Text**: "The most recently scrolled pane takes precedence"
**Status**: **Partial**
**Impact Score**: 3/5

**Question Candidate**: When scroll events occur in both panes within SYNC_DEBOUNCE_MS of each other, what is the tie-breaking mechanism? Should the first event win (oldest timestamp), the last event win (newest timestamp), or should both syncs be suppressed until only one pane is actively scrolling?

**Rationale**: How is "most recently scrolled" determined when both panes receive scroll events within the same debounce window (50ms)? The scroll lock algorithm (lines 134-141) helps prevent feedback loops but doesn't fully address simultaneous scroll detection. Simultaneous scroll scenarios (e.g., multi-touch trackpad gestures) could cause unpredictable behavior if tie-breaking isn't explicit.

---

### 8. Missing Definition: "last non-disabled mode" (Line 119)

**Location**: User Story 5, Acceptance Scenario 3
**Text**: "sync is enabled (to the last non-disabled mode)"
**Status**: **Missing**
**Impact Score**: 4/5

**Question Candidate**: Should the system persist a separate "last non-disabled mode" preference to restore when toggling sync back on, or should toggling sync on always default to "bidirectional" mode?

**Rationale**: There is no requirement or state definition for persisting the "last non-disabled mode." FR-003 only mentions persisting the sync mode preference, not a separate "last active mode" for toggle restoration. This affects implementation architecture (additional state to persist) and user expectation (will their preferred one-way mode be restored after toggling back on?).

---

### 9. Quantified Performance Budgets

**Location**: Performance Constants (Lines 28-34), Success Criteria (Lines 213-219), Non-Functional Requirements (Lines 227-229)
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: All performance metrics are explicitly quantified:
- SYNC_DEBOUNCE_MS: 50ms
- SCROLL_ANIMATION_MS: 150ms
- POSITION_CACHE_TTL_MS: 1000ms
- SYNC_THRESHOLD_LINES: 3 lines
- SCROLL_MARGIN_PERCENT: 10%
- Scroll handler budget: 5ms
- Position cache lookup: O(1)
- Typing latency: <16ms

---

### 10. Quantified Accuracy Metrics

**Location**: Success Criteria SC-004 (Line 216)
**Text**: "Position mapping accuracy achieves 90%+ for documents with AST source positions (rendered content within 5 lines of source)"
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: Accuracy is properly quantified with both a percentage (90%+) and a tolerance (5 lines). Clear and testable.

---

## Summary Table

| # | Item | Status | Impact | Line(s) |
|---|------|--------|--------|---------|
| 1 | No TODO markers | Clear | 0/5 | - |
| 2 | "Smooth scroll" | Clear | 1/5 | 19, 52-53, 69 |
| 3 | "Immediate" perception | Clear | 1/5 | 213-214 |
| 4 | "Brief notification" | Partial | 2/5 | 120, 193 |
| 5 | "Approximately those same lines" | Partial | 2/5 | 51 |
| 6 | "Reasonable document sizes" / "degraded accuracy" | Partial | 3/5 | 251 |
| 7 | "Most recently scrolled" tie-breaking | Partial | 3/5 | 127 |
| 8 | "Last non-disabled mode" state | Missing | 4/5 | 119 |
| 9 | Performance budgets | Clear | 1/5 | 28-34, 213-219, 227-229 |
| 10 | Accuracy metrics | Clear | 1/5 | 216 |

---

## Recommended Priority for Clarification

**High Priority** (Impact 4-5):
1. **"Last non-disabled mode" persistence** - Should the system persist a separate "last non-disabled mode" preference for toggle restoration, or default to "bidirectional" when re-enabling sync?

**Medium Priority** (Impact 3):
2. **Large document degradation behavior** - What is the expected degradation behavior for documents exceeding 10,000 lines?
3. **Simultaneous scroll tie-breaking** - What is the tie-breaking mechanism when both panes receive scroll events within the debounce window?

**Lower Priority** (Impact 2):
4. **Brief notification quantification** - Specify notification duration and style for sync toggle feedback
5. **"Approximately" clarification** - Align acceptance scenario language with SC-004 tolerance definition

---

## Recommended Clarification Questions (Sorted by Impact)

1. **[Impact 4]** Should the system persist a separate "last non-disabled mode" preference to restore when toggling sync back on via command/shortcut, or should toggling sync on always default to "bidirectional" mode?

2. **[Impact 3]** For documents exceeding 10,000 lines, what is the expected degradation behavior? Options: (a) relax accuracy targets, (b) show user warning but continue sync, (c) automatically disable sync, (d) best-effort with no special handling.

3. **[Impact 3]** When scroll events occur in both panes within the 50ms debounce window (simultaneous scrolling), what is the tie-breaking mechanism: first event wins, last event wins, or suppress both syncs?

4. **[Impact 2]** What is the exact duration for the sync toggle notification (FR-052), and what notification style should be used (toast, snackbar, status bar)?

5. **[Impact 2]** Should User Story 1, Acceptance Scenario 2 be updated to reference the "within 5 lines" tolerance defined in SC-004 instead of using "approximately"?
