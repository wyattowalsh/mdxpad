# Feature Specification: Bidirectional Preview Sync

**Feature Branch**: `008-bidirectional-sync`
**Created**: 2026-01-17
**Status**: Clarified
**Input**: User description: "Bidirectional Preview Sync - Scroll position syncing between editor and preview. Editor scroll position reflected in preview panel and vice versa. Configurable sync behavior (disabled, editor-to-preview, preview-to-editor, bidirectional). Smooth scroll with position caching."

---

## Executive Summary

Bidirectional Preview Sync enables automatic scroll synchronization between the editor and the preview panel. As writers navigate their document in either pane, the other pane follows to show the corresponding content. This creates a unified editing experience where the preview always reflects what the user is working on.

Key capabilities:

1. **Editor-to-Preview sync** - Scrolling in the editor scrolls the preview to show the same content
2. **Preview-to-Editor sync** - Scrolling in the preview scrolls the editor to show the source of visible content
3. **Configurable modes** - Users choose their preferred sync behavior (disabled, one-way, or bidirectional)
4. **Smooth scrolling** - Synchronized scrolls animate smoothly without jarring jumps
5. **Position caching** - Scroll positions are cached to provide instant sync without recalculation

---

## Performance Constants

These constants are defined once and referenced throughout the specification:

| Constant | Value | Description |
|----------|-------|-------------|
| `SYNC_DEBOUNCE_MS` | 50ms | Debounce delay before triggering synchronized scroll |
| `SCROLL_ANIMATION_MS` | 150ms | Duration of smooth scroll animation |
| `POSITION_CACHE_TTL_MS` | 1000ms | Time-to-live for cached position mappings |
| `SYNC_THRESHOLD_LINES` | 3 | Minimum line change to trigger sync (prevents micro-syncs) |
| `SCROLL_MARGIN_PERCENT` | 10 | Percentage of viewport height for scroll margin |
| `NOTIFICATION_DURATION_MS` | 2000ms | Duration for sync toggle notification (auto-dismiss) |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editor Scroll Syncs Preview (Priority: P1)

A writer scrolls through their MDX document in the editor to find a specific section. As they scroll, the preview panel smoothly scrolls to show the rendered output of the content visible in the editor. The writer can see both the source and rendered version of the same content simultaneously.

**Why this priority**: This is the most common use case. Writers primarily work in the editor and need the preview to follow along to verify rendering.

**Independent Test**: Can be fully tested by opening a document, scrolling in the editor, and verifying the preview shows corresponding content.

**Acceptance Scenarios**:

1. **Given** sync mode is "editor-to-preview" or "bidirectional", **When** the user scrolls in the editor, **Then** the preview scrolls to show content corresponding to the editor's visible lines
2. **Given** the editor shows lines 50-80 of a document, **When** sync occurs, **Then** the preview shows the rendered output within 5 lines of the editor's top visible line (per SC-004 tolerance)
3. **Given** the user scrolls rapidly in the editor, **When** sync triggers, **Then** the preview scroll animates smoothly over SCROLL_ANIMATION_MS
4. **Given** sync mode is "disabled" or "preview-to-editor", **When** the user scrolls in the editor, **Then** the preview does not scroll automatically

---

### User Story 2 - Preview Scroll Syncs Editor (Priority: P1)

A writer reviews their rendered preview and clicks or scrolls to a section they want to edit. The editor automatically scrolls to show the source code for that section, allowing immediate editing without manual navigation.

**Why this priority**: Equally important for the bidirectional experience. Writers often spot issues in preview and need to quickly find the source.

**Independent Test**: Can be tested by scrolling in the preview panel and verifying the editor scrolls to show the corresponding source lines.

**Acceptance Scenarios**:

