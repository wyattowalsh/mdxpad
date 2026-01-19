# Data Model: Frontmatter Visual Editor

**Feature**: 020-frontmatter-editor
**Date**: 2026-01-17
**Phase**: 1 - Design

## Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│   FrontmatterData   │       │  FrontmatterSchema  │
├─────────────────────┤       ├─────────────────────┤
│ fields: Field[]     │◄──────│ properties: Props   │
│ rawYaml: string     │       │ required: string[]  │
│ parseError?: Error  │       │ source: SchemaSource│
└─────────────────────┘       └─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐       ┌─────────────────────┐
│  FrontmatterField   │       │   ValidationResult  │
├─────────────────────┤       ├─────────────────────┤
│ name: string        │──────►│ valid: boolean      │
│ value: FieldValue   │       │ errors: Error[]     │
│ type: FieldType     │       │ warnings: Warning[] │
│ validation: Result  │       └─────────────────────┘
│ path: string[]      │
│ isFromSchema: bool  │
└─────────────────────┘
```

## Core Entities

### FrontmatterData

Represents the complete parsed frontmatter from a document.

```typescript
interface FrontmatterData {
  /** Parsed fields from frontmatter */
  readonly fields: FrontmatterField[];

  /** Raw YAML string (for raw mode editing) */
  readonly rawYaml: string;

  /** Parse error if YAML is invalid */
  readonly parseError: FrontmatterParseError | null;

  /** Whether frontmatter exists in document */
  readonly exists: boolean;

  /** Original YAML formatting options (for preservation) */
  readonly formatOptions: YamlFormatOptions;
}

interface YamlFormatOptions {
  /** Indentation width (typically 2) */
  readonly indent: number;

  /** Quote style for strings */
  readonly defaultQuoteStyle: 'single' | 'double' | 'plain';

  /** Line width before wrapping */
  readonly lineWidth: number;
}

interface FrontmatterParseError {
  readonly message: string;
  readonly line: number;
  readonly column: number;
}
```

### FrontmatterField

Represents a single field within the frontmatter.

```typescript
interface FrontmatterField {
  /** Field name (key in YAML) */
  readonly name: string;

  /** Field value (typed based on content) */
  readonly value: FieldValue;

  /** Detected or schema-defined type */
  readonly type: FieldType;

  /** Validation result for this field */
  readonly validation: ValidationResult;

  /** Path for nested fields (e.g., ['author', 'name']) */
  readonly path: readonly string[];

  /** Whether type came from schema (vs inferred) */
  readonly isFromSchema: boolean;

  /** Schema-provided description for tooltip */
  readonly description?: string;

  /** Display order from schema (lower = first) */
  readonly order: number;
}

type FieldValue =
  | string
  | number
  | boolean
  | Date
  | FieldValue[]
  | { [key: string]: FieldValue }
  | null;
```

### FieldType

Enumeration of supported field types with their UI controls.

```typescript
type FieldType =
  | 'text'      // Single-line text input
  | 'textarea'  // Multi-line text input
  | 'number'    // Numeric input
  | 'boolean'   // Checkbox or switch
  | 'date'      // Date picker
  | 'array'     // Tag input for string arrays
  | 'object';   // Nested form (collapsible)

const FieldTypeConfig: Record<FieldType, FieldTypeDefinition> = {
  text: {
    component: 'TextField',
    defaultValue: '',
    validator: z.string(),
  },
  textarea: {
    component: 'TextareaField',
    defaultValue: '',
    validator: z.string(),
  },
  number: {
    component: 'NumberField',
    defaultValue: 0,
    validator: z.number(),
  },
  boolean: {
    component: 'BooleanField',
    defaultValue: false,
    validator: z.boolean(),
  },
  date: {
    component: 'DateField',
    defaultValue: null,
    validator: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  },
  array: {
    component: 'ArrayField',
    defaultValue: [],
    validator: z.array(z.string()),
  },
  object: {
    component: 'ObjectField',
    defaultValue: {},
    validator: z.record(z.unknown()),
  },
};
```

### FrontmatterSchema

Optional schema for field definitions and validation.

```typescript
interface FrontmatterSchema {
  /** Schema properties by field name */
  readonly properties: Record<string, SchemaProperty>;

  /** Required field names */
  readonly required: readonly string[];

  /** Schema source for debugging */
  readonly source: SchemaSource;
}

type SchemaSource =
  | { type: 'project'; path: string }
  | { type: 'user' }
  | { type: 'none' };

interface SchemaProperty {
  /** JSON Schema type */
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';

  /** Format hint (e.g., 'date', 'email') */
  readonly format?: string;

  /** Human-readable description */
  readonly description?: string;

  /** Default value */
  readonly default?: unknown;

