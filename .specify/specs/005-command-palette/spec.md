# Feature Specification: Keyboard Shortcuts & Command Palette

**Feature Branch**: `005-command-palette`
**Created**: 2026-01-10
**Status**: Draft
**Input**: User description: "Implement a comprehensive keyboard shortcuts system with a searchable command palette for mdxpad"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Command Discovery (Priority: P1)

As a user, I want to press Cmd+Shift+P (or Ctrl+Shift+P on Windows/Linux) to open a command palette where I can search for and execute any available command without memorizing keyboard shortcuts.

**Why this priority**: This is the core feature that makes all other commands discoverable. Without it, users must memorize shortcuts or navigate menus, which is a significant barrier to productivity.

**Independent Test**: Can be fully tested by opening the palette, typing a search term, and verifying matching commands appear with their shortcuts displayed.

**Acceptance Scenarios**:

1. **Given** the editor is open and focused, **When** user presses Cmd+Shift+P, **Then** a centered modal overlay appears with a search input focused
2. **Given** the command palette is open, **When** user types "save", **Then** commands containing "save" are filtered and displayed with matching characters highlighted
3. **Given** the command palette shows filtered results, **When** user presses Enter or clicks a command, **Then** that command executes and the palette closes
4. **Given** the command palette is open, **When** user presses Escape or clicks outside, **Then** the palette closes without executing any command

---

### User Story 2 - File Operations via Shortcuts (Priority: P1)

As a user, I want to use standard keyboard shortcuts (Cmd+S, Cmd+O, Cmd+N) to perform common file operations quickly without using menus.

**Why this priority**: File operations are the most frequent user actions. Fast save/open/new operations are essential for a productive editing workflow.

**Independent Test**: Can be fully tested by pressing Cmd+S with unsaved changes and verifying the save dialog appears or file saves.

**Acceptance Scenarios**:

1. **Given** a document with unsaved changes, **When** user presses Cmd+S, **Then** the file save operation initiates (using existing IPC file.save channel)
2. **Given** any state, **When** user presses Cmd+O, **Then** the file open dialog appears (using existing IPC file.open channel)
3. **Given** any state, **When** user presses Cmd+N, **Then** a new empty document is created
4. **Given** a document is open, **When** user presses Cmd+W, **Then** the document closes (prompting to save if unsaved changes exist)
5. **Given** any state, **When** user presses Cmd+Shift+S, **Then** the "Save As" dialog appears

---

### User Story 3 - Editor Text Formatting (Priority: P2)

As a user writing MDX content, I want to use Cmd+B for bold, Cmd+I for italic, and Cmd+K for links so I can format text without leaving the keyboard.

**Why this priority**: Text formatting shortcuts are essential for efficient markdown editing, but require editor focus and are secondary to core file operations.

**Independent Test**: Can be fully tested by selecting text, pressing Cmd+B, and verifying markdown bold syntax is applied around the selection.

**Acceptance Scenarios**:

1. **Given** text is selected in the editor, **When** user presses Cmd+B, **Then** the selection is wrapped with `**` markdown bold syntax
2. **Given** text is selected in the editor, **When** user presses Cmd+I, **Then** the selection is wrapped with `_` markdown italic syntax
3. **Given** cursor is in the editor, **When** user presses Cmd+K, **Then** a link insertion UI appears or markdown link syntax is inserted
4. **Given** cursor is in the editor, **When** user presses Cmd+Shift+K, **Then** a code block is inserted at cursor position
5. **Given** cursor is on a line, **When** user presses Cmd+/, **Then** the line is toggled as a markdown/JSX comment

---

### User Story 4 - View Controls (Priority: P2)

As a user, I want to toggle the preview pane and control zoom level with keyboard shortcuts so I can customize my workspace quickly.

**Why this priority**: View controls improve workflow efficiency but are less frequently used than editing shortcuts.

**Independent Test**: Can be fully tested by pressing Cmd+\ and verifying the preview pane visibility toggles.

**Acceptance Scenarios**:

1. **Given** the preview pane is visible, **When** user presses Cmd+\, **Then** the preview pane hides
2. **Given** the preview pane is hidden, **When** user presses Cmd+\, **Then** the preview pane shows
3. **Given** any zoom level, **When** user presses Cmd++, **Then** the view zooms in
4. **Given** any zoom level, **When** user presses Cmd+-, **Then** the view zooms out
5. **Given** any non-default zoom level, **When** user presses Cmd+0, **Then** the view resets to 100% zoom

---

### User Story 5 - Recently Used Commands (Priority: P3)

As a frequent user, I want the command palette to show my recently used commands at the top so I can quickly re-execute common actions.

**Why this priority**: This is a convenience enhancement that improves efficiency for power users but the palette is fully functional without it.

**Independent Test**: Can be fully tested by executing a command, reopening the palette, and verifying that command appears in the "Recent" section.

**Acceptance Scenarios**:

1. **Given** user has previously executed "Toggle Preview", **When** user opens the command palette, **Then** "Toggle Preview" appears in a "Recent" section at the top
2. **Given** the Recent section has 5+ commands, **When** user opens the palette, **Then** only the 5 most recent commands are shown in Recent
3. **Given** user clears search input in palette, **When** viewing results, **Then** Recent commands appear first, followed by all commands by category

---

### User Story 6 - Command Categories (Priority: P3)

As a user, I want commands organized into categories (File, Edit, View, Format, Help) so I can browse related commands together.

**Why this priority**: Categorization improves discoverability but search is the primary discovery mechanism.

**Independent Test**: Can be fully tested by opening the palette with empty search and verifying commands are grouped by category.

**Acceptance Scenarios**:

1. **Given** the command palette is open with no search query, **When** viewing the command list, **Then** commands are grouped under category headers (File, Edit, View, Format, Help)
2. **Given** a search query is entered, **When** viewing filtered results, **Then** category headers are hidden and only matching commands are shown

---

### Edge Cases

- What happens when user presses a shortcut while in a native input field (outside CodeMirror)? Shortcuts should be suppressed to allow normal text input.
- How does system handle modifier key edge cases (Caps Lock active, key held)? Standard OS-level modifier handling applies; Caps Lock does not affect shortcuts.
- What happens if command execution fails? A toast notification appears with an error message; palette closes normally.
- How do shortcuts behave with multiple windows? Each window handles shortcuts independently for its focused state.
- What happens when user presses Cmd+K in the editor vs. globally? In editor, it inserts a link. Globally (not in editor), it opens command palette (alternative to Cmd+Shift+P).
- What happens when user rapidly presses the same shortcut? Debounced (200ms), async commands show "in progress" indicator.

## Requirements *(mandatory)*

### Functional Requirements

**Command Registry**
- **FR-001**: System MUST provide a central command registry where commands can be registered and looked up
- **FR-002**: Each registered command MUST have: unique id, display name, description, category, optional keyboard shortcut, execute function, optional enabled/visible state functions
- **FR-003**: System MUST support command registration from multiple sources (built-in commands, future feature modules)
- **FR-004**: System MUST detect and warn about keyboard shortcut conflicts at registration time

**Command Palette UI**
- **FR-005**: System MUST display a centered modal overlay (max 500px wide) with backdrop blur when palette is opened
- **FR-006**: System MUST provide fuzzy search filtering of commands as user types
- **FR-007**: System MUST highlight matching characters in command names during search
- **FR-008**: System MUST display each command with: icon (if available), name, description, and keyboard shortcut (if bound)
- **FR-009**: System MUST support full keyboard navigation (arrow keys, Enter to execute, Escape to close)
- **FR-010**: System MUST implement focus trap within the palette modal
- **FR-011**: System MUST provide appropriate ARIA labels for accessibility
- **FR-043**: System MUST announce command execution results to screen readers via aria-live region

**Keyboard Shortcuts**
- **FR-012**: System MUST handle keyboard shortcuts at the application level via DOM keydown events
- **FR-013**: System MUST use Cmd modifier on macOS and Ctrl modifier on Windows/Linux
- **FR-014**: System MUST suppress shortcuts when focus is in native input/textarea elements (outside CodeMirror)
- **FR-015**: System MUST integrate with Electron native menu bar for shortcut consistency
- **FR-042**: System MUST debounce rapid shortcut repeats (200ms) and show "in progress" indicator for async commands

**Built-in Commands**

Global shortcuts (work anywhere):
- **FR-016**: System MUST implement Cmd+S (save current document)
- **FR-017**: System MUST implement Cmd+Shift+S (save as)
- **FR-018**: System MUST implement Cmd+O (open file)
- **FR-019**: System MUST implement Cmd+N (new document)
- **FR-020**: System MUST implement Cmd+W (close document)
- **FR-021**: System MUST implement Cmd+, (settings) as disabled command with "Coming soon" state until settings feature exists
- **FR-022**: System MUST implement Cmd+Shift+P (open command palette)
- **FR-023**: System MUST implement Cmd+K as alternative palette opener when not in editor

Editor shortcuts (when editor focused):
- **FR-024**: System MUST implement Cmd+B (bold selected text)
- **FR-025**: System MUST implement Cmd+I (italic selected text)
- **FR-026**: System MUST implement Cmd+K (insert link - when editor focused)
- **FR-027**: System MUST implement Cmd+Shift+K (insert code block)
- **FR-028**: System MUST implement Cmd+/ (toggle comment)
- **FR-029**: System MUST implement Cmd+F (find in editor)
- **FR-030**: System MUST implement Cmd+G (find next)

View shortcuts:
- **FR-031**: System MUST implement Cmd+\ (toggle preview pane)
- **FR-032**: System MUST implement Cmd+Shift+\ (toggle sidebar) as disabled command with "Coming soon" state until sidebar feature exists
- **FR-033**: System MUST implement Cmd++ (zoom in, max 200%)
- **FR-034**: System MUST implement Cmd+- (zoom out, min 50%)
- **FR-035**: System MUST implement Cmd+0 (reset zoom to 100%)
- **FR-044**: System MUST persist zoom level to localStorage and restore on app launch

