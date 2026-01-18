# UX Flow Ambiguity Analysis

**Spec**: 014-smart-filtering (Smart Filtering for File Tree)
**Analysis Date**: 2026-01-17
**Category**: UX Flow

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 4 |
| Partial | 8 |
| Missing | 5 |

---

## Critical User Journeys / Sequences

### 1. Filter Input Focus Flow

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: What is the designated keyboard shortcut to focus the filter input, and how should conflicts with existing shortcuts be handled?
- **Impact Score**: 4

**Analysis**: The spec mentions a keyboard shortcut to focus the filter input (FR-006, User Story 4) but does not specify the actual keyboard shortcut. It mentions "Cmd/Ctrl+Shift+E or similar unassigned shortcut" in Assumptions but this is vague and non-committal.

---

### 2. Focus Return Behavior After Escape

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: When pressing Escape to exit the filter input, should focus return to (a) the previously focused element before the shortcut was invoked, (b) the file tree panel, (c) the main editor, or (d) a configurable default?
- **Impact Score**: 3

**Analysis**: User Story 4 Scenario 2 says "returns focus to the previous element" but doesn't define what "previous element" means. Is it the last focused element before invoking the shortcut? The file tree? The editor?

---

### 3. Two-Stage Escape Behavior

- **Category**: ux_flow
- **Status**: Clear
- **Question Candidate**: N/A
- **Impact Score**: N/A

**Analysis**: User Story 4 Scenario 3 clearly defines the two-stage Escape behavior: first clears text, second removes focus. This is well specified.

---

### 4. Filter Results Update During Typing

- **Category**: ux_flow
- **Status**: Clear
- **Question Candidate**: N/A
- **Impact Score**: N/A

**Analysis**: FR-002 and FR-010 clearly specify that filtering happens "as the user types" without "noticeable delay". SC-002 quantifies this as "within 100ms".

---

### 5. File Selection While Filter Active

- **Category**: ux_flow
- **Status**: Missing
- **Question Candidate**: After selecting a file from filtered results, should (a) the filter clear and show full tree, (b) the filter persist allowing additional selections, or (c) the behavior be configurable? Additionally, can users navigate the filtered list with keyboard (arrow keys)?
- **Impact Score**: 4

**Analysis**: The spec does not describe what happens after a user selects a file from the filtered results. Does the filter clear? Does it persist? Can the user navigate the filtered list with keyboard (arrow keys)?

---

### 6. Filter Input Visibility and Position

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: Where should the filter input be positioned within the file explorer sidebar - always visible at top, collapsible, or appearing only when the keyboard shortcut is invoked?
- **Impact Score**: 3

**Analysis**: FR-001 states a "text input field in the file explorer sidebar" but doesn't specify positioning (top, bottom, floating), whether it's always visible or appears on demand, or how it integrates visually with the file tree.

---

## Error / Empty / Loading States

### 7. Empty State Message

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: What should the empty state message say when no files match? Should it include (a) just "No results found", (b) a suggestion like "Try a different search term", (c) a count of total files searched, or (d) an option to clear the filter?
- **Impact Score**: 3

**Analysis**: FR-011 requires "a clear empty state message" and the Edge Cases mention "(Empty state with helpful message)" but the actual message content, visual design, or whether it should include suggestions (like "Try a different search term") is not specified.

---

### 8. Loading State During Large Tree Filter

- **Category**: ux_flow
- **Status**: Missing
- **Question Candidate**: If filtering exceeds the 100ms target (e.g., on very large projects or slower machines), should the UI (a) show a loading indicator, (b) debounce input and show "searching...", (c) progressively render results, or (d) allow background filtering with cancellation?
- **Impact Score**: 3

**Analysis**: The spec mentions performance targets (SC-002: 100ms for 10,000 files) but doesn't address what happens if filtering takes longer. Is there a loading indicator? Does the UI remain responsive? What about initial load when restoring persisted filter?

---

### 9. Error State for Filter Persistence Failure

- **Category**: ux_flow
- **Status**: Missing
- **Question Candidate**: How should the system behave if filter persistence fails? Should it (a) silently continue without persistence, (b) show a non-blocking notification, (c) attempt recovery, or (d) fall back to session-only storage?
- **Impact Score**: 2

**Analysis**: FR-007 requires persistence across sessions but there's no error handling specified if localStorage is unavailable, quota is exceeded, or data is corrupted.

---

### 10. Real-time File System Changes During Filter

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: When files are added/deleted/renamed while a filter is active, should the UI (a) silently update the list, (b) provide subtle animation for changes, (c) show a notification of changes, or (d) flash/highlight newly matching items?
- **Impact Score**: 3

