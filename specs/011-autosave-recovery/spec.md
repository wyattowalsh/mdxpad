# Feature Specification: Autosave & Crash Recovery

**Feature Branch**: `011-autosave-recovery`
**Created**: 2026-01-17
**Status**: Draft
**Input**: User description: "Autosave & Crash Recovery - Automatic saving of document changes at configurable intervals. Crash recovery that restores unsaved work on application restart. Recovery dialog showing recoverable documents with preview. Integration with document store for dirty state tracking."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Background Saving (Priority: P1)

As a user editing an MDX document, I want my changes to be automatically saved in the background so that I don't lose work if I forget to manually save or if something unexpected happens.

**Why this priority**: This is the core value proposition - preventing data loss is the primary user need. Without autosave, users risk losing significant work.

**Independent Test**: Can be fully tested by editing a document, waiting for the autosave interval to pass, and verifying that changes are persisted to a recovery location. Delivers immediate protection against data loss.

**Acceptance Scenarios**:

1. **Given** a document with unsaved changes, **When** the configured autosave interval elapses, **Then** the document content (full MDX text including frontmatter) is saved to a recovery location without user intervention
2. **Given** an autosave in progress, **When** the user continues typing, **Then** the autosave completes without blocking the main thread for more than 16ms (one frame at 60fps)
3. **Given** autosave is enabled, **When** the user makes a change, **Then** the dirty state indicator reflects unsaved changes; autosave completion does NOT clear the dirty indicator (only manual save clears it)

---

### User Story 2 - Crash Recovery on Restart (Priority: P1)

As a user who experienced an unexpected application exit (crash, power loss, forced quit), I want to recover my unsaved work when I restart the application so that I don't lose my progress.

**Why this priority**: Equal priority to autosave - recovery is the payoff of autosave. Without recovery, autosave provides no value to users.

**Independent Test**: Can be tested by simulating an app crash after making unsaved changes, then restarting and verifying that a recovery dialog appears offering to restore the work.

**Acceptance Scenarios**:

1. **Given** the application crashed with autosaved content, **When** the application restarts, **Then** a recovery dialog is displayed offering to restore unsaved work
2. **Given** the recovery dialog is shown, **When** the user accepts recovery, **Then** the recovered document opens with the autosaved content intact
3. **Given** the recovery dialog is shown, **When** the user declines recovery, **Then** the recovery data is discarded and the user can start fresh

---

### User Story 3 - Recovery Dialog with Preview (Priority: P2)

As a user with multiple recoverable documents, I want to preview what will be recovered before accepting so that I can make an informed decision about which documents to restore.

**Why this priority**: Enhances the recovery experience but not strictly necessary for basic data protection.

**Independent Test**: Can be tested by having multiple autosaved documents, triggering recovery flow, and verifying preview content is displayed for each recoverable document.

**Acceptance Scenarios**:

1. **Given** multiple documents have recovery data, **When** the recovery dialog opens, **Then** all recoverable documents are listed with identifying information (file path, document title if available, timestamp of last autosave, character count, first 100 characters preview)
2. **Given** a recoverable document in the list, **When** the user selects it, **Then** a preview of the document content is displayed
3. **Given** multiple recoverable documents, **When** the user selects specific documents to recover, **Then** only the selected documents are restored

---

### User Story 4 - Autosave Configuration (Priority: P3)

As a user, I want to configure autosave settings (interval, enable/disable) so that I can balance data protection with system resources based on my preferences.

**Why this priority**: Important for user control but autosave should work well with sensible defaults. Most users won't change these settings.

**Independent Test**: Can be tested by accessing settings, modifying autosave interval, and verifying the new interval is applied to subsequent autosave operations.

**Acceptance Scenarios**:

1. **Given** the settings panel is open, **When** the user adjusts the autosave interval, **Then** the new interval is applied immediately
2. **Given** autosave is enabled, **When** the user disables autosave, **Then** no automatic saves occur until re-enabled
3. **Given** a custom interval is set, **When** the application restarts, **Then** the configured interval persists

---

### Edge Cases (Resolved)

