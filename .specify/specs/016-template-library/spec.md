# Feature Specification: Template Library

**Feature Branch**: `016-template-library`
**Created**: 2026-01-17
**Status**: Clarified
**Input**: User description: "Template Library - Collection of MDX document templates (blog post, documentation, presentation, etc). Template browser with preview. Custom template creation and management. Template metadata (description, tags, author). Integration with new file creation flow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Document from Template (Priority: P1)

A content creator wants to quickly start a new MDX document without building structure from scratch. They open the template library, browse available templates organized by category, preview a template to confirm it matches their needs, and create a new document pre-populated with the template's content and structure.

**Why this priority**: This is the core value proposition of the template library - enabling users to start writing faster with professional structure. Without this capability, the feature has no purpose.

**Independent Test**: Can be fully tested by opening the template browser, selecting any template, previewing it, and creating a new document. Delivers immediate value by reducing document creation time.

**Acceptance Scenarios**:

1. **Given** user has no document open, **When** user opens template library, **Then** a browser displays available templates organized by category
2. **Given** template browser is open, **When** user selects a template, **Then** a live preview shows how the document will look
3. **Given** user is viewing a template preview, **When** user confirms selection, **Then** a new document is created with the template content
4. **Given** user creates document from template, **When** document opens in editor, **Then** content is fully editable and static placeholder markers are visually highlighted with dashed orange border
5. **Given** template contains dynamic variables (e.g., `{{title}}`), **When** user confirms template selection, **Then** a dialog prompts for each variable value before document creation

**Variable Dialog Behavior**:
- If variable extraction fails (malformed syntax): Skip variable, treat as literal text, log warning
- Required variables: User cannot proceed without value (Submit button disabled)
- Optional variables: May be left blank; defaults applied if defined
- Validation: Variable values are trimmed; empty strings for required = invalid
- Cancel behavior: Pressing Escape closes dialog without creating document

---

### User Story 2 - Browse and Filter Templates (Priority: P1)

A user needs to find a specific type of template from a large collection. They use search and filtering capabilities to narrow down templates by category (blog, documentation, presentation), tags, or text search, allowing efficient discovery even with many templates available.

**Why this priority**: Discovery is essential for template utility. A library with no way to find templates becomes unusable as the collection grows.

**Independent Test**: Can be tested by opening the template browser with multiple templates loaded, then using filters and search to locate specific templates. Delivers value by making the right template findable.

**Acceptance Scenarios**:

1. **Given** template browser is open with 10+ templates, **When** user selects a category filter, **Then** only templates in that category are displayed
2. **Given** template browser is open, **When** user types in search field, **Then** templates matching name, description, or tags are shown
3. **Given** filters are applied, **When** user clears filters, **Then** all templates are visible again
4. **Given** no templates match search criteria, **When** results display, **Then** a message "No templates found. Try removing filters or broadening your search." is shown with a "Clear Filters" button

---

### User Story 3 - Create Custom Template (Priority: P2)

A power user wants to save a document structure they've created as a reusable template. They select "Save as Template" from an open document, provide metadata (name, description, tags), and the template becomes available in their personal template collection for future use.

**Why this priority**: Custom templates extend the library's value beyond built-in options. However, users can derive value from built-in templates alone, making this secondary to core browsing/creation.

**Independent Test**: Can be tested by opening an existing document, saving it as a template with metadata, then verifying the template appears in the library and can create new documents. Delivers value by enabling personalized workflows.

**Acceptance Scenarios**:

1. **Given** user has a document open, **When** user initiates "Save as Template", **Then** a dialog prompts for template name, description, category, and tags
2. **Given** user completes template metadata, **When** user saves, **Then** template is added to the custom templates section
3. **Given** custom template exists, **When** user browses templates, **Then** custom templates are visually distinguished from built-in templates
4. **Given** user saves template with duplicate name, **When** save is attempted, **Then** user is prompted to rename or replace existing template

