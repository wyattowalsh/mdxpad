# Data Model Ambiguity Analysis

**Spec**: 008-bidirectional-sync
**Category**: Data Model
**Analyzed**: 2026-01-17

---

## Summary

The spec defines 4 key entities (SyncMode, ScrollPosition, PositionMapping, SyncState) in the "Key Entities" section (lines 197-206). The data model is relatively straightforward but has several ambiguities around identity rules, lifecycle management, and scale assumptions.

---

## Ambiguity Findings

### 1. PositionMapping Cardinality & Uniqueness

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | PositionMapping identity/relationships |
| **Question Candidate** | For PositionMapping, what is the cardinality between editor lines and preview positions? Can multiple editor lines map to the same preview scroll position? Can a single editor line map to multiple preview positions? What uniqueness constraints should be enforced on the position cache? |
| **Impact Score** | 4 |
| **Rationale** | The position mapping strategy is core to sync functionality. PositionMapping defines `editorLine` and `previewScrollTop` but doesn't clarify if mappings are 1:1, 1:many, or many:many. This affects cache key design and sync behavior for content like multi-line code blocks that render as single elements, or single lines that expand into multiple rendered elements. |

---

### 2. PositionMapping DOM Element Reference Lifecycle

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | PositionMapping.element lifecycle |
| **Question Candidate** | When should DOM element references in PositionMapping be invalidated? Should they be WeakRefs to allow garbage collection? How should the system handle stale element references that no longer exist in the DOM after preview re-renders? |
| **Impact Score** | 3 |
| **Rationale** | PositionMapping includes `element (DOM element reference if available)`. DOM references become stale when preview re-renders or document is edited. FR-041 mentions cache invalidation on "document content changes" but doesn't specify DOM reference handling. Stale references could cause runtime errors or incorrect scroll positions. |

---

### 3. Position Cache Structure & Capacity

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | SyncState.positionCache capacity and structure |
| **Question Candidate** | What is the maximum number of entries the position cache should hold? For a 10,000-line document, should all line mappings be cached? What eviction policy should apply when the cache reaches capacity (beyond TTL expiration)? What is the Map key - editor line number, composite key, or something else? |
| **Impact Score** | 3 |
| **Rationale** | SyncState defines `positionCache (Map of PositionMapping)` but doesn't specify: Map key structure, maximum cache size, or eviction policy beyond TTL. The assumptions mention "Documents are typically under 10,000 lines" but this doesn't translate to cache bounds. Without limits, memory usage could grow unbounded. |

---

### 4. SyncState Lifecycle Across Document Switches

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | SyncState per-document vs global scope |
| **Question Candidate** | When the user switches from Document A to Document B, should the SyncState (including position cache and lock state) be preserved for Document A and restored when returning? Or should SyncState be reset for each document switch? Is SyncState per-document or application-global? |
| **Impact Score** | 4 |
| **Rationale** | Assumption #4 states "Sync operates on the currently active document only" but doesn't clarify state management during document switching. SyncState includes `positionCache` which is document-specific, but also `mode` which appears to be a global preference. The lifecycle is ambiguous. |

---

### 5. ScrollPosition Timestamp Semantics

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | ScrollPosition.timestamp purpose and format |
| **Question Candidate** | What is the purpose of the timestamp in ScrollPosition? Is it used for ordering events, calculating staleness, debugging, or something else? Should it be a high-resolution timestamp (performance.now()) or standard Date.now()? |
| **Impact Score** | 2 |
| **Rationale** | ScrollPosition includes `timestamp` but the spec doesn't clarify its use beyond implicit staleness (TTL and debounce use constant durations, not timestamp comparisons). The timestamp type and precision aren't specified. |

---

### 6. Confidence Level Definitions & Usage

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | PositionMapping.confidence criteria and behavior |
| **Question Candidate** | What criteria determine whether a PositionMapping has 'high', 'medium', or 'low' confidence? How should sync behavior differ based on confidence level? For example: AST source positions = high, DOM line mapping = medium, proportional ratio = low? |
| **Impact Score** | 3 |
| **Rationale** | PositionMapping has `confidence ('high' | 'medium' | 'low')` but the spec doesn't define threshold criteria or how confidence affects sync behavior. The Position Mapping Strategy (lines 143-146) mentions primary/secondary/fallback sources but doesn't map these to confidence levels explicitly. Without defined semantics, confidence values may be ignored or used inconsistently. |

