# Quickstart: MDX Content Outline/Navigator

**Feature**: 007-mdx-content-outline
**Prerequisites**: Spec 003 (Preview Pane), Spec 005 (Command Palette), Spec 006 (Application Shell)

---

## Overview

The MDX Content Outline provides a live, navigable document structure panel. This quickstart covers the key implementation steps.

---

## Step 1: Extend Preview Store with AST

**File**: `src/renderer/stores/preview-store.ts`

Add outline AST to compilation result:

```typescript
// Extend CompileSuccess interface
interface CompileSuccess {
  readonly ok: true;
  readonly code: string;
  readonly frontmatter: Record<string, unknown>;
  readonly outline: OutlineAST | null;  // NEW
}

// Add selector
export const selectOutlineAST = (state: PreviewStore): OutlineAST | null =>
  state.state.status === 'success' ? state.state.result.outline : null;
```

---

## Step 2: Add AST Extraction to Compiler

**File**: `src/renderer/lib/mdx/compiler.ts`

Extract outline data during MDX compilation:

```typescript
import { visit } from 'unist-util-visit';

function extractOutline(tree: Root): OutlineAST {
  const headings: HeadingNode[] = [];
  const components: ComponentNode[] = [];

  visit(tree, (node) => {
    if (node.type === 'heading') {
      headings.push({
        depth: node.depth,
        text: toString(node),
        position: { line: node.position!.start.line, column: node.position!.start.column },
      });
    }
    if (node.type === 'mdxJsxFlowElement' && node.name) {
      components.push({
        name: node.name,
        position: { line: node.position!.start.line, column: node.position!.start.column },
      });
    }
  });

  return { headings, components, frontmatter: null };
}
```

---

## Step 3: Create Outline Store

**File**: `src/renderer/stores/outline-store.ts`

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { OutlineStore, OutlineAST } from '@/shared/types/outline';
import { INITIAL_OUTLINE_STATE, buildHeadingTree, groupComponents } from './outline-utils';

export const useOutlineStore = create<OutlineStore>()(
  immer((set) => ({
    ...INITIAL_OUTLINE_STATE,

    updateFromAST: (ast: OutlineAST) => {
      set((draft) => {
        draft.sections[0].items = ast.frontmatter ? buildFrontmatterItems(ast.frontmatter) : [];
        draft.sections[0].isEmpty = draft.sections[0].items.length === 0;

        draft.sections[1].items = buildHeadingTree(ast.headings);
        draft.sections[1].isEmpty = draft.sections[1].items.length === 0;

        draft.sections[2].items = groupComponents(ast.components);
        draft.sections[2].isEmpty = draft.sections[2].items.length === 0;

        draft.lastUpdated = Date.now();
        draft.parseError = null;
        draft.isParsing = false;
      });
    },

    // ... other actions
  }))
);
```

---

## Step 4: Create Outline Navigation Hook

**File**: `src/renderer/hooks/useOutlineNavigation.ts`

```typescript
import { useCallback, useState } from 'react';
import { EditorView, Decoration } from '@codemirror/view';
import { StateEffect } from '@codemirror/state';
import type { UseOutlineNavigationOptions, UseOutlineNavigationResult } from '@/shared/types/outline';

export function useOutlineNavigation({
  editorRef,
  highlightDuration = 500,
}: UseOutlineNavigationOptions): UseOutlineNavigationResult {
  const [isNavigating, setIsNavigating] = useState(false);

  const navigateToItem = useCallback(
    ({ line, column = 1 }: { line: number; column?: number }) => {
      const view = editorRef.current;
      if (!view) return;

      setIsNavigating(true);

      const doc = view.state.doc;
      const clampedLine = Math.max(1, Math.min(line, doc.lines));
      const lineInfo = doc.line(clampedLine);
      const pos = lineInfo.from + Math.max(0, column - 1);

      // Position cursor and scroll
      view.dispatch({
        selection: { anchor: pos, head: pos },
        scrollIntoView: true,
        effects: EditorView.scrollIntoView(pos, { y: 'center' }),
      });

      // Add line highlight
      // (implementation uses StateEffect and Decoration)

      view.focus();
      setTimeout(() => setIsNavigating(false), highlightDuration);
    },
    [editorRef, highlightDuration]
  );

  return { navigateToItem, isNavigating };
}
```

---

## Step 5: Extend UI Layout Store

**File**: `src/renderer/stores/ui-layout-store.ts`

```typescript
// Add to state interface
outlineVisible: boolean;  // default: true

