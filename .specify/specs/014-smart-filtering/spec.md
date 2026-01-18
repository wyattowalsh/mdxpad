# Feature Specification: Smart Filtering for File Tree

**Feature Branch**: `014-smart-filtering`
**Created**: 2026-01-17
**Status**: Draft
**Input**: User description: "Smart Filtering for File Tree - Quick filter/search in file explorer sidebar. Fuzzy matching for file and folder names. Filter persistence across sessions. Visual highlighting of matched portions. Keyboard shortcut to focus filter input."

## Clarifications

### Session 2026-01-17

- Q: What fuzzy matching behavior should be implemented? → A: Sequential (fzf-style): Query characters must appear in order, but not contiguously
- Q: What keyboard shortcut should focus the filter input? → A: Cmd/Ctrl+P ("P" for filter/Pick file). Note: Cmd/Ctrl+Shift+F conflicts with Find/Replace in editor (see research.md).
- Q: What should happen to the filter after selecting a file? → A: Persist filter, allowing continued navigation in filtered view
- Q: How should case sensitivity be handled in filter matching? → A: Case-insensitive matching
- Q: What debounce strategy should be used for filter input? → A: 50ms debounce after last keystroke before filtering

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick File Filtering (Priority: P1)

As a user working with a large project, I want to quickly filter the file tree by typing a search query so that I can rapidly locate files without manually scrolling through the entire directory structure.

**Why this priority**: This is the core functionality that enables users to navigate large codebases efficiently. Without basic filtering, the file explorer becomes unusable for projects with many files.

**Independent Test**: Can be fully tested by typing a query in the filter input and verifying that only matching files/folders are displayed. Delivers immediate value for file navigation.

**Acceptance Scenarios**:

1. **Given** the file explorer is visible with multiple files and folders, **When** I type a query in the filter input, **Then** only files and folders matching the query are displayed
2. **Given** the filter input contains a query, **When** I clear the filter input, **Then** the full file tree is restored
3. **Given** the filter input is empty, **When** I view the file explorer, **Then** all files and folders are displayed without filtering
4. **Given** a filter is active and showing results, **When** I select/click a file from the filtered results, **Then** the filter remains active and the filtered view persists

---

### User Story 2 - Fuzzy Matching (Priority: P1)

As a user who may not remember exact file names, I want the filter to support fuzzy matching so that I can find files even with abbreviated queries where characters appear in sequence but not contiguously.

**Why this priority**: Fuzzy matching is essential for practical usability. Users rarely remember exact file names, especially in unfamiliar codebases.

**Independent Test**: Can be tested by typing abbreviated or misspelled queries and verifying that relevant files still appear in results.

**Acceptance Scenarios**:

1. **Given** a file named "MyComponent.tsx" exists, **When** I type "mycmp", **Then** "MyComponent.tsx" appears in the filtered results
2. **Given** a file named "userAuthenticationService.ts" exists, **When** I type "usrauth", **Then** the file appears in the filtered results
3. **Given** multiple files with similar names exist, **When** I type a partial query, **Then** all matching files are displayed ranked by match quality
4. **Given** a file named "MyComponent.tsx" exists, **When** I type "MYCOMP" or "mycomp", **Then** "MyComponent.tsx" appears in the filtered results (case-insensitive)

---

### User Story 3 - Visual Match Highlighting (Priority: P2)

As a user scanning filter results, I want to see which parts of file/folder names matched my query so that I can quickly verify I found the right file.

**Why this priority**: Visual feedback improves user confidence and speeds up file selection. Essential for usability but filtering works without it.

**Independent Test**: Can be tested by entering a query and verifying that matched character sequences are visually distinguished in the results.

**Acceptance Scenarios**:

1. **Given** I type "comp" and "MyComponent.tsx" matches, **When** viewing the filtered results, **Then** the letters "comp" within "Component" are visually highlighted
2. **Given** fuzzy matching is applied, **When** viewing results, **Then** each matched character is individually highlighted even if non-contiguous
3. **Given** a folder name matches the query, **When** viewing the folder, **Then** the matched portion of the folder name is also highlighted

---

### User Story 4 - Keyboard Shortcut Access (Priority: P2)

As a keyboard-oriented user, I want to use a keyboard shortcut to focus the filter input so that I can start filtering without reaching for the mouse.

**Why this priority**: Keyboard shortcuts significantly improve workflow efficiency for power users. Important for productivity but not blocking for basic functionality.

**Independent Test**: Can be tested by pressing the designated keyboard shortcut and verifying the filter input receives focus.

**Acceptance Scenarios**:

1. **Given** I am anywhere in the application, **When** I press Cmd/Ctrl+P, **Then** the filter input receives focus and is ready for typing
2. **Given** the filter input is focused, **When** I press Escape, **Then** the filter input loses focus and returns focus to the file tree
3. **Given** the filter input is focused and contains text, **When** I press Escape, **Then** the filter text is cleared first, and a second Escape removes focus

---

### User Story 5 - Filter Persistence (Priority: P3)

As a user who frequently returns to the same project, I want my filter query to persist across sessions so that I don't have to re-enter it every time I reopen the application.

**Why this priority**: Persistence is a convenience feature that enhances long-term usability but is not essential for the core filtering workflow.

**Independent Test**: Can be tested by entering a filter query, closing and reopening the application, and verifying the filter query is restored.

**Acceptance Scenarios**:

1. **Given** I have entered a filter query, **When** I close and reopen the application, **Then** the filter query is restored and applied to the file tree
2. **Given** I have cleared the filter before closing, **When** I reopen the application, **Then** the filter input is empty and no filtering is applied
3. **Given** I open a different project/workspace, **When** viewing the file explorer, **Then** the filter state is specific to that project

---

### Edge Cases

- What happens when the filter query matches no files or folders? (Empty state with helpful message)
- How does the system handle very deep nested folder structures? (Parent folders of matching items remain visible)
- What happens when a file is created/deleted/renamed while a filter is active? (Filter results update automatically)
- How does the system handle special characters in the filter query? (Treat as literal characters for matching)
- What happens when the user pastes a very long string into the filter? (Truncate input at 256 characters maximum; prevent further input beyond limit; no error message shown)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a text input field in the file explorer sidebar for entering filter queries
- **FR-002**: System MUST filter the file tree to show only items matching the current query as the user types
- **FR-003**: System MUST support sequential fuzzy matching (fzf-style) with case-insensitive comparison, where query characters must appear in order within file/folder names, but not contiguously (e.g., "mcp" matches "MyComponent.tsx", "MCP" matches "mycomponent.tsx")
- **FR-004**: System MUST display parent folders of matching items to maintain tree structure context
- **FR-005**: System MUST visually highlight the matched portions of file/folder names in the filtered results
- **FR-006**: System MUST provide Cmd/Ctrl+P keyboard shortcut to focus the filter input from anywhere in the application (changed from Cmd/Ctrl+Shift+F due to conflict with Find/Replace)
- **FR-007**: System MUST persist the filter query across application sessions per project/workspace
- **FR-008**: System MUST restore full file tree view when filter query is cleared
- **FR-009**: System MUST update filter results automatically when files are added, removed, or renamed
- **FR-010**: System MUST perform filtering with 50ms debounce (wait 50ms after last keystroke before filtering to prevent excessive recomputation)
- **FR-011**: System MUST display a clear empty state message when no files match the filter query
- **FR-012**: System MUST allow users to clear the filter with a single action (clear button or Escape key)
- **FR-013**: System MUST persist the active filter when a file is selected, allowing continued navigation in the filtered view

### Key Entities

- **Filter Query**: The text string entered by the user to filter the file tree; persisted per project
- **Match Result**: A file or folder that matches the filter query, including match positions for highlighting
- **File Tree Node**: A file or folder in the explorer, with visibility state determined by filter matches

**Matching Behavior**: Fuzzy matching applies to the full file/folder path for determining visibility. For highlighting, match positions are remapped to the visible node name only. Folders match if their name matches OR if any descendant matches (ancestor visibility).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can locate a specific file in a 500+ file project within 5 seconds using the filter
- **SC-002**: Filter results update within 100ms of keystroke for projects with up to 10,000 files
- **SC-003**: 95% of users successfully find their target file on first filter attempt
- **SC-004**: Keyboard shortcut to focus filter is discoverable (documented in UI or command palette)
- **SC-005**: Filter state persists correctly across 100% of application restart cycles
- **SC-006**: Fuzzy matching correctly identifies files where all query characters appear sequentially (in order, not contiguously) within the file name

## Assumptions

- The file explorer sidebar already exists as part of the application shell (from spec 006)
- File tree data structure is available from the file system shell (from spec 004)
- The application uses localStorage or similar mechanism for session persistence (established pattern)
- Cmd/Ctrl+P is reserved for file tree filtering (originally Cmd/Ctrl+Shift+F, changed due to Find/Replace conflict)
- Fuzzy matching uses sequential fzf-style matching algorithm for consistency with developer expectations (query "mcp" matches "MyComponent" but not "CompoMynet")
