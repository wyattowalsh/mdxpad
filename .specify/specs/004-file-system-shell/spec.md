# Feature Specification: File System Shell

**Feature Branch**: `004-file-system-shell`
**Created**: 2026-01-09
**Status**: Draft
**Input**: User description: "Implement file system operations for mdxpad in the Electron main process. This lane owns file open/save/watch operations, IPC handlers, and native dialogs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Existing File (Priority: P1)

As a user, I want to use Cmd+O to open a file dialog, select an .mdx or .md file, and see its contents loaded in the editor so I can edit existing documents.

**Why this priority**: Opening files is the most fundamental file operation. Without it, users cannot work with their existing content. This is the entry point for the entire file workflow.

**Independent Test**: Can be fully tested by launching the app, pressing Cmd+O, selecting a test .mdx file, and verifying the content appears in the editor. Delivers immediate value by enabling access to existing documents.

**Acceptance Scenarios**:

1. **Given** the app is open with a blank document, **When** I press Cmd+O and select a valid .mdx file, **Then** the file contents appear in the editor and the window title shows the filename.
2. **Given** the app is open, **When** I press Cmd+O and cancel the dialog, **Then** nothing changes and no error is shown.
3. **Given** the app is open, **When** I try to open a file that no longer exists, **Then** I see a user-friendly error message explaining the file was not found.
4. **Given** the app is open, **When** I try to open a file I don't have permission to read, **Then** I see a user-friendly error message explaining access was denied.

---

### User Story 2 - Save File (Priority: P1)

As a user, I want to use Cmd+S to save my current document. If it's untitled, a save dialog appears. If it already has a path, it saves directly, so my work is persisted.

**Why this priority**: Saving is equally critical to opening. Users must be able to persist their work or data loss occurs. This completes the basic read/write cycle.

**Independent Test**: Can be fully tested by creating content, pressing Cmd+S, and verifying the file is written to disk with correct contents. Delivers immediate value by preventing data loss.

**Acceptance Scenarios**:

1. **Given** I have an untitled document with content, **When** I press Cmd+S, **Then** a save dialog appears allowing me to choose location and filename.
2. **Given** I have a previously saved document with changes, **When** I press Cmd+S, **Then** the file is saved silently without a dialog and the dirty indicator clears.
3. **Given** I save to a location without write permission, **When** the save fails, **Then** I see a user-friendly error message and my content is preserved in the editor.
4. **Given** I cancel the save dialog for an untitled document, **When** the dialog closes, **Then** my content remains in the editor unchanged.

---

### User Story 3 - Save As (Priority: P1)

As a user, I want to use Cmd+Shift+S to save my document to a new location so I can create copies or rename files.

**Why this priority**: Save As completes the core save functionality by enabling file duplication and renaming, which are essential workflows for document management.

**Independent Test**: Can be fully tested by opening an existing file, pressing Cmd+Shift+S, choosing a new location, and verifying both files exist with correct contents.

**Acceptance Scenarios**:

1. **Given** I have a document with a path, **When** I press Cmd+Shift+S and choose a new location, **Then** the file is saved to the new location and the editor now references the new path.
2. **Given** I have an untitled document, **When** I press Cmd+Shift+S, **Then** a save dialog appears (same behavior as Cmd+S for untitled).
3. **Given** I cancel the Save As dialog, **When** the dialog closes, **Then** the document retains its original path (or remains untitled).

---

### User Story 4 - New File (Priority: P1)

As a user, I want to use Cmd+N to create a new untitled document so I can start fresh content.

**Why this priority**: Creating new documents is a fundamental workflow that enables users to begin creating content from scratch.

**Independent Test**: Can be fully tested by pressing Cmd+N and verifying a new empty editor appears. Delivers immediate value as the starting point for new content.

**Acceptance Scenarios**:

1. **Given** I have a document open, **When** I press Cmd+N, **Then** a new untitled document appears in the editor.
2. **Given** I create a new document, **When** it appears, **Then** the window title shows "Untitled" and the document is empty.

---

### User Story 5 - Dirty State Warning (Priority: P1)

As a user, when I try to close a document with unsaved changes, I want to see a confirmation dialog so I don't accidentally lose work.

**Why this priority**: Preventing data loss is critical to user trust. Users must be warned before discarding unsaved work.

**Independent Test**: Can be fully tested by making changes to a document, attempting to close the window, and verifying a confirmation dialog appears with save/discard/cancel options.

**Acceptance Scenarios**:

1. **Given** I have unsaved changes, **When** I try to close the window, **Then** a dialog asks if I want to save, discard, or cancel.
2. **Given** I choose "Save" in the dialog, **When** the save completes, **Then** the window closes.
3. **Given** I choose "Discard" in the dialog, **When** I confirm, **Then** the window closes without saving.
4. **Given** I choose "Cancel" in the dialog, **When** I confirm, **Then** the window remains open with my content intact.
5. **Given** I have no unsaved changes, **When** I close the window, **Then** it closes immediately without a dialog.

---

### User Story 6 - External File Change Detection (Priority: P2)

As a user, if the file I'm editing changes on disk (external edit), I want to be notified and can choose to reload or keep my version so I stay aware of external changes.

**Why this priority**: File watching prevents data loss from external edits and enables workflows where files are modified by other tools. Lower priority than core CRUD operations.

**Independent Test**: Can be fully tested by opening a file, modifying it externally (e.g., via terminal), and verifying a notification appears with reload/keep options.

**Acceptance Scenarios**:

