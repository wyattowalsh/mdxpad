# Quickstart: Template Library

**Feature**: 016-template-library
**Date**: 2026-01-17
**Phase**: 1 - Design

## Overview

This guide provides a quick reference for implementing the Template Library feature. It covers the key implementation patterns, file locations, and integration points.

## Prerequisites

Before implementing this feature, ensure:

- [x] Spec 000 (Foundational Setup) is complete
- [x] Spec 003 (Preview Pane) is complete (for template preview)
- [x] Spec 004 (File System Shell) is complete (for file I/O)
- [x] Spec 005 (Command Palette) is complete (for template commands)

## Key Files to Create

### Main Process

```
src/main/services/template-service.ts
```

Handles all file I/O for templates:
- Load templates from bundled resources and user directory
- Save/delete custom templates
- Import/export templates
- Validate MDX content

### Renderer Process

```
src/renderer/components/template-browser/
├── TemplateBrowser.tsx      # Modal container
├── TemplateCard.tsx         # Grid item component
├── TemplatePreview.tsx      # Preview panel (reuse Spec 003)
├── TemplateFilters.tsx      # Search + category filter
├── VariableDialog.tsx       # Dynamic variable input
└── SaveTemplateDialog.tsx   # Save as template form

src/renderer/stores/template-store.ts
src/renderer/lib/template-parser.ts
src/renderer/lib/template-variables.ts
```

### Shared

```
src/shared/ipc-channels.ts   # Add TEMPLATE_IPC_CHANNEL
```

### Resources

```
resources/templates/
├── blog-post.mdxt
├── documentation.mdxt
├── presentation.mdxt
├── meeting-notes.mdxt
└── tutorial.mdxt
```

## Implementation Order

### Phase 1: Core Infrastructure (P1)

1. **Template Parser** (`template-parser.ts`)
   - Parse `.mdxt` files with `gray-matter`
   - Extract frontmatter metadata
   - Validate against zod schemas

2. **Template Service** (`template-service.ts`)
   - Load templates from both sources
   - IPC handlers for CRUD operations
   - File system operations

3. **Template Store** (`template-store.ts`)
   - Zustand store with Immer
   - Template list state
   - Selected template state
   - Filter/search state

### Phase 2: UI Components (P1)

4. **Template Browser** (`TemplateBrowser.tsx`)
   - Modal dialog with split pane
   - Keyboard navigation (arrow keys, Enter, Escape)
   - Integration with command palette

5. **Template Card** (`TemplateCard.tsx`)
   - Display name, description, category badge
   - Built-in vs custom indicator
   - Selection state

6. **Template Filters** (`TemplateFilters.tsx`)
   - Search input with fuzzy matching
   - Category dropdown filter
   - Clear filters button

7. **Template Preview** (`TemplatePreview.tsx`)
   - Reuse Preview component from Spec 003
   - Show template content with variable placeholders

### Phase 3: Variable System (P1)

8. **Variable Extraction** (`template-variables.ts`)
   - Regex to find `{{varName}}` patterns
   - Match with declared variables in frontmatter
   - Substitution function

9. **Variable Dialog** (`VariableDialog.tsx`)
   - Form with input for each variable
   - Show description and default values
   - Validation for required fields

### Phase 4: Custom Templates (P2)

10. **Save Template Dialog** (`SaveTemplateDialog.tsx`)
    - Form for name, description, category, tags
    - Variable definition (optional)
    - Duplicate name handling

11. **Template Management**
    - Edit metadata
    - Delete with confirmation
    - Prevent modification of built-in

### Phase 5: Import/Export (P2)

12. **Import Flow**
    - File picker for `.mdxt`
    - Parse and validate
    - Handle duplicates

13. **Export Flow**
    - Save picker dialog
    - Write template to chosen path

### Phase 6: Integration (P3)

14. **New File Integration**
    - Add "From Template" option to new file dialog
    - Hook into existing file creation flow

15. **Command Palette Integration**
    - `Template: Browse Templates`
    - `Template: Save as Template`
    - `Template: Import Template`

