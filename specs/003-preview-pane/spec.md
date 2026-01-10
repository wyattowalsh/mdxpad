# Feature Specification: Preview Pane

**Feature Branch**: `003-preview-pane`
**Created**: 2026-01-09
**Status**: Draft
**Input**: User description: "Implement the live MDX preview pane for mdxpad. This lane owns MDX compilation, preview rendering in a sandboxed iframe, and real-time updates as the user types."

## Clarifications

### Session 2026-01-09

- Q: Where should compilation and runtime errors be displayed in the preview pane? → A: Errors replace preview content entirely (with last-good preview cached but hidden)
- Q: What is the maximum document size the preview should support? → A: No hard limit; performance degrades gracefully with warning above recommended size
- Q: How should custom component support balance flexibility with safety? → A: Hardened sandbox (C1-H): allow-scripts, no same-origin, no network, unidirectional postMessage, honest UI warning

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Live Preview Updates (Priority: P1)

As a user editing MDX content, I want to see my rendered output update in real-time as I type, so I can immediately verify that my content looks correct without manual refresh.

**Why this priority**: This is the core value proposition of a live preview pane. Without real-time updates, users have no way to visualize their MDX content, making the entire feature useless.

**Independent Test**: Can be fully tested by typing MDX content into an editor and observing the preview pane update within 500ms. Delivers immediate visual feedback value.

**Acceptance Scenarios**:

1. **Given** the user has MDX content in the editor, **When** the user types additional text, **Then** the preview pane updates to show the rendered output within 500ms of the last keystroke.
2. **Given** the user has valid MDX with Markdown formatting, **When** the preview renders, **Then** all Markdown elements (headings, lists, links, emphasis, code) display with appropriate styling.
3. **Given** the user makes rapid consecutive edits, **When** updates are debounced, **Then** the preview renders once after typing stops (default 300ms debounce).

---

### User Story 2 - Compilation Error Display (Priority: P1)

As a user writing MDX, when I make a syntax error, I want to see a clear error message with the line number where the error occurred, so I can quickly fix the issue without guessing.

**Why this priority**: Error visibility is critical for usability. Without clear error messages, users cannot debug their MDX content effectively, leading to frustration and abandonment.

**Independent Test**: Can be fully tested by intentionally introducing syntax errors and verifying error messages display with line numbers. Delivers debugging capability independently.

**Acceptance Scenarios**:

1. **Given** the user has MDX with a syntax error, **When** compilation fails, **Then** the error message replaces the preview content entirely (last successful render is cached but hidden).
2. **Given** a compilation error with position information, **When** the error displays, **Then** the line number and column are shown to help locate the issue.
3. **Given** the user fixes a syntax error, **When** the MDX becomes valid, **Then** the error clears and the preview renders normally.
4. **Given** multiple syntax errors exist, **When** compilation fails, **Then** all errors are displayed in a list.

---

### User Story 3 - Built-in Component Rendering (Priority: P1)

As a user, I want to use built-in MDX components like Callout, CodeBlock, and Tabs in my documents, so I can create rich, interactive content without writing custom components.

**Why this priority**: Built-in components provide immediate value and differentiate mdxpad from plain Markdown editors. Users expect these components to "just work" without configuration.

**Independent Test**: Can be fully tested by writing MDX that uses each built-in component and verifying correct rendering. Delivers rich content authoring capability independently.

**Acceptance Scenarios**:

1. **Given** MDX content using a Callout component, **When** the preview renders, **Then** the callout displays with the appropriate variant styling (info, warning, error, success, note, tip).
2. **Given** MDX content using a CodeBlock component, **When** the preview renders, **Then** the code displays with syntax highlighting and a copy button.
3. **Given** MDX content using Tabs/Tab components, **When** the preview renders, **Then** the user can switch between tabbed content sections.
4. **Given** MDX content using Card/CardGrid components, **When** the preview renders, **Then** cards display in a grid layout with working links.
5. **Given** MDX content using FileTree component, **When** the preview renders, **Then** a directory structure visualization displays correctly.

---

### User Story 4 - Frontmatter Parsing (Priority: P2)

As a user, I want to include YAML frontmatter in my MDX documents, so I can define metadata that components or the application can use.

**Why this priority**: Frontmatter is a standard MDX feature but secondary to core preview functionality. The preview can work without it, but power users expect frontmatter support.

**Independent Test**: Can be fully tested by adding frontmatter to MDX and verifying it parses without errors and is accessible to components. Delivers metadata capability independently.

**Acceptance Scenarios**:

1. **Given** MDX content with valid YAML frontmatter, **When** the preview compiles, **Then** the frontmatter is parsed and available to components.
2. **Given** MDX content with frontmatter, **When** the preview renders, **Then** the frontmatter block itself is not displayed as visible content.
3. **Given** invalid YAML in frontmatter, **When** compilation occurs, **Then** a clear error message indicates the frontmatter parsing issue.

---

### User Story 5 - Scroll Synchronization (Priority: P2)

As a user, when I scroll through my MDX document in the editor, I want the preview to scroll to roughly the same position, so I can always see the content I'm editing.

**Why this priority**: Scroll sync is a quality-of-life feature that improves usability but is not required for basic preview functionality.

**Independent Test**: Can be fully tested by scrolling the editor and verifying the preview scrolls proportionally. Delivers navigation convenience independently.

**Acceptance Scenarios**:

1. **Given** a long MDX document open in the editor, **When** the user scrolls in the editor, **Then** the preview scrolls to approximately the same relative position.
2. **Given** scroll synchronization is active, **When** the preview scrolls, **Then** the animation is smooth (not jarring jumps).

---

### User Story 6 - Theme Synchronization (Priority: P2)

