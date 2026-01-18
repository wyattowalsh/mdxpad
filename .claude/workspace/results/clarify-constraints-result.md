# Constraints Category Ambiguity Analysis

**Spec**: `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/spec.md`
**Feature**: Smart Filtering for File Tree
**Analysis Date**: 2026-01-17
**Category Focus**: Constraints & Tradeoffs

---

## Summary

The spec is notably **sparse on explicit constraints**. While functional requirements and success criteria are well-defined, the specification lacks a dedicated Constraints section and does not explicitly document tradeoffs or rejected alternatives.

---

## Ambiguity Analysis

### 1. Fuzzy Matching Algorithm Selection

| Field | Value |
|-------|-------|
| **Category** | constraints |
| **Status** | Partial |
| **Location** | Assumptions section, line 138 |
| **Current Text** | "Fuzzy matching uses a standard algorithm like fzf-style matching for consistency with developer expectations" |
| **Question Candidate** | What specific fuzzy matching library or algorithm should be used (e.g., fzf, fuse.js, flexsearch, custom implementation)? Should we prioritize match quality, performance, or bundle size? |
| **Impact Score** | 4 |
| **Rationale** | The spec says "like fzf-style" which is vague. Different libraries have different performance characteristics, match scoring algorithms, and bundle sizes. This affects both implementation and the 100ms performance target (SC-002). |

---

### 2. Storage Mechanism for Persistence

| Field | Value |
|-------|-------|
| **Category** | constraints |
| **Status** | Partial |
| **Location** | Assumptions section, line 136 |
| **Current Text** | "The application uses localStorage or similar mechanism for session persistence (established pattern)" |
| **Question Candidate** | Should filter persistence use localStorage (renderer process), electron-store (main process), or another mechanism? Is there a size limit concern for storing per-project filter state? |
| **Impact Score** | 3 |
| **Rationale** | The "or similar mechanism" leaves ambiguity. The project already uses both localStorage (005, 006, 007 specs) and electron-store (004, 006 specs) for different purposes. The choice affects architecture and where state is managed. |

---

### 3. Maximum Filter Query Length

| Field | Value |
|-------|-------|
| **Category** | constraints |
| **Status** | Missing |
| **Location** | Edge Cases section, line 96 |
| **Current Text** | "What happens when the user pastes a very long string into the filter? (Truncate or limit input length gracefully)" |
| **Question Candidate** | What is the maximum allowed filter query length? Should it be a hard limit (truncation) or soft limit (warning)? What is the specific character count? |
| **Impact Score** | 2 |
| **Rationale** | No specific limit is defined. While the edge case acknowledges this scenario, implementation needs a concrete number to enforce. This affects both UX and performance. |

---

### 4. Keyboard Shortcut Binding

| Field | Value |
|-------|-------|
| **Category** | constraints |
| **Status** | Partial |
| **Location** | Assumptions section, line 137 |
| **Current Text** | "Standard keyboard shortcut conventions apply (e.g., Cmd/Ctrl+Shift+E or similar unassigned shortcut)" |
| **Question Candidate** | What is the exact keyboard shortcut for focusing the filter input? Has conflict analysis been done with existing shortcuts in specs 005 (command palette) and 006 (application shell)? |
| **Impact Score** | 3 |
| **Rationale** | The shortcut is not definitively specified. Cmd/Ctrl+Shift+E is only suggested. Conflicts with existing shortcuts could cause UX issues or require refactoring. |

---

### 5. Performance Constraints for Large Projects

| Field | Value |
|-------|-------|
| **Category** | constraints |
| **Status** | Partial |
| **Location** | Success Criteria, lines 125-126 |
| **Current Text** | "SC-001: Users can locate a specific file in a 500+ file project within 5 seconds" and "SC-002: Filter results update within 100ms of keystroke for projects with up to 10,000 files" |
| **Question Candidate** | What is the expected behavior for projects exceeding 10,000 files? Should there be degradation strategies (debouncing, pagination, background indexing)? What is the upper bound for supported project size? |
| **Impact Score** | 3 |
| **Rationale** | The spec defines performance targets up to 10,000 files but does not address larger projects. Real-world monorepos can have 50,000+ files. Without guidance, implementation may fail silently or degrade unpredictably. |

