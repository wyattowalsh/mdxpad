# Non-Functional Requirements Ambiguity Analysis

**Spec**: `specs/008-bidirectional-sync/spec.md`
**Category**: Non-Functional Quality Attributes
**Analyzed**: 2026-01-17

---

## Summary

| Quality Attribute | Status | Issues Found |
|-------------------|--------|--------------|
| Performance | Partial | 2 issues |
| Scalability | Partial/Missing | 3 issues |
| Reliability & Availability | Missing | 2 issues |
| Observability | Missing | 2 issues |
| Security & Privacy | Missing | 1 issue |
| Compliance / Regulatory | Partial | 1 issue |

**Total Ambiguities Identified**: 11

**Note**: The spec provides good quantitative performance constants (lines 24-35) and success criteria (lines 209-219), but has significant gaps in scalability limits, error recovery, and observability. The Non-Functional Requirements section (lines 223-242) is concise but incomplete.

---

## Detailed Analysis

### 1. Performance (Latency, Throughput Targets)

#### 1.1 Main Thread Blocking Threshold Unquantified
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: NFR Performance (line 229)
- **Issue**: The spec states "Sync calculations must not block the main thread during active scrolling" but does not define what constitutes "blocking." The 5ms handler limit (line 227) addresses event handlers but not the calculation phase itself.
- **Question Candidate**: What is the maximum acceptable duration for sync position calculations before they should be offloaded to a web worker or deferred? Should there be a specific threshold (e.g., 2ms) that triggers async execution?
- **Impact Score**: 2

#### 1.2 Animation Frame Budget Not Addressed
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: NFR Performance (lines 227-229)
- **Issue**: The spec ensures handlers complete in 5ms but doesn't address whether sync operations should use `requestAnimationFrame` for scroll updates to avoid layout thrashing.
- **Question Candidate**: Should sync scroll operations be scheduled via `requestAnimationFrame` to align with browser paint cycles and prevent layout thrashing during rapid scrolling?
- **Impact Score**: 2

---

### 2. Scalability (Horizontal/Vertical, Limits)

#### 2.1 Document Size Degradation Undefined
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: Assumptions (line 251)
- **Issue**: The spec states documents are "typically under 10,000 lines" with "degraded sync accuracy" for larger documents but does not quantify the degradation or specify when sync should be disabled.
- **Question Candidate**: At what document size (lines/characters) should sync accuracy degrade, and what does degradation mean quantitatively (e.g., 80% accuracy? 50%)? Should sync be disabled entirely beyond a certain threshold with user notification?
- **Impact Score**: 4

#### 2.2 Position Cache Size Unbounded
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: FR-040 to FR-042 (lines 185-188)
- **Issue**: The position cache has a TTL (1000ms) but no maximum entry count or memory budget. During active scrolling on large documents, cache could grow significantly before TTL expiration.
- **Question Candidate**: What is the maximum number of position cache entries or memory budget for the cache? Should an LRU eviction policy be implemented in addition to TTL?
- **Impact Score**: 3

#### 2.3 Concurrent Sync Operations Not Limited
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No specification for handling concurrent sync calculations. Rapid bi-directional scrolling could queue multiple sync operations.
- **Question Candidate**: Should there be a limit on queued sync operations? If a new sync is requested while one is in progress, should the pending operation be cancelled (debounce/throttle pattern)?
- **Impact Score**: 2

---

### 3. Reliability & Availability (Uptime, Recovery)

#### 3.1 Sync Error Recovery Strategy Missing
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No specification for how sync recovers from errors during position calculation (e.g., DOM element not found, stale AST reference) or scroll execution failures.
- **Question Candidate**: How should sync recover from calculation or scroll execution errors? Options: (a) silently skip and retry on next scroll event, (b) temporarily disable sync with auto-recovery after N seconds, (c) fall back to proportional mode, (d) notify user of sync degradation?
- **Impact Score**: 3

#### 3.2 Sync Failure Isolation Not Guaranteed
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No explicit requirement that sync failures should be isolated from core editor/preview functionality. A sync bug should never affect the user's ability to type or manually scroll.
- **Question Candidate**: Should sync be explicitly isolated via error boundary or try-catch to ensure sync failures never degrade core editing functionality? Is sync considered a "best-effort" feature that should fail silently?
- **Impact Score**: 4

---

### 4. Observability (Logging, Metrics, Tracing)

#### 4.1 No Performance Metrics Specified
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No metrics are specified for monitoring sync performance in development or production. Metrics like sync latency p50/p95, cache hit rate, and mapping accuracy would help diagnose user-reported issues.
- **Question Candidate**: Should sync emit performance metrics (e.g., sync latency, cache hit rate, position mapping accuracy)? If so, what is the collection and reporting strategy for a local desktop app?
- **Impact Score**: 2