## Code Patterns

### Loading Templates (Main Process)

```typescript
// template-service.ts
async function loadAllTemplates(): Promise<TemplateMetadata[]> {
  const builtin = await loadBuiltinTemplates();
  const custom = await loadCustomTemplates();
  return [...builtin, ...custom];
}

async function loadBuiltinTemplates(): Promise<TemplateMetadata[]> {
  const templatesDir = path.join(app.getAppPath(), 'resources', 'templates');
  const files = await fs.readdir(templatesDir);
  return Promise.all(
    files
      .filter(f => f.endsWith('.mdxt'))
      .map(f => parseTemplateMetadata(path.join(templatesDir, f), true))
  );
}
```

### Parsing Templates

```typescript
// template-parser.ts
import matter from 'gray-matter';
import { TemplateMetadataSchema } from '@/shared/contracts/template-schemas';

export function parseTemplate(filePath: string, content: string, isBuiltIn: boolean): Template {
  const { data: frontmatter, content: mdxContent } = matter(content);

  const metadata = TemplateMetadataSchema.parse({
    ...frontmatter,
    id: frontmatter.id ?? slugify(frontmatter.name),
    isBuiltIn,
  });

  return {
    ...metadata,
    content: mdxContent,
    filePath,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
```

### Variable Substitution

```typescript
// template-variables.ts
const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

export function extractVariables(content: string): string[] {
  const matches = content.matchAll(VARIABLE_REGEX);
  return [...new Set([...matches].map(m => m[1]))];
}

export function substituteVariables(content: string, values: Record<string, string>): string {
  return content.replace(VARIABLE_REGEX, (match, name) => {
    return values[name] ?? match; // Keep original if no value
  });
}
```

### Zustand Store

```typescript
// template-store.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface TemplateState {
  templates: TemplateMetadata[];
  selectedId: string | null;
  searchQuery: string;
  categoryFilter: TemplateCategory | null;
  isLoading: boolean;

  // Actions
  loadTemplates: () => Promise<void>;
  selectTemplate: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: TemplateCategory | null) => void;
}

export const useTemplateStore = create<TemplateState>()(
  immer((set, get) => ({
    templates: [],
    selectedId: null,
    searchQuery: '',
    categoryFilter: null,
    isLoading: false,

    loadTemplates: async () => {
      set({ isLoading: true });
      const templates = await window.api.template.list();
      set({ templates, isLoading: false });
    },

    selectTemplate: (id) => set({ selectedId: id }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setCategoryFilter: (category) => set({ categoryFilter: category }),
  }))
);
```

## Testing Checklist

### Unit Tests

- [ ] `template-parser.ts` - Parse valid/invalid .mdxt files
- [ ] `template-variables.ts` - Extract and substitute variables
- [ ] `template-store.ts` - State management actions

### Integration Tests

- [ ] IPC channel: list templates
- [ ] IPC channel: get single template
- [ ] IPC channel: save custom template
- [ ] IPC channel: delete custom template
- [ ] IPC channel: import/export

### E2E Tests

- [ ] Open template browser via command palette
- [ ] Browse and filter templates
- [ ] Select and preview template
- [ ] Create document from template
- [ ] Create document with variables
- [ ] Save document as template
- [ ] Import external template
- [ ] Export template to file

## Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Load template list | < 500ms | Cold start |
| Search/filter | < 200ms | Keystroke to results |
| Preview render | < 500ms | Selection to preview |
| Variable dialog | < 100ms | Confirmation to document |
| Save template | < 2s | Including validation |

## Common Pitfalls

1. **Don't block main thread** - Template parsing should be async
2. **Validate before save** - Run MDX compilation to catch syntax errors
3. **Handle missing variables** - Leave `{{var}}` in output if no value provided
4. **Escape user content** - Prevent XSS in template names/descriptions
5. **Check file permissions** - Custom templates directory may not exist
6. **Keyboard navigation** - Ensure focus management in modal