**Duplicate Name Resolution**:
- Dialog shows: "A template named '{name}' already exists. Choose an action:"
- Options: "Replace Existing" (overwrites), "Rename" (focus on name field), "Cancel"
- Name field pre-populated with "{original_name} (2)" for rename
- Uniqueness enforced: names are case-insensitive compared
- Character limits: 1-100 characters, no path separators (/ or \)

---

### User Story 4 - Manage Custom Templates (Priority: P2)

A power user wants to maintain their custom template collection by editing template metadata, updating template content, or removing templates they no longer need.

**Why this priority**: Management capabilities ensure the custom template collection remains useful over time. Deprioritized because users can work around this by recreating templates.

**Independent Test**: Can be tested by editing a custom template's metadata, verifying changes persist, then deleting a template and confirming removal. Delivers value by keeping the template library organized.

**Acceptance Scenarios**:

1. **Given** user has custom templates, **When** user selects "Edit" on a custom template, **Then** template metadata is editable
2. **Given** user edits template metadata, **When** user saves changes, **Then** updated information appears in template browser
3. **Given** user selects "Delete" on a custom template, **When** user confirms deletion, **Then** template is removed from the library
4. **Given** user attempts to delete built-in template, **When** action is attempted, **Then** operation is prevented with explanatory message

---

### User Story 5 - New File Integration (Priority: P3)

When a user initiates the standard "New File" action, they can choose to start from a template instead of a blank document, seamlessly integrating the template library into the existing file creation workflow.

**Why this priority**: While convenient, this is a workflow enhancement rather than core functionality. Users can access templates through the dedicated template browser.

**Independent Test**: Can be tested by triggering New File action, verifying template option appears, selecting it, and confirming template browser opens. Delivers value through workflow integration.

**Acceptance Scenarios**:

1. **Given** user triggers "New File" action, **When** new file dialog appears, **Then** an option to "Start from Template" is available
2. **Given** user selects "Start from Template", **When** option is selected, **Then** template browser opens
3. **Given** user selects template from integrated flow, **When** document is created, **Then** new file workflow continues with template content

---

### Edge Cases

- What happens when template content references components that don't exist in the user's environment?
  - Display a warning but allow creation; mark missing component references in the editor
- How does the system handle templates with invalid MDX syntax?
  - Validate templates before saving; prevent saving templates that fail MDX compilation
- What happens when user has no custom templates?
  - Display only built-in templates with a clear call-to-action to create custom templates
- How does the system handle template metadata in different languages?
  - Support Unicode characters in all metadata fields; no language restrictions
- What happens when a template file becomes corrupted or inaccessible?
  - Skip corrupted templates during loading; display error indicator for affected items

**Unicode Support**: All valid UTF-8 characters are supported including Latin extended, Cyrillic, CJK, RTL scripts (Arabic, Hebrew), and emoji. Metadata fields are validated for well-formed UTF-8 encoding.

### Error Message Specifications

| Scenario | Message Text | UI Treatment |
|----------|--------------|--------------|
| No search results | "No templates found. Try removing filters or broadening your search." | Centered text with "Clear Filters" button |
| Template load error | "Unable to load template: {filename}. The file may be corrupted." | Toast notification with "Retry" action |
| Missing component | "This template uses component '{name}' which is not available." | Yellow warning banner at top of preview |
| MDX syntax error | "Template contains invalid MDX syntax: {error}. Please fix before saving." | Inline error below content field |
| Save failed | "Unable to save template. Check disk space and permissions." | Toast notification with "Retry" action |
| Built-in delete attempt | "Built-in templates cannot be deleted. They are part of the application." | Toast notification (info level) |
| Import failed | "Unable to import template: {reason}. Please check the file format." | Toast notification with error details |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a template browser interface displaying all available templates

