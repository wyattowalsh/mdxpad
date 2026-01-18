# Research: Bidirectional Preview Sync

**Feature**: 008-bidirectional-sync
**Date**: 2026-01-17
**Status**: Complete

---

## Executive Summary

Research confirms the bidirectional sync feature can integrate cleanly with existing architecture. Key findings:

1. **Preview store already manages scroll state** as a normalized ratio (0-1), with postMessage communication to iframe
2. **AST source positions are exposed** via `OutlineAST` in the preview store, enabling accurate position mapping
3. **Settings persistence pattern exists** in `ui-layout-store.ts` using manual localStorage with Zod validation
4. **Command registration pattern is established** with shortcut binding and execution context
5. **Navigation hooks exist** (`useErrorNavigation`, `useOutlineNavigation`) providing scroll-to-line patterns with line highlighting

No blocking technical unknowns. All integration points are well-documented in the existing codebase.

---

## R1: Preview Store & Scroll Position

### Current State

**Location**: `src/renderer/stores/preview-store.ts`

The preview store manages scroll position as a normalized ratio:

```typescript
export interface PreviewStoreState {
  readonly state: PreviewState;
  readonly lastSuccessfulRender: CompileSuccess | null;
  readonly scrollRatio: number;  // 0 = top, 1 = bottom
}

// Actions
setScrollRatio: (ratio) =>
  set((draft) => {
    draft.scrollRatio = Math.max(0, Math.min(1, ratio));
  }),
```

**Key Finding**: Scroll is stored as a **normalized ratio** (0-1), not pixel values. This provides cross-resolution consistency but requires conversion for accurate line-based sync.

### PostMessage Communication

**Location**: `src/renderer/components/preview/PreviewFrame.tsx`

```typescript
// Parent → Iframe messages
type ParentToIframeMessage =
  | RenderCommand   // { type: 'render', code, frontmatter }
  | ThemeCommand    // { type: 'theme', value }
  | ScrollCommand;  // { type: 'scroll', ratio }

// Iframe → Parent messages
type IframeToParentMessage =
  | ReadySignal        // { type: 'ready' }
  | SizeSignal         // { type: 'size', height }
  | RuntimeErrorSignal; // { type: 'runtime-error', ... }
```

**Decision**: Extend postMessage protocol with bidirectional scroll events

For sync, we need to add:
```typescript
// Iframe → Parent: Report scroll position
type ScrollReportSignal = { type: 'scroll-report', ratio: number };
```

**Rationale**:
- Follows existing message pattern
- Maintains security via origin validation
- Minimal changes to existing infrastructure

---

## R2: AST Source Position Data

### Current State

The preview store already exposes AST data via `OutlineAST`:

```typescript
export interface CompileSuccess {
  readonly ok: true;
  readonly code: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly outline: OutlineAST | null | undefined;
}

export interface OutlineAST {
  readonly headings: readonly HeadingNode[];
  readonly components: readonly ComponentNode[];
  readonly frontmatter: FrontmatterData | null;
}

interface HeadingNode {
  readonly depth: 1 | 2 | 3 | 4 | 5 | 6;
  readonly text: string;
  readonly position: { line: number; column: number };
}
```

**Key Finding**: AST headings include source line positions. This enables the **primary position mapping strategy** (AST-based).

### Decision: Reuse AST for Position Mapping

The existing `OutlineAST` provides heading positions. For sync, build a line-to-heading map:

```typescript
function buildPositionMap(ast: OutlineAST): Map<number, HeadingNode> {
  const map = new Map<number, HeadingNode>();
  for (const heading of ast.headings) {
    map.set(heading.position.line, heading);
  }
  return map;
}
```

**Position Mapping Strategy** (per spec Edge Cases):
1. **Primary**: AST source positions from headings/components
2. **Secondary**: DOM element data-line attributes in preview
3. **Fallback**: Proportional scroll ratio (editor % = preview %)

---

## R3: Settings Persistence Pattern

### Current Implementation

**Location**: `src/renderer/stores/ui-layout-store.ts`

