# Feature Specification: Editor Core

**Feature Branch**: `002-editor-core`
**Created**: 2026-01-09
**Status**: Draft
**Input**: User description: "Implement the CodeMirror 6 editor integration for mdxpad. This lane owns all editor functionality including MDX syntax highlighting, state management, commands, and keybindings."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Editor with Content (Priority: P1)

As a user, when I open a file or create a new document, I see an editor with proper MDX syntax highlighting (Markdown + JSX), so I can immediately start editing.

**Why this priority**: This is the fundamental capability—without a working editor with syntax highlighting, no other features matter. This enables the core editing experience.

**Independent Test**: Can be fully tested by opening a new document and verifying the editor renders with syntax highlighting, delivering immediate editing capability.

**Acceptance Scenarios**:

1. **Given** a new document is created, **When** the editor loads, **Then** the editor is visible and accepts input within 100ms
2. **Given** an MDX file with content is opened, **When** the editor renders, **Then** syntax highlighting correctly distinguishes Markdown headings, JSX tags, and code blocks
3. **Given** an MDX file with frontmatter, **When** the editor renders, **Then** YAML content between `---` delimiters is highlighted as frontmatter

---

### User Story 2 - Edit MDX Content (Priority: P1)

As a user, I can type MDX content with real-time syntax highlighting that correctly distinguishes Markdown, JSX tags, JavaScript expressions, and frontmatter, so I understand my document structure.

**Why this priority**: Real-time feedback while typing is essential for the editing experience. Users need to see their document structure as they type.

**Independent Test**: Can be fully tested by typing various MDX elements and verifying each token type receives appropriate highlighting.

**Acceptance Scenarios**:

1. **Given** I am typing Markdown content, **When** I type a heading with `#`, **Then** the heading is immediately highlighted as a heading
2. **Given** I am in the editor, **When** I type a JSX tag like `<Button>`, **Then** the tag name and brackets are highlighted as JSX
3. **Given** I am typing an MDX expression, **When** I type `{variable}`, **Then** the expression is highlighted distinctly from surrounding Markdown
4. **Given** I am typing in a code block, **When** I specify a language (e.g., ` ```javascript `), **Then** the code receives language-specific highlighting

---

### User Story 3 - Use Editor Commands (Priority: P1)

As a user, I can use keyboard shortcuts to format my content, so I can write efficiently without using menus.

**Why this priority**: Keyboard commands are essential for productivity. Power users expect standard shortcuts to work immediately.

**Independent Test**: Can be fully tested by selecting text and using keyboard shortcuts, verifying the correct formatting is applied.

**Acceptance Scenarios**:

1. **Given** text is selected, **When** I press Cmd+B, **Then** the selection is wrapped in `**` (bold)
2. **Given** text is selected, **When** I press Cmd+I, **Then** the selection is wrapped in `*` (italic)
3. **Given** text is selected, **When** I press Cmd+E, **Then** the selection is wrapped in `` ` `` (inline code)
4. **Given** text is selected, **When** I press Cmd+K, **Then** the selection is converted to a link format `[text](url)` with cursor positioned in the URL
5. **Given** cursor is on a line, **When** I press Cmd+1/2/3, **Then** the line is converted to the corresponding heading level
6. **Given** I made a change, **When** I press Cmd+Z, **Then** the change is undone
7. **Given** I undid a change, **When** I press Cmd+Shift+Z, **Then** the change is redone

---

### User Story 4 - Navigate Document (Priority: P2)

As a user, I can use keyboard shortcuts to find text and navigate to specific lines, so I can work efficiently with large documents.

**Why this priority**: Navigation is important for productivity but not essential for basic editing. Users can work without it initially.

**Independent Test**: Can be fully tested by opening a document, using find/replace and go-to-line commands, verifying navigation works correctly.

**Acceptance Scenarios**:

1. **Given** I am in the editor, **When** I press Cmd+F, **Then** a find panel appears with search functionality
2. **Given** I am searching, **When** I type a search term, **Then** all matches are highlighted in the document
3. **Given** I am in the editor, **When** I press Cmd+Shift+F, **Then** a find-and-replace panel appears
4. **Given** I am in the editor, **When** I press Cmd+G, **Then** a go-to-line input appears and I can jump to a specific line number

---

### User Story 5 - Configure Editor (Priority: P2)

As a user, I can toggle line numbers, word wrap, and adjust tab size, so the editor fits my workflow.

**Why this priority**: Customization improves user experience but is not essential for core functionality. Default settings work for most users initially.

**Independent Test**: Can be fully tested by changing editor preferences and verifying the editor updates to reflect the new settings.

**Acceptance Scenarios**:

1. **Given** line numbers are enabled, **When** I toggle them off, **Then** line numbers disappear from the editor
2. **Given** a long line exists, **When** I enable word wrap, **Then** the line wraps visually at the editor boundary
3. **Given** default tab size is 2, **When** I change it to 4, **Then** new tabs indent by 4 spaces

---

### Edge Cases

- What happens when the document is extremely large (10MB+)? The editor must remain responsive with keystroke latency under 16ms.
- What happens when invalid JSX syntax is typed? The editor should continue highlighting other elements correctly without crashing.
- What happens when the user pastes a large block of text? The editor must handle it without freezing.
- What happens when the user rapidly types while syntax highlighting is updating? Highlighting must not block typing.
- What happens when the system theme changes (light/dark)? The editor must update its theme automatically.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render an interactive text editor that accepts user input within 100ms of document open
- **FR-002**: System MUST highlight MDX syntax including Markdown elements, JSX tags, JSX attributes, JavaScript expressions, and frontmatter (YAML between `---` delimiters)
- **FR-003**: System MUST highlight code blocks with language-specific syntax highlighting when a language is specified
- **FR-004**: System MUST display line numbers (toggleable via configuration)
- **FR-005**: System MUST highlight the currently active line
- **FR-006**: System MUST match and highlight bracket pairs
- **FR-007**: System MUST auto-close brackets, quotes, and JSX tags
- **FR-008**: System MUST display indentation guides
- **FR-009**: System MUST support word wrap (toggleable via configuration)
- **FR-010**: System MUST provide keyboard commands for text formatting:
  - Bold (Cmd+B): wrap selection in `**`
  - Italic (Cmd+I): wrap selection in `*`
  - Code (Cmd+E): wrap selection in `` ` ``
  - Link (Cmd+K): wrap selection in `[]()`
  - Heading levels (Cmd+1/2/3): prefix line with #/##/###
- **FR-011**: System MUST provide undo (Cmd+Z) and redo (Cmd+Shift+Z) functionality
- **FR-012**: System MUST provide find functionality (Cmd+F) with match highlighting
- **FR-013**: System MUST provide find-and-replace functionality (Cmd+Shift+F)
- **FR-014**: System MUST provide go-to-line functionality (Cmd+G)
- **FR-015**: System MUST emit change events when the document content changes, with configurable debounce (default 150ms)
- **FR-016**: System MUST expose current content and selection state for external consumption
- **FR-017**: System MUST support light and dark themes that follow system preference
- **FR-018**: System MUST sync with the shared EditorState type interface defined in Spec 001
- **FR-019**: System MUST log internal errors (syntax highlighting failures, command execution errors) to the developer console AND emit structured error events for external consumption

### Key Entities

- **EditorState**: Represents the current state of the editor, including document content and selection. Defined in `src/shared/types/editor.ts` (Spec 001).
- **Selection**: Represents the current cursor position or text selection range within the document.
- **EditorConfig**: Configuration options controlling editor behavior (line numbers, word wrap, tab size, etc.).
- **EditorChange**: Event payload emitted when document content changes, containing change details.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Editor renders and accepts input within 100ms of document open
- **SC-002**: MDX syntax highlighting correctly identifies all token types (Markdown, JSX, expressions, frontmatter, code blocks)
- **SC-003**: All keyboard shortcuts function correctly with no conflicts
- **SC-004**: Keystroke latency remains below 16ms for documents up to 10,000 characters (p99)
- **SC-005**: Find functionality highlights all matches and allows navigation between them
- **SC-006**: Theme changes (light/dark) apply immediately when system preference changes
- **SC-007**: Build and type checking pass without errors (`pnpm typecheck`, `pnpm lint`, `pnpm build`)

## Clarifications

### Session 2026-01-09

- Q: How should editor errors (syntax highlighting failures, command execution errors) be handled for debugging? → A: Console + Structured - log to developer console AND emit error events for external consumption

## Assumptions

- The shared type definitions from Spec 001 (`EditorState`, `EditorConfig`, `EditorChange`, etc.) are stable and will not change during implementation.
- The application will be running in an Electron renderer process with appropriate security configuration per Constitution Article III.
- Default debounce for change events (150ms) is appropriate for typical use; can be adjusted later if needed.
- Tab size default of 2 spaces follows common convention; configurable to support other preferences.
- The editor will be the primary content of the application window (not embedded in a complex layout) for this spec.

## Dependencies

- **Spec 001**: Interface Contracts - defines the `EditorState`, `Selection`, `EditorConfig`, and `EditorChange` types that this feature must implement against.
- **Constitution Article II**: Technology stack (TypeScript 5.9.x strict, React 19, CodeMirror 6).
- **Constitution Article III Section 3.4**: Editor architecture requirements.
- **Constitution Article V**: Performance budgets (keystroke latency < 16ms).
