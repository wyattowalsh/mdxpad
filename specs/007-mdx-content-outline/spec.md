# Feature Specification: MDX Content Outline/Navigator

**Feature Branch**: `007-mdx-content-outline`
**Created**: 2026-01-17
**Status**: Clarified
**Input**: User description: "MDX Content Outline/Navigator - A live document outline panel showing headings tree (h1-h6), component hierarchy, and frontmatter sections with click-to-navigate functionality. Displays as a collapsible sidebar that updates in real-time as the user edits. Integrates with existing preview AST parsing and useErrorNavigation hook for cursor positioning."

---

## Executive Summary

The MDX Content Outline/Navigator provides a live, interactive table of contents for MDX documents. It transforms the document's structure into a navigable tree view, enabling writers to:

1. **See document structure at a glance** - Headings hierarchy, component usage, and frontmatter metadata displayed in a collapsible tree
2. **Navigate instantly** - Click any outline item to jump directly to that location in the editor
3. **Understand component usage** - See which JSX components are used and where in the document
4. **Access frontmatter quickly** - View and navigate to frontmatter fields without scrolling

This feature leverages the existing MDX AST parsing from the preview pane, avoiding duplicate compilation while providing real-time updates as the user edits.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate Document via Headings (Priority: P1)

A writer working on a long MDX document wants to jump to a specific section. They glance at the outline panel on the side and see all headings organized by level. They click "## Installation" and the editor instantly scrolls to that heading with the cursor positioned at the start of the line.

**Why this priority**: Heading navigation is the core value of any document outline. It's the primary use case that users expect and delivers immediate productivity gains for long documents.

**Independent Test**: Can be fully tested by opening a document with multiple headings, clicking each heading in the outline, and verifying the editor jumps to the correct line.

**Acceptance Scenarios**:

1. **Given** a document with headings at various levels (h1-h6), **When** the outline panel is visible, **Then** all headings appear in a hierarchical tree reflecting their nesting structure
2. **Given** the outline shows a heading, **When** the user clicks that heading, **Then** the editor scrolls to show that heading and positions the cursor at the start of the heading line
3. **Given** a heading is clicked, **When** the cursor moves to that line, **Then** the heading line is briefly highlighted to help the user locate it
4. **Given** the user is editing content, **When** they add, remove, or modify headings, **Then** the outline updates within 500ms to reflect the changes

---

### User Story 2 - Toggle Outline Panel Visibility (Priority: P1)

A writer sometimes needs more screen space for editing. They can quickly hide the outline panel using a keyboard shortcut or toggle button, and restore it when needed. The visibility preference is remembered across sessions.

**Why this priority**: Without the ability to show/hide, the outline would consume precious screen space. This is essential for the feature to be usable.

**Independent Test**: Can be tested by toggling the outline on/off via shortcut, verifying the panel hides and shows correctly, and checking persistence after app restart.

**Acceptance Scenarios**:

1. **Given** the outline panel is visible, **When** the user presses the toggle shortcut (Cmd+Shift+O), **Then** the outline panel hides and the editor/preview area expands
2. **Given** the outline panel is hidden, **When** the user presses the toggle shortcut, **Then** the outline panel appears
3. **Given** the user hides the outline panel, **When** they restart the app, **Then** the outline remains hidden (persistence)
4. **Given** the outline is visible, **When** the user clicks the close button on the panel header, **Then** the outline hides

---

### User Story 3 - View Component Usage (Priority: P2)

A writer using custom JSX components wants to see all components used in the document. The outline panel shows a "Components" section listing each unique component type with the count of occurrences. Expanding a component shows each instance location which can be clicked to navigate.

**Why this priority**: Component navigation is valuable for MDX-heavy documents but is secondary to heading navigation which serves all users.

**Independent Test**: Can be tested by creating a document with JSX components, verifying the Components section lists them, and clicking to navigate to each instance.

**Acceptance Scenarios**:

1. **Given** a document contains JSX components (e.g., `<Callout>`, `<CodeBlock>`), **When** the outline is visible, **Then** a "Components" section lists each unique component type
2. **Given** a component type has multiple instances, **When** the user expands that component type, **Then** they see each instance with its line number
3. **Given** a component instance is listed, **When** the user clicks it, **Then** the editor jumps to that component's location
4. **Given** the user adds or removes components, **When** the outline updates, **Then** the Components section reflects the current component usage

---

### User Story 4 - View Frontmatter Summary (Priority: P2)

A writer wants to check the document's frontmatter metadata (title, date, tags) without scrolling to the top. The outline panel shows a "Frontmatter" section that displays key fields. Clicking the frontmatter section navigates to line 1.

**Why this priority**: Frontmatter access is useful for document metadata but most users can scroll to the top easily. It's a convenience feature.

**Independent Test**: Can be tested by creating a document with YAML frontmatter, verifying it appears in the outline, and clicking to navigate.

**Acceptance Scenarios**:

1. **Given** a document has YAML frontmatter, **When** the outline is visible, **Then** a "Frontmatter" section appears showing key fields (title, date, author, tags if present)
2. **Given** the frontmatter section is visible, **When** the user clicks it, **Then** the editor jumps to line 1 (start of frontmatter)
3. **Given** a document has no frontmatter, **When** the outline is visible, **Then** the Frontmatter section is not shown
4. **Given** the user modifies frontmatter, **When** the outline updates, **Then** the Frontmatter section reflects the changes

---

### User Story 5 - Collapse/Expand Outline Sections (Priority: P3)

A writer working on a complex document wants to focus on specific parts of the outline. They can collapse sections (Headings, Components, Frontmatter) to reduce visual clutter, and expand them when needed. Collapse state persists during the session.

**Why this priority**: Collapse functionality is a polish feature that improves usability but doesn't block core navigation.

**Independent Test**: Can be tested by collapsing sections, verifying they stay collapsed during editing, and expanding them again.

**Acceptance Scenarios**:

1. **Given** a section header (Headings, Components, Frontmatter) has a collapse toggle, **When** the user clicks it, **Then** the section content collapses/expands
2. **Given** a section is collapsed, **When** the document updates, **Then** the section remains collapsed (state preserved)
3. **Given** multiple sections exist, **When** the user collapses one, **Then** other sections are unaffected
4. **Given** the app is restarted, **When** the outline loads, **Then** sections start expanded (session-only persistence)

---

### Edge Cases

- **What happens when** the document has no headings, no components, and no frontmatter? → Show an empty state message: "No outline available. Add headings, components, or frontmatter to see the document structure."
- **What happens when** the document has syntax errors that prevent AST parsing? → Show the last valid outline with a warning indicator, or show "Unable to parse document" if no valid outline exists
- **What happens when** a heading text is very long? → Truncate with ellipsis after ~40 characters, show full text on hover
- **What happens when** the user rapidly scrolls through the document? → Outline does not track scroll position (no active item highlighting based on scroll - only click-to-navigate)
- **What happens when** outline panel width is very narrow? → Enforce minimum width of 150px; text truncates with ellipsis
- **What happens when** window is too narrow for outline + editor + preview? → Outline auto-hides when window width drops below threshold (similar to preview auto-hide behavior)

---

## Requirements *(mandatory)*

### Functional Requirements

#### Outline Panel Layout

- **FR-001**: System MUST display the outline panel as a collapsible sidebar on the left side of the application, between the window edge and the editor
- **FR-002**: System MUST allow the outline panel to be toggled visible/hidden via keyboard shortcut (Cmd+Shift+O)
- **FR-003**: System MUST persist outline panel visibility preference across sessions using the existing settings store
- **FR-004**: System MUST auto-hide the outline when window width is insufficient (below 600px with preview visible, or below 400px with preview hidden)
- **FR-005**: System MUST provide a close button in the outline panel header to hide the panel

#### Headings Tree