**Analysis**: Edge cases mention "Filter results update automatically" for file changes, but doesn't specify visual feedback. Should new matching files animate in? Should deletions animate out? What if a currently highlighted file is deleted?

---

## Accessibility Notes

### 11. Screen Reader Announcements

- **Category**: ux_flow
- **Status**: Missing
- **Question Candidate**: What accessibility features are required? Should the system provide (a) ARIA live regions announcing result counts, (b) screen reader announcements for empty state, (c) accessible descriptions of match highlighting, (d) all of the above?
- **Impact Score**: 4

**Analysis**: The spec has no accessibility requirements. Screen reader users need announcements for: filter result count changes, empty state, matched/highlighted portions, and focus changes.

---

### 12. Keyboard Navigation Within Filtered Results

- **Category**: ux_flow
- **Status**: Missing
- **Question Candidate**: How should keyboard navigation work within filtered results? Specifically: (a) Can users arrow down from the filter input into results? (b) Does Enter open the highlighted file? (c) Can Tab move between filter input, clear button, and results?
- **Impact Score**: 4

**Analysis**: No specification for how keyboard users navigate the filtered file tree. Arrow keys? Tab? Enter to select? How does this integrate with the filter input focus?

---

### 13. Color Contrast for Match Highlighting

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: How should matched characters be visually distinguished? Should highlighting use (a) bold text, (b) background color, (c) text color change, (d) underline, or a combination? Must it meet WCAG 2.1 AA contrast requirements?
- **Impact Score**: 3

**Analysis**: FR-005 requires "visually highlight the matched portions" but doesn't specify the highlighting method (bold, color, background) or ensure WCAG color contrast compliance.

---

## Localization Notes

### 14. RTL Language Support

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: Should the filter input and file tree support RTL languages? If so, how should (a) the input field direction, (b) match highlighting, and (c) tree indentation behave in RTL mode?
- **Impact Score**: 2

**Analysis**: No mention of RTL (right-to-left) language support for the filter input or file tree display. This affects Arabic, Hebrew, and other RTL language users.

---

### 15. Internationalized Empty State and UI Text

- **Category**: ux_flow
- **Status**: Clear
- **Question Candidate**: N/A
- **Impact Score**: N/A

**Analysis**: While specific message content isn't specified, the spec doesn't preclude internationalization. This follows established patterns in the application.

---

### 16. Special Character Handling Across Languages

- **Category**: ux_flow
- **Status**: Clear
- **Question Candidate**: N/A
- **Impact Score**: N/A

**Analysis**: Edge cases mention "Treat as literal characters for matching" for special characters, which implicitly covers Unicode characters from different languages.

---

## Additional UX Flow Gaps

### 17. Filter Clear Button Behavior

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: Should the clear button (a) always be visible, (b) appear only when the filter has text, or (c) be an "X" icon inside the input field? After clearing, should focus remain on the input or move elsewhere?
- **Impact Score**: 2

**Analysis**: FR-012 mentions "clear button" as one way to clear the filter, but doesn't specify when it appears (always? only when text exists?), its position, or whether clicking it returns focus to the filter input.

---

## High-Priority Questions (Impact >= 4)

1. **What is the designated keyboard shortcut to focus the filter input, and how should conflicts with existing shortcuts be handled?** (Impact: 4)

2. **After selecting a file from filtered results, should the filter clear, persist, or be configurable? Can users navigate filtered results with arrow keys?** (Impact: 4)

3. **What accessibility features are required for screen reader users?** (Impact: 4)

4. **How should keyboard navigation work within filtered results?** (Impact: 4)

---

## Recommendations

1. Add an **Accessibility Requirements** section addressing screen readers, keyboard navigation, and color contrast.

2. Specify the **exact keyboard shortcut** and document conflict resolution strategy.

3. Define the complete **user journey** from filter invocation through file selection and beyond.

4. Clarify **loading/error states** for edge cases like slow filtering or persistence failures.

5. Document **keyboard navigation flow** between filter input and filtered tree results.

---

## Appendix: Checklist of UX Flow Topics

| Topic | Covered | Notes |
|-------|---------|-------|
| Happy path user journey | Yes | User Stories 1-5 well-defined |
| Empty state | Partial | Behavior mentioned, visual design not |
| Loading state | No | Not addressed |
| Error state | No | Persistence failures not addressed |
| Keyboard navigation | No | Not specified for filtered results |
| Screen reader support | No | No accessibility requirements |
| Focus management | Partial | Escape behavior defined, selection not |
| Localization | Partial | RTL not addressed |
| Animations | No | No transition specs |
| Responsive behavior | No | Not mentioned |
