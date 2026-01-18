# Research: Template Library

**Feature**: 016-template-library
**Date**: 2026-01-17
**Phase**: 0 - Research

## Research Topics

### 1. Template File Format (.mdxt)

**Decision**: Use `.mdxt` extension with YAML frontmatter

**Rationale**:
- Aligns with MDX ecosystem conventions (frontmatter is standard)
- Human-readable and editable in any text editor
- Easy to parse using existing `gray-matter` or `remark-frontmatter` libraries
- Self-contained: one file = one template, simple to share
- Git-friendly: clean diffs for version control

**Alternatives Considered**:
- JSON bundle: Rejected because MDX content as escaped string is error-prone and not human-editable
- Folder structure (template.mdx + meta.json): Rejected because requires zipping for sharing, adds complexity

**File Structure**:
```yaml
---
name: "Blog Post"
description: "Standard blog post with title, date, and content sections"
category: "blog"
tags: ["blog", "article", "content"]
author: "mdxpad"
version: "1.0.0"
variables:
  - name: "title"
    description: "Post title"
    default: "Untitled Post"
  - name: "author"
    description: "Author name"
    required: true
---

# {{title}}

By {{author}} | {{date}}

[Your introduction here...]

## Main Content

[Write your content here...]
```

### 2. Template Variable System

**Decision**: Dual system - dynamic variables (`{{var}}`) + static placeholders

**Rationale**:
- Dynamic variables reduce repetitive editing for common fields (title, author, date)
- Static placeholders (`[Your content here]`) provide guidance without requiring interaction
- Mustache-style `{{var}}` syntax is widely understood
- Variables declared in frontmatter allow validation and default values

**Implementation Pattern**:
1. Parse frontmatter to extract `variables` array
2. On template selection, show dialog for required variables
3. Apply substitution with regex: `/\{\{(\w+)\}\}/g`
4. Leave static placeholders untouched
5. Highlight placeholders in editor using CodeMirror decoration

**Alternatives Considered**:
- Handlebars full syntax: Rejected as overkill; no need for conditionals/loops in templates
- Only static markers: Rejected because common fields like title/date benefit from prompting

### 3. Template Storage Architecture

**Decision**: Dual storage - bundled resources + user data directory

**Rationale**:
- Built-in templates: `resources/templates/` in app bundle (read-only, updates with app)
- Custom templates: `~/.mdxpad/templates/` (user-writable, persists across updates)
- Clear separation prevents users from accidentally modifying built-in templates
- Follows macOS conventions for app resources vs. user data

**Storage Paths**:
```
# Built-in (read-only, bundled with app)
/Applications/mdxpad.app/Contents/Resources/templates/

# Custom (user-writable)
~/Library/Application Support/mdxpad/templates/

# In development
./resources/templates/  (built-in)
./.mdxpad/templates/    (custom, gitignored)
```

**Alternatives Considered**:
- Single directory with `isBuiltIn` flag: Rejected because mixing user files with app bundle is fragile
- Database storage: Rejected as overkill; file-based is simpler and enables manual editing

### 4. Template Browser UI Pattern

**Decision**: Modal dialog with split-pane (list + preview)

**Rationale**:
- Modal ensures focused template selection without context-switching
- Split-pane allows browsing and previewing simultaneously
- Follows patterns from VS Code, Notion, and other document apps
- Keyboard-navigable list with arrow keys, Enter to select, Escape to cancel

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Template Browser                               [×]      │
├─────────────────────────────────────────────────────────┤
│ [Search...                        ] [Category ▼]       │
├─────────────────────┬───────────────────────────────────┤
│                     │                                   │
│  ● Blog Post        │   # Blog Post                     │
│    Documentation    │                                   │
│    Presentation     │   By Author | Date                │
│    Meeting Notes    │                                   │
│    Tutorial         │   Your introduction here...       │
│  ──────────────     │                                   │
│  Custom             │   ## Main Content                 │
│    My Template      │                                   │
│                     │   Write your content here...      │
│                     │                                   │
├─────────────────────┴───────────────────────────────────┤
│                        [Cancel]  [Use Template]         │
└─────────────────────────────────────────────────────────┘
```

**Alternatives Considered**:
- Inline panel (non-modal): Rejected because template selection is a distinct task
- Card grid without preview: Rejected because preview is essential for template evaluation

### 5. IPC Channel Design

**Decision**: Single `mdxpad:template` channel with action-based routing

**Rationale**:
- Follows Constitution Article III.3 (max 10 top-level channels, nest operations)
- All template operations go through one channel with action parameter
- Zod validation for all payloads (per Constitution)

**Channel Structure**:
```typescript
// Channel: mdxpad:template
// Actions: list, get, save, delete, import, export, validate

// Example payloads
{ action: 'list', source: 'all' | 'builtin' | 'custom' }
{ action: 'get', id: string }
{ action: 'save', template: TemplateData }
{ action: 'delete', id: string }
{ action: 'import', path: string }
{ action: 'export', id: string, path: string }
{ action: 'validate', content: string }
```

### 6. Search and Filter Performance

**Decision**: In-memory index with fuzzy matching

**Rationale**:
- Template count is small (< 100 per SC-004)
- Full text loaded on app start, minimal memory impact
- Fuse.js or similar for fuzzy search with < 200ms response (per SC-004)
- Category and tag filters are simple array filtering

**Implementation**:
1. Load all template metadata on app start (frontmatter only, not full content)
2. Build Fuse.js index with name, description, tags fields
3. Filter results in renderer process (no IPC for search)
4. Load full content only when template is selected for preview

**Alternatives Considered**:
- Server-side search: Rejected as unnecessary for local-only app
- SQLite index: Rejected as overkill for < 100 items

### 7. Template Validation

**Decision**: MDX compilation check + frontmatter schema validation

**Rationale**:
- Invalid MDX in templates would cause preview errors
- Frontmatter schema ensures required fields are present
- Validation runs before save, blocking invalid templates
- User sees clear error message indicating what's wrong

**Validation Steps**:
1. Parse YAML frontmatter with `gray-matter`
2. Validate frontmatter against zod schema (name required, etc.)
3. Compile MDX content with `@mdx-js/mdx` to check syntax
4. Return success or array of error messages

## Dependencies Identified

| Dependency | Version | Purpose | Status |
|------------|---------|---------|--------|
| gray-matter | 4.x | Parse YAML frontmatter | New |
| fuse.js | 7.x | Fuzzy search | New |
| @mdx-js/mdx | 3.x | Template validation | Existing (Spec 003) |
| zod | 4.x | Schema validation | Existing |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large template causes slow preview | Medium | Lazy load content; preview only on selection |
| Corrupted template file | Low | Graceful error handling; skip invalid templates |
| Variable substitution edge cases | Low | Escape `{{` with `\{\{` for literal braces |
| File system permissions | Low | Clear error message if templates directory not writable |

## Conclusion

All research topics resolved. Technical approach validated against Constitution. Ready for Phase 1 (Design & Contracts).