**Template Browser Specification**:
- Container: Modal dialog (not sidebar or drawer)
- Initial state: All templates visible, sorted by category then name
- Loading state: Skeleton cards with pulsing animation
- Empty state: "No templates found" with "Create Template" CTA
- Focus management: Focus trapped within modal; initial focus on search input

- **FR-002**: System MUST organize templates into categories: blog, documentation, presentation, notes, tutorial (built-in); custom (user-created)
- **FR-003**: System MUST display template metadata including name, description, tags, and author
- **FR-004**: System MUST provide live preview of selected template content
- **FR-005**: System MUST create new documents populated with selected template content
- **FR-006**: System MUST support text-based search across template names, descriptions, and tags
- **FR-007**: System MUST support filtering templates by category
- **FR-008**: System MUST support filtering templates by tags
- **FR-009**: System MUST allow users to save any open document as a custom template by copying the document content to a new `.mdxt` file with user-provided metadata. Original document remains unchanged. Unsaved documents must be saved first before converting to template.
- **FR-010**: System MUST capture template metadata (name, description, category, tags) when saving custom templates

**Metadata Field Validation**:
| Field | Required | Length | Validation |
|-------|----------|--------|------------|
| name | Yes | 1-100 chars | No path separators, trimmed, unique (case-insensitive) |
| description | Yes | 1-500 chars | Trimmed |
| category | Yes | — | Must be valid TemplateCategory enum value |
| tags | No | Max 10 items, 30 chars each | Trimmed, lowercase normalized, duplicates removed |
| author | No | 0-100 chars | Trimmed, defaults to "Custom" |
- **FR-011**: System MUST persist custom templates across application sessions
- **FR-012**: System MUST allow editing of custom template metadata
- **FR-013**: System MUST allow deletion of custom templates
- **FR-014**: System MUST prevent modification or deletion of built-in templates
- **FR-015**: System MUST validate template MDX syntax before saving custom templates

**MDX Validation Specification**:
- Compiler: @mdx-js/mdx 3.x (per plan.md)
- Errors that block save: Syntax errors, unclosed tags, invalid JSX
- Warnings (allow save): Unknown components, deprecated syntax
- Validation timeout: 2 seconds; timeout = validation failure

- **FR-016**: System MUST integrate template selection into new file creation workflow by adding "Start from Template" option in the New File dialog. Selecting this option opens the template browser modal. Canceling returns to New File dialog. Selecting a template continues the new file workflow with template content populated. File naming follows standard new file conventions ("Untitled.mdx" or user-specified).

- **FR-017**: System MUST visually distinguish between built-in and custom templates

**Built-in Indicator Specification**:
- Icon: Lock icon (🔒) or shield badge in TemplateCard corner
- Label: "Built-in" badge with muted background
- CSS class: `template-card--builtin`
- Accessibility: `aria-label="Built-in template"` on badge

- **FR-018**: System MUST provide at least 5 built-in templates covering common document types (per SC-006: blog post, documentation page, presentation, meeting notes, tutorial)
- **FR-019**: System MUST support keyboard navigation within the template browser

### Keyboard Navigation Specification (FR-019)

| Key | Action |
|-----|--------|
| Tab / Shift+Tab | Move between search, filters, template grid |
| Arrow Up/Down | Navigate template cards vertically |
| Arrow Left/Right | Navigate template cards horizontally |
| Enter | Select focused template / Confirm action |
| Escape | Close modal / Cancel dialog |
| Cmd/Ctrl+F | Focus search input |

**Focus Indicators**:
- Visible focus ring (2px solid blue) on all interactive elements
- Skip-link to template grid for screen readers
- ARIA attributes: `role="grid"`, `aria-label` on template cards

**Focus Trap**:
- Modal traps focus; Tab cycles within modal
- Escape releases trap and closes modal
- **FR-020**: System MUST preserve template placeholder markers that guide users on where to add content
- **FR-021**: System MUST allow users to export custom templates as standalone files for sharing
- **FR-022**: System MUST allow users to import templates from standalone files into their custom collection
- **FR-023**: System MUST use `.mdxt` file format with YAML frontmatter for template storage and exchange

