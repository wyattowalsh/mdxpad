# Constraints Category Ambiguity Analysis

**Spec**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`
**Category**: Constraints & Tradeoffs
**Date**: 2026-01-10

---

## Summary

The spec references constraints implicitly through assumptions and dependencies but lacks a dedicated **Constraints & Tradeoffs** section. Key technical constraints are documented in the Constitution (Article II, V) but the spec does not explicitly map to these or document spec-specific constraints.

---

## Ambiguity Findings

### 1. Settings Persistence Technology

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | What technology should be used for persisting settings/preferences? The input mentions "electron-store persistence" but this is not carried forward into the spec requirements or constraints. Should electron-store be mandated, or is localStorage acceptable for some settings? What are the constraints on storage location and format? |
| **Impact Score** | 4 |
| **Rationale** | FR-033 through FR-036 require persistence but do not specify the technology. The Constitution does not pin electron-store as a required technology. This leaves implementers without clear guidance and could lead to inconsistent approaches (e.g., using localStorage for renderer-accessible settings vs electron-store for main-process settings). |

---

### 2. Minimum Pane Width Values

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What are the specific minimum width values for editor and preview panes? FR-003 states "neither can be resized below usability threshold" but does not quantify the constraint. Should this be a fixed pixel value, a percentage of window width, or dynamically calculated based on content? |
| **Impact Score** | 3 |
| **Rationale** | Without defined minimums, different implementations could vary significantly. This affects both UX consistency and edge case behavior (e.g., very narrow windows). The Constitution's UX requirements (Article VII) do not specify numeric values for panel sizing. |

---

### 3. Minimum Window Size

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What is the minimum window size for the application? Edge case mentions "Enforce minimum window size" but no constraint value is specified. What dimensions should be enforced, and should this be configurable? |
| **Impact Score** | 2 |
| **Rationale** | This affects usability on smaller displays and window management behavior. Without explicit constraints, the implementation may choose arbitrary values that conflict with macOS HIG recommendations or user expectations. |

---

### 4. Preview Update Debounce/Throttle Strategy

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What is the specific debounce/throttle strategy for preview updates? Success criterion SC-002 specifies "within 500ms of typing pause" but the spec does not constrain the implementation approach. Should this be debounce (wait for pause), throttle (max rate), or a hybrid approach? What is the minimum debounce delay? |
| **Impact Score** | 3 |
| **Rationale** | The Constitution (Article V) sets a 500ms budget for MDX preview compile but does not specify input debouncing. A pure throttle would cause unnecessary recompilations; a long debounce would feel sluggish. The tradeoff between responsiveness and resource usage is not addressed. |

---

### 5. Settings Persistence Debounce Strategy

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What is the debounce interval for settings persistence? The NFR "Settings persistence must be debounced to avoid excessive disk writes" does not specify a duration. What constitutes "excessive"? What is the maximum acceptable delay between user action and persistence? |
| **Impact Score** | 2 |
| **Rationale** | Too short leads to disk thrashing; too long risks data loss on crash. A concrete value (e.g., 500ms, 2s) would provide clear implementation guidance. |

---

### 6. Error Count Threshold for Status Bar

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | Is there a maximum error count displayed in the status bar? Should errors be aggregated, truncated, or shown as "99+" style overflow? What happens if there are hundreds of compilation errors? |
| **Impact Score** | 1 |
| **Rationale** | Minor UX detail, but affects status bar layout and performance if error tracking is unbounded. |

---

### 7. Rejected Alternatives Documentation

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | What alternative approaches were considered and rejected for key decisions? For example: Why split-pane over tabbed layout? Why single-document model over multi-document initially? Why Zustand over React Context or Redux for document state? Documenting rejected alternatives helps future maintainers understand design rationale. |
| **Impact Score** | 2 |
| **Rationale** | The spec mentions "single document model" as an assumption but does not explain why or what was rejected. This is standard practice in architectural decision records (ADRs) and helps prevent re-litigating decisions. |

---

### 8. File Size Constraints

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | What are the file size constraints for opened documents? The Constitution specifies performance budgets for 1MB and 10MB files, but the spec does not define behavior for files exceeding these sizes. Should there be a hard limit? A warning? Graceful degradation? |
| **Impact Score** | 3 |
| **Rationale** | Users may attempt to open very large files. Without constraints, the app could hang or crash. The Constitution provides performance targets but not behavioral constraints for exceeding them. |

---

### 9. State Store Technology Constraint

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | Should all document state use Zustand as mandated by the Constitution, or can React state be used for ephemeral UI state (e.g., dialog visibility)? The NFR states "Document state must be centralized (single source of truth)" but does not clarify the boundary between document state and transient UI state. |
| **Impact Score** | 2 |
| **Rationale** | The Constitution mandates Zustand+Immer for state, but over-centralizing trivial UI state (like "is save dialog open") adds unnecessary complexity. Clarifying the boundary helps implementers make consistent decisions. |

---

### 10. External File Change Detection Timing

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | What is the polling interval or file watching strategy for detecting external file changes? Edge case mentions "detect change and prompt user" but does not constrain the implementation. Is this chokidar-based watching? Polling? On-focus-only checks? What is the acceptable detection latency? |
| **Impact Score** | 3 |
| **Rationale** | File watching has performance implications (battery, CPU). The Constitution mentions chokidar in Section 3.1 but does not specify when/how it should be used. This feature may be better deferred to a separate spec if not core to MVP. |

---

## Recommendations

1. **Add Constraints Section**: The spec should include an explicit "Constraints & Tradeoffs" section documenting technology constraints inherited from Constitution and spec-specific constraints.

2. **Quantify UI Constraints**: Provide specific pixel/percentage values for minimum pane widths and window dimensions.

3. **Document Storage Strategy**: Explicitly state that electron-store will be used for settings persistence, aligning with the user's input description.

4. **Add Rejected Alternatives**: Document at least the key architectural decisions (single-document model, split-pane layout) with brief rationale.

5. **Clarify Performance Tradeoffs**: Specify debounce strategies and their values for both preview updates and settings persistence.

---

## Impact Summary

| Impact Score | Count |
|--------------|-------|
| 5 (Critical) | 0 |
| 4 (High) | 1 |
| 3 (Medium) | 4 |
| 2 (Low) | 4 |
| 1 (Minimal) | 1 |

**Total Ambiguities**: 10
**Requiring Clarification**: 5 (High + Medium impact)