As a user, I want the preview pane to match the application's light or dark theme, so the preview appearance is consistent with the rest of the interface.

**Why this priority**: Theme consistency is important for user experience but does not affect core preview functionality.

**Independent Test**: Can be fully tested by toggling the app theme and verifying the preview updates. Delivers visual consistency independently.

**Acceptance Scenarios**:

1. **Given** the application is in light mode, **When** the preview renders, **Then** the preview displays with light theme styling.
2. **Given** the application is in dark mode, **When** the preview renders, **Then** the preview displays with dark theme styling.
3. **Given** the user toggles the theme, **When** the theme changes, **Then** the preview updates to match without requiring re-compilation.

---

### Edge Cases

- What happens when MDX content is empty? The preview displays a blank or placeholder state.
- What happens when a component throws a runtime error? The error replaces preview content entirely, displaying the error message (last successful render is cached for restoration).
- What happens when compilation takes longer than expected? A loading/compiling indicator is shown to provide feedback.
- What happens when the user pastes a large amount of content? The preview still updates (main thread never blocked); if document exceeds recommended size, a non-blocking performance warning is shown.
- What happens when a component referenced in MDX doesn't exist? A clear error message indicates the missing component name.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST compile MDX content to renderable output using a standard MDX compiler.
- **FR-002**: System MUST render the compiled MDX in a sandboxed iframe with `sandbox="allow-scripts"` only (no `allow-same-origin`, no `allow-top-navigation`).
- **FR-003**: System MUST update the preview within 500ms of the user's last edit.
- **FR-004**: System MUST debounce compilation with a configurable delay (default 300ms) to avoid excessive recompilation during rapid typing.
- **FR-005**: System MUST run MDX compilation off the main thread to prevent UI blocking.
- **FR-006**: System MUST display compilation errors with message, line number, and column when available.
- **FR-007**: System MUST clear error state and render normally when MDX becomes valid after an error.
- **FR-008**: System MUST cache the last successful render and restore it when errors are resolved (errors replace preview content entirely while active).
- **FR-009**: System MUST provide built-in MDX components: Typography elements (h1-h6, p, a, ul, ol, li, blockquote, hr, table).
- **FR-010**: System MUST provide a CodeBlock component with syntax highlighting and copy-to-clipboard functionality.
- **FR-011**: System MUST provide a Callout component with variants: info, warning, error, success, note, tip.
- **FR-012**: System MUST provide Tabs/Tab components for tabbed content sections.
- **FR-013**: System MUST provide Card/CardGrid components for linked cards in grid layout.
- **FR-014**: System MUST provide a FileTree component for directory structure visualization.
- **FR-015**: System MUST support GitHub Flavored Markdown (tables, strikethrough, task lists, autolinks).
- **FR-016**: System MUST parse YAML frontmatter and make it available to components.
- **FR-017**: System MUST enforce Content Security Policy on the preview container: `default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data: https:; connect-src 'none'`.
- **FR-018**: System MUST use unidirectional message passing: parent→child for render commands only; child→parent for size/ready signals only (no data queries).
- **FR-019**: System MUST expose preview state (idle, compiling, success, error) via a state management hook for UI indicators.
- **FR-020**: System MUST synchronize preview scroll position with editor scroll position.
- **FR-021**: System MUST inherit the application theme (light/dark) in the preview container.
- **FR-022**: System MUST catch runtime component errors and display them gracefully rather than breaking the entire preview.
- **FR-023**: System MUST display a non-blocking performance warning when document size exceeds a recommended threshold, while still rendering the preview.
- **FR-024**: System MUST support custom React components (with hooks) in MDX, executing within the hardened sandbox.
- **FR-025**: System MUST display an honest UI indicator that "Preview executes code from your MDX" to inform users of code execution.
- **FR-026**: System MUST NOT pass sensitive data (auth tokens, file paths, editor state) to the preview iframe.

### Key Entities

- **CompileResult**: The outcome of MDX compilation - either success (with compiled code and frontmatter) or failure (with error list).
- **CompileError**: A compilation error with message, and optional line/column/source information.
- **PreviewState**: The current state of the preview pane - idle, compiling, success (with result), or error (with errors).
- **PreviewConfig**: Configuration for preview behavior including debounce timing and component overrides.
- **MDXComponent**: A built-in component available for use in MDX documents (Callout, CodeBlock, Tabs, Card, FileTree, etc.).

## Assumptions

- The editor component will provide the MDX source text and scroll position as inputs.
- The application has a global theme context that the preview can subscribe to.
- Built-in components will use CSS variables for theming to enable light/dark mode support.
- The debounce time of 300ms is appropriate for most users; power users may want to configure this.
- Source position mapping from MDX compilation is available for scroll synchronization.
- MDXPad is a local-first editor where users execute their own MDX code (not untrusted third-party content).
- The hardened sandbox (no same-origin, no network) provides sufficient isolation for the local-first threat model.
- Users understand that previewing MDX executes code, similar to running any code file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users see preview updates within 500ms of their last edit in 95% of cases for typical documents; larger documents degrade gracefully with a performance warning displayed.
- **SC-002**: The main application interface remains responsive during MDX compilation (no UI freezes or jank).
- **SC-003**: All 6 built-in component types render correctly with their documented variants/options.
- **SC-004**: Compilation errors display with line numbers in 100% of cases where position information is available.
- **SC-005**: The preview container passes Content Security Policy validation per application security requirements.
- **SC-006**: Users can successfully author MDX documents using all supported Markdown features (GFM) on first attempt.
- **SC-007**: Theme changes reflect in the preview within 100ms without requiring page reload.
- **SC-008**: Runtime component errors are caught and displayed gracefully in 100% of cases (no blank/broken preview).
