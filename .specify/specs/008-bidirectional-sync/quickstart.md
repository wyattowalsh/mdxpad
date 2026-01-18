# Quickstart: Bidirectional Preview Sync

**Feature**: 008-bidirectional-sync
**Prerequisites**: Spec 002 (Editor Core), Spec 003 (Preview Pane), Spec 005 (Command Palette), Spec 006 (Application Shell)

---

## Overview

Bidirectional Preview Sync provides automatic scroll synchronization between the editor and preview panel. This quickstart covers the key implementation steps.

---

## Step 1: Create Sync Store

**File**: `src/renderer/stores/sync-store.ts`

Create the Zustand store for sync state management:

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { SyncStore, SyncMode, SyncPane, ScrollPosition } from '@/shared/types/sync';
import {
  INITIAL_SYNC_STATE,
  SYNC_STORAGE_KEYS,
  SYNC_CONSTANTS,
  parseSyncMode,
  parseLastActiveMode,
} from './sync-schemas';

export const useSyncStore = create<SyncStore>()(
  immer((set, get) => ({
    ...INITIAL_SYNC_STATE,

    setMode: (mode: SyncMode) =>
      set((draft) => {
        draft.mode = mode;
        if (mode !== 'disabled') {
          draft.lastActiveMode = mode;
        }
      }),

    toggleSync: () =>
      set((draft) => {
        if (draft.mode === 'disabled') {
          draft.mode = draft.lastActiveMode;
        } else {
          draft.mode = 'disabled';
        }
      }),

    acquireLock: (source: SyncPane): boolean => {
      const state = get();

      if (state.lock.isLocked) {
        // If locked by same source, ignore
        if (state.lock.lockSource === source) {
          return false;
        }
        // Different source breaks lock early
        get().releaseLock();
      }

      set((draft) => {
        draft.lock = {
          isLocked: true,
          lockSource: source,
          lockTimestamp: Date.now(),
        };
      });

      // Auto-release after debounce period
      setTimeout(() => get().releaseLock(), SYNC_CONSTANTS.SYNC_DEBOUNCE_MS);

      return true;
    },

    releaseLock: () =>
      set((draft) => {
        draft.lock = {
          isLocked: false,
          lockSource: null,
          lockTimestamp: 0,
        };
      }),

    // ... other actions

    loadFromStorage: () => {
      try {
        const modeStr = localStorage.getItem(SYNC_STORAGE_KEYS.mode);
        const lastActiveStr = localStorage.getItem(SYNC_STORAGE_KEYS.lastActiveMode);

        set((draft) => {
          if (modeStr) {
            draft.mode = parseSyncMode(JSON.parse(modeStr));
          }
          if (lastActiveStr) {
            draft.lastActiveMode = parseLastActiveMode(JSON.parse(lastActiveStr));
          }
        });
      } catch {
        // Silently fail on localStorage errors
      }
    },

    persist: () => {
      const state = get();
      try {
        localStorage.setItem(SYNC_STORAGE_KEYS.mode, JSON.stringify(state.mode));
        localStorage.setItem(SYNC_STORAGE_KEYS.lastActiveMode, JSON.stringify(state.lastActiveMode));
      } catch {
        // Silently fail on localStorage errors
      }
    },
  }))
);

// Load persisted state on module initialization
useSyncStore.getState().loadFromStorage();
```

---

## Step 2: Create Scroll Lock Module

**File**: `src/renderer/lib/sync/scroll-lock.ts`

Implement feedback loop prevention:

```typescript
import type { SyncPane, ScrollLockController, ScrollLockOptions } from '@/shared/types/sync';
import { SYNC_CONSTANTS } from './constants';

export function createScrollLock(options?: Partial<ScrollLockOptions>): ScrollLockController {
  const lockDuration = options?.lockDuration ?? SYNC_CONSTANTS.SYNC_DEBOUNCE_MS;

  let isLocked = false;
  let lockSource: SyncPane | null = null;
  let lockTimestamp = 0;
  let timeoutId: number | null = null;

  const release = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    isLocked = false;
    lockSource = null;
    lockTimestamp = 0;
    options?.onLockReleased?.();
  };

  const acquire = (source: SyncPane): boolean => {
    if (isLocked) {
      // Same source - ignore
      if (lockSource === source) {
        return false;
      }
      // Different source - break lock
      release();
    }

    isLocked = true;
    lockSource = source;
    lockTimestamp = Date.now();
    options?.onLockAcquired?.(source);

    // Auto-release after duration
    timeoutId = window.setTimeout(release, lockDuration);

    return true;
  };

  return {
    acquire,
    release,
    isLocked: () => isLocked,
    getSource: () => lockSource,
    shouldIgnore: (source: SyncPane) => isLocked && lockSource === source,
  };
}
```

---

## Step 3: Create Position Mapper

**File**: `src/renderer/lib/sync/position-mapper.ts`

Implement three-tier position mapping:

```typescript
import type {
  PositionMapper,
  PositionMapping,
  HeadingWithPosition,
  PositionCache,
} from '@/shared/types/sync';