- **FR-006**: System MUST parse the current document and extract all markdown headings (h1-h6)
- **FR-007**: System MUST display headings in a hierarchical tree structure reflecting their nesting based on level (h1 > h2 > h3, etc.)
- **FR-008**: System MUST show heading text content as the tree node label
- **FR-009**: System MUST truncate heading labels longer than 40 characters with ellipsis, showing full text on hover
- **FR-010**: System MUST update the headings tree within 500ms of document changes

#### Component List

- **FR-011**: System MUST parse the current document and identify all JSX component usages
- **FR-012**: System MUST group components by type, showing unique component names with usage count
- **FR-013**: System MUST allow expanding a component type to see individual instances with line numbers
- **FR-014**: System MUST distinguish between built-in components (Callout, CodeBlock, etc.) and custom/unknown components visually
- **FR-015**: System MUST update the component list within 500ms of document changes

#### Frontmatter Section

- **FR-016**: System MUST parse YAML frontmatter if present and display key fields (title, date, author, description, tags)
- **FR-017**: System MUST limit displayed frontmatter to common fields, with option to expand for all fields
- **FR-018**: System MUST hide the Frontmatter section if the document has no frontmatter
- **FR-019**: System MUST update the frontmatter display within 500ms of document changes

#### Navigation

- **FR-020**: System MUST navigate the editor to the clicked outline item's source location
- **FR-021**: System MUST position the cursor at the start of the target line after navigation
- **FR-022**: System MUST briefly highlight the target line after navigation (flash highlight for 500ms)
- **FR-023**: System MUST use the existing useErrorNavigation hook pattern for cursor positioning
- **FR-024**: System MUST scroll the editor to center the target line in view when possible

#### Collapsible Sections

- **FR-025**: System MUST allow each main section (Headings, Components, Frontmatter) to be collapsed/expanded
- **FR-026**: System MUST preserve collapse state during the editing session
- **FR-027**: System MUST allow nested heading levels to be collapsed (e.g., collapse all h3+ under an h2)
- **FR-028**: System MUST start with all sections expanded on app launch

#### AST Integration

- **FR-029**: System MUST reuse AST data from the preview pane's MDX compilation when available
- **FR-030**: System MUST fall back to a lightweight parser if preview AST is unavailable
- **FR-031**: System MUST handle AST parsing failures gracefully, showing the last valid outline or an error state
- **FR-032**: System MUST extract source position information (line, column) from AST nodes for navigation

---

### Key Entities

- **OutlineItem**: Represents a single navigable item with: type ('heading' | 'component' | 'frontmatter'), label (display text), level (1-6 for headings, 0 otherwise), line (source line number), column (source column), children (nested items)

- **OutlineSection**: A top-level grouping with: id ('headings' | 'components' | 'frontmatter'), label (display name), items (array of OutlineItems), isCollapsed (boolean), isEmpty (boolean)

- **OutlineState**: The complete outline with: sections (array of OutlineSections), isVisible (panel visibility), lastUpdated (timestamp), parseError (error message if parsing failed)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can navigate from outline item click to editor position within 100ms (perceived instant)
- **SC-002**: Outline updates reflect document changes within 500ms of typing pause
- **SC-003**: Outline panel toggle responds within 50ms of keyboard shortcut
- **SC-004**: Outline parsing adds less than 50ms overhead to the existing preview compilation cycle
- **SC-005**: 100% of headings in the document are represented in the outline
- **SC-006**: 100% of JSX component usages are identified and listed
- **SC-007**: Users can complete a full navigation workflow (open outline, click item, edit, see update) in under 3 seconds
- **SC-008**: Outline panel visibility preference persists correctly across 100% of app restarts

---

## Non-Functional Requirements

### Performance

- Outline parsing must not block the main thread or cause editor input lag
- Debounce outline updates to avoid excessive re-parsing during rapid typing
- Reuse AST from preview compilation to avoid duplicate parsing overhead

### Accessibility

- Outline tree must be navigable via keyboard (arrow keys to move, Enter to select)
- All outline items must have appropriate ARIA roles (tree, treeitem)
- Screen readers must announce outline structure and navigation actions

