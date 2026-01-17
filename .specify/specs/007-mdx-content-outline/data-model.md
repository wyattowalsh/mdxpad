# Data Model: MDX Content Outline/Navigator

**Feature**: 007-mdx-content-outline
**Date**: 2026-01-17
**Source**: spec.md Key Entities + research.md

---

## Core Entities

### OutlineItem

Represents a single navigable item in the outline tree.

```typescript
/**
 * A single navigable item in the document outline.
 * Can represent headings, components, or frontmatter fields.
 */
interface OutlineItem {
  /** Unique identifier within the outline */
  readonly id: string;

  /** Type of outline item */
  readonly type: 'heading' | 'component' | 'frontmatter';

  /** Display text for the tree node */
  readonly label: string;

  /** Heading level (1-6) for headings, 0 for other types */
  readonly level: HeadingLevel;

  /** Source line number (1-indexed) */
  readonly line: number;

  /** Source column number (1-indexed) */
  readonly column: number;

  /** Nested children (for hierarchical headings) */
  readonly children: readonly OutlineItem[];
}

/** Valid heading levels */
type HeadingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;
```

**Validation Rules**:
- `id`: Non-empty string, unique within document
- `label`: Non-empty string, max 200 characters (UI truncates at 40)
- `level`: 1-6 for headings, 0 for components/frontmatter
- `line`: >= 1
- `column`: >= 1
- `children`: Only populated for headings (components/frontmatter have empty array)

**ID Generation**:
```typescript
// Headings: "h-{line}-{column}"
// Components: "c-{componentName}-{line}"
// Frontmatter: "fm-{fieldName}"
```

---

### OutlineSection

A top-level grouping in the outline panel.

```typescript
/**
 * A collapsible section in the outline panel.
 * Groups related outline items (Headings, Components, Frontmatter).
 */
interface OutlineSection {
  /** Section identifier */
  readonly id: OutlineSectionId;

  /** Display name for section header */
  readonly label: string;

  /** Items within this section */
  readonly items: readonly OutlineItem[];

  /** Whether section is collapsed in UI */
  readonly isCollapsed: boolean;

  /** Whether section has any items */
  readonly isEmpty: boolean;
}

/** Valid section identifiers */
type OutlineSectionId = 'headings' | 'components' | 'frontmatter';
```

**Section Order** (display priority):
1. Frontmatter (if present)
2. Headings
3. Components

**Validation Rules**:
- `items`: Array, may be empty
- `isCollapsed`: Session-only state, defaults to `false`
- `isEmpty`: Computed from `items.length === 0`

---

### OutlineState

Complete outline state managed by the outline store.

```typescript
/**
 * Complete outline state for a document.
 * Managed by the outline Zustand store.
 */
interface OutlineState {
  /** All outline sections */
  readonly sections: readonly OutlineSection[];

  /** Panel visibility (user preference) */
  readonly isVisible: boolean;

  /** Last successful parse timestamp */
  readonly lastUpdated: number;

  /** Error message if parsing failed, null otherwise */
  readonly parseError: string | null;

  /** Whether currently parsing */
  readonly isParsing: boolean;
}
```

**State Transitions**:
```
Initial → Parsing → Success | Error
Success → Parsing (on document change)
Error → Parsing (on document change)
```

**Validation Rules**:
- `sections`: Always 3 sections in fixed order (frontmatter, headings, components)
- `isVisible`: Persisted to localStorage
- `lastUpdated`: Unix timestamp (ms)
- `parseError`: null on success, error message string on failure

---

### ComponentInfo

Extended information for component outline items.

```typescript
/**
 * Component-specific metadata for outline display.
 */
interface ComponentInfo {
  /** Component name (e.g., "Callout", "CodeBlock") */
  readonly name: string;

  /** Whether this is a recognized built-in component */
  readonly isBuiltIn: boolean;

  /** All instances of this component in the document */
  readonly instances: readonly ComponentInstance[];

  /** Total count of instances */
  readonly count: number;
}

interface ComponentInstance {
  /** Line number of this instance */
  readonly line: number;

  /** Column number */
  readonly column: number;

  /** Brief context (e.g., first prop or content preview) */
  readonly context?: string;
}
```

**Built-in Components** (per clarification Q3):
```typescript
const BUILTIN_COMPONENTS = new Set([
  'Callout', 'Note', 'Warning', 'Tip',
  'CodeBlock', 'Tabs', 'Tab',
  'Card', 'Image', 'Link'
]);
```

---

### FrontmatterInfo

Extended information for frontmatter section.

