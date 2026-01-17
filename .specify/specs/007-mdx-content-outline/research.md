# Research: MDX Content Outline/Navigator

**Feature**: 007-mdx-content-outline
**Date**: 2026-01-17
**Status**: Complete

---

## Executive Summary

Research confirms the outline feature can integrate cleanly with existing architecture. Key finding: the preview store currently does NOT expose AST data—only compiled JavaScript code. This requires extending the MDX compilation pipeline to preserve and expose AST for outline generation.

---

## R1: Preview Store & AST Access

### Current State

**Location**: `src/renderer/stores/preview-store.ts`

The preview store is a Zustand store with Immer middleware managing:

```typescript
interface PreviewStoreState {
  readonly state: PreviewState;  // idle | compiling | success | error
  readonly lastSuccessfulRender: CompileSuccess | null;
  readonly scrollRatio: number;
}

interface CompileSuccess {
  readonly ok: true;
  readonly code: string;              // Compiled JS function body
  readonly frontmatter: Record<string, unknown>;
}
```

**Key Finding**: No AST data is currently exposed. The store holds only the final compiled JavaScript code, not the syntax tree.

### Decision: Extend Preview Store with AST Field

To support outline generation, extend `CompileSuccess`:

```typescript
interface CompileSuccess {
  readonly ok: true;
  readonly code: string;
  readonly frontmatter: Record<string, unknown>;
  readonly ast: OutlineAST | null;  // NEW: Lightweight AST for outline
}

interface OutlineAST {
  readonly headings: HeadingNode[];
  readonly components: ComponentNode[];
  readonly hasFrontmatter: boolean;
}
```

**Rationale**:
- Maintains clear store boundaries
- Enables reactive updates via Zustand subscriptions
- Keeps AST ownership in preview domain
- Minimal changes to existing architecture

**Alternatives Rejected**:
- Separate outline store: Would duplicate parsing, add sync complexity
- Direct AST query: Breaks reactive model, requires imperative calls
- Shared AST cache: Over-engineered for single-document model

---

## R2: Navigation Pattern (useErrorNavigation)

### Current Implementation

**Location**: `src/renderer/hooks/useErrorNavigation.ts`

```typescript
interface UseErrorNavigationOptions {
  readonly editorRef: React.RefObject<EditorView | null>;
}

interface UseErrorNavigationResult {
  readonly navigateToError: (error: ErrorLocation) => void;
}

interface ErrorLocation {
  readonly line: number;    // 1-indexed
  readonly column: number;  // 1-indexed
}
```

**Positioning Logic**:
1. Clamp line/column to document bounds
2. Calculate absolute position: `line.from + column - 1`
3. Dispatch transaction with selection and scroll
4. Focus editor

**Key Finding**: No line highlighting implemented—only cursor positioning and scroll-to-center.

### Decision: Create useOutlineNavigation Hook

Extend the pattern with line highlighting:

```typescript
interface UseOutlineNavigationResult {
  readonly navigateToOutlineItem: (item: OutlineLocation) => void;
}

interface OutlineLocation {
  readonly line: number;
  readonly column?: number;  // Optional, defaults to 1
}
```

**Implementation Approach**:
1. Reuse positioning logic from useErrorNavigation
2. Add line highlight via CodeMirror `Decoration`
3. Highlight duration: 500ms (per FR-022)
4. Use `StateEffect` for highlight lifecycle

**Rationale**:
- Follows existing patterns
- Reuses proven CodeMirror integration
- Adds visual feedback per spec requirements

---

## R3: UI Layout Store Integration

### Current Implementation

**Location**: `src/renderer/stores/ui-layout-store.ts`

```typescript
interface UILayoutStoreState {
  previewVisible: boolean;   // Persisted
  sidebarVisible: boolean;   // Prepared, not used
  zoomLevel: number;         // Persisted
  splitRatio: number;        // Persisted (debounced)
}
```

**Persistence Pattern**:
- localStorage keys: `mdxpad:ui:{property}`
- Validation on load with clamping
- Debounced persistence for drag operations

### Decision: Add outlineVisible to UI Layout Store

```typescript
// Add to state
outlineVisible: boolean;  // default: true

// Add storage key
'mdxpad:ui:outline-visible'

// Add actions
toggleOutline(): void;
setOutlineVisible(visible: boolean): void;

// Add selector
selectOutlineVisible(state): boolean;
```

**Rationale**:
- Follows existing `previewVisible` pattern exactly
- Reuses persistence infrastructure
- Consistent with application shell architecture

---

## R4: Command Registration Pattern

### Current Implementation

**Registry Location**: `src/renderer/stores/command-registry-store.ts`
**Command Definitions**: `src/renderer/commands/{category}-commands.ts`