| Edge Case | Resolution |
|-----------|------------|
| EC-1: Disk space insufficient | Show warning notification, skip autosave attempt, retry on next interval. Notification includes "Open Disk Utility" action. (FR-017) |
| EC-2: Document is read-only or locked | Skip autosave for read-only/locked documents. Show "Autosave unavailable" status. (FR-018) |
| EC-3: Application exits during autosave write | Atomic write pattern (temp file + rename) ensures recovery file integrity. (FR-015) |
| EC-4: Source file modified externally | Show conflict warning with diff view, let user choose version. (FR-016) |
| EC-5: Recovery data corrupted or incomplete | Validate recovery file checksum on load. Show error in dialog with "Discard corrupted" option. (FR-019) |
| EC-6: Large documents exceed autosave interval | Skip overlapping autosave if previous write still in progress. Queue at most one pending. Show "Saving..." indicator if save exceeds 2 seconds. (FR-020) |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically save document content to a recovery location at configurable intervals
- **FR-002**: System MUST track dirty state (unsaved changes) for each open document
- **FR-003**: System MUST detect on startup whether recovery data exists from a previous session
- **FR-004**: System MUST display a recovery dialog when recoverable documents are detected
- **FR-005**: System MUST allow users to preview recoverable document content before accepting recovery
- **FR-006**: System MUST restore selected documents to their autosaved state when user accepts recovery
- **FR-007**: System MUST discard recovery data only when user explicitly clicks "Decline"; dismissing the dialog (ESC key or X button) preserves recovery data for next startup. Recovery dialog is modal; clicking outside does NOT dismiss it (prevents accidental data loss).
- **FR-008**: System MUST clear recovery data after a document is successfully manually saved
- **FR-009**: System MUST provide settings to configure autosave interval (minimum 5 seconds, maximum 30 seconds) — per Constitution Article VII.3 mandate
- **FR-010**: System MUST provide a setting to enable or disable autosave functionality
- **FR-011**: System MUST persist autosave settings across application restarts
- **FR-012**: System MUST integrate with the document store to reflect dirty state accurately
- **FR-013**: System MUST handle autosave failures by showing a status indicator (16x16px icon-only, muted color, no text) and displaying a dismissible toast notification after 3 consecutive failures. Toast auto-dismisses after 8 seconds, includes "Retry Now" primary action and "Disable Autosave" secondary action, and persists if user hovers over it.
- **FR-014**: System MUST support recovery of multiple documents from a single crash event
- **FR-015**: System MUST use atomic write pattern (write to temp file, then rename) to prevent recovery file corruption during crashes
- **FR-016**: System MUST detect when source file was modified externally and present a conflict resolution dialog with diff view (using diff-match-patch library, side-by-side display mode), allowing user to choose: keep recovery version, keep disk version, or save as new file. If diff computation fails, show both versions without highlighting.
- **FR-017**: System MUST detect insufficient disk space (<100MB available) before autosave write, emit warning event, show notification with "Open Disk Utility" action, skip autosave attempt, and retry on next interval
- **FR-018**: System MUST skip autosave for read-only documents (external file permissions) and locked documents (open by another process). Status indicator should show "Autosave unavailable: [reason]" state.
- **FR-019**: System MUST validate recovery file checksum on load. Corrupted entries show error in recovery dialog with "Discard corrupted" option. Corruption events are logged for debugging.
- **FR-020**: System MUST skip overlapping autosave if previous write still in progress. Queue at most one pending autosave. Show "Saving..." indicator if save exceeds 2 seconds. Emit "slow-save" warning after 2x interval.
- **FR-021**: System MUST automatically delete recovery files older than 7 days. Maximum 50 recovery files retained; oldest deleted when exceeded. Cleanup runs on app startup.

### Key Entities

- **RecoveryFile**: Represents an autosaved backup of document content; contains document identifier, content snapshot, timestamp, and original file path reference
- **AutosaveSettings**: User preferences for autosave behavior; contains enabled flag (default: true), interval duration (default: 30000ms, range: 5000-30000ms), and retention settings (maxAgeDays: 7, maxFiles: 50)
- **DirtyState**: Tracks whether a document has unsaved changes; synchronized with document store; cleared ONLY on successful manual save (File > Save or Cmd+S), NOT on autosave completion
- **RecoveryManifest**: Index of all recoverable documents from previous sessions; enables recovery dialog to list available documents

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can recover at least 95% of their work after an unexpected application exit. Measurement: Recovery file contains document content captured within (autosave_interval + 2s debounce) before crash. Validated by comparing recovery file timestamp to crash timestamp in E2E tests.
- **SC-002**: Autosave operations MUST NOT block main thread for more than 16ms (one frame at 60fps). Measurement: performance.now() timing in unit tests with 1MB+ documents.
- **SC-003**: Recovery dialog presents all recoverable documents within 2 seconds of application start. Measurement: Time from app ready event to dialog fully rendered with 10 recovery files.
- **SC-004**: Users can preview and selectively recover documents in under 30 seconds total interaction time. Measurement: Manual test timing with 5 documents.
- **SC-005**: Autosave setting changes take effect immediately without requiring application restart
- **SC-006**: Zero data loss events in adversarial testing scenarios (process kill during save, corrupt manifest mid-write, disk full simulation)

## Clarifications

### Session 2026-01-17

> Note: Answered clarifications are now encoded in FRs. See FR-015 (atomic writes), FR-016 (conflict resolution), FR-007 (dismiss behavior), FR-013 (failure notification).

- Q: Where should recovery files be stored? → A: Electron's userData directory via `app.getPath('userData')/recovery`

## Assumptions

- The application has an existing document store implementation that tracks document state
- File system access is available for storing recovery data (builds on Spec 004 - File System Shell)
- The application runs in an Electron environment with access to local storage paths
- Users primarily work with single documents at a time, though multiple document recovery is supported
- Recovery files are stored in Electron's userData directory (`app.getPath('userData')/recovery`), separate from user documents
- Default autosave interval of 30 seconds balances protection with performance

## Dependencies

- **004-file-system-shell**: File system access for reading/writing recovery files
- **Document Store**: Integration point for dirty state tracking (assumed existing from application architecture)
