# Data Model: Bidirectional Preview Sync

**Feature**: 008-bidirectional-sync
**Date**: 2026-01-17
**Source**: spec.md Key Entities + research.md

---

## Core Entities

### SyncMode

Represents the user's sync configuration preference.

```typescript
/**
 * Sync mode configuration.
 * Controls which direction(s) scroll synchronization operates.
 */
type SyncMode = 'disabled' | 'editorToPreview' | 'previewToEditor' | 'bidirectional';
```

**Validation Rules**:
- Must be one of the four valid values
- Default: `'bidirectional'` (per FR-002)
- Persisted to localStorage

**Display Names**:
```typescript
const SYNC_MODE_LABELS: Record<SyncMode, string> = {
  disabled: 'Disabled',
  editorToPreview: 'Editor → Preview',
  previewToEditor: 'Preview → Editor',
  bidirectional: 'Bidirectional',
};
```

---

### ScrollPosition

Represents a scroll state in either pane.

```typescript
/**
 * A scroll position snapshot from either pane.
 */
interface ScrollPosition {
  /** Which pane this position is from */
  readonly pane: SyncPane;

  /** Line number for editor (1-indexed), null for preview */
  readonly line: number | null;

  /** Pixel offset from top for preview, null for editor */
  readonly scrollTop: number | null;

  /** Normalized ratio (0-1) for proportional sync */
  readonly ratio: number;

  /** Timestamp of this position */
  readonly timestamp: number;
}

/** The two panes that can be synced */
type SyncPane = 'editor' | 'preview';
```

**Validation Rules**:
- `pane`: Must be `'editor'` or `'preview'`
- `line`: >= 1 when pane is `'editor'`, null otherwise
- `scrollTop`: >= 0 when pane is `'preview'`, null otherwise
- `ratio`: Clamped to [0, 1]
- `timestamp`: Unix timestamp in milliseconds

---

### PositionMapping

Maps editor lines to preview scroll positions.

```typescript
/**
 * A mapping between editor line and preview position.
 * Used for accurate sync based on document structure.
 */
interface PositionMapping {
  /** Source line number in editor (1-indexed) */
  readonly editorLine: number;

  /** Target scroll position in preview (pixels from top) */
  readonly previewScrollTop: number;

  /** Optional reference to DOM element in preview */
  readonly elementId?: string;

  /** Confidence level of this mapping */
  readonly confidence: MappingConfidence;

  /** Cache timestamp */
  readonly timestamp: number;
}

/**
 * Confidence level for position mappings.
 * Determines fallback behavior when primary mapping unavailable.
 */
type MappingConfidence = 'high' | 'medium' | 'low';
```

**Confidence Levels**:
- `'high'`: Direct AST source position match (heading, component)
- `'medium'`: DOM element with data-line attribute
- `'low'`: Proportional calculation (fallback)

**Validation Rules**:
- `editorLine`: >= 1
- `previewScrollTop`: >= 0
- `confidence`: One of the three valid values
- `timestamp`: Unix timestamp in milliseconds

---

### ScrollLockState

Internal state for preventing feedback loops.

```typescript
/**
 * Scroll lock state to prevent infinite sync loops.
 * When locked, scroll events from the lock source are ignored.
 */
interface ScrollLockState {
  /** Whether lock is currently active */
  readonly isLocked: boolean;

  /** Which pane initiated the lock (owns the sync) */
  readonly lockSource: SyncPane | null;

  /** When the lock was acquired */
  readonly lockTimestamp: number;
}
```

**State Transitions**:
```
Unlocked → Locked (on sync initiation)
Locked → Unlocked (after SYNC_DEBOUNCE_MS timeout)
Locked → Unlocked (on manual scroll from opposite pane)
```

**Validation Rules**:
- `lockSource` must be null when `isLocked` is false
- `lockTimestamp` must be 0 when `isLocked` is false

---

### SyncState

Complete sync state managed by the sync store.