#### 4.2 No Debug Logging Strategy
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No logging requirements exist for debugging sync issues. Users reporting "sync doesn't work" would be difficult to diagnose.
- **Question Candidate**: Should sync operations be logged at debug level for troubleshooting (e.g., log sync triggers, mapping sources used, scroll targets, lock state transitions)?
- **Impact Score**: 2

---

### 5. Security & Privacy (AuthN/Z, Data Protection)

#### 5.1 Malicious Content Threat Model Missing
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: MDX allows arbitrary JSX components. Malicious content could potentially manipulate scroll positions or DOM structure to interfere with sync (e.g., cause infinite loops, unexpected scrolling).
- **Question Candidate**: Could malicious MDX content (components that manipulate scroll position or DOM) interfere with sync functionality? Should sync validate or sanitize scroll targets to prevent unexpected behavior from untrusted documents?
- **Impact Score**: 2

---

### 6. Compliance / Regulatory Constraints

#### 6.1 WCAG Compliance Level Not Specified
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: NFR Accessibility (lines 233-236)
- **Issue**: The spec includes good accessibility provisions (keyboard shortcut, screen reader announcements, reduced motion support) but doesn't specify a target WCAG compliance level.
- **Question Candidate**: What WCAG compliance level is targeted for sync features (A, AA, or AAA)? Should specific WCAG success criteria be referenced (e.g., 2.1 AA)?
- **Impact Score**: 2

---

## Prioritized Question Candidates

Sorted by impact score (highest first):

| # | Impact | Quality Attribute | Question |
|---|--------|-------------------|----------|
| 1 | 4 | Scalability | At what document size should sync degrade or be disabled, and how should users be notified? |
| 2 | 4 | Reliability | Should sync be explicitly isolated to ensure failures never affect core editing functionality? |
| 3 | 3 | Scalability | What are the memory bounds for the position cache (max entries or memory budget)? |
| 4 | 3 | Reliability | What is the error recovery strategy when sync calculations or scroll execution fails? |
| 5 | 2 | Performance | Should sync scroll operations use requestAnimationFrame to prevent layout thrashing? |
| 6 | 2 | Performance | What is the max duration for sync calculations before offloading to async/worker? |
| 7 | 2 | Scalability | Should concurrent sync operations be limited or debounced when rapidly bi-directional scrolling? |
| 8 | 2 | Observability | Should sync emit performance metrics (latency, cache hit rate, mapping accuracy)? |
| 9 | 2 | Observability | Should sync operations be debug-logged for troubleshooting user-reported issues? |
| 10 | 2 | Security | Should sync validate scroll targets to prevent interference from malicious MDX content? |
| 11 | 2 | Compliance | What WCAG compliance level is targeted for sync features? |

---

## Recommendations

### Critical (Impact 4)
1. **Error Isolation**: Explicitly require that sync failures be isolated and never affect core editor/preview functionality. Sync is a convenience feature; its bugs should never degrade the writing experience.

2. **Document Size Limits**: Define quantitative thresholds for document size:
   - Documents up to 10,000 lines: Full sync accuracy
   - Documents 10,000-50,000 lines: Degraded accuracy (define percentage), notify user
   - Documents beyond 50,000 lines: Sync disabled with user notification

### High Priority (Impact 3)
3. **Position Cache Bounds**: Add a maximum cache size (e.g., 1000 entries) with LRU eviction to complement the TTL mechanism.

4. **Error Recovery**: Specify that sync should fail silently and retry on next scroll event, falling back to proportional mode if AST mapping fails repeatedly.

### Medium Priority (Impact 2)
5. **WCAG Compliance**: Specify target WCAG 2.1 AA compliance for accessibility features.

6. **Observability**: Add basic debug logging requirements for sync operations to aid troubleshooting.

7. **requestAnimationFrame**: Recommend (not require) using rAF for scroll animations to align with browser paint cycles.

### Low Priority (Impact 1)
- Security concerns are minimal for a local desktop app processing user-authored content. The malicious content question can be documented as an accepted risk.

---

## Notes

- The spec is well-structured with clear performance constants (lines 24-35) that are referenced throughout
- The Success Criteria section (lines 209-219) provides good quantitative targets that partially compensate for NFR gaps
- The Scroll Lock Algorithm (lines 134-141) and Position Mapping Strategy (lines 143-147) are well-documented
- The existing NFR Accessibility section (lines 233-236) demonstrates good awareness of accessibility concerns
- Security is less critical here than for cloud services since this is a local desktop app processing user files