**IPC Contract Reference**: See `contracts/template-schemas.ts` for complete type definitions and Zod validation schemas for all template operations.

- **FR-024**: System MUST support dynamic template variables (e.g., `{{title}}`) that prompt user for values during document creation

**Dynamic Variable Specification**:
- Syntax: `{{variableName}}` (double curly braces)
- Name constraints: `/^[a-zA-Z_][a-zA-Z0-9_]*$/` (same as TemplateVariable.name)
- Special variables: `{{TODAY}}` → current date (YYYY-MM-DD), `{{AUTHOR}}` → system username
- Escaping: `\{{literal}}` renders as `{{literal}}` without substitution
- Extraction regex: `/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g`
- Type: All variables are strings; no type coercion

- **FR-025**: System MUST support static placeholder markers visually distinguished in the editor for manual replacement
- **FR-026**: System MUST substitute all dynamic variables before opening the new document in the editor

**Substitution Failure Handling**:
- Missing required variable: Block document creation, highlight field in dialog
- Missing optional variable: Use default if defined; otherwise preserve `{{variableName}}` literally
- Partial substitution: Allowed for optional variables only
- Order of operations: (1) Dynamic variable substitution, (2) Special variable expansion, (3) Static placeholder preservation

**Placeholder Precedence**:
1. Dynamic variables (`{{variable}}`) are processed first and prompt user dialog
2. Static placeholders (`[TODO: ...]`) are preserved verbatim in the created document
3. Users can skip variable dialog by pressing Escape; variables default to their defined defaults or remain as `{{variable}}` text
- **FR-027**: System MUST preserve static placeholder markers (e.g., `[TODO: ...]`, `<!-- PLACEHOLDER -->`) when creating document from template
- **FR-028**: System MUST visually distinguish static placeholder markers in the editor using CSS class `placeholder-marker` with dashed border styling
- **FR-029**: System MUST allow users to navigate between placeholder markers using keyboard shortcut (Cmd/Ctrl+Shift+P)

**Static Placeholder Formats**:
- Bracket syntax: `[TODO: description]`, `[PLACEHOLDER: description]`
- HTML comment syntax: `<!-- TODO: description -->`, `<!-- PLACEHOLDER -->`
- Detection regex: `/\[(TODO|PLACEHOLDER):\s*[^\]]+\]|<!--\s*(TODO|PLACEHOLDER)[^>]*-->/gi`

**Placeholder Styling Specification**:
- CSS class: `placeholder-marker`
- Border: 2px dashed #FFA500 (orange)
- Background: rgba(255, 165, 0, 0.1)
- Border-radius: 4px
- Padding: 2px 4px

### Key Entities

- **Template**: An MDX document structure with content, formatting, and optional placeholders; serves as a starting point for new documents. Stored and shared as `.mdxt` files with YAML frontmatter containing metadata
- **Template Metadata**: Descriptive information about a template including name (unique identifier for display), description (purpose and use case), category (organizational grouping), tags (searchable keywords), and author (creator attribution)
- **Template Category**: A classification grouping templates by document type. Built-in categories: blog (blog posts and articles), documentation (technical docs), presentation (slide decks), notes (meeting notes), tutorial (step-by-step guides). Custom category: user-created templates stored separately.
- **Template Collection**: The complete set of templates available to a user, comprising both built-in templates shipped with the application and custom templates created by the user

### .mdxt File Format Example