1. **Given** sync mode is "preview-to-editor" or "bidirectional", **When** the user scrolls in the preview, **Then** the editor scrolls to show source lines corresponding to the visible preview content
2. **Given** a heading is visible at the top of the preview, **When** sync occurs, **Then** the editor shows the source line containing that heading
3. **Given** the user scrolls rapidly in the preview, **When** sync triggers, **Then** the editor scroll animates smoothly over SCROLL_ANIMATION_MS
4. **Given** sync mode is "disabled" or "editor-to-preview", **When** the user scrolls in the preview, **Then** the editor does not scroll automatically

---

### User Story 3 - Configure Sync Mode (Priority: P2)

A writer prefers that only the preview follows the editor, not the reverse. They open settings and change the sync mode from "bidirectional" to "editor-to-preview". The change takes effect immediately without requiring a restart.

**Why this priority**: Configuration is important for personalization but most users will use the default bidirectional mode.

**Independent Test**: Can be tested by changing each sync mode option and verifying the corresponding behavior changes.

**Acceptance Scenarios**:

1. **Given** the settings panel is open, **When** the user views sync options, **Then** they see four modes: Disabled, Editor to Preview, Preview to Editor, Bidirectional
2. **Given** the user selects a different sync mode, **When** they close settings, **Then** the new mode takes effect immediately
3. **Given** the user sets sync mode to "disabled", **When** they scroll in either pane, **Then** no automatic synchronization occurs
4. **Given** the app is restarted, **When** it loads, **Then** the previously selected sync mode is preserved

---

### User Story 4 - Sync While Typing (Priority: P2)

A writer is actively typing at the cursor position. As they type and the document grows, the preview stays synchronized with the editing location, ensuring the rendered output of what they're typing is always visible.

**Why this priority**: Active editing is a core workflow, but typing already keeps the cursor in view, so this is secondary to scroll sync.

**Independent Test**: Can be tested by typing content and verifying the preview shows the rendered output of the current editing location.

**Acceptance Scenarios**:

1. **Given** sync is enabled and the user is typing, **When** content is added that causes scroll, **Then** the preview syncs to show the rendered content at the cursor
2. **Given** the user types multiple lines, **When** the editor auto-scrolls to keep cursor visible, **Then** the preview follows to show the new content rendered
3. **Given** sync debounce is active, **When** the user types rapidly, **Then** sync does not fire on every keystroke (debounced)

---

### User Story 5 - Access Sync Toggle via Command Palette (Priority: P3)

A writer wants to quickly toggle sync on or off without opening settings. They open the command palette, type "sync", and see a command to toggle sync. Executing it immediately disables or enables sync.

**Why this priority**: Power-user feature for quick toggling, but most users will set and forget their preference.

**Independent Test**: Can be tested by invoking the command palette, finding the sync toggle command, and verifying sync state changes.

**Acceptance Scenarios**:

1. **Given** the command palette is open, **When** the user searches for "sync", **Then** they see "Toggle Preview Sync" command
2. **Given** sync is currently enabled, **When** the user executes the toggle command, **Then** sync is disabled
3. **Given** sync is currently disabled, **When** the user executes the toggle command, **Then** sync is enabled to the last non-disabled mode (persisted across sessions)
4. **Given** sync is toggled via command, **When** the action completes, **Then** a notification displays the new sync state for 2 seconds before auto-dismissing

---

### Edge Cases

- **What happens when** the document has no preview content (empty or parse error)? → Editor sync is disabled; preview shows error state without attempting scroll sync
- **What happens when** the user scrolls both panes simultaneously (e.g., via touchpad)? → Editor scroll takes precedence; if both panes receive scroll events within the same debounce window, the editor's scroll triggers sync and the preview's scroll is ignored
- **What happens when** source line mapping is ambiguous (e.g., content from frontmatter)? → Frontmatter maps to the top of the preview; preview scrolls to top when editor is in frontmatter region
- **What happens when** the preview renders content at a different position than source (e.g., table of contents)? → Sync uses source position data from AST where available; falls back to proportional scroll ratio
- **What happens when** the document is very short and fits in both viewports? → Sync is effectively no-op; both panes show all content
- **What happens when** one pane is scrolled to the very top or bottom? → Sync respects boundaries; does not attempt to scroll past document limits
- **What happens when** a document is first opened? → Both panes start at the top of the document; no initial sync scroll animation occurs

