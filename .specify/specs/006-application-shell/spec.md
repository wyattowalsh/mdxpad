# Feature Specification: Application Shell

**Feature Branch**: `006-application-shell`
**Created**: 2026-01-10
**Status**: Draft
**Input**: User description: "Core application shell integrating editor, preview, and file operations into a cohesive document-editing experience. Includes resizable split-pane layout, document state management (Zustand store for current file, content, dirty state), settings/preferences infrastructure (electron-store persistence), status bar (file name, line/col, dirty indicator, error count), and complete document lifecycle (new, open, edit, save, close with dirty check). This is the glue spec that wires all existing components together into a functional MDX editor."

---

## Executive Summary

The Application Shell transforms mdxpad from a collection of isolated components into a cohesive, professional MDX editing environment. It provides the foundational architecture that:

1. **Unifies existing components** - Wires together the CodeMirror editor, MDX preview pane, command palette, and file operations into a seamless workflow
2. **Manages document lifecycle** - Tracks the complete journey from new/open through edit to save/close with data safety guarantees
3. **Provides professional layout** - Delivers a resizable split-pane interface that users expect from modern editors
4. **Persists user preferences** - Remembers layout choices and settings across sessions
5. **Surfaces contextual status** - Keeps users informed with file state, cursor position, and error information

This is the "glue spec" that makes all previous work usable as an actual application.

---

## Clarifications

### Session 2026-01-10

- Q: Should external file modification detection be in scope (basic detection on window focus) or completely deferred? → A: Detect on window focus only (no continuous watching)
- Q: What specific minimum width should be enforced for each pane? → A: 100px minimum (just enough to grab divider back)
- Q: What should happen when the user clicks the error count in the status bar? → A: All three actions: jump to first error line in editor, show error details popover, and scroll preview to show error
- Q: After how many seconds should preview compilation timeout? → A: 3 seconds (6x the 500ms normal target)
- Q: Should there be a maximum document size limit? → A: No arbitrary limit; trust existing safeguards (3s compilation timeout handles performance issues)

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit and Preview MDX Content (Priority: P1)

A writer opens mdxpad and immediately sees a split-pane interface with an editor on the left and a live preview on the right. As they type MDX content, the preview updates in real-time showing the rendered output. They can resize the divider to allocate more space to either pane, and the layout remembers their preference for next time.

**Why this priority**: This is the core value proposition of mdxpad - a live MDX editing experience. Without this, there is no product.

**Independent Test**: Can be fully tested by launching the app, typing in the editor, and verifying the preview updates. Delivers immediate editing value.

**Acceptance Scenarios**:

1. **Given** the app launches, **When** the main window appears, **Then** the user sees a split-pane layout with editor on left and preview on right with a draggable divider between them
2. **Given** the editor contains MDX content, **When** the user types additional content, **Then** the preview updates to reflect the changes within 500ms of typing pause
3. **Given** the user drags the divider, **When** they release the divider, **Then** the new split ratio is preserved and restored on next app launch
4. **Given** the preview pane is visible, **When** the user toggles preview off (via command palette or keyboard shortcut), **Then** the editor expands to fill the available space

---

### User Story 2 - Create and Save New Document (Priority: P1)

A writer starts mdxpad to create a new MDX document. They see an empty editor ready for input with "Untitled" shown in the status bar. After writing content, they save the file using Cmd+S, which prompts them to choose a location and filename. The status bar updates to show the saved filename and the dirty indicator clears.

**Why this priority**: File persistence is essential - users must be able to save their work. Tied for P1 because editing without saving is useless.

**Independent Test**: Can be tested by launching app, typing content, pressing Cmd+S, selecting a save location, and verifying the file exists on disk with correct content.

**Acceptance Scenarios**:

1. **Given** the app launches fresh, **When** the main window appears, **Then** the editor is empty and the status bar shows "Untitled"
2. **Given** the user has typed content in an untitled document, **When** they trigger save (Cmd+S or command palette), **Then** a save dialog appears prompting for filename and location
3. **Given** the user completes the save dialog, **When** the save succeeds, **Then** the status bar updates to show the filename and the dirty indicator disappears
4. **Given** the user has saved content, **When** they make additional changes, **Then** a dirty indicator appears in the status bar

