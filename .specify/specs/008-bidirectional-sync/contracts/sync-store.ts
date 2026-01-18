/**
 * Sync Store Contracts
 *
 * Feature: 008-bidirectional-sync
 * Type definitions for sync state management.
 */

import { z } from 'zod';

// =============================================================================
// Constants
// =============================================================================

/**
 * Performance constants from spec.md.
 * Centralized for consistency across implementation.
 */
export const SYNC_CONSTANTS = {
  /** Debounce delay before triggering synchronized scroll (ms) */
  SYNC_DEBOUNCE_MS: 50,

  /** Duration of smooth scroll animation (ms) */
  SCROLL_ANIMATION_MS: 150,

  /** Time-to-live for cached position mappings (ms) */
  POSITION_CACHE_TTL_MS: 1000,

  /** Minimum line change to trigger sync (prevents micro-syncs) */
  SYNC_THRESHOLD_LINES: 3,

  /** Percentage of viewport height for scroll margin */
  SCROLL_MARGIN_PERCENT: 10,

  /** Duration for sync toggle notification (ms) */
  NOTIFICATION_DURATION_MS: 2000,
} as const;

/**
 * localStorage keys for sync settings persistence.
 */
export const SYNC_STORAGE_KEYS = {
  mode: 'mdxpad:sync:mode',
  lastActiveMode: 'mdxpad:sync:last-active-mode',
} as const;

/**
 * Display labels for sync modes.
 */
export const SYNC_MODE_LABELS = {
  disabled: 'Disabled',
  editorToPreview: 'Editor → Preview',
  previewToEditor: 'Preview → Editor',
  bidirectional: 'Bidirectional',
} as const;

// =============================================================================
// Schemas
// =============================================================================

/**
 * Sync mode configuration.
 * Controls which direction(s) scroll synchronization operates.
 */
export const SyncModeSchema = z.enum([
  'disabled',
  'editorToPreview',
  'previewToEditor',
  'bidirectional',
]);

/**
 * The two panes that can be synced.
 */
export const SyncPaneSchema = z.enum(['editor', 'preview']);

/**
 * Confidence level for position mappings.
 */
export const MappingConfidenceSchema = z.enum(['high', 'medium', 'low']);

/**
 * Scroll lock state to prevent infinite sync loops.
 */
export const ScrollLockStateSchema = z.object({
  /** Whether lock is currently active */
  isLocked: z.boolean(),
  /** Which pane initiated the lock */
  lockSource: SyncPaneSchema.nullable(),
  /** When the lock was acquired */
  lockTimestamp: z.number().int().min(0),
});

// =============================================================================
// Types
// =============================================================================

export type SyncMode = z.infer<typeof SyncModeSchema>;
export type SyncPane = z.infer<typeof SyncPaneSchema>;
export type MappingConfidence = z.infer<typeof MappingConfidenceSchema>;
export type ScrollLockState = z.infer<typeof ScrollLockStateSchema>;

/**
 * A scroll position snapshot from either pane.
 */
export interface ScrollPosition {
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

/**
 * A mapping between editor line and preview position.
 */
export interface PositionMapping {
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
 * Complete sync state for the application.
 */
export interface SyncStoreState {
  /** Current sync mode (user preference) */
  readonly mode: SyncMode;

  /** Last non-disabled mode (for toggle restore) */
  readonly lastActiveMode: Exclude<SyncMode, 'disabled'>;

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

/**
 * Sync store actions.
 */
export interface SyncStoreActions {
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

  /** Update position cache entry */
  readonly updateCache: (mapping: PositionMapping) => void;

  /** Invalidate entire position cache (on document change) */
  readonly invalidateCache: () => void;

  /** Load mode from localStorage */
  readonly loadFromStorage: () => void;

  /** Persist mode to localStorage */
  readonly persist: () => void;

  /** Reset to initial state */
  readonly reset: () => void;
}

/**
 * Complete sync store type.
 */
export type SyncStore = SyncStoreState & SyncStoreActions;

/**
 * Zustand store API for external access.
 */
export interface SyncStoreApi {
  getState: () => SyncStore;
  setState: (partial: Partial<SyncStoreState>) => void;
  subscribe: (listener: (state: SyncStore) => void) => () => void;
}

// =============================================================================
// Initial State
// =============================================================================

export const INITIAL_SCROLL_LOCK: ScrollLockState = {
  isLocked: false,
  lockSource: null,
  lockTimestamp: 0,
};

export const INITIAL_SYNC_STATE: SyncStoreState = {
  mode: 'bidirectional',
  lastActiveMode: 'bidirectional',
  lock: INITIAL_SCROLL_LOCK,
  lastSyncTimestamp: 0,
  positionCache: new Map(),
  isSyncing: false,
  editorPosition: null,
  previewPosition: null,
};

// =============================================================================
// Selectors
// =============================================================================

/**
 * Select current sync mode.
 */
export const selectSyncMode = (state: SyncStore): SyncMode => state.mode;

/**
 * Select whether sync is enabled.
 */
export const selectIsSyncEnabled = (state: SyncStore): boolean =>
  state.mode !== 'disabled';

/**
 * Select whether editor-to-preview sync is active.
 */
export const selectIsEditorToPreviewEnabled = (state: SyncStore): boolean =>
  state.mode === 'editorToPreview' || state.mode === 'bidirectional';

/**
 * Select whether preview-to-editor sync is active.
 */
export const selectIsPreviewToEditorEnabled = (state: SyncStore): boolean =>
  state.mode === 'previewToEditor' || state.mode === 'bidirectional';

/**
 * Select whether sync is currently locked.
 */
export const selectIsLocked = (state: SyncStore): boolean =>
  state.lock.isLocked;

/**
 * Select lock source pane.
 */
export const selectLockSource = (state: SyncStore): SyncPane | null =>
  state.lock.lockSource;

/**
 * Select whether sync is in progress.
 */
export const selectIsSyncing = (state: SyncStore): boolean =>
  state.isSyncing;

// =============================================================================
// Type Guards
// =============================================================================

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

// =============================================================================
// Validators
// =============================================================================

/**
 * Parse and validate sync mode from storage.
 */
export function parseSyncMode(value: unknown): SyncMode {
  const result = SyncModeSchema.safeParse(value);
  return result.success ? result.data : 'bidirectional';
}

/**
 * Parse and validate last active mode from storage.
 */
export function parseLastActiveMode(value: unknown): Exclude<SyncMode, 'disabled'> {
  const result = SyncModeSchema.safeParse(value);
  if (result.success && result.data !== 'disabled') {
    return result.data;
  }
  return 'bidirectional';
}
