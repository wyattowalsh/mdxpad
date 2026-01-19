# Edge Cases Ambiguity Analysis

**Spec**: 008-bidirectional-sync
**Category**: Edge Cases & Failure Handling
**Analysis Date**: 2026-01-17
**Focus Areas**: Negative scenarios, Rate limiting/throttling, Conflict resolution (concurrent edits)

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 3 |
| Partial | 5 |
| Missing | 6 |

---

## Detailed Findings

### 1. Simultaneous Scroll Conflict Resolution

- **Category**: Edge Cases (Conflict Resolution)
- **Status**: Partial
- **Spec Reference**: Lines 127-128 - "The most recently scrolled pane takes precedence; a 'scroll lock' prevents feedback loops for SYNC_DEBOUNCE_MS after a sync scroll"
- **Question Candidate**: How is "most recently scrolled pane" determined when scroll events from both panes arrive within the same debounce window (50ms)? What if timestamps are identical or within 1-2ms of each other?
- **Impact Score**: 4
- **Rationale**: The spec mentions precedence but doesn't specify the exact conflict resolution mechanism when events are near-simultaneous. Race conditions could lead to unpredictable behavior.

---

### 2. Manual Scroll Detection During Lock

- **Category**: Edge Cases (Conflict Resolution)
- **Status**: Partial
- **Spec Reference**: Lines 140-141 - "If a manual (user-initiated) scroll occurs on the other pane during lock, break the lock early"
- **Question Candidate**: How is a "manual (user-initiated) scroll" distinguished from a programmatic scroll triggered by the sync system? What is the detection mechanism?
- **Impact Score**: 4
- **Rationale**: Distinguishing user-initiated vs programmatic scrolls is technically non-trivial. Without clear detection criteria, the lock-breaking logic may fire incorrectly.

---

### 3. Parse Error State - Sync Recovery

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Partial
- **Spec Reference**: Line 126 - "Editor sync is disabled; preview shows error state without attempting scroll sync"
- **Question Candidate**: When a parse error is resolved (document becomes valid again), should sync automatically re-enable? What triggers the transition from error state back to normal sync state?
- **Impact Score**: 3
- **Rationale**: Recovery behavior is unspecified. Users may be confused if sync doesn't automatically resume after fixing a syntax error.

---

