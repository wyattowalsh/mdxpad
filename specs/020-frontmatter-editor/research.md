# Research: Frontmatter Visual Editor

**Feature**: 020-frontmatter-editor
**Date**: 2026-01-17
**Phase**: 0 - Research

## Research Topics

### 1. YAML Parsing Library Selection

**Decision**: Use `yaml` (formerly `yaml-js`) package

**Rationale**:
- Full YAML 1.2 support including anchors, aliases, and custom tags
- Preserves comments and formatting when round-tripping (critical for FR-016)
- Tree-sitter style AST access for precise document manipulation
- Active maintenance, widely used in Node.js ecosystem
- TypeScript types included

**Alternatives Considered**:
- `js-yaml`: Popular but doesn't preserve formatting/comments on serialization
- `@std/yaml`: Deno-focused, less ecosystem support
- Custom parser: Unnecessary complexity, maintenance burden

**Implementation Notes**:
- Use `parseDocument()` for AST access to preserve structure
- Use `stringify()` with custom options to maintain indentation style
- Handle parse errors gracefully with line/column info for user feedback

---

### 2. Bidirectional Sync Strategy

**Decision**: Event-based sync with debouncing and source tracking

**Rationale**:
- Avoids infinite loops by tracking change source (panel vs document)
- Debouncing (150ms) prevents excessive updates during rapid typing
- Last-write-wins is acceptable for single-user desktop app
- No need for operational transforms (CRDT) complexity

**Alternatives Considered**:
- Polling: Wasteful, introduces latency
- Locking: Blocks one editing mode while other is active (poor UX)
- CRDT: Overkill for single-user, single-document scenario

**Implementation Notes**:
```typescript
// Sync flow
1. Editor change → debounce(150ms) → parse frontmatter → update store → re-render form
2. Form change → update store → serialize YAML → update editor (skip next editor change)
```

---

### 3. Field Type Inference Algorithm

**Decision**: Pattern-based heuristics with confidence scoring

**Rationale**:
- Simple rules cover 95%+ of real-world frontmatter
- No ML/AI needed, runs instantly
- Fallback to "text" for unknown types is safe

**Type Detection Rules** (in priority order):
1. **Boolean**: `true`, `false`, `yes`, `no`, `on`, `off` (YAML booleans)
2. **Number**: Parseable as integer or float
3. **Date**: ISO 8601 format (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS`)
4. **Array**: YAML sequence (list)
5. **Object**: YAML mapping (nested key-value)
6. **Textarea**: String containing newlines
7. **Text**: Default fallback for strings

**Implementation Notes**:
- Run inference once on frontmatter load
- Cache inferred types in store
- Schema definitions override inference

---

### 4. Schema Format and Loading

**Decision**: JSON Schema subset with custom extensions

**Rationale**:
- JSON Schema is widely understood and tooling exists
- Subset keeps implementation simple (no $ref, no complex conditionals)
- Custom `x-frontmatter` extension for field suggestions and display hints

**Schema Location Priority**:
1. Project: `frontmatter.schema.json` in workspace root
2. User: electron-store under `frontmatter.defaultSchema`
3. Fallback: Built-in defaults (no validation, type inference only)

**Supported Schema Properties**:
```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "description": "Document title",
      "x-frontmatter": { "suggested": true, "order": 1 }
    },
    "date": {
      "type": "string",
      "format": "date",
      "x-frontmatter": { "suggested": true, "order": 2 }
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "x-frontmatter": { "suggested": true }
    },
    "draft": {
      "type": "boolean",
      "default": false
    }
  },
  "required": ["title"]
}
```

**Implementation Notes**:
- Use zod to validate schema file itself
- Convert JSON Schema to zod validators for field validation
- Load schema once per workspace, cache in memory

---

### 5. Date Picker Component

**Decision**: Use native HTML date input with shadcn/ui styling

**Rationale**:
- Native `<input type="date">` works well on macOS
- Consistent with system date format preferences
- No additional dependencies
- Falls back to text input on unsupported browsers (N/A for Electron)

**Alternatives Considered**:
- react-datepicker: Adds bundle size, styling complexity
- Custom calendar: Unnecessary development effort
- Popover with calendar: Overkill for date-only input

**Implementation Notes**:
- Format stored as ISO 8601 (`YYYY-MM-DD`)
- Display format follows system preferences via Intl.DateTimeFormat
- Time component (`datetime-local`) deferred - use text input for now

---

### 6. Array/Tag Input Component

**Decision**: Inline tag chips with keyboard-driven editing

**Rationale**:
- Common pattern (GitHub labels, blog tags)
- Intuitive: type, press Enter/comma to add
- Backspace removes last tag when input empty
- Click tag to remove

**Alternatives Considered**:
- Comma-separated text: Error-prone, poor UX
- Dropdown multi-select: Requires predefined options
- Reorderable list: Overkill for simple arrays

**Implementation Notes**:
- Render as flex-wrap container with chips
- Input grows to fill remaining space
- Support paste of comma-separated values
- Trim whitespace, deduplicate on add

---

### 7. Nested Object Editing

**Decision**: Collapsible inline forms (accordion style)

**Rationale**:
- Keeps context visible (parent fields)
- Familiar pattern from JSON editors
- Works well for 1-2 levels of nesting
- Deep nesting (3+) redirects to raw mode with warning

**Alternatives Considered**:
- Modal for nested objects: Loses context
- Tree view only: No inline editing
- JSON editor embed: Inconsistent UX

**Implementation Notes**:
- Limit visual nesting to 2 levels
- Display path breadcrumb for context
- "Edit in raw mode" button for complex structures

---

## Dependencies to Add

| Package | Version | Purpose |
|---------|---------|---------|
| yaml | ^2.x | YAML parsing with formatting preservation |

*Note: All other dependencies (React, Zustand, zod, Tailwind, shadcn/ui) already in project per Spec 001.*

## Performance Considerations

| Operation | Target | Strategy |
|-----------|--------|----------|
| Panel open | < 200ms | Lazy load components, memoize form |
| Sync latency | < 300ms | 150ms debounce + 100ms render budget |
| Validation | < 100ms | Validate changed field only, not entire form |
| Schema load | < 50ms | Cache in memory, load once per workspace |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| YAML edge cases (anchors, aliases) | Medium | Low | Detect and route to raw mode |
| Sync race conditions | Low | Medium | Source tracking + debounce |
| Schema validation errors | Low | Low | Graceful degradation to no validation |
| Large frontmatter (100+ fields) | Very Low | Medium | Virtual scrolling if needed (defer) |
