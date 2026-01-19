# Constraints Category Ambiguity Analysis

**Spec**: `/Users/ww/dev/projects/mdxpad-sync/.specify/specs/008-bidirectional-sync/spec.md`
**Category**: Constraints & Tradeoffs
**Date**: 2026-01-17

---

## Summary

The spec provides **reasonable technical constraints** through performance constants and dependencies but has **significant gaps** in explicitly stating technology constraints, storage mechanisms, and rejected alternatives. Performance budgets are well-defined with specific constants.

---

## Ambiguity Findings

### 1. Technology Stack Constraints

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | Does this feature commit to using TypeScript 5.9.x strict:true, React 19.x, and Zustand 5.x + Immer 11.x for SyncState management as mandated by Constitution Article II? |
| **Impact Score** | 2 |
| **Rationale** | The spec mentions integrating with "existing application state management pattern" (line 241) but doesn't explicitly confirm the technology stack. Constitution already mandates this, but explicit confirmation prevents implementation ambiguity. |

---

### 2. Settings Store Selection

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | Which "existing settings store" should persist sync mode - localStorage (renderer process) or electron-store (main process)? How does this align with Spec 006 Application Shell's settings persistence pattern? |
| **Impact Score** | 3 |
| **Rationale** | FR-003 says "persist sync mode preference across sessions using the existing settings store" (line 158) but doesn't specify which store. Prior specs use different approaches: Spec 004 uses electron-store, Spec 005 uses localStorage. Inconsistent choice could cause IPC overhead or pattern fragmentation. |

---

### 3. Large Document Behavior

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | For documents exceeding 10,000 lines, should sync: (a) continue with acknowledged degradation, (b) automatically switch to proportional-only mode, or (c) be disabled entirely with user notification? |
| **Impact Score** | 3 |
| **Rationale** | Assumption 5 (line 251) states "Documents are typically under 10,000 lines; extreme documents may have degraded sync accuracy" but no explicit fallback behavior is defined. Edge case handling for large documents could cause user confusion without clear behavior. |

---

### 4. Scroll Animation Implementation

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | Should smooth scroll animation use CSS scroll-behavior, JavaScript requestAnimationFrame, or a specific library? The NFR mentions respecting prefers-reduced-motion (line 235) - what is the exact implementation approach for instant vs animated scroll? |
| **Impact Score** | 3 |
| **Rationale** | NFR Accessibility (line 235) says "Reduced motion preference should disable smooth scroll animation (use instant scroll)" but doesn't constrain the implementation approach for smooth scrolling or how to detect reduced-motion preference. |

---

### 5. Debounce Utility Source

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | Should debouncing use an existing project utility, a standard library (lodash-es debounce), or implement custom debounce logic? Are there existing debounce utilities in the codebase to reuse? |
| **Impact Score** | 2 |
| **Rationale** | Multiple requirements reference SYNC_DEBOUNCE_MS (50ms) but don't specify the debounce implementation. AGENTS.md rule states "always check for existing logic/code snippets/utilities/libraries/packages that can be reused." |

---

### 6. Rejected Alternatives Documentation

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | What alternative sync strategies were considered and rejected? For example: (1) Why debounce (50ms) vs throttle? (2) Why 150ms animation vs instant or longer duration? (3) Why not virtual scrolling for position mapping? |
| **Impact Score** | 2 |
| **Rationale** | The spec has "Out of Scope" section (lines 257-263) but no documented rationale for chosen approaches vs alternatives. Understanding why specific constants were chosen helps implementers avoid revisiting already-evaluated options. |

---

### 7. Position Cache Size Limit

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | Should the position cache have a maximum entry limit (e.g., 1000 entries) in addition to TTL expiry to prevent unbounded memory growth for documents with many unique scroll positions? |
| **Impact Score** | 2 |
| **Rationale** | FR-040-042 (lines 185-187) define TTL-based expiry (1000ms) but no maximum cache size. While short TTL limits growth, explicit bounds provide cleaner memory management guarantees. |