**Integration**
- **FR-036**: File operations MUST use existing IPC_CHANNELS.file.* channels
- **FR-037**: Editor operations MUST dispatch commands to CodeMirror via EditorView
- **FR-038**: Preview toggle MUST integrate with existing preview pane visibility state

**UX Polish**
- **FR-039**: Palette MUST animate open/close with 150ms ease-out transition
- **FR-040**: Empty search results MUST show "No commands found" with suggestion to clear search
- **FR-041**: Click outside palette OR Escape key MUST dismiss the palette

### Key Entities

- **Command**: Represents an executable action with id, name, description, category, optional shortcut, execute function (`(ctx: CommandContext) => CommandResult | Promise<CommandResult>`), and optional enabled/visible predicates
- **CommandContext**: Injected context providing access to editor instance, stores, current document state, and window reference - enables testability and multi-window support
- **CommandResult**: Structured result type: `{ ok: true; undo?: () => void | Promise<void> }` or `{ ok: false; error: string }` - enables error handling, undo/redo, and command chaining
- **CommandRegistry**: Singleton store holding all registered commands with subscribe capability for reactive updates
- **ShortcutBinding**: Maps a keyboard combination (modifiers + key) to a command id
- **RecentCommands**: Ordered list of recently executed command ids (persisted in local storage)
- **Notification**: Unified notification model with type, message, priority, duration, actions, channel, source (for deduplication), groupKey, presentation style (toast/banner/inline/silent), and lifecycle metadata
- **NotificationStore**: Manages active notifications and history with smart features: deduplication by source, priority queuing, max visible limits, channel filtering, and CRUD operations

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open command palette and find any command in under 3 seconds via search
- **SC-002**: All keyboard shortcuts execute their command within 100ms of key press
- **SC-003**: 100% of registered commands are discoverable through the command palette
- **SC-004**: Command palette is fully navigable using only keyboard (no mouse required)
- **SC-005**: Users can execute recent commands with 2 or fewer interactions (open palette + select)
- **SC-006**: Zero shortcut conflicts exist between built-in commands
- **SC-007**: Palette open/close animations complete in 150ms or less
- **SC-008**: Users on macOS see Cmd-based shortcuts; users on Windows/Linux see Ctrl-based shortcuts

## Clarifications

### Session 2026-01-10

- Q: How should preview toggle (Cmd+\) integrate with the preview pane? → A: Create new `uiLayoutStore` for UI-only state like panel visibility, separate from compile state. This enables clean separation of concerns, extensibility for future panels (sidebar, terminal), and proper state access for commands.
- Q: What is the signature for Command.execute()? → A: Combined context injection + explicit results: `execute: (ctx: CommandContext) => CommandResult | Promise<CommandResult>`. This enables testability, multi-window support, error handling, undo/redo foundation, command chaining, and analytics.
- Q: Does a toast/notification system exist, or should this spec create one? → A: Create a future-proof notification architecture with full data model (priority, channels, actions, grouping, deduplication, history) but only ship ToastStack UI now. Banners, NotificationCenter, and InlineAlert are future additions over the same store.
- Q: Should placeholder commands (Settings, Sidebar Toggle) be registered or omitted? → A: Register as disabled commands - discoverable in palette with "Coming soon" badge, shortcut reserved. When features ship, flip `enabled: true`.
- Q: What fuzzy search algorithm should FR-006 use? → A: Character-by-character fuzzy match with scoring (like VS Code). "sv" matches "**S**a**v**e", results ranked by match quality. Zero dependencies, ~100 lines implementation.
- Q: What happens when user rapidly presses the same shortcut multiple times? → A: Debounce - ignore rapid repeats within 200ms, show "already in progress" indicator for async commands. Prevents accidental duplicate operations.
- Q: Should command execution results be announced to screen readers? → A: Yes - announce success/failure via aria-live region (e.g., "File saved", "Command failed: reason"). Essential for accessibility.
- Q: What are the zoom level bounds? → A: Standard range 50%-200%, matching VS Code and browsers. Good accessibility range without layout edge cases.
- Q: Should zoom level persist across app restarts? → A: Yes - persist to localStorage, restore on app launch. Users set their preferred zoom once and expect it to stay.

## Assumptions

- The application is running in Electron with access to native menu integration
- Preview pane visibility is managed by a dedicated `uiLayoutStore`, separate from the compile-focused `previewStore`
- CodeMirror 6 is the editor and provides EditorView.dispatch for command execution
- Existing IPC_CHANNELS.file.* channels are implemented and functional (from spec 004)
- No external keyboard shortcut libraries will be used (native DOM events only)
- Future specs will register their own commands using the registry pattern established here

## Out of Scope

- Custom user-defined keyboard shortcuts (future spec)
- Shortcut cheat sheet / help overlay (future spec)
- Multi-step command sequences / macros
- Touch/gesture support for palette
- Voice command integration
