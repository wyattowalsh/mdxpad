# Feature Specification: Frontmatter Visual Editor

**Feature Branch**: `020-frontmatter-editor`
**Created**: 2026-01-17
**Status**: Draft
**Input**: User description: "Frontmatter Visual Editor - Form-based editing of YAML frontmatter. Schema detection and validation. Common field suggestions (title, date, tags, categories). Toggle between visual and raw YAML editing. Real-time sync with document content."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit Frontmatter via Form (Priority: P1)

As a content author, I can edit frontmatter fields through a visual form interface instead of manually writing YAML, so I can modify metadata quickly and without syntax errors.

**Why this priority**: This is the core value proposition—making frontmatter editing accessible without requiring YAML knowledge. Users get immediate productivity gains.

**Independent Test**: Can be fully tested by opening a document with frontmatter and editing fields through the form, verifying changes sync to document.

**Acceptance Scenarios**:

1. **Given** a document with YAML frontmatter, **When** I open the frontmatter editor, **Then** I see a form with fields populated from the existing frontmatter
2. **Given** the form is open, **When** I modify a text field value, **Then** the change is reflected in the document content within 300ms
3. **Given** the form is open, **When** I modify a date field, **Then** I can use a date picker or type the date manually
4. **Given** the form is open, **When** I modify a tags/array field, **Then** I can add/remove items using a tag input interface
5. **Given** the form is open, **When** I modify a boolean field, **Then** I can toggle it using a checkbox or switch

---

### User Story 2 - Toggle Between Visual and Raw Modes (Priority: P1)

As a power user, I can toggle between the visual form and raw YAML editing, so I have full control when I need it while still benefiting from the visual interface for common tasks.

**Why this priority**: Some users need direct YAML access for complex structures. Without toggle capability, power users would avoid the feature entirely.

**Independent Test**: Can be fully tested by toggling between modes and verifying data integrity is preserved.

**Acceptance Scenarios**:

1. **Given** I am in visual form mode, **When** I click the toggle button, **Then** I see the raw YAML content in an editable text area
2. **Given** I am in raw YAML mode, **When** I edit the YAML and switch to visual mode, **Then** the form displays the updated values
3. **Given** I have unsaved changes in one mode, **When** I toggle to the other mode, **Then** my changes are preserved
4. **Given** I enter invalid YAML in raw mode, **When** I try to switch to visual mode, **Then** I see a validation error and remain in raw mode

---

### User Story 3 - Add Common Fields (Priority: P2)

As a content author, I can quickly add common frontmatter fields (title, date, tags, categories, description) from a suggestion list, so I don't have to remember field names or type them manually.

**Why this priority**: Reduces friction for new documents. Users benefit from this but can still type field names manually without it.

**Independent Test**: Can be fully tested by creating a new document and adding fields from suggestions.

**Acceptance Scenarios**:

1. **Given** the frontmatter editor is open, **When** I click "Add Field", **Then** I see a dropdown with common field suggestions
2. **Given** the suggestion dropdown is open, **When** I select "title", **Then** a title field is added to the form with appropriate input type
3. **Given** the suggestion dropdown is open, **When** I select "date", **Then** a date field is added with a date picker input
4. **Given** the suggestion dropdown is open, **When** I select "tags", **Then** an array field is added with tag input interface
5. **Given** I want a custom field, **When** I type a field name not in suggestions, **Then** I can add it with a default text input type

---

### User Story 4 - Field Validation (Priority: P2)

As a content author, I receive validation feedback when field values don't match expected formats, so I can fix errors before publishing.

**Why this priority**: Validation prevents common errors but is not essential for basic editing. Users can work without validation initially.

**Independent Test**: Can be fully tested by entering invalid values and verifying validation messages appear.

**Acceptance Scenarios**:

1. **Given** a date field, **When** I enter an invalid date format, **Then** I see a validation error message under the field
2. **Given** a required field (as specified by schema or inferred from field name: title, date, slug), **When** I leave it empty, **Then** I see a required field indicator and error. Without schema, only `title` and `date` fields are treated as required by default.
3. **Given** a field with validation errors, **When** I correct the value, **Then** the validation error disappears immediately
4. **Given** the frontmatter has validation errors, **When** I look at the editor toggle, **Then** I see an indicator that there are validation issues

---

### User Story 5 - Schema Detection (Priority: P3)

As a content author working in a project with frontmatter schemas, the editor detects and applies the schema to provide appropriate field types and validation rules.

