# UX Flow Ambiguity Analysis

**Spec**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`
**Category Focus**: UX Flow (Critical user journeys, Error/Empty/Loading states, Accessibility/Localization)
**Date**: 2026-01-10

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 4 |
| Partial | 9 |
| Missing | 6 |

---

## Findings

### 1. Loading States During File Operations

- **Category**: ux_flow
- **Status**: Missing
- **Question Candidate**: What visual feedback (loading spinner, progress indicator, disabled state) should be shown during file open, save, and read operations? How long before a loading indicator appears for potentially slow operations?
- **Impact Score**: 4

**Analysis**: The spec defines success criteria for timing (e.g., 500ms preview update, 100ms settings restore) but never specifies what users see during the operation. For large files, network drives, or slow disks, operations could take noticeable time with no defined feedback mechanism.

---

### 2. Empty State for New Documents

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: Should the empty editor display placeholder text, sample content, or be completely blank? Should there be onboarding hints for first-time users?
- **Impact Score**: 3

**Analysis**: FR-012 states "System MUST start with an empty 'Untitled' document" and User Story 2 mentions "empty editor ready for input." However, there's no definition of what "empty" looks like - completely blank, placeholder text, or a starter template. First-run experience is unspecified.

---

### 3. Error Display Mechanism in Status Bar

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: When the user clicks the error count in the status bar, what exactly happens? Does a panel open? Does focus jump to the editor? Is there a popover with error details? What happens if there are multiple errors?
- **Impact Score**: 4

**Analysis**: FR-031 says "display error count" and User Story 5 mentions "clicking the error count shows error details" or "focus moves to first error in preview." These are two different behaviors and neither is fully specified. The acceptance scenario uses "or" suggesting indecision.

---

### 4. Dialog Button Order and Focus

- **Category**: ux_flow
- **Status**: Missing
- **Question Candidate**: What is the button order in the dirty check dialog (Save | Don't Save | Cancel)? Which button has default focus? What keyboard shortcuts dismiss or confirm the dialog?
- **Impact Score**: 3

**Analysis**: User Story 4 lists dialog options but doesn't specify their order, which button is focused by default (usually Cancel for safety, or Save for convenience), or if Enter/Escape have special meaning. macOS HIG has specific guidance here that should be followed.

---

### 5. Preview Toggle Transition

- **Category**: ux_flow
- **Status**: Missing
- **Question Candidate**: When toggling preview visibility (Cmd+\), should there be an animation/transition? If so, how long? Does the split ratio persist when preview is re-shown?
- **Impact Score**: 2

**Analysis**: FR-004 states the editor "expands to fill space" when preview is hidden. User Story 6 mentions the preference persists. But the transition behavior (instant vs animated) and whether the previous split ratio is restored when preview is re-shown are undefined.

---

### 6. External File Modification Flow

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: When external file modification is detected, what is the complete user flow? Does a non-modal notification appear or a blocking dialog? If the user chooses "reload," is there an undo option? What happens if the document is dirty?
- **Impact Score**: 4

**Analysis**: Edge case mentions "prompt user to reload or keep current version" but the complete flow is undefined. What if the user has unsaved changes AND the file was modified externally? This creates a three-way conflict (original, local changes, external changes) with no specified resolution.

---

### 7. Orphaned Document Recovery

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: When a file is deleted/moved externally ("orphaned"), what specific UI appears? Is the status bar updated? Can the user continue editing? Does saving behave like Save-As automatically?
- **Impact Score**: 3

**Analysis**: Edge case mentions "show a warning and mark document as 'orphaned' with option to save elsewhere" but doesn't define the warning mechanism (dialog vs inline notification), how the status bar reflects this state, or whether subsequent save operations automatically trigger Save-As.

---

### 8. Rapid File Open Queuing

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: When user rapidly opens multiple files (e.g., double-clicking several files in Finder), what feedback indicates queuing is happening? Does a progress indicator show? Is there a way to cancel the queue?
- **Impact Score**: 2

**Analysis**: Edge case mentions "queue operations, show last opened file, maintain data integrity" but the UX for this queuing (is it visible? cancellable?) is undefined. Users may not realize multiple opens are pending.

---

### 9. Minimum Window Size Behavior

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: What are the specific minimum window dimensions? What happens to the split pane when approaching minimum size - does the preview collapse first, or do both panes scale proportionally until a threshold?
- **Impact Score**: 2

**Analysis**: Edge case mentions "enforce minimum window size, gracefully collapse panels below certain thresholds" but no specific dimensions or collapse priority is defined. FR-003 mentions "minimum widths for each pane" but doesn't specify values.

---

### 10. Screen Reader Status Bar Access

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: How is status bar information conveyed to screen readers? Are live regions (aria-live) used for dynamic updates like cursor position and error count? What announcement frequency is acceptable to avoid noise?
- **Impact Score**: 4

**Analysis**: NFR Accessibility states "status bar information must be available to screen readers" but doesn't specify how. Cursor position updates constantly - announcing every change would be overwhelming. Error count changes should likely be announced, but filename changes might be different.

---

### 11. Focus Management During Dialogs

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: After a dialog (dirty check, save-as) closes, where does focus return? To the editor? To the element that triggered the dialog? What if that element no longer exists?
- **Impact Score**: 3

**Analysis**: NFR Accessibility mentions "focus management must be logical during dialog flows" but doesn't specify the exact behavior. Focus restoration is critical for keyboard users but the spec leaves it to implementation discretion.

---

### 12. Keyboard Shortcut Conflicts

- **Category**: ux_flow
- **Status**: Missing
- **Question Candidate**: What happens if a keyboard shortcut conflicts with a browser/system shortcut or CodeMirror default? Is there a way for users to view all shortcuts? Is there a shortcut customization UI planned?
- **Impact Score**: 2

**Analysis**: User Story 7 lists shortcuts but doesn't address conflicts or discoverability. Cmd+W (close window) could conflict with system behavior. There's no mention of a keyboard shortcuts reference or customization.

---

### 13. Save Failure Recovery Flow

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: After a save failure (e.g., disk full), what is the complete recovery flow? Is there a retry option? Can the user navigate to a different save location from the error state? Is the error dismissible?
- **Impact Score**: 4

**Analysis**: FR-023 states "handle save errors gracefully, showing user-friendly error message and preserving editor content" but the specific error UI and recovery options are undefined. Edge case mentions "disk full" but only says "show clear error message."

---

### 14. Preview Compilation Timeout Behavior

- **Category**: ux_flow
- **Status**: Partial
- **Question Candidate**: What is the specific timeout duration for preview compilation? What UI indicates "loading" vs "timed out"? After timeout, can the user manually retry? Is partial content shown?
- **Impact Score**: 3

**Analysis**: Edge case mentions "show loading state, allow user to continue editing, timeout after reasonable period" but "reasonable period" is undefined. The visual distinction between "still compiling" and "gave up" is not specified.

---

### 15. Localization / Internationalization

- **Category**: ux_flow
- **Status**: Missing
- **Question Candidate**: Is localization in scope? Should all user-facing strings be externalized? What language is the default? Are RTL layouts considered?
- **Impact Score**: 3

**Analysis**: The spec contains no mention of localization or internationalization. All example text (dialog buttons, status bar labels) is in English with no indication of i18n infrastructure. This is either out of scope (should be explicit) or missing.

---

### 16. High Contrast / Reduced Motion Accessibility

- **Category**: ux_flow
- **Status**: Missing
- **Question Candidate**: Does the app respect system accessibility settings like increased contrast or reduced motion? Are there high-contrast variants for the status bar indicators?
- **Impact Score**: 3

**Analysis**: NFR Accessibility covers keyboard and screen reader concerns but doesn't mention visual accessibility features like high contrast mode or respecting prefers-reduced-motion for any animations.

---

### 17. Document State Persistence Across Crashes

- **Category**: ux_flow
- **Status**: Clear (explicitly out of scope)
- **Question Candidate**: N/A - Explicitly deferred
- **Impact Score**: N/A

**Analysis**: Edge case explicitly states "autosave/recovery (out of scope for this spec, but design should not preclude it)" - this is a clear acknowledgment with a constraint that enables future implementation.

---

### 18. Single Document Model User Flow

- **Category**: ux_flow
- **Status**: Clear
- **Question Candidate**: N/A - Assumption is explicit
- **Impact Score**: N/A

**Analysis**: Assumption 1 clearly states "single document model...Tab/multi-document support is a future enhancement." This scoping is clear.

---

### 19. Core Edit-Preview-Save Journey

- **Category**: ux_flow
- **Status**: Clear
- **Question Candidate**: N/A - Well defined
- **Impact Score**: N/A

**Analysis**: User Stories 1-3 comprehensively cover the primary edit-preview-save journey with clear acceptance scenarios and success criteria (SC-001 through SC-005).

---

### 20. Dirty Check Flow

- **Category**: ux_flow
- **Status**: Clear
- **Question Candidate**: N/A - Well defined
- **Impact Score**: N/A

**Analysis**: User Story 4 and FR-024 through FR-027 provide complete coverage of the dirty check flow with all three outcomes (save, discard, cancel) explicitly specified.

---

## Priority Recommendations

### High Priority (Impact 4+)
1. Loading states during file operations - No visual feedback defined
2. Error display mechanism in status bar - Ambiguous interaction behavior
3. External file modification flow - Three-way conflict unresolved
4. Screen reader status bar access - Accessibility compliance risk
5. Save failure recovery flow - Data safety UX incomplete

### Medium Priority (Impact 3)
1. Empty state for new documents - First-run experience undefined
2. Dialog button order and focus - Platform HIG compliance
3. Orphaned document recovery - Edge case UX incomplete
4. Focus management during dialogs - Keyboard accessibility gap
5. Preview compilation timeout - Recovery UX undefined
6. Localization / i18n - Needs explicit scoping
7. High contrast / reduced motion - Accessibility compliance

### Lower Priority (Impact 2)
1. Preview toggle transition - Polish/animation concern
2. Rapid file open queuing - Edge case feedback
3. Minimum window size behavior - Responsive design detail
4. Keyboard shortcut conflicts - Discoverability concern

---

## Conclusion

The spec is strong on core user journeys (edit, save, open, close with dirty check) but has gaps in error/loading states and accessibility implementation details. The highest-impact clarifications needed are around visual feedback during async operations and the specific mechanism for surfacing errors to users (both visually and for assistive technology).