---

### 8. CodeMirror Scroll API Specifics

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | Which specific CodeMirror 6 APIs should be used for scroll position tracking and programmatic scrolling? Does the dependency on Spec 002 (Editor Core) already provide abstracted scroll methods? |
| **Impact Score** | 2 |
| **Rationale** | Assumption 2 (line 248) states "The editor component exposes methods to get current scroll position and scroll to a specific line" but doesn't cite specific CM6 APIs. Dependency on Spec 002 (line 268) is noted but API contract is implicit. |

---

### 9. Preview Container Type

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | Is the preview an iframe (per Constitution Section 3.5) or a scrollable div container? The spec assumes "iframe or scrollable container" (line 249) - which is the actual implementation from Spec 003? |
| **Impact Score** | 2 |
| **Rationale** | Assumption 3 (line 249) says "The preview pane can receive and respond to scroll commands" but wording "iframe or scrollable container" suggests uncertainty. Constitution Section 3.5 mandates sandboxed iframe - this should be confirmed. |

---

### 10. Platform Constraints

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | Does this feature confirm macOS-only scope per Constitution Article II Preamble? Are there any platform-specific scroll behavior considerations (e.g., touchpad momentum scrolling on macOS)? |
| **Impact Score** | 1 |
| **Rationale** | Constitution states "macOS-only through v2.0" but the spec doesn't explicitly confirm this scope. macOS-specific scroll behaviors (momentum scrolling, trackpad gestures) may affect sync behavior. |

---

## Clear Constraints (No Ambiguity)

The following constraints are well-specified:

1. **Performance Constants** (lines 28-34):
   - `SYNC_DEBOUNCE_MS`: 50ms
   - `SCROLL_ANIMATION_MS`: 150ms
   - `POSITION_CACHE_TTL_MS`: 1000ms
   - `SYNC_THRESHOLD_LINES`: 3 lines
   - `SCROLL_MARGIN_PERCENT`: 10%

2. **Main Thread Performance** (line 226): Scroll handlers must complete within 5ms

3. **Keystroke Latency** (line 219): Must maintain <16ms per Constitution Article V

4. **Position Cache Lifecycle** (lines 185-187): In-memory with TTL expiry on content change

5. **Out of Scope Items** (lines 257-263): Cursor sync, selection sync, zoom sync, multi-document, external windows, custom mapping rules

6. **Inter-Spec Dependencies** (lines 267-271): Specs 002, 003, 005, 006

7. **Feedback Loop Prevention** (lines 134-141): Scroll lock algorithm well-defined

8. **Position Mapping Strategy** (lines 144-146): Three-tier fallback (AST > DOM > proportional)

---

## Recommendations

1. **Add "Technical Constraints" Section**: Explicitly confirm TypeScript 5.9.x, React 19.x, Zustand 5.x + Immer 11.x compliance
2. **Clarify Settings Store**: Specify localStorage vs electron-store based on Spec 006 patterns
3. **Define Large Document Fallback**: Add explicit behavior when documents exceed 10,000 lines
4. **Specify Animation Implementation**: Constrain scroll animation approach with reduced-motion handling
5. **Add "Tradeoffs & Alternatives" Section**: Document rationale for debounce values and approach choices

---

## Impact Summary

| Impact Score | Count | Description |
|--------------|-------|-------------|
| 5 (Critical) | 0 | - |
| 4 (High) | 0 | - |
| 3 (Medium) | 3 | Settings store, large document behavior, scroll animation |
| 2 (Medium-Low) | 6 | Tech stack, debounce utility, rejected alternatives, cache size, CM6 API, preview container |
| 1 (Low) | 1 | Platform constraints |

**Total Ambiguities Found**: 10
**Requiring Clarification (Impact >= 3)**: 3
**Clear/Well-Specified**: 8 items