  /** For arrays: item schema */
  readonly items?: SchemaProperty;

  /** For objects: nested properties */
  readonly properties?: Record<string, SchemaProperty>;

  /** Custom frontmatter extensions */
  readonly 'x-frontmatter'?: {
    /** Show in common field suggestions */
    suggested?: boolean;
    /** Display order (lower = first) */
    order?: number;
  };
}
```

### ValidationResult

Result of validating a field value.

```typescript
interface ValidationResult {
  /** Whether the field is valid */
  readonly valid: boolean;

  /** Validation errors (blocking) */
  readonly errors: readonly ValidationError[];

  /** Validation warnings (non-blocking) */
  readonly warnings: readonly ValidationWarning[];
}

interface ValidationError {
  readonly code: ValidationErrorCode;
  readonly message: string;
  readonly path?: readonly string[];
}

type ValidationErrorCode =
  | 'REQUIRED'
  | 'INVALID_TYPE'
  | 'INVALID_FORMAT'
  | 'MIN_LENGTH'
  | 'MAX_LENGTH'
  | 'MIN_VALUE'
  | 'MAX_VALUE'
  | 'PATTERN_MISMATCH';

interface ValidationWarning {
  readonly code: 'DEPRECATED' | 'UNKNOWN_FIELD';
  readonly message: string;
}
```

## State Management

### FrontmatterStore (Zustand)

```typescript
interface FrontmatterStore {
  // === State ===

  /** Current frontmatter data */
  data: FrontmatterData | null;

  /** Active schema */
  schema: FrontmatterSchema | null;

  /** Current editing mode */
  mode: 'visual' | 'raw';

  /** Panel visibility */
  isPanelOpen: boolean;

  /** Raw YAML text (for raw mode) */
  rawYamlDraft: string;

  /** Pending changes flag */
  isDirty: boolean;

  /** Sync source tracking (prevents loops) */
  lastChangeSource: 'panel' | 'document' | null;

  // === Actions ===

  /** Parse frontmatter from document content */
  parseFromDocument: (content: string) => void;

  /** Update a field value */
  updateField: (path: string[], value: FieldValue) => void;

  /** Add a new field */
  addField: (name: string, type: FieldType) => void;

  /** Remove a field */
  removeField: (path: string[]) => void;

  /** Toggle editing mode */
  setMode: (mode: 'visual' | 'raw') => void;

  /** Update raw YAML draft */
  setRawYaml: (yaml: string) => void;

  /** Apply raw YAML changes (parse and validate) */
  applyRawYaml: () => ValidationResult;

  /** Toggle panel visibility */
  togglePanel: () => void;

  /** Load schema from project or user settings */
  loadSchema: () => Promise<void>;

  /** Serialize to YAML for document update */
  serializeToYaml: () => string;

  /** Reset state */
  reset: () => void;
}
```

## State Transitions

```
┌──────────────────────────────────────────────────────────────────┐
│                         PANEL CLOSED                              │
└───────────────────────────┬──────────────────────────────────────┘
                            │ togglePanel()
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    VISUAL MODE (default)                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   LOADING   │───►│   EDITING   │◄──►│  VALIDATING │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
└───────────────────────────┬──────────────────────────────────────┘
                            │ setMode('raw')
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                         RAW MODE                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   EDITING   │───►│  APPLYING   │───►│   ERROR     │          │
│  └─────────────┘    └─────────────┘    └──────┬──────┘          │
│         ▲                                      │                  │
│         └──────────────────────────────────────┘                  │
└───────────────────────────┬──────────────────────────────────────┘
                            │ setMode('visual') + valid
                            ▼
                    [Back to VISUAL MODE]
```

## Common Field Suggestions

Predefined fields for the "Add Field" dropdown:

```typescript
const COMMON_FIELDS: CommonFieldSuggestion[] = [
  { name: 'title', type: 'text', description: 'Document title' },
  { name: 'description', type: 'textarea', description: 'Brief summary' },
  { name: 'date', type: 'date', description: 'Publication date' },
  { name: 'author', type: 'text', description: 'Author name' },
  { name: 'tags', type: 'array', description: 'Categorization tags' },
  { name: 'categories', type: 'array', description: 'Content categories' },
  { name: 'draft', type: 'boolean', description: 'Draft status' },
  { name: 'slug', type: 'text', description: 'URL slug' },
  { name: 'image', type: 'text', description: 'Featured image path' },
];
```

## Validation Rules

| Field Type | Validation |
|------------|------------|
| text | Required check, max length |
| textarea | Required check, max length |
| number | Required check, min/max range |
| boolean | Always valid (true/false) |
| date | ISO 8601 format (YYYY-MM-DD) |
| array | Required check (non-empty), item type |
| object | Recursive validation of nested fields |
