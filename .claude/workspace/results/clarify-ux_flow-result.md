# UX Flow Ambiguity Analysis

**Spec**: `specs/011-autosave-recovery/spec.md`
**Category**: UX Flow
**Analysis Date**: 2026-01-17

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 3 |
| Partial | 6 |
| Missing | 5 |

---

## Findings

### 1. Recovery Dialog Dismissal Behavior

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: What should happen when a user dismisses the recovery dialog without explicitly accepting or declining (e.g., pressing Escape, clicking outside the modal, closing the window)? Should recovery data be preserved for the next startup, discarded, or should dismissal be prevented?
- **Impact Score**: 4

**Analysis**: The spec describes that users can accept or decline recovery (FR-006, FR-007), but does not specify what happens if the user dismisses the dialog without making a choice. This is a common interaction pattern that needs explicit definition to avoid data loss ambiguity.

---

### 2. Multiple Document Recovery Selection UX

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: What UI pattern should be used for selecting multiple documents in the recovery dialog? (e.g., checkboxes with individual selection, multi-select list, toggle switches, "Recover All" + "Recover Selected" buttons, or drag-select)
- **Impact Score**: 3

**Analysis**: User Story 3 and FR-014 mention "select specific documents to recover" and support for "multiple documents from a single crash event" but the interaction pattern is not defined. The selection mechanism significantly affects the user experience when many documents need recovery.

---

### 3. Autosave Progress/Status Indicator

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: Should autosave provide any visual feedback to the user? If so, what form should it take (status bar message like "Autosaved at 2:30 PM", subtle icon change, transient toast notification, or completely invisible operation) and how long should feedback persist?
- **Impact Score**: 3

**Analysis**: The spec emphasizes autosave should happen "without interrupting the user's editing flow" (Acceptance Scenario 2) and "without perceptible interruption" (SC-002), but does not specify whether any visual feedback should be provided. Users often want reassurance that their work is being protected.

---

### 4. Error State: Autosave Failure Notification

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: When autosave fails (e.g., disk full, permissions error, file locked), should the user be notified? If yes, how (non-blocking status bar warning, toast notification, modal alert)? If no, how will users know their work is not protected?
- **Impact Score**: 5

**Analysis**: FR-013 states the system "MUST handle autosave failures gracefully without disrupting user workflow" but does not specify if/how failures should be communicated to users. Silent failure could lead users to falsely believe their work is protected. This is a critical UX decision that directly impacts user trust and data safety perception.

---

### 5. Error State: Recovery Data Corruption

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: How should the UI handle corrupted or incomplete recovery data? Should it: (a) show a partial preview with a warning badge, (b) omit the corrupted document from the list entirely, (c) display an error message explaining partial recovery is possible, or (d) show the document grayed out with an error indicator?
- **Impact Score**: 4

**Analysis**: Edge cases mention "What happens when recovery data is corrupted or incomplete?" but no UX flow is defined. Users need to understand why a document they expected to recover is unavailable or only partially recoverable.

---

### 6. Loading State: Recovery Dialog Population

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: What loading state should be shown while the recovery dialog is scanning and populating the list of recoverable documents? (e.g., spinner with "Scanning for recoverable documents...", skeleton UI with placeholder items, progressive loading where each document appears as discovered)
- **Impact Score**: 2

**Analysis**: SC-003 specifies recovery dialog should present documents "within 2 seconds of application start" but no loading state is defined for this window. For large recovery sets or slow storage, users need feedback that the scan is in progress.

---

### 7. Empty State: No Recoverable Documents After Dialog Opens

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: If the recovery dialog opens because initial detection indicated recovery data exists, but validation finds all recovery files are invalid or empty, should the dialog: (a) close automatically with no message, (b) show an empty state with explanation text, (c) show an error dialog, or (d) never open in the first place (defer validation to before dialog)?
- **Impact Score**: 2

**Analysis**: FR-004 states the dialog appears "when recoverable documents are detected" implying detection happens before the dialog opens. However, the timing of validation versus detection is unclear, and the edge case of "all detected files turn out to be invalid" is not addressed.

---

### 8. Dirty State Indicator Location and Style

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: Where should the dirty state indicator be displayed (tab title with asterisk, status bar icon, document title area, window title bar) and what visual style should it use (asterisk prefix, dot indicator, color change, icon)?
- **Impact Score**: 3

**Analysis**: User Story 1 Acceptance Scenario 3 mentions "dirty state indicator reflects unsaved changes" and FR-002/FR-012 reference dirty state tracking, but the visual representation and placement are not specified. This is a visible UI element users interact with mentally throughout their editing session.

---

### 9. Settings Panel Access and Integration

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: How do users access autosave settings? Is there an existing application settings panel to integrate with (from another spec), or does this feature need to define a new settings UI? What is the navigation path to these settings (menu item, keyboard shortcut, command palette)?
- **Impact Score**: 3

**Analysis**: User Story 4 references "the settings panel is open" for autosave configuration, but doesn't specify how users reach it or whether this assumes an existing settings infrastructure. The spec lists dependencies on 004-file-system-shell and Document Store, but not on any settings/preferences spec.

---

### 10. Recovery Dialog Timing and Modality

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: At what point in the application startup sequence should the recovery dialog appear (before main window, after main window loads but before user can interact, or overlaid on the main window)? Should the dialog be modal (blocking all other interaction) or non-modal (allowing the user to dismiss and access the app)?
- **Impact Score**: 3