export function createPositionMapper(cache: PositionCache): PositionMapper {
  let headings: readonly HeadingWithPosition[] = [];
  let totalEditorLines = 0;
  let previewScrollHeight = 0;
  let previewClientHeight = 0;

  // Build line-to-heading map
  const buildLineMap = (): Map<number, HeadingWithPosition> => {
    const map = new Map<number, HeadingWithPosition>();
    for (const heading of headings) {
      map.set(heading.position.line, heading);
    }
    return map;
  };

  const editorToPreview = (editorLine: number): PositionMapping => {
    // Check cache first
    const cached = cache.get(editorLine);
    if (cached) return cached;

    // Strategy 1: AST-based mapping (high confidence)
    const lineMap = buildLineMap();
    const heading = findNearestHeading(editorLine, lineMap);
    if (heading) {
      // Estimate preview position based on heading order
      const headingIndex = headings.findIndex(
        (h) => h.position.line === heading.position.line
      );
      const ratio = headings.length > 1
        ? headingIndex / (headings.length - 1)
        : 0;
      const scrollTop = ratio * (previewScrollHeight - previewClientHeight);

      const mapping: PositionMapping = {
        editorLine,
        previewScrollTop: scrollTop,
        confidence: 'high',
        timestamp: Date.now(),
      };
      cache.set(editorLine, mapping);
      return mapping;
    }

    // Strategy 3: Proportional fallback (low confidence)
    const ratio = totalEditorLines > 1
      ? (editorLine - 1) / (totalEditorLines - 1)
      : 0;
    const scrollTop = ratio * (previewScrollHeight - previewClientHeight);

    const mapping: PositionMapping = {
      editorLine,
      previewScrollTop: Math.max(0, scrollTop),
      confidence: 'low',
      timestamp: Date.now(),
    };
    cache.set(editorLine, mapping);
    return mapping;
  };

  const previewToEditor = (scrollTop: number): PositionMapping => {
    // Reverse mapping from scroll position to line
    const ratio = previewScrollHeight > previewClientHeight
      ? scrollTop / (previewScrollHeight - previewClientHeight)
      : 0;
    const line = Math.round(ratio * (totalEditorLines - 1)) + 1;

    return {
      editorLine: Math.max(1, Math.min(line, totalEditorLines)),
      previewScrollTop: scrollTop,
      confidence: 'low',
      timestamp: Date.now(),
    };
  };

  return {
    editorToPreview,
    previewToEditor,
    updateAST: (newHeadings) => {
      headings = newHeadings;
      cache.clear();
    },
    updatePreviewHeight: (scrollHeight, clientHeight) => {
      previewScrollHeight = scrollHeight;
      previewClientHeight = clientHeight;
    },
    updateEditorLines: (lines) => {
      totalEditorLines = lines;
    },
    reset: () => {
      headings = [];
      cache.clear();
    },
  };
}

function findNearestHeading(
  line: number,
  lineMap: Map<number, HeadingWithPosition>
): HeadingWithPosition | null {
  // Exact match
  const exact = lineMap.get(line);
  if (exact) return exact;

  // Find nearest (within tolerance)
  let nearest: HeadingWithPosition | null = null;
  let nearestDist = Infinity;

  for (const [headingLine, heading] of lineMap) {
    const dist = Math.abs(headingLine - line);
    if (dist < nearestDist && dist <= 5) {
      nearest = heading;
      nearestDist = dist;
    }
  }

  return nearest;
}
```

---

## Step 4: Create Position Cache

**File**: `src/renderer/lib/sync/position-cache.ts`

Implement TTL-based caching:

```typescript
import type { PositionCache, PositionMapping, PositionCacheOptions } from '@/shared/types/sync';
import { SYNC_CONSTANTS } from './constants';

