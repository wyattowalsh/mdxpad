# Constraints Category Ambiguity Analysis

**Spec**: `/Users/ww/dev/projects/mdxpad/specs/007-mdx-content-outline/spec.md`
**Category**: Constraints & Tradeoffs
**Date**: 2026-01-17

---

## Summary

The spec has significant gaps in the Constraints category. While it mentions some performance targets and behavioral constraints, it lacks explicit sections for technical constraints (language/framework choices), storage mechanisms, and formally documented tradeoffs/rejected alternatives.

---

## Ambiguity Findings

### 1. Technical Language/Framework Constraints

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | What specific technologies (TypeScript version, React version, state management library, CSS approach) are required or preferred for implementing the outline panel? Should this align with existing spec conventions (e.g., TypeScript 5.9.x strict, React 19.x, Zustand 5.x)? |
| **Impact Score** | 4 |
| **Rationale** | The spec references "existing Zustand store pattern" and "existing hooks" but never explicitly states the required technology stack. The AGENTS.md and CLAUDE.md files mention TypeScript 5.9.x, React 19.x, Zustand 5.x - this should be codified in the spec's constraints section. |

---

### 2. Storage/Persistence Mechanism

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What specific storage mechanism should be used for outline panel visibility persistence? Should it use localStorage (like spec 005), electron-store (like spec 004), or the "existing settings store" mentioned in FR-003? |
| **Impact Score** | 3 |
| **Rationale** | FR-003 says "persist outline panel visibility preference across sessions using the existing settings store" but doesn't specify which store. Prior specs use different storage approaches (localStorage vs electron-store). The collapse state is explicitly session-only (User Story 5), but the mechanism is not specified. |

---

### 3. Panel Width Constraints

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What are the minimum and maximum width constraints for the outline panel? Is 150px the minimum width (mentioned in edge cases), and what is the maximum/default width? Should the panel be resizable? |
| **Impact Score** | 2 |
| **Rationale** | Edge cases mention "minimum width of 150px" but there's no explicit constraint section defining panel dimensions. FR-001 says "collapsible sidebar" but doesn't specify if it's resizable, fixed-width, or what the default width should be. |

---

### 4. Window Width Threshold for Auto-hide

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What exact window width thresholds trigger auto-hide behavior? FR-004 specifies 600px (with preview) and 400px (without preview) - are these final values or placeholders? How do these interact with Application Shell (spec 006) layout constraints? |
| **Impact Score** | 2 |
| **Rationale** | FR-004 provides specific pixel values but doesn't explain how they were derived or how they coordinate with the existing Application Shell spec's responsive behavior. Edge cases mention "similar to preview auto-hide behavior" but the relationship isn't explicit. |

---

### 5. AST Fallback Parser Constraint

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What specific "lightweight parser" should be used when preview AST is unavailable (FR-030)? Is this a custom implementation, an existing library (remark, unified), or should the outline simply show an empty/error state? |
| **Impact Score** | 3 |
| **Rationale** | FR-030 says "fall back to a lightweight parser" but doesn't specify what this parser is or its performance characteristics. This is a technical constraint that affects implementation approach and bundle size. |

---

### 6. Rejected Alternatives / Tradeoffs Documentation

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | What alternative approaches were considered and rejected? For example: (1) Why left-side panel vs right-side? (2) Why no scroll-position sync (highlighted as Out of Scope but rationale not given)? (3) Why 500ms update debounce vs other values? (4) Why session-only collapse state vs persisted? |
| **Impact Score** | 3 |
| **Rationale** | The spec documents "Out of Scope" items but doesn't explain the tradeoffs or reasoning behind these decisions. Understanding rejected alternatives helps implementers avoid revisiting already-considered approaches. |

---

### 7. Debounce/Throttle Constraints

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What is the specific debounce strategy for outline updates? Is 500ms the debounce delay, or the maximum latency? Should updates be debounced, throttled, or use requestIdleCallback? |
| **Impact Score** | 2 |
| **Rationale** | Multiple requirements mention "within 500ms of document changes" (FR-010, FR-015, FR-019) and NFR mentions "debounce outline updates" but the exact debounce configuration isn't specified. SC-002 says "500ms of typing pause" which suggests debounce, but this conflicts with the "within 500ms" language elsewhere. |

---

### 8. Memory/Resource Constraints

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | Are there constraints on memory usage or DOM node limits for the outline tree? For very large documents with hundreds of headings/components, what are the performance boundaries? |
| **Impact Score** | 2 |
| **Rationale** | NFRs mention "must not block the main thread" but don't specify memory limits or how to handle extremely large documents. Virtualization requirements (if any) are not documented. |

---

### 9. Browser/Electron Version Constraints

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | What minimum Electron/Chromium version is required? Are there any browser API constraints (e.g., ResizeObserver availability, CSS container queries)? |
| **Impact Score** | 1 |
| **Rationale** | The spec doesn't mention platform constraints. AGENTS.md mentions Electron 39.x in other specs but this spec doesn't explicitly state its Electron requirements. |

---

### 10. CSS/Styling Approach Constraint

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | What CSS methodology should be used for styling the outline panel? Should it use CSS modules, Tailwind, styled-components, or plain CSS to match the existing codebase patterns? |
| **Impact Score** | 2 |
| **Rationale** | No styling constraints are mentioned. The existing codebase likely has established patterns that should be followed for consistency. |

---

## Recommendations

1. **Add "Technical Constraints" Section**: Explicitly state TypeScript 5.9.x, React 19.x, Zustand 5.x + Immer 11.x per codebase standards
2. **Clarify Storage Mechanism**: Specify whether to use localStorage or electron-store, and which specific store key
3. **Document Panel Dimensions**: Add explicit min/max/default width values and resizability constraint
4. **Add "Tradeoffs & Alternatives" Section**: Document why certain approaches were chosen over alternatives
5. **Specify Debounce Strategy**: Clarify exact debounce configuration (delay value, leading/trailing edge)

---

## Impact Summary

| Impact Score | Count |
|--------------|-------|
| 5 (Critical) | 0 |
| 4 (High) | 1 |
| 3 (Medium) | 3 |
| 2 (Medium-Low) | 5 |
| 1 (Low) | 1 |

**Total Ambiguities**: 10
**Requiring Clarification**: 4 (High + Medium impact)