**Analysis**: The spec states recovery dialog appears "on startup" and "when the application restarts" but doesn't specify the precise timing in the startup sequence or whether users can interact with the main application while the dialog is shown. This affects whether users can compare the recovery version with existing files.

---

### 11. Keyboard Accessibility for Recovery Dialog

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: What keyboard accessibility requirements apply to the recovery dialog? Specifically: Tab navigation order between document list and buttons, Enter key behavior (accept focused item vs. confirm dialog), Escape key behavior (decline? close without action?), and ARIA labels for screen reader users.
- **Impact Score**: 4

**Analysis**: No accessibility considerations are mentioned for the recovery dialog. Given that this is a critical workflow (data recovery), keyboard navigation, screen reader support, and focus management are essential for users who cannot use a mouse.

---

### 12. Autosave Timer Reset Conditions

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: How does the autosave timer behave? Options: (a) fixed interval from app start regardless of activity, (b) interval resets after each user edit (debounce-style, only saves after period of inactivity), (c) interval resets after each successful autosave. Which model provides the most predictable user experience?
- **Impact Score**: 3

**Analysis**: The spec mentions autosave occurs "at configurable intervals" (FR-001, FR-009) but doesn't clarify the timer behavior. This affects user mental model of when their work will be saved. The debounce model (reset on edit) is common but different from a fixed cadence model.

---

### 13. Recovery Preview Content Format

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: What should the recovery preview display for each document? Options: (a) raw MDX source text (first N lines or characters), (b) rendered preview of the MDX content, (c) metadata only (filename, last modified time, word count, size), (d) diff view showing changes since last manual save. What level of detail helps users make informed decisions?
- **Impact Score**: 3

**Analysis**: FR-005 requires users to "preview recoverable document content before accepting recovery" but doesn't specify the preview format. The preview content significantly affects users' ability to identify documents and assess recovery value. For MDX documents, rendered vs. raw source is a meaningful distinction.

---

### 14. Localization/Internationalization

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: Does this feature need to support localization/internationalization? If so, which strings need externalization (recovery dialog labels, error messages, settings labels, status messages), and how should date/time formatting in "last modified" timestamps be handled for different locales?
- **Impact Score**: 2

**Analysis**: No localization requirements are mentioned. User-facing strings include: "Recover", "Discard", "Autosave interval", error messages, and potentially timestamp displays. If the application targets international users, these need i18n consideration.

---

## Clear Items (No Ambiguity)

### 1. Basic Autosave Flow
- **Status**: Clear
- **Analysis**: User Story 1 provides a complete journey: user edits document -> interval elapses -> content saved to recovery location. Acceptance scenarios cover the core flow, concurrent editing, and dirty state reflection.

### 2. Accept/Decline Recovery Binary Choice
- **Status**: Clear
- **Analysis**: FR-006 and FR-007 clearly define that accepting recovery opens the document with autosaved content intact, while declining discards recovery data and lets the user start fresh.

### 3. Settings Persistence Across Restarts
- **Status**: Clear
- **Analysis**: FR-011 explicitly states "System MUST persist autosave settings across application restarts" and User Story 4 Acceptance Scenario 3 confirms this with a testable scenario.

---

## Recommendations

### High Priority (Impact 4-5)
1. **Autosave Failure Notification** (Impact 5) - Critical: Define how users learn when autosave fails. Silent failure vs. notification has major trust implications.
2. **Recovery Data Corruption Handling** (Impact 4) - Define UX for corrupted/incomplete recovery files.
3. **Recovery Dialog Dismissal** (Impact 4) - Clarify what happens on Escape/click-outside.
4. **Keyboard Accessibility** (Impact 4) - Document keyboard navigation and screen reader support for recovery dialog.

### Medium Priority (Impact 3)
5. **Autosave Status Indicator** - Determine if/how successful autosaves are communicated.
6. **Multiple Document Selection UI** - Define selection pattern (checkboxes, multi-select, etc.).
7. **Dirty State Indicator Design** - Specify location and visual style.
8. **Settings Panel Access** - Define navigation path to autosave settings.
9. **Recovery Dialog Modality** - Specify timing and whether dialog is modal.
10. **Autosave Timer Behavior** - Document reset conditions.
11. **Recovery Preview Format** - Specify content shown in preview.

### Lower Priority (Impact 2)
12. **Loading State** - Define recovery dialog loading indicator.
13. **Empty State After Detection** - Handle edge case of invalid recovery files.
14. **Localization** - Determine i18n requirements.

---

## Appendix: UX Flow Coverage Checklist

| Topic | Coverage | Notes |
|-------|----------|-------|
| Happy path - autosave | Yes | User Story 1 well-defined |
| Happy path - recovery accept | Yes | User Story 2 well-defined |
| Happy path - recovery decline | Yes | User Story 2 well-defined |
| Happy path - preview/select | Partial | Flow defined, UI pattern not |
| Happy path - settings | Partial | Behavior defined, access path not |
| Empty state | Partial | Implied but edge case not explicit |
| Loading state | No | Not addressed |
| Error state - autosave failure | No | Mentioned but UX not defined |
| Error state - recovery failure | No | Not addressed |
| Keyboard accessibility | No | Not addressed |
| Screen reader support | No | Not addressed |
| Focus management | No | Not addressed |
| Localization | No | Not addressed |
| Visual feedback | Partial | Dirty state mentioned, style not |
| Dialog dismissal | No | Not addressed |