### Scroll Lock Algorithm

To prevent feedback loops (editor scrolls preview, which scrolls editor, which scrolls preview...):

1. When a sync scroll is initiated, set `scrollLock = true` and record `lockSource = 'editor' | 'preview'`
2. Ignore scroll events from the `lockSource` pane for SYNC_DEBOUNCE_MS
3. After SYNC_DEBOUNCE_MS, set `scrollLock = false`
4. If a manual (user-initiated) scroll occurs on the other pane during lock, break the lock early

### Position Mapping Strategy

1. **Primary**: Use AST source position data (line numbers from parsed nodes)
2. **Secondary**: Use line-to-element mapping from rendered preview DOM
3. **Fallback**: Use proportional scroll ratio (editor scroll % = preview scroll %)

---

## Requirements *(mandatory)*

### Functional Requirements

#### Sync Mode Configuration

- **FR-001**: System MUST provide four sync modes: disabled, editor-to-preview, preview-to-editor, bidirectional
- **FR-002**: System MUST default to "bidirectional" sync mode for new installations
- **FR-003**: System MUST persist sync mode preference across sessions using the existing settings store
- **FR-004**: System MUST apply sync mode changes immediately without requiring restart
- **FR-005**: System MUST persist the last non-disabled sync mode and restore it when sync is toggled back on

#### Editor-to-Preview Sync

- **FR-010**: System MUST detect scroll events in the editor when sync mode includes editor-to-preview
- **FR-011**: System MUST debounce editor scroll events by SYNC_DEBOUNCE_MS before triggering preview sync
- **FR-012**: System MUST calculate the target preview scroll position based on editor visible lines
- **FR-013**: System MUST scroll the preview smoothly over SCROLL_ANIMATION_MS to the target position
- **FR-014**: System MUST not trigger preview sync during typing if cursor remains within SYNC_THRESHOLD_LINES of previous position

#### Preview-to-Editor Sync

- **FR-020**: System MUST detect scroll events in the preview when sync mode includes preview-to-editor
- **FR-021**: System MUST debounce preview scroll events by SYNC_DEBOUNCE_MS before triggering editor sync
- **FR-022**: System MUST calculate the target editor line based on visible preview content
- **FR-023**: System MUST scroll the editor smoothly over SCROLL_ANIMATION_MS to the target line
- **FR-024**: System MUST use AST source position data to map preview content to source lines when available

#### Feedback Loop Prevention

- **FR-030**: System MUST implement scroll lock to prevent sync feedback loops
- **FR-031**: System MUST ignore scroll events from the sync target pane for SYNC_DEBOUNCE_MS after initiating a sync scroll
- **FR-032**: System MUST break scroll lock if user manually scrolls the other pane
- **FR-033**: System MUST give editor scroll priority when both panes receive scroll events within the same debounce window

#### Position Caching

- **FR-040**: System MUST cache position mappings between editor lines and preview scroll positions
- **FR-041**: System MUST invalidate position cache when document content changes
- **FR-042**: System MUST expire position cache entries after POSITION_CACHE_TTL_MS

#### Command Integration

- **FR-050**: System MUST register a "Toggle Preview Sync" command with the command palette
- **FR-051**: System MUST register a keyboard shortcut for sync toggle (Cmd+Shift+Y / Ctrl+Shift+Y)
- **FR-052**: System MUST show a notification for 2 seconds (auto-dismiss) when sync is toggled via command or shortcut, displaying the new sync state

---

### Key Entities

- **SyncMode**: Enum representing sync configuration ('disabled' | 'editorToPreview' | 'previewToEditor' | 'bidirectional')

- **ScrollPosition**: Represents a scroll state with: pane ('editor' | 'preview'), line (for editor), scrollTop (for preview), timestamp