### 4. AST Source Position Unavailability

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Partial
- **Spec Reference**: Lines 145-146 - "Primary: Use AST source position data... Fallback: Use proportional scroll ratio"
- **Question Candidate**: Under what conditions does AST source position data become unavailable (beyond frontmatter)? How should the system behave when AST data is partially available (some nodes have positions, others don't)?
- **Impact Score**: 3
- **Rationale**: The spec assumes AST data is generally available, but MDX compilation may fail to provide positions for certain constructs (JSX expressions, dynamic imports, etc.).

---

### 5. Scroll Lock vs Animation Duration Mismatch

- **Category**: Edge Cases (Rate Limiting)
- **Status**: Partial
- **Spec Reference**: Line 139 - "After SYNC_DEBOUNCE_MS, set scrollLock = false"
- **Question Candidate**: The scroll lock releases after 50ms (SYNC_DEBOUNCE_MS), but animation takes 150ms (SCROLL_ANIMATION_MS). Should the lock persist for the full animation duration to prevent interruption? What happens if the user scrolls during the 100ms gap between lock release and animation completion?
- **Impact Score**: 3
- **Rationale**: There's a 100ms window where the lock is released but animation is still in progress. This could cause jittery behavior if the user interacts during this window.

---

### 6. High-Velocity Scroll Throttling

- **Category**: Edge Cases (Rate Limiting/Throttling)
- **Status**: Missing
- **Question Candidate**: What happens when the user scrolls extremely rapidly (e.g., touchpad momentum scroll, scroll wheel spinning)? Is there a maximum rate of sync operations per second, or could sustained high-velocity scrolling overwhelm the system despite debouncing?
- **Impact Score**: 4
- **Rationale**: The spec defines debounce (50ms) but doesn't address sustained high-velocity scrolling scenarios that could flood the event queue. Debouncing alone may not prevent performance degradation during momentum scrolling.

---

### 7. Preview Iframe Navigation/Reload

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Missing
- **Question Candidate**: What happens to sync state if the preview iframe navigates away (e.g., user clicks an external link in preview) or reloads? Should sync be suspended, and how is it restored when the preview returns to the document?
- **Impact Score**: 3
- **Rationale**: The spec assumes the preview always shows the current document. Navigation/reload scenarios are not addressed and could leave sync in an inconsistent state.

---

### 8. Position Cache Corruption Recovery

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Missing
- **Question Candidate**: What happens if cached position mappings become stale or incorrect (e.g., due to a bug, race condition, or document edit during cache lookup)? Is there a mechanism to detect and recover from cache corruption beyond TTL expiration?
- **Impact Score**: 3
- **Rationale**: Cache invalidation is mentioned (FR-041, FR-042) but error recovery from bad cache state is not specified. Corrupt cache could cause sync to target wrong positions.

---

### 9. Panel Resize During Sync

- **Category**: Edge Cases (Conflict Resolution)
- **Status**: Missing
- **Question Candidate**: What happens to sync and position mappings during or immediately after a panel resize? Should sync recalculate positions, pause during resize, or use a grace period? What if proportional mapping becomes inaccurate due to changed viewport ratios?
- **Impact Score**: 3
- **Rationale**: Panel resizing changes viewport dimensions and may invalidate position mappings. No handling is specified.

---

### 10. Remote Content Layout Reflow

- **Category**: Edge Cases (Negative Scenario)
- **Status**: Missing
- **Question Candidate**: If the preview loads remote content (images, embeds, iframes) that affects layout after initial render, how does sync handle the resulting reflow? Should sync defer until preview layout stabilizes, or use a stabilization timeout?
- **Impact Score**: 2
- **Rationale**: Remote content loading causes layout shifts that could invalidate position mappings. This is common with MDX documents containing images or embeds.

---

### 11. Position Cache Memory Limits

- **Category**: Edge Cases (Rate Limiting/Throttling)
- **Status**: Missing
- **Question Candidate**: Is there a maximum size for the position cache? What happens with very large documents (approaching the 10,000 line assumption) - could the cache consume excessive memory? Should there be an eviction policy beyond TTL?
- **Impact Score**: 2
- **Rationale**: The spec mentions position caching with TTL but doesn't address memory limits or eviction policies for large documents.

---

### 12. Empty Document State

- **Category**: Edge Cases
- **Status**: Clear
- **Spec Reference**: Line 126 - "the document has no preview content (empty or parse error)? -> Editor sync is disabled"
- **Analysis**: This case is adequately addressed.

---

### 13. Short Document (Fits Both Viewports)

- **Category**: Edge Cases
- **Status**: Clear
- **Spec Reference**: Line 130 - "the document is very short and fits in both viewports? -> Sync is effectively no-op"
- **Analysis**: This case is adequately addressed.

---

### 14. Scroll Boundary Limits

- **Category**: Edge Cases
- **Status**: Clear
- **Spec Reference**: Line 131 - "one pane is scrolled to the very top or bottom? -> Sync respects boundaries; does not attempt to scroll past document limits"
- **Analysis**: This case is adequately addressed.

---

## Impact Summary

| Score | Count | Topics |
|-------|-------|--------|
| 4 (High) | 3 | Simultaneous scroll conflict, manual scroll detection, high-velocity throttling |
| 3 (Medium) | 6 | Parse error recovery, AST unavailability, lock/animation mismatch, iframe navigation, cache corruption, panel resize |
| 2 (Low) | 2 | Remote content reflow, cache memory limits |

---

## Prioritized Questions for Clarification

### High Priority (Impact 4)

1. **Simultaneous Scroll Resolution**: How is "most recently scrolled pane" determined when scroll events arrive within the same debounce window (50ms)? Define the tie-breaking mechanism for near-simultaneous events.

2. **Manual Scroll Detection**: How is user-initiated scroll distinguished from programmatic sync scroll? Define detection criteria (e.g., `event.isTrusted`, scroll source tracking, or flag-based approach).

3. **High-Velocity Scroll Throttling**: Should there be a maximum sync rate beyond debouncing to prevent system overload during sustained momentum scrolling? Define throttling strategy.

### Medium Priority (Impact 3)

4. **Parse Error Recovery**: When a parse error is resolved, should sync automatically re-enable? Define the recovery trigger and timing.

5. **Scroll Lock vs Animation Duration**: Should scroll lock persist for the full animation duration (150ms) rather than just debounce window (50ms)? Define handling for user interaction during the gap.

6. **Partial AST Data**: How should sync behave when AST source positions are only partially available (some nodes have positions, others don't)?

7. **Preview Navigation/Reload**: What happens to sync state if the preview iframe navigates away or reloads? Define suspension and restoration behavior.

8. **Position Cache Recovery**: How does the system detect and recover from stale/corrupt cache state beyond TTL expiration?

9. **Panel Resize Handling**: Should sync pause, recalculate, or use a grace period during/after panel resize?

### Lower Priority (Impact 2)

10. **Remote Content Reflow**: Should sync defer until preview layout stabilizes after remote content loads?

11. **Position Cache Memory Limits**: Should there be a maximum cache size with eviction policy for large documents?

---

## Recommendations

1. **Add explicit conflict resolution rules** for simultaneous scroll events with defined tie-breaking mechanism (e.g., prefer editor, use timestamp with epsilon threshold)

2. **Extend scroll lock duration** to match or exceed animation duration (150ms) to prevent mid-animation interruption

3. **Define rate limiting strategy** for sustained high-velocity scroll scenarios (e.g., maximum 10 syncs/second)

4. **Document recovery behaviors** for error states, iframe navigation, and cache corruption

5. **Address viewport change scenarios** (resize, zoom changes affecting layout) with explicit invalidation and recalculation strategy

6. **Specify manual scroll detection mechanism** - recommend using flag-based tracking where sync scrolls set a flag that is checked/cleared by scroll event handlers