export function createPositionCache(options?: Partial<PositionCacheOptions>): PositionCache {
  const ttl = options?.ttl ?? SYNC_CONSTANTS.POSITION_CACHE_TTL_MS;
  const cache = new Map<number, PositionMapping>();

  const isValid = (mapping: PositionMapping): boolean => {
    return Date.now() - mapping.timestamp < ttl;
  };

  return {
    get: (editorLine) => {
      const mapping = cache.get(editorLine);
      if (!mapping) return null;

      if (!isValid(mapping)) {
        cache.delete(editorLine);
        options?.onExpire?.(editorLine, mapping);
        return null;
      }

      return mapping;
    },

    set: (editorLine, mapping) => {
      cache.set(editorLine, mapping);
    },

    has: (editorLine) => {
      const mapping = cache.get(editorLine);
      return mapping !== undefined && isValid(mapping);
    },

    invalidate: (editorLine) => {
      cache.delete(editorLine);
    },

    clear: () => {
      cache.clear();
    },

    size: () => cache.size,

    entries: () => cache,
  };
}
```

---

## Step 5: Create useScrollSync Hook

**File**: `src/renderer/hooks/useScrollSync.ts`

Main orchestration hook:

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorView } from '@codemirror/view';
import type {
  UseScrollSyncOptions,
  UseScrollSyncResult,
  ScrollPosition,
} from '@/shared/types/sync';
import { useSyncStore, selectIsSyncEnabled } from '@/stores/sync-store';
import { createScrollLock } from '@/lib/sync/scroll-lock';
import { createPositionMapper } from '@/lib/sync/position-mapper';
import { createPositionCache } from '@/lib/sync/position-cache';
import { SYNC_CONSTANTS } from '@/lib/sync/constants';
import { debounce } from '@/lib/utils/debounce';

export function useScrollSync(options: UseScrollSyncOptions): UseScrollSyncResult {
  const { editorRef, previewRef, isEnabled, mode } = options;
  const [isSyncing, setIsSyncing] = useState(false);

  // Create stable instances
  const scrollLockRef = useRef(createScrollLock());
  const cacheRef = useRef(createPositionCache());
  const mapperRef = useRef(createPositionMapper(cacheRef.current));

  // Sync editor scroll to preview
  const syncEditorToPreview = useCallback(() => {
    const view = editorRef.current;
    const iframe = previewRef.current;
    if (!view || !iframe?.contentWindow) return;

    // Check if sync should proceed
    if (!isEnabled || mode === 'previewToEditor') return;

    // Try to acquire lock
    if (!scrollLockRef.current.acquire('editor')) return;

    setIsSyncing(true);

    // Get visible line range
    const { from } = view.viewport;
    const firstLine = view.state.doc.lineAt(from).number;

    // Map to preview position
    const mapping = mapperRef.current.editorToPreview(firstLine);

    // Check reduced motion preference
    const prefersReducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Send scroll command to preview
    iframe.contentWindow.postMessage(
      {
        type: 'scroll',
        ratio: mapping.previewScrollTop / getPreviewScrollMax(iframe),
        animate: !prefersReducedMotion,
      },
      '*'
    );

    setTimeout(() => setIsSyncing(false), SYNC_CONSTANTS.SCROLL_ANIMATION_MS);
  }, [editorRef, previewRef, isEnabled, mode]);

  // Debounced sync handler
  const debouncedSync = useRef(
    debounce(syncEditorToPreview, SYNC_CONSTANTS.SYNC_DEBOUNCE_MS)
  );

  // Listen to editor scroll events
  useEffect(() => {
    const view = editorRef.current;
    if (!view) return;

    // Subscribe to scroll events via EditorView
    const scrollHandler = EditorView.scrollHandler.of(() => {
      if (isEnabled && (mode === 'editorToPreview' || mode === 'bidirectional')) {
        debouncedSync.current();
      }
      return false; // Don't prevent default
    });

    // Add extension (in real implementation, use proper extension management)
    // This is simplified for quickstart

    return () => {
      debouncedSync.current.cancel?.();
    };
  }, [editorRef, isEnabled, mode]);

  // Similar setup for preview-to-editor sync (via postMessage)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'scroll-report') {
        // Handle preview scroll report
        if (isEnabled && (mode === 'previewToEditor' || mode === 'bidirectional')) {
          syncPreviewToEditor(event.data);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isEnabled, mode]);

  const syncPreviewToEditor = useCallback((report: { ratio: number }) => {
    const view = editorRef.current;
    if (!view) return;

    if (!scrollLockRef.current.acquire('preview')) return;

    setIsSyncing(true);

    const totalLines = view.state.doc.lines;
    const targetLine = Math.round(report.ratio * (totalLines - 1)) + 1;
    const lineInfo = view.state.doc.line(targetLine);

    view.dispatch({
      selection: { anchor: lineInfo.from },
      scrollIntoView: true,
      effects: EditorView.scrollIntoView(lineInfo.from, { y: 'start' }),
    });

    setTimeout(() => setIsSyncing(false), SYNC_CONSTANTS.SCROLL_ANIMATION_MS);
  }, [editorRef]);

  return {
    isSyncing,
    syncEditorToPreview,
    syncPreviewToEditor: () => {}, // Triggered by postMessage
    pauseSync: () => scrollLockRef.current.acquire('editor'),
    resumeSync: () => scrollLockRef.current.release(),
  };
}

function getPreviewScrollMax(iframe: HTMLIFrameElement): number {
  const doc = iframe.contentDocument;
  if (!doc) return 1;
  return Math.max(1, doc.documentElement.scrollHeight - doc.documentElement.clientHeight);
}
```