// Add actions
toggleOutline: () =>
  set((draft) => {
    draft.outlineVisible = !draft.outlineVisible;
  }),

setOutlineVisible: (visible: boolean) =>
  set((draft) => {
    draft.outlineVisible = visible;
  }),

// Add to persist/load functions
// Storage key: 'mdxpad:ui:outline-visible'
```

---

## Step 6: Register Toggle Command

**File**: `src/renderer/commands/view-commands.ts`

```typescript
const toggleOutlineCommand: Command = {
  id: 'view.toggle-outline' as CommandId,
  name: 'Toggle Outline',
  description: 'Show or hide the document outline',
  category: 'view',
  shortcut: { key: 'o', modifiers: ['Mod', 'Shift'] },
  icon: '📑',
  execute: (): CommandResult => {
    useUILayoutStore.getState().toggleOutline();
    return { ok: true };
  },
};

// Add to VIEW_COMMANDS array
```

---

## Step 7: Create OutlinePanel Component

**File**: `src/renderer/components/outline/OutlinePanel.tsx`

```tsx
import { useOutlineStore, selectSections, selectHasContent } from '@/stores/outline-store';
import { useUILayoutStore, selectOutlineVisible } from '@/stores/ui-layout-store';
import { OutlineSection } from './OutlineSection';
import { OutlineEmptyState } from './OutlineEmptyState';

export function OutlinePanel() {
  const isVisible = useUILayoutStore(selectOutlineVisible);
  const sections = useOutlineStore(selectSections);
  const hasContent = useOutlineStore(selectHasContent);

  if (!isVisible) return null;

  return (
    <aside className="outline-panel" role="complementary" aria-label="Document outline">
      <header className="outline-header">
        <h2>Outline</h2>
        <button onClick={() => useUILayoutStore.getState().toggleOutline()}>×</button>
      </header>

      {hasContent ? (
        <nav role="tree" aria-label="Document structure">
          {sections.map((section) => (
            <OutlineSection key={section.id} section={section} />
          ))}
        </nav>
      ) : (
        <OutlineEmptyState />
      )}
    </aside>
  );
}
```

---

## Step 8: Integrate with App Layout

**File**: `src/renderer/App.tsx`

```tsx
import { OutlinePanel } from '@/components/outline/OutlinePanel';

function App() {
  return (
    <div className="app-layout">
      <OutlinePanel />
      <main className="editor-area">
        {/* Editor and Preview */}
      </main>
    </div>
  );
}
```

---

## Step 9: Connect AST Updates

**File**: `src/renderer/hooks/usePreview.ts` (or App.tsx)

```typescript
// Subscribe to preview store AST changes
useEffect(() => {
  return usePreviewStore.subscribe(
    (state) => selectOutlineAST(state),
    (ast) => {
      if (ast) {
        useOutlineStore.getState().updateFromAST(ast);
      }
    }
  );
}, []);
```

---

## Testing Checklist

- [ ] Headings extracted and displayed hierarchically
- [ ] Components grouped by type with counts
- [ ] Frontmatter fields shown (title, date, author, tags)
- [ ] Click navigation positions cursor correctly
- [ ] Line briefly highlights after navigation
- [ ] Cmd+Shift+O toggles panel visibility
- [ ] Visibility persists across app restart
- [ ] Empty state shown for empty documents
- [ ] Outline updates within 500ms of edits
- [ ] Keyboard navigation works (arrow keys, Enter)

---

## Key Files

| File | Purpose |
|------|---------|
| `stores/outline-store.ts` | Outline state management |
| `hooks/useOutlineNavigation.ts` | Editor navigation |
| `lib/mdx/outline-extractor.ts` | AST extraction |
| `components/outline/OutlinePanel.tsx` | Main panel component |
| `components/outline/OutlineSection.tsx` | Section component |
| `components/outline/OutlineItem.tsx` | Tree item component |
| `commands/view-commands.ts` | Toggle command |