---

### User Story 3 - Open Existing Document (Priority: P1)

A writer wants to continue working on an existing MDX file. They use Cmd+O or the command palette to open a file. After selecting a file, the editor loads the content and the preview renders it. The status bar shows the filename and path.

**Why this priority**: Opening existing files is as fundamental as saving - users need to access their previous work.

**Independent Test**: Can be tested by creating an MDX file externally, opening it via the app, and verifying content appears correctly in editor and preview.

**Acceptance Scenarios**:

1. **Given** the user triggers open file (Cmd+O or command palette), **When** the file dialog appears, **Then** it filters for MDX/MD files by default
2. **Given** the user selects a valid MDX file, **When** the file loads, **Then** the content appears in the editor and the preview renders it
3. **Given** a file is opened, **When** it finishes loading, **Then** the status bar shows the filename and the cursor is positioned at the start of the document
4. **Given** there are unsaved changes in the current document, **When** the user tries to open another file, **Then** a confirmation dialog appears asking to "Save", "Don't Save", or "Cancel" (per macOS convention)

---

### User Story 4 - Safe Document Close with Dirty Check (Priority: P2)

A writer has made changes to a document but tries to close the app or open a different file without saving. The app warns them about unsaved changes and offers options to save, discard, or cancel the action. This prevents accidental data loss.

**Why this priority**: Data safety is critical for user trust, but depends on P1 stories being functional first.

**Independent Test**: Can be tested by making changes, attempting to close, and verifying the warning appears with correct options.

**Acceptance Scenarios**:

1. **Given** a document has unsaved changes, **When** the user attempts to close the window, **Then** a dialog appears with "Save", "Don't Save", and "Cancel" options
2. **Given** the dirty check dialog is shown, **When** the user clicks "Save", **Then** the document is saved and the window closes
3. **Given** the dirty check dialog is shown, **When** the user clicks "Don't Save", **Then** the changes are discarded and the window closes
4. **Given** the dirty check dialog is shown, **When** the user clicks "Cancel", **Then** the dialog closes and the document remains open with changes intact
5. **Given** a document has no unsaved changes, **When** the user closes the window, **Then** the window closes immediately without a dialog

---

### User Story 5 - Status Bar Information (Priority: P2)

A writer wants to know their current position in the document, whether there are syntax errors, and the save state at a glance. The status bar at the bottom of the window shows: filename (with dirty indicator), cursor line/column, and error count (if any). Clicking the error count shows error details.

**Why this priority**: Status information improves productivity but the app is functional without it.

**Independent Test**: Can be tested by opening a file, moving the cursor, making changes, and introducing errors - verifying each updates the status bar.

**Acceptance Scenarios**:

1. **Given** a document is open, **When** the user looks at the status bar, **Then** they see the filename (or "Untitled" for new documents)
2. **Given** a document has unsaved changes, **When** the user looks at the status bar, **Then** a dirty indicator (dot or asterisk) appears next to the filename
3. **Given** the user moves the cursor, **When** the cursor position changes, **Then** the status bar updates to show current line and column numbers
4. **Given** the MDX has compilation errors, **When** the preview fails to compile, **Then** the status bar shows an error count badge
5. **Given** errors exist, **When** the user clicks the error count in the status bar, **Then** all three actions occur: cursor jumps to first error line in editor, error details popover is shown, and preview scrolls to show the error

---

### User Story 6 - Persistent Settings and Preferences (Priority: P3)

A writer customizes their workspace - adjusting the split ratio, hiding the preview, setting a preferred theme. When they relaunch the app, all their preferences are restored exactly as they left them.

**Why this priority**: Preference persistence improves UX but the app works without it (users just reconfigure each session).

**Independent Test**: Can be tested by changing settings, quitting, relaunching, and verifying settings are restored.

**Acceptance Scenarios**:

1. **Given** the user adjusts the split pane divider, **When** they relaunch the app, **Then** the split ratio is restored to their last setting
2. **Given** the user toggles the preview pane off, **When** they relaunch the app, **Then** the preview remains hidden
3. **Given** the user changes the zoom level, **When** they relaunch the app, **Then** the zoom level is restored
4. **Given** settings exist from a previous session, **When** the app launches, **Then** all settings are applied before the UI becomes visible (no flash of default state)

---

### User Story 7 - Keyboard-Driven Workflow (Priority: P3)

A power user navigates the entire application using keyboard shortcuts. They can open files, save, toggle preview, access the command palette, and perform all common actions without touching the mouse.

**Why this priority**: Keyboard efficiency is important for power users but mouse-based workflow is fully functional.

**Independent Test**: Can be tested by performing a complete workflow (open file, edit, save, close) using only keyboard.

**Acceptance Scenarios**:

1. **Given** the app is focused, **When** the user presses Cmd+N, **Then** a new untitled document is created
2. **Given** the app is focused, **When** the user presses Cmd+O, **Then** the open file dialog appears
3. **Given** the app is focused, **When** the user presses Cmd+S, **Then** the document is saved (or save dialog if untitled)
4. **Given** the app is focused, **When** the user presses Cmd+Shift+S, **Then** the save-as dialog appears
5. **Given** the app is focused, **When** the user presses Cmd+W, **Then** the window close flow initiates (with dirty check if needed)
6. **Given** the app is focused, **When** the user presses Cmd+\, **Then** the preview pane visibility toggles

---

### Edge Cases

- **What happens when** the file being edited is deleted or moved externally? → Show a warning and mark document as "orphaned" with option to save elsewhere. Specifically: (1) status bar shows "(Deleted)" suffix after filename, (2) Cmd+S triggers save-as dialog instead of overwriting missing path, (3) warning persists until user saves to new location or creates new document
- **What happens when** the file is modified externally while open? → Detect change on window focus (not continuous watching) and prompt user to reload or keep current version
- **What happens when** disk is full during save? → Show modal error dialog with message "Could not save: Disk is full. Free up space and try again." Editor content is preserved. User can retry via Cmd+S or save to different location via Cmd+Shift+S (save-as).
- **What happens when** the app crashes with unsaved changes? → Future: autosave/recovery (out of scope for this spec, but design should not preclude it)
- **What happens when** preview compilation hangs or takes too long? → Behavior defined in FR-037a: show loading state, allow continued editing, timeout after 3 seconds with error state
- **What happens when** window is resized very small? → Enforce minimum window size of 400x300 pixels. Below this, OS prevents further shrinking. If preview is visible and window width drops below 300px (100px editor min + 100px preview min + divider), preview auto-hides to give editor full width.
- **What happens when** user rapidly opens multiple files? → Queue operations sequentially, showing loading indicator during transitions. Final state displays the last file in queue order. Each open request triggers dirty check for current document before proceeding. If user cancels any dirty check, the queue is cleared and current document is preserved.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Layout & Panels

- **FR-001**: System MUST display a split-pane layout with editor on the left and preview on the right as the default view
- **FR-002**: System MUST provide a draggable divider between editor and preview panes that allows resizing
- **FR-003**: System MUST enforce minimum width of 100px for each pane when both are visible (enough to grab divider back)
- **FR-004**: System MUST allow the preview pane to be completely hidden, with editor expanding to fill space
- **FR-005**: System MUST display a status bar at the bottom of the window showing contextual information
- **FR-006**: System MUST support a titlebar/header area using Electron's `titleBarStyle: 'hiddenInset'` with `trafficLightPosition` set to `{ x: 12, y: 12 }`. The custom titlebar region MUST be marked as a drag region (-webkit-app-region: drag) with interactive elements excluded (-webkit-app-region: no-drag).

#### Document State Management

