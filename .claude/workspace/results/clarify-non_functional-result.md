# Non-Functional Requirements Ambiguity Analysis

**Spec**: Smart Filtering for File Tree (014-smart-filtering)
**Analysis Date**: 2026-01-17
**Category**: Non-Functional Quality Attributes

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 2 |
| Partial | 5 |
| Missing | 6 |

---

## Performance

### 1. Filter Response Latency
- **Category**: non_functional
- **Status**: Partial
- **Current Spec Reference**: SC-002 states "Filter results update within 100ms of keystroke for projects with up to 10,000 files"
- **Question Candidate**: What is the acceptable latency for projects with 10,000-100,000 files? Should filtering degrade gracefully (e.g., debounce) or maintain strict 100ms even with larger datasets?
- **Impact Score**: 4
- **Rationale**: Large monorepo projects can easily exceed 10,000 files. Without defined behavior for larger projects, implementation choices may lead to UI freezes or inconsistent UX.

### 2. Memory Consumption
- **Category**: non_functional
- **Status**: Missing
- **Question Candidate**: What is the maximum acceptable memory overhead for the filter index/cache? Should the fuzzy matching index be built eagerly at startup or lazily on first filter activation?
- **Impact Score**: 3
- **Rationale**: Fuzzy matching often requires pre-computed indexes. Memory constraints affect mobile/low-resource environments and overall app performance.

### 3. Throughput / Keystroke Handling
- **Category**: non_functional
- **Status**: Partial
- **Current Spec Reference**: FR-010 mentions "without noticeable delay as the user types"
- **Question Candidate**: Should keystrokes be debounced (e.g., 50-150ms) or should every keystroke trigger immediate filtering? What happens during rapid typing (10+ keystrokes/second)?
- **Impact Score**: 3
- **Rationale**: Debounce strategy directly impacts perceived responsiveness vs. CPU usage trade-off. Fast typists may flood the system.

---

## Scalability

### 4. File Count Limits
- **Category**: non_functional
- **Status**: Partial
- **Current Spec Reference**: SC-002 mentions "up to 10,000 files"
- **Question Candidate**: What is the hard upper limit before the feature should warn users or degrade? Should there be a configurable threshold where filtering switches to server-side or background worker?
- **Impact Score**: 4
- **Rationale**: Enterprise/monorepo users may have 50,000+ files. Without clear limits, the feature may become a liability rather than an asset.

### 5. Folder Depth Limits
- **Category**: non_functional
- **Status**: Partial
- **Current Spec Reference**: Edge case mentions "very deep nested folder structures" with behavior note "(Parent folders of matching items remain visible)"
- **Question Candidate**: Is there a maximum folder depth (e.g., 50 levels) that the filter should support? How should performance degrade with extreme nesting?
- **Impact Score**: 2
- **Rationale**: Deep nesting affects rendering performance and match result display. Extreme cases (100+ levels) could cause stack overflows or UI issues.

---

## Reliability & Availability

### 6. Filter Persistence Failure Handling
- **Category**: non_functional
- **Status**: Missing
- **Question Candidate**: What happens if localStorage is full, corrupted, or unavailable (e.g., private browsing)? Should the filter gracefully degrade to non-persistent mode with a warning?
- **Impact Score**: 3
- **Rationale**: Session persistence (FR-007) is a requirement. Failure to persist should not block core filtering functionality.

### 7. File System Change Race Conditions
- **Category**: non_functional
- **Status**: Missing
- **Question Candidate**: If a file is renamed/deleted while the user is viewing filtered results and clicks on the match, what error handling is expected? Should there be retry logic or graceful error messaging?
- **Impact Score**: 3
- **Rationale**: FR-009 requires automatic updates but doesn't address race conditions between filter display and underlying file system state.

---

## Observability

### 8. Logging Strategy
- **Category**: non_functional
- **Status**: Missing
- **Question Candidate**: Should filter operations (queries, results count, latency) be logged for debugging or telemetry? If so, at what verbosity level and where (console, file, telemetry service)?
- **Impact Score**: 2
- **Rationale**: Debugging filter performance issues in production requires some observability. Privacy implications of logging user queries must be considered.

### 9. Metrics / Performance Monitoring
- **Category**: non_functional
- **Status**: Missing
- **Question Candidate**: Should the application track filter performance metrics (p50/p95 latency, query frequency, match rate) internally or externally? What triggers performance degradation alerts?
- **Impact Score**: 2
- **Rationale**: Achieving SC-002 (100ms target) requires measurement capability. Without metrics, regressions may go unnoticed.

---

## Security & Privacy

### 10. Query Input Sanitization
- **Category**: non_functional
- **Status**: Partial
- **Current Spec Reference**: Edge case mentions "special characters in the filter query" treated as "literal characters for matching"
- **Question Candidate**: Are there any characters that should be explicitly blocked or escaped to prevent regex injection, XSS in highlighted output, or path traversal attempts?
- **Impact Score**: 3
- **Rationale**: While filtering is client-side, highlighted output rendered as HTML could introduce XSS if not properly escaped. Long queries could also be used for ReDoS attacks.

### 11. Query Privacy / Telemetry
- **Category**: non_functional
- **Status**: Missing
- **Question Candidate**: Should filter queries be excluded from any application telemetry or crash reports? Are queries containing sensitive patterns (passwords, tokens) a concern?
- **Impact Score**: 2
- **Rationale**: Users may accidentally type sensitive information while searching. Privacy policy implications exist if queries are logged.

---

## Compliance / Regulatory

### 12. Accessibility (a11y) Requirements
- **Category**: non_functional
- **Status**: Missing
- **Question Candidate**: What WCAG compliance level (A, AA, AAA) is required for the filter input, results list, and match highlighting? Should screen readers announce filter result counts?
- **Impact Score**: 4
- **Rationale**: Accessibility is often a regulatory requirement (ADA, Section 508) and significantly impacts implementation of keyboard navigation, ARIA labels, and focus management.

### 13. Internationalization (i18n)
- **Category**: non_functional
- **Status**: Missing
- **Question Candidate**: Should fuzzy matching correctly handle Unicode characters, diacritics, and non-Latin scripts (CJK, Arabic, Hebrew)? Should "cafe" match "cafe"?
- **Impact Score**: 3
- **Rationale**: International users may have file names in various scripts. Fuzzy matching algorithms must be Unicode-aware to avoid excluding valid matches.

---

## Additional Observations

### Clear Items (No Action Needed)

1. **Basic Latency Target**: SC-002 provides a clear 100ms target for up to 10,000 files - this is specific and measurable.
2. **Persistence Scope**: FR-007 and User Story 5 clearly define per-project persistence semantics.

---

## Recommended Priority for Clarification

| Priority | Item | Impact | Reason |
|----------|------|--------|--------|
| High | Accessibility (a11y) | 4 | Legal/regulatory implications |
| High | Scalability limits (10k+ files) | 4 | Common enterprise use case |
| High | Performance degradation strategy | 4 | User experience at scale |
| Medium | Input sanitization / XSS | 3 | Security vulnerability risk |
| Medium | Persistence failure handling | 3 | Feature reliability |
| Medium | i18n / Unicode support | 3 | International user base |
| Medium | Memory consumption limits | 3 | Resource management |
| Medium | Keystroke debouncing strategy | 3 | UX consistency |
| Medium | File system race conditions | 3 | Error handling completeness |
| Low | Observability/logging | 2 | Development/debugging convenience |
| Low | Privacy/telemetry | 2 | Policy documentation need |
| Low | Folder depth limits | 2 | Edge case handling |