```typescript
interface Command {
  id: CommandId;
  name: string;
  description?: string;
  category: 'file' | 'edit' | 'view' | 'format' | 'help';
  shortcut?: { key: string; modifiers: ModifierKey[] };
  icon?: string;
  execute: (ctx: CommandContext) => CommandResult;
  enabled?: (ctx: CommandContext) => boolean;
}
```

### Decision: Add Toggle Outline Command

**File**: `src/renderer/commands/view-commands.ts`

```typescript
const toggleOutlineCommand: Command = {
  id: 'view.toggle-outline' as CommandId,
  name: 'Toggle Outline',
  description: 'Show or hide the document outline',
  category: 'view',
  shortcut: { key: 'o', modifiers: ['Mod', 'Shift'] },  // Cmd+Shift+O
  icon: '📑',
  execute: (): CommandResult => {
    useUILayoutStore.getState().toggleOutline();
    return { ok: true };
  },
};
```

**Rationale**:
- Follows existing view command patterns
- Shortcut consistent with spec (FR-002)
- Integrates with command palette automatically

---

## R5: AST Extraction Strategy

### MDX Compilation Pipeline

**Worker Location**: `src/renderer/lib/mdx/mdx-compiler.worker.ts`
**Compiler Location**: `src/renderer/lib/mdx/compiler.ts`

Current pipeline:
```
source → @mdx-js/mdx → VFile → { code, frontmatter }
```

### Decision: Add Outline Extraction to Pipeline

Extend pipeline to extract outline data during compilation:

```
source → @mdx-js/mdx → VFile → extractOutline(ast) → { code, frontmatter, ast }
```

**Extraction Logic**:
1. Walk AST after remark/rehype processing
2. Extract heading nodes (type: 'heading', depth: 1-6)
3. Extract JSX component nodes (type: 'mdxJsxFlowElement')
4. Capture source positions from VFile
5. Serialize lightweight outline structure

**Performance Consideration**:
- AST walk adds ~5-10ms for typical documents
- Well within SC-004 budget (<50ms overhead)
- No additional compilation pass needed

---

## R6: Built-in Component Recognition

### Decision: Hardcoded Initial List

Per clarification Q3, recognize these as built-in:

```typescript
const BUILTIN_COMPONENTS = new Set([
  'Callout', 'Note', 'Warning', 'Tip',
  'CodeBlock', 'Tabs', 'Tab',
  'Card', 'Image', 'Link'
]);
```

**Visual Distinction**:
- Built-in: Filled icon, standard text color
- Custom: Outlined icon, muted text color

**Future Extension Point**: Configuration file or user settings (out of scope for v1)

---

## R7: Strict Heading Nesting Algorithm

### Decision: Stack-Based Nesting

Per clarification Q2, implement canonical strict nesting:

```typescript
function buildHeadingTree(headings: HeadingNode[]): OutlineItem[] {
  const root: OutlineItem[] = [];
  const stack: { level: number; children: OutlineItem[] }[] =
    [{ level: 0, children: root }];

  for (const heading of headings) {
    const item: OutlineItem = { ...heading, children: [] };

    // Pop stack until we find parent level
    while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    // Add as child of current top
    stack[stack.length - 1].children.push(item);

    // Push onto stack for potential children
    stack.push({ level: heading.level, children: item.children });
  }

  return root;
}
```

**Rationale**:
- Matches VS Code, GitHub, Obsidian behavior
- Handles skipped levels gracefully
- O(n) time complexity

---

## Dependencies Confirmed

| Dependency | Status | Notes |
|------------|--------|-------|
| Preview Store | Exists | Needs AST field extension |
| useErrorNavigation | Exists | Pattern reusable for outline |
| UI Layout Store | Exists | Add outlineVisible |
| Command Registry | Exists | Add toggle-outline command |
| MDX Compiler | Exists | Add outline extraction |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AST serialization overhead | Low | Medium | Lightweight outline structure, not full AST |
| Worker communication latency | Low | Low | Outline data piggybacks on existing compile message |
| Line position drift during edits | Medium | Low | Re-extract on every compile (debounced) |
| Memory bloat from AST cache | Low | Medium | Only store current document outline |

---

## Conclusion

All technical unknowns resolved. The outline feature integrates cleanly with existing architecture by:

1. **Extending** preview store with lightweight AST data
2. **Reusing** useErrorNavigation pattern with line highlighting
3. **Following** UI layout store persistence patterns
4. **Leveraging** command registry for keyboard shortcuts
5. **Piggy-backing** on MDX compilation for AST extraction

Ready for Phase 1 artifact generation.