**Why this priority**: Schema detection enhances the experience but requires project-specific configuration. The editor works without schemas using sensible defaults.

**Independent Test**: Can be fully tested by opening documents in a project with a frontmatter schema and verifying fields use correct input types.

**Acceptance Scenarios**:

1. **Given** a project has a frontmatter schema definition, **When** I open the frontmatter editor, **Then** field types and validation rules from the schema are applied
2. **Given** no schema is defined, **When** I open the frontmatter editor, **Then** field types are inferred from existing values (string, number, boolean, array, date)
3. **Given** a schema defines field descriptions, **When** I hover over a field label, **Then** I see the description as a tooltip
4. **Given** a schema file exists but contains invalid JSON or schema syntax, **When** I open the frontmatter editor, **Then** I see a warning "Schema file is invalid, using type inference" and fields are inferred from values

---

### Edge Cases

- What happens when frontmatter contains deeply nested objects? The editor displays nested objects in a collapsible tree structure with edit capability at each level.
- **Nesting depth limit**: Visual editing supports objects nested up to 2 levels deep. Beyond this limit, the field displays as read-only with a button to edit in raw mode. Example: `author.social.twitter` (3 levels) → raw mode only.
- What happens when frontmatter contains YAML features not representable in the form (anchors, aliases, complex multi-line strings)? The editor displays an inline warning banner at the top of the panel: "Some fields use advanced YAML features and can only be edited in raw mode." Affected fields show a lock icon with tooltip. The user can still view but not edit these fields in visual mode; clicking the field or lock icon switches to raw mode with cursor positioned at that field.
- What happens when the document has no frontmatter? The editor shows an empty state with option to add frontmatter.
- What happens when frontmatter delimiters (`---`) are malformed? The editor displays an error banner: "Frontmatter delimiters are malformed." with two action buttons:
  - **Auto-fix**: Inserts/corrects `---` delimiters automatically and syncs
  - **View raw**: Switches to raw mode for manual correction
  Auto-fix applies these transformations: (1) Missing opening `---` → insert at line 1; (2) Missing closing `---` → insert after last frontmatter line; (3) Mismatched delimiters (`---` vs `...`) → normalize to `---`
- What happens when switching modes during active typing? (See US2-AC3 for change preservation) Changes are debounced with a 150ms window. Mode switch waits up to 500ms for pending sync to complete. If sync times out, mode switch proceeds with the last successfully synced state and displays a warning: "Some changes may not have synced."
- What happens when frontmatter is edited in both panel and document simultaneously? The most recent change wins with a 150ms debounce window. If edits occur within this window, they are consolidated; the last edit in the window is applied. Changes from the other source arriving after the window are discarded with no notification (non-destructive since both views sync immediately after).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST parse YAML frontmatter from MDX documents and render as editable form fields (implementation detail of FR-009)
- **FR-002**: System MUST serialize form changes back to valid YAML frontmatter in the document (implementation detail of FR-009)
- **FR-003**: System MUST provide a toggle to switch between visual form and raw YAML editing modes
- **FR-004**: System MUST preserve data integrity when switching between visual and raw modes
- **FR-005**: System MUST support editing the following field types:
  - Text (single-line string)
  - Textarea (multi-line string)
  - Number (integer and decimal)
  - Boolean (checkbox/switch)
  - Date (with date picker)
  - Array of strings (tag input interface)
  - Object (nested form for schema-defined fields, key-value editor for arbitrary objects)
- **FR-006**: System MUST provide common field suggestions: title, description, date, author, tags, categories, draft, slug, image
- **FR-007**: System MUST allow adding custom fields with user-specified names
- **FR-008**: System MUST allow removing fields from frontmatter
- **FR-009**: System MUST sync changes bidirectionally between the frontmatter panel and document content in real-time (within 300ms of change detection). This is the primary sync requirement; FR-001 and FR-002 describe the parse/serialize operations that enable sync.
- **FR-009a**: System MUST handle sync failures gracefully:
  - If form edit produces invalid YAML: Revert to last valid state, highlight invalid field, show error
  - If document edit produces unparseable frontmatter: Switch to raw mode, show parse error
  - Retry mechanism: 3 attempts with 100ms backoff before failing