---

### 7. SyncMode Persistence Format

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | SyncMode storage representation |
| **Question Candidate** | What storage key should be used for sync mode persistence? Should the value be stored as the string enum value (e.g., 'bidirectional') or an integer? How should the system handle unrecognized persisted values from potential future version changes or corruption? |
| **Impact Score** | 2 |
| **Rationale** | FR-003 states "System MUST persist sync mode preference across sessions using the existing settings store" but doesn't specify key name, data format, or migration/validation strategy. Minor issue but affects interoperability and forward compatibility. |

---

### 8. Large Document Scale Behavior

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | Scale assumptions and degradation |
| **Question Candidate** | For documents exceeding 10,000 lines, what specific degradation is acceptable? Should the position mapping strategy change at scale (e.g., sample every Nth line instead of mapping all lines)? What is the upper bound before sync should be disabled entirely? |
| **Impact Score** | 2 |
| **Rationale** | Assumptions state "Documents are typically under 10,000 lines; extreme documents may have degraded sync accuracy." This doesn't quantify "degraded" or specify whether data model changes occur at scale. Users with very large documents need predictable behavior. |

---

### 9. ScrollPosition Pane Value Constraints

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Clear |
| **Element** | ScrollPosition.pane enum values |
| **Question Candidate** | N/A - Clear |
| **Impact Score** | N/A |
| **Rationale** | ScrollPosition clearly defines `pane ('editor' | 'preview')` which aligns with the two-pane architecture. |

---

### 10. SyncState Lock State Transitions

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Clear |
| **Element** | isLocked and lockSource state machine |
| **Question Candidate** | N/A - Clear |
| **Impact Score** | N/A |
| **Rationale** | The Scroll Lock Algorithm (lines 135-141) clearly defines state transitions: set lock on sync initiation, ignore events from lockSource, clear after debounce, break early on manual scroll. This is well-specified. |

---

## Summary Statistics

| Status | Count |
|--------|-------|
| Clear | 2 |
| Partial | 6 |
| Missing | 1 |
| **Total Ambiguities** | **8** |

| Impact Score | Count |
|--------------|-------|
| 5 (Critical) | 0 |
| 4 (High) | 2 |
| 3 (Medium) | 3 |
| 2 (Low) | 3 |

---

## Recommended Clarification Priority

1. **PositionMapping Cardinality & Uniqueness** (Impact: 4) - Core sync algorithm correctness
2. **SyncState Lifecycle Across Document Switches** (Impact: 4) - User experience continuity
3. **Position Cache Structure & Capacity** (Impact: 3) - Memory management
4. **Confidence Level Definitions & Usage** (Impact: 3) - Mapping strategy implementation
5. **PositionMapping DOM Element Reference Lifecycle** (Impact: 3) - Runtime stability
6. **ScrollPosition Timestamp Semantics** (Impact: 2) - Implementation detail
7. **SyncMode Persistence Format** (Impact: 2) - Settings compatibility
8. **Large Document Scale Behavior** (Impact: 2) - Edge case handling

---

## Clear Aspects

The following data model aspects are sufficiently clear:

- **SyncMode enum values**: Explicitly defined as 4 options ('disabled' | 'editorToPreview' | 'previewToEditor' | 'bidirectional')
- **ScrollPosition.pane values**: Explicitly defined as ('editor' | 'preview')
- **SyncState.lockSource values**: Explicitly defined as ('editor' | 'preview' | null)
- **Scroll lock state transitions**: Well-documented algorithm with clear conditions
- **Cache TTL**: Explicitly defined as POSITION_CACHE_TTL_MS = 1000ms
- **Cache invalidation trigger**: Document content changes (FR-041)
- **Default sync mode**: Explicitly "bidirectional" for new installations (FR-002)