```typescript
/**
 * Complete sync state for the application.
 * Managed by the sync Zustand store.
 */
interface SyncState {
  /** Current sync mode (user preference) */
  readonly mode: SyncMode;

  /** Last non-disabled mode (for toggle restore) */
  readonly lastActiveMode: SyncMode;

  /** Current scroll lock state */
  readonly lock: ScrollLockState;

  /** Last sync operation timestamp */
  readonly lastSyncTimestamp: number;

  /** Position cache for performance */
  readonly positionCache: ReadonlyMap<number, PositionMapping>;

  /** Whether sync is currently in progress */
  readonly isSyncing: boolean;

  /** Last known editor position */
  readonly editorPosition: ScrollPosition | null;

  /** Last known preview position */
  readonly previewPosition: ScrollPosition | null;
}
```

**State Lifecycle**:
```
Initial → Mode set (from localStorage or default)
Mode set → Syncing (on scroll event)
Syncing → Idle (after sync complete)
Idle → Syncing (on next scroll event)
```

**Validation Rules**:
- `lastActiveMode`: Never `'disabled'`, defaults to `'bidirectional'`
- `positionCache`: May be empty, values validated as PositionMapping
- `isSyncing`: Boolean flag, resets after sync completes

---

### SyncEvent

Represents a scroll event that may trigger sync.

```typescript
/**
 * A scroll event from either pane.
 * Processed by the sync orchestrator.
 */
interface SyncEvent {
  /** Source pane of the scroll */
  readonly source: SyncPane;

  /** Position data from the scroll */
  readonly position: ScrollPosition;

  /** Whether this is a user-initiated scroll */
  readonly isUserScroll: boolean;
}
```

**Validation Rules**:
- `source` must match `position.pane`
- `isUserScroll`: true for manual scrolls, false for programmatic syncs

---

### PreviewScrollMessage

PostMessage for preview scroll communication.

```typescript
/**
 * Message sent from parent to preview iframe for scroll.
 */
interface ScrollCommand {
  readonly type: 'scroll';
  readonly ratio: number;
}

/**
 * Message sent from preview iframe to parent reporting scroll.
 * NEW: Added for bidirectional sync.
 */
interface ScrollReportSignal {
  readonly type: 'scroll-report';
  readonly ratio: number;
  readonly scrollTop: number;
  readonly scrollHeight: number;
}
```

**Validation Rules**:
- `ratio`: Clamped to [0, 1]
- `scrollTop`: >= 0
- `scrollHeight`: > 0

---

## Store Extensions

### Sync Store

New Zustand store for sync state management.

```typescript
interface SyncStoreState extends SyncState {}

interface SyncStoreActions {
  /** Set sync mode */
  readonly setMode: (mode: SyncMode) => void;

  /** Toggle sync (disabled ↔ lastActiveMode) */
  readonly toggleSync: () => void;

  /** Handle scroll event from editor */
  readonly handleEditorScroll: (position: ScrollPosition) => void;

  /** Handle scroll event from preview */
  readonly handlePreviewScroll: (position: ScrollPosition) => void;

  /** Acquire scroll lock */
  readonly acquireLock: (source: SyncPane) => boolean;

  /** Release scroll lock */
  readonly releaseLock: () => void;

  /** Update position cache */
  readonly updateCache: (mapping: PositionMapping) => void;

  /** Invalidate position cache (on document change) */
  readonly invalidateCache: () => void;

  /** Load mode from localStorage */
  readonly loadFromStorage: () => void;

  /** Persist mode to localStorage */
  readonly persist: () => void;
}

type SyncStore = SyncStoreState & SyncStoreActions;
```

**Storage Keys**:
```typescript
export const SYNC_STORAGE_KEYS = {
  mode: 'mdxpad:sync:mode',
  lastActiveMode: 'mdxpad:sync:last-active-mode',
} as const;
```

---

### Preview Store Extension

Extend existing preview store for scroll reporting.

```typescript
// Add to IframeToParentMessage union
type IframeToParentMessage =
  | ReadySignal
  | SizeSignal
  | RuntimeErrorSignal
  | ScrollReportSignal;  // NEW
```

---

## Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                       SyncStore                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  SyncMode   │  │ ScrollLock  │  │PositionCache│         │
│  │  Settings   │  │    State    │  │   (Map)     │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                      │
│              │    Sync Orchestrator   │                      │
│              │   (useScrollSync hook) │                      │
│              └───────────────────────┘                      │
│                          │                                   │
│         ┌────────────────┼────────────────┐                  │
│         ▼                │                ▼                  │
│  ┌─────────────┐         │         ┌─────────────┐          │
│  │   Editor    │◄────────┘────────►│   Preview   │          │
│  │ (CodeMirror)│                   │  (iframe)   │          │
│  └─────────────┘                   └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ persists
                          ▼
               ┌───────────────────────┐
               │     localStorage      │
               │ - mdxpad:sync:mode    │
               │ - mdxpad:sync:last-.. │
               └───────────────────────┘
```

---

## Zod Schemas

```typescript
import { z } from 'zod';

export const SyncModeSchema = z.enum([
  'disabled',
  'editorToPreview',
  'previewToEditor',
  'bidirectional',
]);

export const SyncPaneSchema = z.enum(['editor', 'preview']);

export const MappingConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const ScrollPositionSchema = z.object({
  pane: SyncPaneSchema,
  line: z.number().int().min(1).nullable(),
  scrollTop: z.number().min(0).nullable(),
  ratio: z.number().min(0).max(1),
  timestamp: z.number().int().min(0),
});

export const PositionMappingSchema = z.object({
  editorLine: z.number().int().min(1),
  previewScrollTop: z.number().min(0),
  elementId: z.string().optional(),
  confidence: MappingConfidenceSchema,
  timestamp: z.number().int().min(0),
});

export const ScrollLockStateSchema = z.object({
  isLocked: z.boolean(),
  lockSource: SyncPaneSchema.nullable(),
  lockTimestamp: z.number().int().min(0),
});

export const ScrollReportSignalSchema = z.object({
  type: z.literal('scroll-report'),
  ratio: z.number().min(0).max(1),
  scrollTop: z.number().min(0),
  scrollHeight: z.number().min(1),
});
```

---

## Constants

```typescript
/**
 * Performance constants from spec.md.
 * Centralized for consistency across implementation.
 */
export const SYNC_CONSTANTS = {
  /** Debounce delay before triggering synchronized scroll */
  SYNC_DEBOUNCE_MS: 50,

  /** Duration of smooth scroll animation */
  SCROLL_ANIMATION_MS: 150,

  /** Time-to-live for cached position mappings */
  POSITION_CACHE_TTL_MS: 1000,

  /** Minimum line change to trigger sync (prevents micro-syncs) */
  SYNC_THRESHOLD_LINES: 3,

  /** Percentage of viewport height for scroll margin */
  SCROLL_MARGIN_PERCENT: 10,

  /** Duration for sync toggle notification */
  NOTIFICATION_DURATION_MS: 2000,
} as const;
```

---

## Initial State

```typescript
const INITIAL_SCROLL_LOCK: ScrollLockState = {
  isLocked: false,
  lockSource: null,
  lockTimestamp: 0,
};

const INITIAL_SYNC_STATE: SyncState = {
  mode: 'bidirectional',
  lastActiveMode: 'bidirectional',
  lock: INITIAL_SCROLL_LOCK,
  lastSyncTimestamp: 0,
  positionCache: new Map(),
  isSyncing: false,
  editorPosition: null,
  previewPosition: null,
};
```

---

## Type Guards

```typescript
/**
 * Type guard for SyncMode.
 */
export function isSyncMode(value: unknown): value is SyncMode {
  return SyncModeSchema.safeParse(value).success;
}

/**
 * Check if sync should occur from editor to preview.
 */
export function shouldSyncEditorToPreview(mode: SyncMode): boolean {
  return mode === 'editorToPreview' || mode === 'bidirectional';
}

/**
 * Check if sync should occur from preview to editor.
 */
export function shouldSyncPreviewToEditor(mode: SyncMode): boolean {
  return mode === 'previewToEditor' || mode === 'bidirectional';
}

/**
 * Check if any sync is enabled.
 */
export function isSyncEnabled(mode: SyncMode): boolean {
  return mode !== 'disabled';
}
```