- **FR-010**: System MUST validate field values and display error messages for invalid input
- **FR-011**: System MUST infer field types from existing values when no schema is present
- **FR-012**: System MUST detect and apply frontmatter schemas using this precedence: (1) project config file `frontmatter.schema.json`, (2) user settings defaults
- **FR-013**: System MUST display appropriate input controls for each field type
- **FR-014**: System MUST handle frontmatter with no existing fields (empty state)
- **FR-015**: System MUST handle documents with no frontmatter by offering to add it
- **FR-016**: System MUST preserve YAML formatting preferences:
  - **Guaranteed**: Indentation (2 or 4 spaces) for top-level scalars
  - **Best-effort**: Quote style (single/double) may normalize to double quotes
  - **Not preserved**: Trailing comments, complex multi-line string formatting
  - **Fallback**: If formatting cannot be preserved, emit warning in raw mode with diff preview
- **FR-017**: System MUST display validation indicators on the mode toggle when errors exist
- **FR-018**: System MUST support keyboard navigation: Tab/Shift+Tab to move between fields, Escape to close panel, Enter to submit field changes, Space to toggle boolean fields

### Key Entities

- **FrontmatterData**: Parsed frontmatter content as a key-value structure with typed values
- **FrontmatterField**: Individual field with name, value, inferred or schema-defined type, and validation state
- **FrontmatterSchema**: Optional schema definition specifying field types, validation rules, and descriptions
- **FieldType**: Enumeration of supported field types (text, textarea, number, boolean, date, array, object)
- **ValidationResult**: Result of validating a field value against its type or schema rules

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can edit frontmatter fields through the form without YAML syntax knowledge
- **SC-002**: Mode toggle preserves data integrity 100% of the time for valid frontmatter
- **SC-003**: Form changes sync to document content within 300ms of user input

  > **Note**: The 300ms sync latency is the canonical performance target. All other references (US1-AC2, FR-009, plan.md) derive from this criterion.
- **SC-004**: Field type inference correctly identifies type for 95% of common frontmatter values

  **Common frontmatter values** are defined as:
  - **Strings**: Plain text without quotes, single words, multi-word titles
  - **Numbers**: Integers (42), decimals (3.14), negative numbers (-1)
  - **Booleans**: true, false, yes, no, on, off
  - **Dates**: ISO 8601 (2024-01-15, 2024-01-15T10:30:00Z)
  - **Arrays**: Bracketed lists [a, b, c] or YAML list syntax
  - **Objects**: Key-value structures at any depth

  Test fixtures for validation: See `src/renderer/lib/frontmatter/__fixtures__/type-inference-samples.json`
- **SC-005**: Validation errors are displayed within 100ms of invalid input
- **SC-006**: The frontmatter editor opens within 200ms of user request
- **SC-007**: All code compiles and passes project quality gates without errors

## Clarifications

### Session 2026-01-17

- Q: How should the frontmatter editor be displayed? → A: Collapsible sidebar panel (always accessible, non-blocking)
- Q: What sync direction between panel and document? → A: Bidirectional (panel ↔ document sync in both directions)
- Q: Where are frontmatter schemas defined? → A: Hybrid - project config file (`frontmatter.schema.json`) takes precedence, user settings provide defaults

## Assumptions

- The existing preview types from Spec 001 define `frontmatter: Record<string, unknown>` which this feature extends with structured editing capabilities.
- YAML parsing will use a standard library (js-yaml or yaml) rather than custom implementation.
- Date values follow ISO 8601 format (YYYY-MM-DD) as the canonical representation.
- Tag/array fields are assumed to be arrays of strings; complex array types require raw YAML editing.
- Schema detection uses a hybrid approach: project-level `frontmatter.schema.json` takes precedence over user settings defaults. Schemas follow JSON Schema draft-07 format. **Out of scope**: YAML Schema, custom validators, JSON Schema draft-2020-12 features.
- User settings defaults are managed through electron-store and configured via a settings panel (out of scope for this spec, uses existing settings infrastructure). Default schema includes: `title` (text, required), `date` (date), `tags` (array), `draft` (boolean). On fresh installation, these defaults are applied.
- The frontmatter editor is displayed as a collapsible panel in the application sidebar, providing persistent access without blocking document editing.

## Dependencies

- **Spec 001**: Interface Contracts - defines the `frontmatter: Record<string, unknown>` type in preview types.
- **Spec 002**: Editor Core - provides the document content that contains the frontmatter.
- **Spec 007**: MDX Content Outline - may integrate with frontmatter navigation.
- **Constitution Article II**: Technology stack (TypeScript 5.9.x strict, React 19, Zustand).