---

## Step 6: Register Toggle Command

**File**: `src/renderer/commands/view-commands.ts`

Add toggle sync command:

```typescript
import type { Command, CommandId, CommandResult, CommandContext } from '@/shared/types/commands';
import { useSyncStore } from '@/stores/sync-store';

const toggleSyncCommand: Command = {
  id: 'view.toggle-sync' as CommandId,
  name: 'Toggle Preview Sync',
  description: 'Enable or disable scroll synchronization between editor and preview',
  category: 'view',
  shortcut: { key: 'y', modifiers: ['Mod', 'Shift'] },
  icon: '🔗',
  execute: (ctx: CommandContext): CommandResult => {
    const store = useSyncStore.getState();
    store.toggleSync();

    // Persist change
    store.persist();

    // Show notification
    const newState = store.mode === 'disabled' ? 'disabled' : 'enabled';
    ctx.notify({
      type: 'info',
      message: `Preview sync ${newState}`,
      duration: 2000,
    });

    return { ok: true };
  },
};

// Add to VIEW_COMMANDS array
export const VIEW_COMMANDS: readonly Command[] = [
  togglePreviewCommand,
  toggleOutlineCommand,
  toggleSyncCommand,  // NEW
  zoomInCommand,
  zoomOutCommand,
  resetZoomCommand,
];
```

---

## Step 7: Extend Preview Iframe

**File**: Preview iframe content (inside preview-renderer.tsx or similar)

Add scroll report messages:

```typescript
// Inside preview iframe
let lastReportedRatio = -1;

document.addEventListener('scroll', () => {
  const scrollTop = document.documentElement.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = document.documentElement.clientHeight;

  const ratio = scrollHeight > clientHeight
    ? scrollTop / (scrollHeight - clientHeight)
    : 0;

  // Throttle reports (only send if changed significantly)
  if (Math.abs(ratio - lastReportedRatio) > 0.01) {
    lastReportedRatio = ratio;
    window.parent.postMessage({
      type: 'scroll-report',
      ratio,
      scrollTop,
      scrollHeight,
      clientHeight,
    }, '*');
  }
}, { passive: true });
```

---

## Step 8: Integrate with App

**File**: `src/renderer/App.tsx`

Add sync hook to application:

```tsx
import { useScrollSync } from '@/hooks/useScrollSync';
import { useSyncStore, selectSyncMode, selectIsSyncEnabled } from '@/stores/sync-store';

function App() {
  const editorRef = useRef<EditorView | null>(null);
  const previewRef = useRef<HTMLIFrameElement | null>(null);

  const mode = useSyncStore(selectSyncMode);
  const isEnabled = useSyncStore(selectIsSyncEnabled);

  const { isSyncing } = useScrollSync({
    editorRef,
    previewRef,
    isEnabled,
    mode,
  });

  return (
    <div className="app-layout">
      {/* Outline Panel */}
      <OutlinePanel />

      {/* Editor */}
      <Editor ref={editorRef} />

      {/* Preview */}
      <PreviewFrame ref={previewRef} isSyncing={isSyncing} />
    </div>
  );
}
```

---

## Testing Checklist

- [ ] Editor scroll syncs preview within 200ms
- [ ] Preview scroll syncs editor within 200ms
- [ ] No feedback loops during bidirectional sync
- [ ] Sync mode persists across app restart
- [ ] Cmd+Shift+Y toggles sync on/off
- [ ] Toggle notification displays for 2 seconds
- [ ] Reduced motion preference uses instant scroll
- [ ] Position mapping within 5-line tolerance
- [ ] Cache invalidates on document change
- [ ] Typing does not trigger excessive sync

---

## Key Files

| File | Purpose |
|------|---------|
| `stores/sync-store.ts` | Sync state management |
| `lib/sync/scroll-lock.ts` | Feedback loop prevention |
| `lib/sync/position-mapper.ts` | Editor ↔ Preview mapping |
| `lib/sync/position-cache.ts` | TTL-based position cache |
| `hooks/useScrollSync.ts` | Main orchestration hook |
| `commands/view-commands.ts` | Toggle command registration |