- **PositionMapping**: Maps editor lines to preview positions with: editorLine (source line number), previewScrollTop (pixel offset), element (DOM element reference if available), confidence ('high' | 'medium' | 'low')

- **SyncState**: The complete sync state with: mode (SyncMode), isLocked (boolean), lockSource ('editor' | 'preview' | null), lastSync (timestamp), positionCache (Map of PositionMapping)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can scroll in the editor and see the preview follow within SYNC_DEBOUNCE_MS + SCROLL_ANIMATION_MS (perceived as immediate)
- **SC-002**: Users can scroll in the preview and see the editor follow within SYNC_DEBOUNCE_MS + SCROLL_ANIMATION_MS (perceived as immediate)
- **SC-003**: Scroll synchronization adds less than 5ms to the main thread during scroll events
- **SC-004**: Position mapping accuracy achieves 90%+ for documents with AST source positions (rendered content within 5 lines of source)
- **SC-005**: Sync mode preference persists correctly across 100% of app restarts
- **SC-006**: No feedback loops occur during normal usage (sync does not trigger infinite scroll cycles)
- **SC-007**: Typing latency is not affected by sync (maintains <16ms keystroke-to-render per Constitution Article V)

---

## Non-Functional Requirements

### Performance

- Scroll event handlers must complete within 5ms to maintain 60fps scroll smoothness
- Position cache lookups must complete in O(1) time
- Sync calculations must not block the main thread during active scrolling

### Accessibility

- Sync toggle must be accessible via keyboard shortcut
- Sync state must be announced to screen readers when changed
- Reduced motion preference should disable smooth scroll animation (use instant scroll)

### Maintainability

- Sync logic should be encapsulated in a dedicated module
- Position mapping should be separate from sync orchestration
- Sync state should integrate with the existing application state management pattern

---

## Assumptions

1. **Preview AST provides source positions**: The preview pane's MDX compilation produces AST nodes with line/column information that can be used for position mapping.
2. **Editor scroll API available**: The editor component exposes methods to get current scroll position and scroll to a specific line.
3. **Preview is an iframe or scrollable container**: The preview pane can receive and respond to scroll commands.
4. **Single document model**: Sync operates on the currently active document only.
5. **Reasonable document sizes**: Documents are typically under 10,000 lines; extreme documents may have degraded sync accuracy.

---

## Out of Scope

- Cursor position sync (moving cursor based on preview click)
- Selection sync (highlighting corresponding text in both panes)
- Zoom level sync between editor and preview
- Multi-document sync (syncing across multiple open documents)
- Sync with external preview windows
- Custom position mapping rules

---

## Dependencies

- **Spec 002 (Editor Core)**: CodeMirror scroll API and line position methods
- **Spec 003 (Preview Pane)**: Preview scroll container and rendered content access
- **Spec 005 (Command Palette)**: Command registration for sync toggle
- **Spec 006 (Application Shell)**: Settings persistence and layout integration

---

## Glossary

- **Sync Mode**: User-configurable setting that controls which direction(s) scroll synchronization operates
- **Scroll Lock**: Temporary state that prevents feedback loops by ignoring scroll events from the sync target
- **Position Mapping**: The relationship between an editor line number and a preview scroll position
- **Debounce**: Delaying action until a pause in rapid events (e.g., scroll events during continuous scrolling)

---

## Clarifications

### Session 2026-01-17

- Q: What is the position mapping accuracy tolerance for acceptance testing? → A: 5-line tolerance (rendered content within 5 lines of editor position, per SC-004)
- Q: When sync is toggled back on, which mode should be restored? → A: Persist last mode - remember and restore the last non-disabled mode used (across sessions)
- Q: How should simultaneous scroll conflicts be resolved? → A: Editor priority - editor scroll always takes precedence over preview scroll in conflicts
- Q: What happens when a document is first opened? → A: Sync to top - both panes start at the top of the document
- Q: How long should the sync toggle notification display? → A: 2 seconds auto-dismiss (standard toast duration)
