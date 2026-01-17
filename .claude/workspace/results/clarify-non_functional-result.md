# Non-Functional Requirements Ambiguity Analysis

**Spec**: `specs/007-mdx-content-outline/spec.md`
**Category**: Non-Functional Quality Attributes
**Analyzed**: 2026-01-17

---

## Summary

| Quality Attribute | Status | Issues Found |
|-------------------|--------|--------------|
| Performance | Partial | 4 issues |
| Scalability | Missing | 3 issues |
| Reliability & Availability | Partial | 3 issues |
| Observability | Missing | 3 issues |
| Security & Privacy | Missing | 2 issues |
| Compliance / Regulatory | Partial | 2 issues |

**Total Ambiguities Identified**: 17

**Note**: The Non-Functional Requirements section (lines 205-224) is notably thin, covering only Performance, Accessibility, and Maintainability at a high level. Several critical NFR categories are entirely missing, and the existing ones lack quantitative targets.

---

## Detailed Analysis

### 1. Performance (Latency, Throughput Targets)

#### 1.1 Memory Budget Unspecified
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No memory budget or ceiling is specified for the outline feature. Parsing large documents with many headings and components could consume significant memory.
- **Question Candidate**: What is the maximum acceptable memory footprint for the outline feature (e.g., max 50MB additional memory for a 10,000-line document)?
- **Impact Score**: 4

#### 1.2 CPU Utilization Ceiling Unspecified
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: NFR Performance section (lines 209-211)
- **Issue**: The spec says "must not block the main thread or cause editor input lag" but provides no quantitative CPU utilization limit.
- **Question Candidate**: Should there be a CPU utilization ceiling for outline parsing (e.g., no more than 5% of single core during background updates)?
- **Impact Score**: 3

#### 1.3 Performance Targets Scattered Across Sections
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: NFR (209-211), FR-010/015/019 (500ms), SC-001 (100ms), SC-002 (500ms), SC-003 (50ms), SC-004 (50ms)
- **Issue**: Performance targets are scattered across Success Criteria, Functional Requirements, and NFR sections. The NFR section itself only provides qualitative guidance ("debounce," "reuse AST") without consolidating quantitative targets.
- **Question Candidate**: Should all performance targets be consolidated into a single NFR subsection with a clear performance budget table?
- **Impact Score**: 2

#### 1.4 Debounce Interval Not Specified
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: NFR Performance (line 210)
- **Issue**: The spec requires "Debounce outline updates to avoid excessive re-parsing during rapid typing" but does not specify the debounce interval.
- **Question Candidate**: What debounce interval should be used for outline updates during rapid typing (e.g., 100ms, 200ms, 300ms)?
- **Impact Score**: 2

---

### 2. Scalability (Horizontal/Vertical, Limits)

#### 2.1 Document Size Limits Not Defined
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No maximum document size (lines, characters, headings, components) is specified. Large documents could cause outline performance degradation.
- **Question Candidate**: What is the maximum document size (lines/characters) and item count (headings/components) the outline must fully support without degradation?
- **Impact Score**: 4

#### 2.2 Virtualization/Pagination Strategy Missing
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No virtualization or pagination strategy is defined for documents with many outline items. A document with 500+ headings could overwhelm the outline panel.
- **Question Candidate**: What is the maximum number of outline items the panel should display before employing virtualization or a "show more" pattern?
- **Impact Score**: 3

#### 2.3 Graceful Degradation Strategy Missing
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No graceful degradation strategy exists for very large documents that exceed performance targets.
- **Question Candidate**: How should the outline behave when document size exceeds supported limits (e.g., "Outline simplified for large document" with only top-level headings)?
- **Impact Score**: 3

---

### 3. Reliability & Availability (Uptime, Recovery)

#### 3.1 Component Crash Isolation Not Specified
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No error boundary or crash isolation requirement exists. If the outline component throws an unhandled exception, it could crash the entire editor.
- **Question Candidate**: Should the outline component be wrapped in an error boundary to prevent cascading failures to the editor?
- **Impact Score**: 3

#### 3.2 Outline Staleness Threshold Not Defined
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: FR-031, Edge Cases (line 113)
- **Issue**: The spec mentions showing "last valid outline" on parse failure but doesn't define how long stale data is acceptable before showing an error state.
- **Question Candidate**: What is the maximum acceptable staleness for "last valid outline" data (e.g., if AST fails for 10+ seconds, show explicit error state)?
- **Impact Score**: 2

#### 3.3 Retry Logic for Transient Failures Missing
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No retry logic is specified for transient AST parsing failures.
- **Question Candidate**: Should there be automatic retry logic if outline AST parsing fails transiently (e.g., retry once after 500ms)?
- **Impact Score**: 2

---

### 4. Observability (Logging, Metrics, Tracing)

#### 4.1 No Logging Requirements
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No logging requirements exist for outline operations. Debugging slow outline updates or navigation failures would be difficult without logs.
- **Question Candidate**: Should outline parsing performance and navigation events be logged for debugging (e.g., log parse duration, item count, navigation targets)?
- **Impact Score**: 2