```yaml
---
name: "Blog Post"
description: "Standard blog post with title, date, and content sections"
category: "blog"
tags: ["blog", "article", "post"]
author: "MDXPad Team"
version: "1.0.0"
variables:
  - name: "title"
    description: "Post title"
    required: true
  - name: "date"
    description: "Publication date"
    default: "{{TODAY}}"
---

# {{title}}

*Published on {{date}}*

[TODO: Add your content here...]
```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can browse, select a template card, and click "Create Document" in under 30 seconds from opening the template browser (measured from modal open to document creation initiated)
- **SC-002**: Template preview renders within 1 second of template card selection (includes MDX-to-HTML compilation + DOM render; measured from click to first paint)
- **SC-003**: 90% of test users successfully create a document from a template on first attempt without external guidance (usability test with 5+ participants; first attempt = user completes task without asking for help, undoing, or restarting)
- **SC-004**: Search returns fuzzy-matched results (Fuse.js threshold ≤ 0.4) within 200 milliseconds for libraries with up to 100 templates (measured from keystroke to results render)
- **SC-005**: Custom template save operation completes within 2 seconds including validation (measured from save button click to success confirmation)
- **SC-006**: Built-in template collection covers at least 5 common document types (blog post, documentation page, presentation, meeting notes, tutorial)
- **SC-007**: Template browser supports navigation via keyboard alone for accessibility compliance
- **SC-008**: System correctly persists and retrieves custom templates across 100 application restart cycles without data loss (automated test required)
- **SC-009**: Custom template save operation completes within 2 seconds including MDX validation (measured from save button click to success confirmation)
- **SC-010**: System correctly persists and retrieves custom templates across 100 application restart cycles without data loss (automated stress test)
- **SC-011**: 90% of test users successfully create a document from a template on first attempt without external guidance (usability test with 5+ participants)

**Note**: 100 templates is the performance-tested threshold; the system imposes no hard limit. Performance may degrade above 500 templates.

**Validation Scope for SC-005/SC-009**: The 2-second save window includes: (1) YAML frontmatter parsing, (2) MDX syntax compilation check, (3) variable extraction verification, (4) file write to disk, (5) index update.

## Clarifications

### Session 2026-01-17

- Q: Should users be able to import/export templates as standalone files for sharing? → A: Yes, import/export enabled - templates can be shared as standalone files
- Q: What file format should be used for template import/export? → A: Single `.mdxt` file with metadata in YAML frontmatter
- Q: How should template placeholders work? → A: Both - support dynamic variables (e.g., `{{title}}`) that prompt user on creation AND static markers for manual replacement
- Q: Should there be limits on custom template count or size? → A: No hard limits - system handles any reasonable collection size
- Q: How should built-in templates be updated when the application updates? → A: Automatic - built-in templates update silently with the application

## Assumptions

- The existing file system infrastructure from Spec 004 is available for template persistence
- The existing preview pane from Spec 003 can be reused for template preview functionality
- The command palette from Spec 005 can be extended to include template-related commands
- The new file workflow already exists and can be extended with template integration
- Users understand basic MDX syntax or the templates provide sufficient guidance through placeholders
- Built-in templates will be bundled with the application distribution and update automatically with application updates
- Custom templates are stored in a user-specific location (`~/.mdxpad/templates/`) and are global to the application installation (not per-workspace). Templates are available across all workspaces.
- No artificial limits on custom template count or size; system should handle reasonable collections gracefully

## Storage Architecture

### File Paths

| Template Type | Location | Example |
|---------------|----------|---------|
| Built-in | `{app_resources}/templates/` | `/Applications/mdxpad.app/Contents/Resources/templates/blog-post.mdxt` |
| Custom | `~/.mdxpad/templates/` | `/Users/name/.mdxpad/templates/my-template.mdxt` |

### Built-in vs Custom Detection

Templates are distinguished by their `isBuiltIn` flag stored in metadata and by file path:
- Paths under app resources → `isBuiltIn: true`
- Paths under `~/.mdxpad/templates/` → `isBuiltIn: false`

### Bundling Strategy

Built-in templates are bundled in the Electron app's resources directory during build and update with each application release.
