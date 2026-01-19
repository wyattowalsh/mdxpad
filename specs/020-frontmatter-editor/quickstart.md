# Quickstart: Frontmatter Visual Editor

**Feature**: 020-frontmatter-editor
**Prerequisites**: Specs 001 (Interface Contracts), 002 (Editor Core), 006 (Application Shell)

## Overview

This guide covers implementing the Frontmatter Visual Editor - a collapsible sidebar panel for form-based YAML frontmatter editing with bidirectional sync to document content.

## Key Files to Create

```
src/
├── renderer/
│   ├── components/frontmatter/     # UI components
│   ├── stores/frontmatter-store.ts # State management
│   └── lib/frontmatter/            # Business logic
├── shared/types/frontmatter.ts     # Type definitions
└── tests/
    ├── unit/frontmatter/           # Unit tests
    └── e2e/frontmatter-editor.spec.ts
```

## Implementation Order

### Phase 1: Foundation (P1 - Core Editing)

1. **Types** (`src/shared/types/frontmatter.ts`)
   - Define `FrontmatterData`, `FrontmatterField`, `FieldType`
   - Define `ValidationResult`, `FrontmatterSchema`

2. **Parser** (`src/renderer/lib/frontmatter/parser.ts`)
   - `parseFrontmatter(content: string): FrontmatterData`
   - `serializeFrontmatter(data: FrontmatterData): string`
   - Use `yaml` package for parsing/serialization

3. **Type Inference** (`src/renderer/lib/frontmatter/type-inference.ts`)
   - `inferFieldType(value: unknown): FieldType`
   - Pattern matching for boolean, number, date, array, object, textarea, text

4. **Store** (`src/renderer/stores/frontmatter-store.ts`)
   - Zustand store with Immer
   - Actions: `parseFromDocument`, `updateField`, `serializeToYaml`
   - Track `lastChangeSource` to prevent sync loops

5. **Basic Components**
   - `FrontmatterPanel.tsx` - Collapsible sidebar container
   - `FrontmatterForm.tsx` - Form renderer
   - `fields/TextField.tsx` - Text input
   - `fields/BooleanField.tsx` - Checkbox/switch
   - `fields/NumberField.tsx` - Numeric input

### Phase 2: Mode Toggle (P1)

6. **Raw Editor** (`FrontmatterRawEditor.tsx`)
   - Textarea for YAML editing
   - Validation on blur/submit

7. **Mode Toggle**
   - Add `mode` to store: `'visual' | 'raw'`
   - Toggle button in panel header
   - Validate before switching visual → raw

### Phase 3: Field Suggestions (P2)

8. **Add Field Dropdown** (`AddFieldDropdown.tsx`)
   - Common field suggestions
   - Custom field name input
   - Type selection for custom fields

9. **Additional Field Components**
   - `fields/DateField.tsx` - Date picker
   - `fields/ArrayField.tsx` - Tag input
   - `fields/TextareaField.tsx` - Multi-line

### Phase 4: Validation (P2)

10. **Schema Loading** (`src/renderer/lib/frontmatter/schema.ts`)
    - Load from `frontmatter.schema.json`
    - Fallback to user settings
    - Convert to zod validators

11. **Validation Integration**
    - Validate on field change
    - Display errors under fields
    - Error badge on mode toggle

### Phase 5: Advanced (P3)

12. **Nested Objects** (`fields/ObjectField.tsx`)
    - Collapsible sections
    - Recursive field rendering

13. **Bidirectional Sync** (`src/renderer/lib/frontmatter/sync.ts`)
    - Listen to editor changes
    - Debounce updates (150ms)
    - Track change source

## Key Patterns

### Parsing Frontmatter

```typescript
import { parseDocument, stringify } from 'yaml';

export function parseFrontmatter(content: string): FrontmatterData {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { exists: false, fields: [], rawYaml: '' };
  }

  try {
    const doc = parseDocument(match[1]);
    const data = doc.toJS() as Record<string, unknown>;
    const fields = Object.entries(data).map(([name, value]) => ({
      name,
      value,
      type: inferFieldType(value),
      path: [name],
      validation: { valid: true, errors: [], warnings: [] },
    }));
    return { exists: true, fields, rawYaml: match[1] };
  } catch (error) {
    return { exists: true, fields: [], rawYaml: match[1], parseError: error };
  }
}
```

### Bidirectional Sync

```typescript
// In FrontmatterPanel.tsx
const { data, lastChangeSource, parseFromDocument } = useFrontmatterStore();

// Subscribe to editor changes
useEffect(() => {
  const unsubscribe = editorStore.subscribe(
    (state) => state.content,
    debounce((content) => {
      if (lastChangeSource !== 'panel') {
        parseFromDocument(content);
      }
    }, 150)
  );
  return unsubscribe;
}, []);

// Update editor on form changes
const handleFieldChange = (path: string[], value: FieldValue) => {
  updateField(path, value);
  const yaml = serializeToYaml();
  editorStore.getState().updateFrontmatter(yaml);
};
```

### Type Inference

```typescript
export function inferFieldType(value: unknown): FieldType {
  if (value === null || value === undefined) return 'text';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    if (value.includes('\n')) return 'textarea';
  }
  return 'text';
}
```

## Testing Strategy

### Unit Tests

```typescript
// parser.test.ts
describe('parseFrontmatter', () => {
  it('parses valid frontmatter', () => {
    const content = `---
title: Hello
date: 2024-01-01
---
Content here`;
    const result = parseFrontmatter(content);
    expect(result.exists).toBe(true);
    expect(result.fields).toHaveLength(2);
  });

  it('handles missing frontmatter', () => {
    const result = parseFrontmatter('Just content');
    expect(result.exists).toBe(false);
  });
});
```

### E2E Tests

```typescript
// frontmatter-editor.spec.ts
test('edits frontmatter field', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="open-frontmatter-panel"]');
  await page.fill('[data-testid="field-title"]', 'New Title');
  await expect(page.locator('.editor')).toContainText('title: New Title');
});
```

## Performance Checklist

- [ ] Panel opens in < 200ms
- [ ] Field updates sync in < 300ms
- [ ] Validation feedback in < 100ms
- [ ] Debounce prevents excessive updates
- [ ] Memoize field components

## Common Pitfalls

1. **Sync loops**: Always track change source before updating
2. **YAML formatting**: Use `yaml` library's `stringify` options to preserve style
3. **Mode switch validation**: Validate YAML before allowing switch to visual
4. **Nested object depth**: Limit to 2 levels, redirect to raw mode for deeper