```typescript
/**
 * Frontmatter metadata for outline display.
 */
interface FrontmatterInfo {
  /** Whether document has frontmatter */
  readonly hasFrontmatter: boolean;

  /** Default displayed fields */
  readonly displayFields: readonly FrontmatterField[];

  /** Additional fields (shown on expand) */
  readonly additionalFields: readonly FrontmatterField[];

  /** Whether "Show all" is expanded */
  readonly isExpanded: boolean;
}

interface FrontmatterField {
  /** Field name (e.g., "title", "date") */
  readonly key: string;

  /** Field value (stringified for display) */
  readonly value: string;

  /** Line number in source */
  readonly line: number;
}
```

**Default Fields** (per clarification Q4):
- `title`, `date`, `author`, `tags`

**Display Priority**:
1. title (always first if present)
2. date
3. author
4. tags
5. (other fields in document order, behind "Show all")

---

### OutlineAST

Lightweight AST structure passed from compiler to outline store.

```typescript
/**
 * Lightweight AST data extracted during MDX compilation.
 * Piggybacked on CompileSuccess to avoid duplicate parsing.
 */
interface OutlineAST {
  /** All headings in document order */
  readonly headings: readonly HeadingNode[];

  /** All JSX components in document order */
  readonly components: readonly ComponentNode[];

  /** Parsed frontmatter data */
  readonly frontmatter: FrontmatterData | null;
}

interface HeadingNode {
  /** Heading level 1-6 */
  readonly depth: 1 | 2 | 3 | 4 | 5 | 6;

  /** Heading text content */
  readonly text: string;

  /** Source position */
  readonly position: SourcePosition;
}

interface ComponentNode {
  /** Component name */
  readonly name: string;

  /** Source position */
  readonly position: SourcePosition;
}

interface FrontmatterData {
  /** Raw frontmatter object */
  readonly data: Record<string, unknown>;

  /** Line where frontmatter ends */
  readonly endLine: number;
}

interface SourcePosition {
  readonly line: number;    // 1-indexed
  readonly column: number;  // 1-indexed
}
```

---

## Store Extensions

### Preview Store Extension

```typescript
// Extend existing CompileSuccess
interface CompileSuccess {
  readonly ok: true;
  readonly code: string;
  readonly frontmatter: Record<string, unknown>;
  readonly outline: OutlineAST | null;  // NEW
}
```

### UI Layout Store Extension

```typescript
// Add to UILayoutStoreState
interface UILayoutStoreState {
  // ... existing fields
  readonly outlineVisible: boolean;  // NEW, default: true
}

// Add to UILayoutStoreActions
interface UILayoutStoreActions {
  // ... existing actions
  readonly toggleOutline: () => void;
  readonly setOutlineVisible: (visible: boolean) => void;
}
```

**Storage Key**: `'mdxpad:ui:outline-visible'`

---

## Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                      OutlineState                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Frontmatter │  │  Headings   │  │ Components  │         │
│  │   Section   │  │   Section   │  │   Section   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                  │
│         ▼                ▼                ▼                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │OutlineItem[]│  │OutlineItem[]│  │OutlineItem[]│         │
│  │ (flat)      │  │ (tree)      │  │ (grouped)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ transforms
                              │
┌─────────────────────────────────────────────────────────────┐
│                       OutlineAST                             │
│   (from preview store, extracted during MDX compilation)    │
└─────────────────────────────────────────────────────────────┘
```

---

## Zod Schemas

```typescript
import { z } from 'zod';

const HeadingLevelSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2),
  z.literal(3), z.literal(4), z.literal(5), z.literal(6)
]);

const OutlineItemSchema: z.ZodType<OutlineItem> = z.object({
  id: z.string().min(1),
  type: z.enum(['heading', 'component', 'frontmatter']),
  label: z.string().min(1).max(200),
  level: HeadingLevelSchema,
  line: z.number().int().min(1),
  column: z.number().int().min(1),
  children: z.lazy(() => z.array(OutlineItemSchema)),
});

const OutlineSectionIdSchema = z.enum(['headings', 'components', 'frontmatter']);

const OutlineSectionSchema = z.object({
  id: OutlineSectionIdSchema,
  label: z.string(),
  items: z.array(OutlineItemSchema),
  isCollapsed: z.boolean(),
  isEmpty: z.boolean(),
});

const OutlineStateSchema = z.object({
  sections: z.array(OutlineSectionSchema).length(3),
  isVisible: z.boolean(),
  lastUpdated: z.number(),
  parseError: z.string().nullable(),
  isParsing: z.boolean(),
});
```

---

## Initial State

```typescript
const INITIAL_OUTLINE_STATE: OutlineState = {
  sections: [
    { id: 'frontmatter', label: 'Frontmatter', items: [], isCollapsed: false, isEmpty: true },
    { id: 'headings', label: 'Headings', items: [], isCollapsed: false, isEmpty: true },
    { id: 'components', label: 'Components', items: [], isCollapsed: false, isEmpty: true },
  ],
  isVisible: true,
  lastUpdated: 0,
  parseError: null,
  isParsing: false,
};
```