#### 4.2 No Performance Metrics Collection
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No metrics collection is specified for monitoring outline performance in production.
- **Question Candidate**: Should outline performance metrics (parse times, update frequency, memory usage) be collected for monitoring?
- **Impact Score**: 2

#### 4.3 No Debug Mode for Developers
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No developer debugging capability is specified for inspecting outline state.
- **Question Candidate**: Should there be a developer console command or debug panel to inspect current outline state and AST data?
- **Impact Score**: 1

---

### 5. Security & Privacy (AuthN/Z, Data Protection)

#### 5.1 Input Sanitization Not Addressed
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: Heading text and component names come from user-authored content. No sanitization requirement exists to prevent potential rendering issues or injection.
- **Question Candidate**: Should outline item text (heading text, component names) be sanitized before rendering in the tree view to prevent any rendering injection concerns?
- **Impact Score**: 2

#### 5.2 Data Exposure Considerations Missing
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No consideration of whether outline data could expose document structure in error reports or logs.
- **Question Candidate**: Is there any risk of outline data (document structure, heading text) being exposed unintentionally in logs or error reports?
- **Impact Score**: 1

---

### 6. Compliance / Regulatory Constraints

#### 6.1 WCAG Compliance Level Not Specified
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: NFR Accessibility (lines 215-217)
- **Issue**: The spec requires keyboard navigation and ARIA roles but doesn't specify a target WCAG compliance level.
- **Question Candidate**: What WCAG compliance level is required for the outline (2.0 AA minimum, 2.1 AA, or 2.1 AAA)?
- **Impact Score**: 3

#### 6.2 WAI-ARIA TreeView Pattern Not Referenced
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: NFR Accessibility (lines 215-217)
- **Issue**: The spec mentions "tree, treeitem" roles but doesn't reference the specific WAI-ARIA TreeView pattern for keyboard interactions.
- **Question Candidate**: Should keyboard navigation follow the specific WAI-ARIA TreeView pattern (with arrow keys, Home/End, expand/collapse)?
- **Impact Score**: 2

---

## Prioritized Question Candidates

Sorted by impact score (highest first):

| # | Impact | Quality Attribute | Question |
|---|--------|-------------------|----------|
| 1 | 4 | Performance | What is the maximum acceptable memory footprint for the outline feature? |
| 2 | 4 | Scalability | What is the maximum document size and item count the outline must support without degradation? |
| 3 | 3 | Performance | Should there be a CPU utilization ceiling for outline parsing? |
| 4 | 3 | Scalability | What is the maximum number of outline items before employing virtualization? |
| 5 | 3 | Scalability | How should the outline degrade gracefully for very large documents? |
| 6 | 3 | Reliability | Should the outline component be error-boundary isolated? |
| 7 | 3 | Compliance | What WCAG compliance level is required for the outline? |
| 8 | 2 | Performance | Should all performance targets be consolidated into a single NFR section? |
| 9 | 2 | Performance | What debounce interval should be used for outline updates? |
| 10 | 2 | Reliability | What is the maximum acceptable staleness for "last valid outline" data? |
| 11 | 2 | Reliability | Should there be retry logic for transient AST parsing failures? |
| 12 | 2 | Observability | Should outline parsing performance be logged for debugging? |
| 13 | 2 | Observability | Should outline performance metrics be collected for monitoring? |
| 14 | 2 | Security | Should outline item text be sanitized before rendering? |
| 15 | 2 | Compliance | Should keyboard navigation follow the WAI-ARIA TreeView pattern? |
| 16 | 1 | Observability | Should there be a debug mode for inspecting outline state? |
| 17 | 1 | Security | Is there risk of outline data exposure in logs/error reports? |

---

## Recommendations

### Critical (Impact 4)
1. **Memory Budget**: Define a memory ceiling for the outline feature to prevent resource exhaustion on large documents (e.g., "Outline feature must not exceed 50MB additional memory for documents up to 50,000 lines").

2. **Document Size Limits**: Specify maximum supported document dimensions and define graceful degradation behavior beyond those limits.

### High Priority (Impact 3)
3. **WCAG Compliance**: Specify a target WCAG level (recommend 2.1 AA) and reference the WAI-ARIA TreeView pattern for keyboard navigation.

4. **Error Isolation**: Require error boundary wrapping to prevent outline failures from crashing the editor.

5. **Scalability Strategy**: Define virtualization threshold for outline panels with many items.

### Medium Priority (Impact 2)
6. **Performance Consolidation**: Consolidate all quantitative performance targets into a single NFR subsection for clarity.

7. **Observability**: Add basic logging requirements for debugging outline issues in production.

8. **Input Sanitization**: Clarify text rendering approach to prevent any edge-case rendering issues.

### Low Priority (Impact 1)
9. **Debug Mode**: Consider adding developer tooling for outline state inspection (can be deferred to later spec).

---

## Notes

- The spec compensates somewhat for NFR vagueness by including quantitative targets in Success Criteria (SC-001 through SC-008)
- The scattered nature of performance targets across FR, SC, and NFR sections could lead to implementation confusion
- Security concerns are minimal for a local desktop app, but input sanitization is good practice
- The accessibility requirements are directionally correct but would benefit from specific standard references