- **FR-007**: System MUST track the current document state including: file handle (if saved), content, and dirty status
- **FR-008**: System MUST mark a document as "dirty" whenever content changes from the last saved state
- **FR-009**: System MUST clear the dirty flag when a document is successfully saved
- **FR-010**: System MUST maintain document state across component re-renders without data loss
- **FR-011**: System MUST provide the current document state to all components that need it (editor, preview, commands)

#### Document Lifecycle - New

- **FR-012**: System MUST start with an empty "Untitled" document when launched without arguments
- **FR-013**: System MUST allow creating a new document via command (Cmd+N) which replaces current document (with dirty check)

#### Document Lifecycle - Open

- **FR-014**: System MUST allow opening files via command (Cmd+O) which shows a file picker dialog
- **FR-015**: System MUST load selected file content into the editor and trigger preview compilation
- **FR-016**: System MUST update document state with file handle information after successful open
- **FR-017**: System MUST show dirty check dialog before opening if current document has unsaved changes
- **FR-042**: System MUST check if the current file has been modified externally when the window regains focus, and if so, prompt user to reload or keep current version

#### Document Lifecycle - Save

- **FR-018**: System MUST allow saving via command (Cmd+S)
- **FR-019**: System MUST show save-as dialog for untitled documents when save is triggered
- **FR-020**: System MUST write content to the file path for already-saved documents
- **FR-021**: System MUST allow save-as via command (Cmd+Shift+S) which always shows save dialog
- **FR-022**: System MUST update document state (including file handle) after successful save-as
- **FR-023**: System MUST handle save errors gracefully, showing user-friendly error message and preserving editor content

#### Document Lifecycle - Close

- **FR-024**: System MUST intercept window close events to check for unsaved changes
- **FR-025**: System MUST display a confirmation dialog when closing with unsaved changes offering: Save, Don't Save, Cancel
- **FR-026**: System MUST execute the appropriate action based on user's dialog choice
- **FR-027**: System MUST allow closing without dialog when document has no unsaved changes

#### Status Bar

- **FR-028**: System MUST display the current filename (or "Untitled") in the status bar
- **FR-029**: System MUST display a dirty indicator when document has unsaved changes
- **FR-030**: System MUST display current cursor position (line and column) in the status bar
- **FR-031**: System MUST display error count when preview compilation has errors
- **FR-031a**: System MUST respond to error count click by: (1) jumping cursor to first error line in editor, (2) showing error details popover, and (3) scrolling preview to show the error
- **FR-031b**: Error details popover MUST display: (1) error message text from MDX compilation, (2) line number and column if available, (3) a "Go to Error" button that re-triggers the jump to error action, (4) dismiss on click outside or Escape key. Popover positioned below the error count badge with arrow pointing to badge.
- **FR-032**: System MUST update status bar information in real-time as state changes

#### Settings & Preferences

- **FR-033**: System MUST persist layout preferences (split ratio, panel visibility) across sessions
- **FR-034**: System MUST persist user preferences (zoom level, theme choice) across sessions
- **FR-035**: System MUST load persisted preferences on app launch before UI is shown
- **FR-036**: System MUST provide a centralized settings store that components can subscribe to

#### Integration

- **FR-037**: System MUST wire editor content changes to trigger preview compilation
- **FR-037a**: System MUST timeout preview compilation after 3 seconds, showing an error state while allowing continued editing
- **FR-038**: System MUST wire file operation commands to document state management
- **FR-039**: System MUST provide complete CommandContext to command palette including current document and editor state
- **FR-040**: System MUST handle menu events (from native menu) and route them to appropriate commands
- **FR-041**: System MUST connect error click events from preview to editor navigation (jump to error line)

---

### Key Entities

- **Document**: Represents the currently open file with: fileId (UUID for tracking), filePath (null if untitled), fileName (display name), content (current editor content), savedContent (content at last save), isDirty (derived: content !== savedContent)

- **Layout**: Represents the visual arrangement with: splitRatio (0-1, position of divider), previewVisible (boolean), editorWidth (derived from splitRatio and container)

- **Settings**: User preferences with: theme ('light' | 'dark' | 'system'), zoomLevel (50-200), recentFiles (array of paths), other future preferences