```typescript
// Storage keys
export const STORAGE_KEYS = {
  previewVisible: 'mdxpad:ui:preview-visible',
  zoomLevel: 'mdxpad:ui:zoom-level',
  outlineVisible: 'mdxpad:ui:outline-visible',
} as const;

// Load pattern
loadFromStorage: () => {
  const persisted = loadPersistedState();
  set((draft) => {
    if (persisted.previewVisible !== undefined) {
      draft.previewVisible = persisted.previewVisible;
    }
    // ... other fields
  });
},

// Persist pattern
persist: () => {
  const state = get();
  try {
    localStorage.setItem(STORAGE_KEYS.previewVisible, JSON.stringify(state.previewVisible));
    // ... other fields
  } catch {
    // Silently fail if localStorage unavailable
  }
},
```

**Key Patterns**:
- Manual localStorage (no Zustand persist middleware)
- Zod validation on load
- Silent failure on storage errors
- Debounced persistence for frequently-changing values

### Decision: Add Sync Mode to Settings

Following the existing pattern:

```typescript
// New storage keys
export const SYNC_STORAGE_KEYS = {
  syncMode: 'mdxpad:sync:mode',
  lastActiveMode: 'mdxpad:sync:last-active-mode',
} as const;

// Default values
const DEFAULT_SYNC_MODE: SyncMode = 'bidirectional';
```

**Rationale**:
- Follows established pattern exactly
- Consistent key naming convention
- Enables mode persistence across sessions

---

## R4: Command Registration Pattern

### Current Implementation

**Location**: `src/renderer/commands/view-commands.ts`

```typescript
const togglePreviewCommand: Command = {
  id: 'view.toggle-preview' as CommandId,
  name: 'Toggle Preview',
  description: 'Show or hide the preview pane',
  category: 'view',
  shortcut: { key: '\\', modifiers: ['Mod'] },
  execute: (): CommandResult => {
    useUILayoutStore.getState().togglePreview();
    return { ok: true };
  },
};

// Export registration function
export function registerViewCommands(): () => void {
  const { register, unregister } = useCommandRegistry.getState();
  const registeredIds: CommandId[] = [];

  for (const command of VIEW_COMMANDS) {
    const result = register(command);
    if (result.ok) {
      registeredIds.push(command.id);
    }
  }

  return () => {
    for (const id of registeredIds) {
      unregister(id);
    }
  };
}
```

### Decision: Add Toggle Sync Command

Following the established pattern:

```typescript
const toggleSyncCommand: Command = {
  id: 'view.toggle-sync' as CommandId,
  name: 'Toggle Preview Sync',
  description: 'Enable or disable scroll synchronization',
  category: 'view',
  shortcut: { key: 'y', modifiers: ['Mod', 'Shift'] },  // Cmd+Shift+Y
  icon: '🔗',
  execute: (ctx: CommandContext): CommandResult => {
    const store = useSyncStore.getState();
    store.toggleSync();

    // Show notification (2 seconds per spec)
    const newState = store.mode === 'disabled' ? 'disabled' : 'enabled';
    ctx.notify({
      type: 'info',
      message: `Preview sync ${newState}`,
      duration: 2000
    });

    return { ok: true };
  },
};
```

**Shortcut Choice**: `Cmd+Shift+Y` chosen because:
- Not conflicting with existing shortcuts
- "Y" is mnemonic for "sYnc"
- Follows spec FR-051

---

## R5: CodeMirror Scroll API

### Current Navigation Pattern

**Location**: `src/renderer/hooks/useErrorNavigation.ts`

```typescript
const navigateToError = useCallback(
  (error: ErrorLocation): void => {
    const view = editorRef.current;
    if (!view) return;

    const doc = view.state.doc;

    // Clamp line to valid range
    const clampedLine = Math.max(1, Math.min(error.line, doc.lines));
    const line = doc.line(clampedLine);

    // Calculate position
    const pos = line.from + Math.max(0, error.column - 1);

    // Dispatch scroll transaction
    view.dispatch({
      selection: { anchor: pos, head: pos },
      scrollIntoView: true,
      effects: EditorView.scrollIntoView(pos, { y: 'center' }),
    });

    view.focus();
  },
  [editorRef]
);
```

### Decision: Create useScrollSync Hook

The sync hook will:
1. Listen to editor scroll events via `EditorView.scrollHandler`
2. Calculate visible line range from `view.viewport`
3. Trigger preview sync via debounced handler