---

### 6. Case Sensitivity Behavior

| Field | Value |
|-------|-------|
| **Category** | constraints |
| **Status** | Missing |
| **Location** | N/A - Not mentioned in spec |
| **Current Text** | N/A |
| **Question Candidate** | Should the filter be case-insensitive by default? Should there be an option to toggle case sensitivity (e.g., typing uppercase triggers case-sensitive mode like in some search tools)? |
| **Impact Score** | 3 |
| **Rationale** | Case sensitivity is not mentioned anywhere in the spec. This is a fundamental UX decision that affects fuzzy matching behavior and user expectations. Most developer tools default to case-insensitive with smart-case options. |

---

### 7. Technology Stack / Dependencies

| Field | Value |
|-------|-------|
| **Category** | constraints |
| **Status** | Missing |
| **Location** | N/A - No technology section |
| **Current Text** | N/A |
| **Question Candidate** | What are the allowed/preferred dependencies for this feature? Should we use an existing fuzzy search library (fuse.js, flexsearch, etc.) or implement custom matching? Are there bundle size constraints? |
| **Impact Score** | 4 |
| **Rationale** | Unlike other specs in this project (see CLAUDE.md Active Technologies sections), this spec does not declare its technology stack. This leaves implementers to make independent choices that may conflict with project conventions. |

---

### 8. Rejected Alternatives / Tradeoffs

| Field | Value |
|-------|-------|
| **Category** | constraints |
| **Status** | Missing |
| **Location** | N/A - No tradeoffs section |
| **Current Text** | N/A |
| **Question Candidate** | Were alternative approaches considered (e.g., glob patterns, regex search, tag-based filtering)? Why was fuzzy-only matching chosen? Should advanced users have access to more powerful search modes? |
| **Impact Score** | 2 |
| **Rationale** | The spec does not document why fuzzy matching was chosen over alternatives. This context helps implementers understand design intent and avoid re-introducing rejected patterns. |

---

### 9. Accessibility Constraints

| Field | Value |
|-------|-------|
| **Category** | constraints |
| **Status** | Missing |
| **Location** | N/A - Not mentioned |
| **Current Text** | N/A |
| **Question Candidate** | What accessibility requirements apply to the filter input and highlighted results? Should there be screen reader announcements for filter result counts? ARIA labels for the input field? |
| **Impact Score** | 2 |
| **Rationale** | No accessibility requirements are specified. The application shell (006) likely has patterns to follow, but filter-specific accessibility (live regions for result counts, proper labeling) is not addressed. |

---

### 10. Memory/Resource Constraints

| Field | Value |
|-------|-------|
| **Category** | constraints |
| **Status** | Missing |
| **Location** | N/A |
| **Current Text** | N/A |
| **Question Candidate** | Are there memory constraints for indexing/caching file trees for filtering? Should the filter operate on-demand or maintain a pre-built index? What is acceptable memory overhead? |
| **Impact Score** | 2 |
| **Rationale** | For large projects (10,000+ files), caching strategies significantly impact memory usage. No guidance is provided on acceptable memory overhead or whether indexing is preferred over on-the-fly filtering. |

---

## Priority Summary

| Impact Score | Count | Items |
|--------------|-------|-------|
| **5** | 0 | - |
| **4** | 2 | Fuzzy matching algorithm, Technology stack |
| **3** | 4 | Storage mechanism, Keyboard shortcut, Performance for large projects, Case sensitivity |
| **2** | 4 | Max query length, Rejected alternatives, Accessibility, Memory constraints |

---

## Recommended Clarification Questions (Top 5 by Impact)

1. **[Impact 4]** What specific fuzzy matching library or algorithm should be used, and what are the priorities: match quality, performance, or bundle size?

2. **[Impact 4]** What technology stack/dependencies are allowed for this feature? Should this section be added to align with other specs in the project?

3. **[Impact 3]** What is the exact keyboard shortcut for focusing the filter, and has conflict analysis been done with existing shortcuts?

4. **[Impact 3]** Should the filter be case-insensitive by default, and should there be a mechanism to toggle case sensitivity?

5. **[Impact 3]** What is the expected behavior and degradation strategy for projects exceeding 10,000 files?