- **Status**: Derived display information with: displayName (fileName or "Untitled"), dirtyIndicator (boolean), cursorPosition ({line, column}), errorCount (number from preview state)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete a full document workflow (create → edit → save → close) in under 5 seconds excluding typing time
- **SC-002**: Preview updates reflect editor changes within 500ms of typing pause (perceived real-time)
- **SC-003**: Layout preferences are restored within 100ms of app launch (no visible flash of default state)
- **SC-004**: Dirty state is always accurate - 100% of save operations clear dirty flag, 100% of edits after save set dirty flag
- **SC-005**: Zero data loss from unsaved changes - dirty check intercepts 100% of close/open/new actions when dirty
- **SC-006**: Status bar updates within 50ms of state changes (cursor movement, error changes, save state)
- **SC-007**: All P1 user stories are completable using only keyboard shortcuts
- **SC-008**: App launches to usable state within 2 seconds on standard hardware
- **SC-009**: Window operations (resize, divider drag) MUST maintain at least 60 frames per second (16.67ms frame budget) with no dropped frames during continuous interaction
- **SC-010**: Error states are always recoverable - specifically: (1) save failures preserve editor content and allow retry, (2) file open failures return to previous document state, (3) preview compilation errors allow continued editing, (4) external file deletion allows save-as to new location. No error shall require force-quit or data loss to recover.

---

## Non-Functional Requirements

### Performance

- Layout resize operations must not cause visible jank or dropped frames
- Document state updates must be synchronous within the React render cycle
- Settings persistence must be debounced to avoid excessive disk writes

### Reliability

- Document content must never be silently lost
- File operations must have clear success/failure feedback
- Crash recovery design should not be precluded (even if not implemented in this spec)

### Accessibility

- All interactive elements must be keyboard accessible
- Status bar information must be available to screen readers
- Focus management must be logical during dialog flows

### Maintainability

- Document state must be centralized (single source of truth)
- Components must receive state via props/context, not reach into global stores directly where possible
- Clear separation between UI state (layout) and domain state (document)

---

## Assumptions

1. **Single document model**: This spec assumes one document open at a time. Tab/multi-document support is a future enhancement.
2. **Electron context**: File operations assume Electron IPC is available. Browser fallback exists but with limited functionality.
3. **Existing components work**: The MDXEditor, PreviewPane, and CommandPalette components from previous specs are functional and meet their specifications.
4. **macOS primary target**: Keyboard shortcuts use Cmd modifier. Windows/Linux support (Ctrl) should work via existing Mod abstraction but is not the primary test target.
5. **Local files only**: This spec covers local file system operations. Cloud storage integration is out of scope.
6. **No collaborative editing**: Single-user editing only. Real-time collaboration is out of scope.
7. **No arbitrary file size limit**: The system accepts files of any size. Performance safeguards (3s compilation timeout) handle edge cases; file size is a poor proxy for complexity.

---

## Out of Scope

- Multi-document / tabbed interface
- Autosave functionality (separate spec)
- Continuous file watching for external changes (separate spec; basic focus-based detection IS in scope)
- Version history / undo across saves
- Cloud storage integration
- Collaborative editing
- Plugin system for custom panels
- Custom themes beyond light/dark/system
- Recent files list in UI (though settings store should support it)

---

## Dependencies

- **Spec 002 (Editor Core)**: MDXEditor component with controlled value, onChange, and EditorView access
- **Spec 003 (Preview Pane)**: PreviewPane component with source prop and error handling
- **Spec 004 (File System Shell)**: IPC handlers for file operations (open, save, saveAs, read, write)
- **Spec 005 (Command Palette)**: CommandPalette component and useCommandPalette hook, command registration system

---

## Glossary

- **Dirty**: A document is "dirty" when it has unsaved changes (current content differs from last saved content)
- **File Handle**: An object containing fileId, filePath, and fileName that identifies a saved document
- **Split Ratio**: A value from 0 to 1 representing the position of the divider (0 = all preview, 1 = all editor)
- **Untitled**: A document that has never been saved and has no associated file path