1. **Given** I have a file open without local changes, **When** the file changes on disk, **Then** I see a notification asking if I want to reload.
2. **Given** I have a file open with local changes, **When** the file changes on disk, **Then** I see a notification warning about the conflict and offering options.
3. **Given** I choose to reload, **When** confirmed, **Then** the editor content updates to the disk version.
4. **Given** I choose to keep my version, **When** confirmed, **Then** my editor content remains and the dirty state is preserved.

---

### User Story 7 - Recent Files (Priority: P2)

As a user, I want to see and open recently opened files from the File menu so I can quickly access my work.

**Why this priority**: Recent files improve productivity by reducing navigation time. Nice-to-have after core operations are complete.

**Independent Test**: Can be fully tested by opening several files, checking the File menu, and verifying recently opened files appear and can be reopened.

**Acceptance Scenarios**:

1. **Given** I have opened files previously, **When** I open the File menu, **Then** I see a "Recent Files" submenu with up to 10 recently opened files.
2. **Given** I select a file from Recent Files, **When** clicked, **Then** that file opens in the editor.
3. **Given** a recent file no longer exists, **When** I try to open it, **Then** I see an error and it is removed from the recent list.

---

### Edge Cases

- What happens when the file is deleted while being edited? (User is notified, file watching detects deletion)
- How does the system handle extremely large files (>10MB)? (Per Constitution Article V: must open within 2 seconds)
- What happens when disk is full during save? (User-friendly error message, content preserved in editor)
- What happens when file is locked by another process? (Permission denied error shown)
- How are binary files handled when accidentally selected? (Filtered out by dialog, or graceful error if opened)
- What happens when app crashes with unsaved work? (On next launch, recovery dialog shows list of recoverable files; user chooses which to restore)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement all file IPC channels defined in `src/shared/types/ipc.ts`: `mdxpad:file:open`, `mdxpad:file:save`, `mdxpad:file:save-as`, `mdxpad:file:read`, `mdxpad:file:write`
- **FR-002**: System MUST implement window IPC channels: `mdxpad:window:close`, `mdxpad:window:minimize`, `mdxpad:window:maximize`, `mdxpad:app:version`, `mdxpad:app:ready`
- **FR-003**: System MUST use native dialogs for file open/save operations with filters for `.mdx` and `.md` file types
- **FR-004**: System MUST track open files using the `FileHandle` and `FileState` types from `src/shared/types/file.ts`
- **FR-005**: System MUST maintain dirty state by comparing current content with last saved content
- **FR-006**: System MUST generate unique `FileId` for untitled files using `createFileId()` function
- **FR-007**: System MUST return typed `FileResult<T>` for all file operations, never exposing raw errors
- **FR-008**: System MUST handle error codes: `NOT_FOUND`, `PERMISSION_DENIED`, `CANCELLED`, `UNKNOWN`
- **FR-009**: System MUST validate all IPC payloads using zod schemas on both ends (per Constitution Section 3.3)
- **FR-010**: System MUST watch open files for external changes using file system watching
- **FR-011**: System MUST debounce file change events (500ms) to prevent rapid-fire notifications
- **FR-012**: System MUST stop watching files when they are closed
- **FR-013**: System MUST maintain a recent files list with maximum 10 entries
- **FR-014**: System MUST auto-save dirty files every 30 seconds to a temporary location (per Constitution Section 7.3)
- **FR-015**: System MUST on app launch detect recoverable auto-saved files and show a dialog listing them; user selects which files to restore
- **FR-016**: System MUST show confirmation dialog before closing window with unsaved changes
- **FR-017**: System MUST log all file operation errors to the main process console

### Key Entities

- **FileHandle**: Represents a reference to a file, containing unique id, path (null for untitled), and display name
- **FileState**: Runtime state of an open file including handle, current content, saved content, and dirty flag
- **FileResult**: Discriminated union for operation outcomes (success with value or failure with typed error)
- **FileError**: Typed error with codes: NOT_FOUND, PERMISSION_DENIED, CANCELLED, UNKNOWN
- **FileId**: Branded string type for unique file identification

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open a 1MB file within 500ms (per Constitution Article V)
- **SC-002**: Users can open a 10MB file within 2 seconds (per Constitution Article V)
- **SC-003**: All IPC channels validate payloads with zod and reject invalid payloads
- **SC-004**: Dirty state correctly reflects when content differs from last saved version (100% accuracy)
- **SC-005**: File watcher detects external file changes within 1 second of modification
- **SC-006**: Error messages are user-friendly and actionable (no stack traces, no technical jargon)
- **SC-007**: Auto-save successfully preserves content every 30 seconds when document is dirty
- **SC-008**: Build pipeline passes: `pnpm typecheck`, `pnpm lint`, `pnpm build` all succeed
- **SC-009**: Window close with unsaved changes always prompts user (0% data loss from accidental close)
- **SC-010**: Recent files list persists across app restarts

## Clarifications

### Session 2026-01-09

- Q: How should auto-save recovery be offered to users on app launch? → A: On app launch, show dialog listing recoverable files; user chooses which to restore

## Assumptions

- The existing type definitions in `src/shared/types/file.ts` and `src/shared/types/ipc.ts` are complete and correct (READ-ONLY dependency from Spec 001)
- Electron 39.x APIs are available for dialogs, file system operations, and IPC
- macOS is the target platform (per Constitution: macOS-only through v2.0)
- A suitable file watching library (e.g., chokidar) is available and compatible with Electron 39.x
- Auto-save temporary files will be stored in a standard temp directory accessible to the app
- The renderer process will expose keyboard shortcuts (Cmd+O, Cmd+S, etc.) that invoke these IPC handlers