### Maintainability

- Outline parsing logic should be separate from UI components
- Outline state should integrate with existing Zustand store pattern
- Navigation should use existing hooks rather than duplicating cursor control logic

---

## Assumptions

1. **Preview AST is available via store**: The preview pane already compiles MDX and produces an AST. The preview store will be extended to expose this AST as a subscribable field, allowing the outline component to receive reactive updates.
2. **Single document model**: The outline reflects the currently active document (no multi-document support yet).
3. **Standard MDX structure**: Headings use standard markdown syntax (# through ######). Non-standard heading patterns are out of scope.
4. **Existing navigation pattern**: The useErrorNavigation hook from spec 006 provides a proven pattern for cursor positioning that can be extended.
5. **Left-side panel placement**: The outline is positioned on the left, consistent with VS Code and other editors. Alternative placements are out of scope.

---

## Out of Scope

- Drag-and-drop reordering of headings via outline
- Outline search/filter functionality
- Active item highlighting based on scroll position (sync outline selection with cursor)
- Custom outline configurations or filtering rules
- Outline export or printing
- Multi-document outline (showing structure across files)
- Bookmark/favorites within outline

---

## Dependencies

- **Spec 003 (Preview Pane)**: MDX compilation and AST generation
- **Spec 006 (Application Shell)**: Layout integration, settings persistence, useErrorNavigation hook
- **Spec 005 (Command Palette)**: Command registration for outline toggle

---

## Glossary

- **AST**: Abstract Syntax Tree - the parsed representation of MDX document structure
- **Outline Item**: A single entry in the outline representing a heading, component, or frontmatter field
- **Source Position**: The line and column number in the source document where an element appears
- **Tree View**: A hierarchical UI component showing nested items with expand/collapse capability

---

## Clarifications

### Session 2026-01-17

**Q1: AST Data Access Contract**

*How should the outline component access the preview pane's parsed AST?*

**Decision**: Extend preview store with AST field

The preview store will be extended to expose the parsed AST as a subscribable field. The outline component will subscribe to this field to receive AST updates reactively. This approach:
- Maintains clear store boundaries
- Enables reactive updates via Zustand subscriptions
- Keeps AST ownership in the preview domain
- Requires minimal changes to existing architecture

---

**Q2: Heading Nesting Algorithm**

*How should the outline handle non-standard heading sequences (e.g., h1 followed directly by h3, skipping h2)?*

**Decision**: Strict nesting (canonical behavior)

A heading becomes a child of the nearest preceding heading with a smaller level number, regardless of skipped levels. This matches VS Code, GitHub, Obsidian, Notion, and other major editors. Example:
- `# Intro` → `├── Intro`
- `### Deep point` → `│   └── Deep point`
- `## Section` → `└── Section`

---

**Q3: Built-in Component Recognition**

*What components should be recognized as "built-in" for visual distinction?*

**Decision**: MDX ecosystem standard components

Recognize components commonly provided by MDX setups: `Callout`, `Note`, `Warning`, `Tip`, `CodeBlock`, `Tabs`, `Tab`, `Card`, `Image`, `Link`. These receive distinct visual styling in the outline. All other components display as custom/unknown. List is extensible via configuration in future iterations.

---

**Q4: Frontmatter Display Fields**

*Which frontmatter fields should display by default vs. require expansion?*

**Decision**: Title + 3 key metadata fields

Show `title`, `date`, `author`, `tags` by default in the Frontmatter section. A "Show all" toggle reveals any additional fields present in the document. This balances quick access to common metadata with the ability to view everything when needed.

---

**Q5: Auto-Hide Behavior**

*When the outline auto-hides due to window constraints, what should happen to user preference and recovery?*

**Decision**: Preserve preference, auto-restore

If the user had the outline visible, auto-hide it when the window becomes too narrow, then auto-restore it when the window widens past the threshold again. The user's visibility preference remains unchanged throughout. This provides seamless responsive behavior without forcing manual intervention after window resizing.