```typescript
// Get visible lines from editor
const visibleLines = getVisibleLineRange(view);

// From EditorView
interface LineRange {
  firstLine: number;  // First fully visible line
  lastLine: number;   // Last fully visible line
}

function getVisibleLineRange(view: EditorView): LineRange {
  const { from, to } = view.viewport;
  return {
    firstLine: view.state.doc.lineAt(from).number,
    lastLine: view.state.doc.lineAt(to).number,
  };
}
```

**Smooth Scrolling**: Use `EditorView.scrollIntoView` with animation:
```typescript
view.dispatch({
  effects: EditorView.scrollIntoView(pos, {
    y: 'start',
    // Note: CodeMirror doesn't support duration, but CSS transition can be applied
  }),
});
```

For reduced motion, skip animation:
```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

---

## R6: Scroll Lock Algorithm

### Design Decision

Per spec Section "Scroll Lock Algorithm":

```typescript
interface ScrollLockState {
  isLocked: boolean;
  lockSource: 'editor' | 'preview' | null;
  lockTimestamp: number;
}

class ScrollLock {
  private state: ScrollLockState = {
    isLocked: false,
    lockSource: null,
    lockTimestamp: 0,
  };

  acquire(source: 'editor' | 'preview'): boolean {
    if (this.state.isLocked) {
      // Already locked - check if from same source
      if (this.state.lockSource === source) {
        return false; // Ignore scroll from sync target
      }
      // Different source breaks lock early
      this.release();
    }

    this.state = {
      isLocked: true,
      lockSource: source,
      lockTimestamp: Date.now(),
    };

    // Auto-release after debounce period
    setTimeout(() => this.release(), SYNC_DEBOUNCE_MS);

    return true;
  }

  release(): void {
    this.state = {
      isLocked: false,
      lockSource: null,
      lockTimestamp: 0,
    };
  }
}
```

**Key Behaviors**:
- Lock acquired when sync scroll initiated
- Lock prevents feedback loops by ignoring target pane scrolls
- Lock auto-releases after SYNC_DEBOUNCE_MS (50ms)
- Manual scroll on opposite pane breaks lock early

---

## R7: Position Cache

### Design Decision

Per spec FR-040 through FR-042:

```typescript
interface CachedPosition {
  editorLine: number;
  previewScrollTop: number;
  timestamp: number;
}

class PositionCache {
  private cache: Map<number, CachedPosition> = new Map();
  private readonly ttl: number;

  constructor(ttl: number = POSITION_CACHE_TTL_MS) {
    this.ttl = ttl;
  }

  get(editorLine: number): number | null {
    const cached = this.cache.get(editorLine);
    if (!cached) return null;

    // Check TTL expiration
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(editorLine);
      return null;
    }

    return cached.previewScrollTop;
  }

  set(editorLine: number, previewScrollTop: number): void {
    this.cache.set(editorLine, {
      editorLine,
      previewScrollTop,
      timestamp: Date.now(),
    });
  }

  invalidate(): void {
    this.cache.clear();
  }
}
```

**Cache Invalidation Triggers**:
- Document content changes (on `setSuccess` in preview store)
- Manual invalidation after significant edits

---

## Dependencies Confirmed

| Dependency | Status | Notes |
|------------|--------|-------|
| Preview Store | Exists | Has scrollRatio, will need scroll-report message |
| OutlineAST | Exists | Source positions available for mapping |
| UI Layout Store | Exists | Pattern for settings persistence |
| Command Registry | Exists | Pattern for toggle command |
| useErrorNavigation | Exists | Pattern for editor scroll/navigation |
| PostMessage Protocol | Exists | Will extend for bidirectional scroll |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Feedback loops during rapid scroll | Medium | High | Scroll lock + debounce |
| Position mapping inaccuracy | Low | Medium | Three-tier fallback strategy |
| Performance during large docs | Low | Medium | Cache + debounce |
| Preview iframe origin issues | Low | High | Reuse existing secure messaging |
| Reduced motion not respected | Low | Medium | Check media query, instant scroll |

---

## Conclusion

All technical unknowns resolved. The sync feature integrates cleanly with existing architecture by:

1. **Extending** preview store with scroll-report messages from iframe
2. **Reusing** OutlineAST for primary position mapping
3. **Following** ui-layout-store persistence pattern for mode settings
4. **Leveraging** command registry for toggle command
5. **Adapting** useErrorNavigation pattern for scroll orchestration
6. **Implementing** scroll lock class for feedback prevention
7. **Adding** position cache with TTL for performance

Ready for Phase 1 artifact generation.
