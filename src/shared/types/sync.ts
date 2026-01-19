/**
 * Sync Type Definitions
 *
 * Shared types for the Bidirectional Preview Sync feature.
 * Defines types for sync state management, position mapping, and scroll coordination.
 *
 * @module shared/types/sync
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Sync mode configuration.
 * Controls which direction(s) scroll synchronization operates.
 */
export type SyncMode = 'disabled' | 'editorToPreview' | 'previewToEditor' | 'bidirectional';

/**
 * The two panes that can be synced.
 */
export type SyncPane = 'editor' | 'preview';

/**
 * Confidence level for position mappings.
 * - high: Exact AST-based mapping (e.g., heading, component with line data)
 * - medium: Approximate mapping with good confidence
 * - low: Ratio-based fallback mapping
 */
export type MappingConfidence = 'high' | 'medium' | 'low';

// ============================================================================
// State Types
// ============================================================================

/**
 * Scroll lock state to prevent infinite sync loops.
 * When one pane scrolls, it acquires a lock to prevent the other
 * pane's scroll handler from triggering a reverse sync.
 */
export interface ScrollLockState {
  /** Whether lock is currently active */
  readonly isLocked: boolean;
  /** Which pane initiated the lock */
  readonly lockSource: SyncPane | null;
  /** When the lock was acquired (Unix timestamp in ms) */
  readonly lockTimestamp: number;
}

/**
 * A scroll position snapshot from either pane.
 * Captures the current scroll state for sync operations.
 */
export interface ScrollPosition {
  /** Which pane this position is from */
  readonly pane: SyncPane;

  /** Line number for editor (1-indexed), null for preview */
  readonly line: number | null;

  /** Pixel offset from top for preview, null for editor */
  readonly scrollTop: number | null;

  /** Normalized ratio (0-1) for proportional sync fallback */
  readonly ratio: number;

  /** Timestamp of this position (Unix timestamp in ms) */
  readonly timestamp: number;
}

/**
 * A mapping between editor line and preview position.
 * Used for caching position correlations to improve sync performance.
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

  /** Cache timestamp (Unix timestamp in ms) */
  readonly timestamp: number;
}

// ============================================================================
// Store Types
// ============================================================================

/**
 * Complete sync state for the application.
 * Managed by the sync Zustand store.
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

  /** Position cache for performance (editor line -> mapping) */
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
 * All methods for mutating sync state.
 */
export interface SyncStoreActions {
  /**
   * Set sync mode.
   *
   * @param mode - The new sync mode
   */
  readonly setMode: (mode: SyncMode) => void;

  /**
   * Toggle sync (disabled <-> lastActiveMode).
   * Keyboard shortcut: Cmd+Shift+Y
   */
  readonly toggleSync: () => void;

  /**
   * Handle scroll event from editor.
   * Triggers preview scroll if mode allows.
   *
   * @param position - Current editor scroll position
   */
  readonly handleEditorScroll: (position: ScrollPosition) => void;

  /**
   * Handle scroll event from preview.
   * Triggers editor scroll if mode allows.
   *
   * @param position - Current preview scroll position
   */
  readonly handlePreviewScroll: (position: ScrollPosition) => void;

  /**
   * Acquire scroll lock.
   * Returns true if lock was acquired, false if already locked.
   *
   * @param source - Which pane is acquiring the lock
   * @returns Whether lock was successfully acquired
   */
  readonly acquireLock: (source: SyncPane) => boolean;

  /**
   * Release scroll lock.
   * Should be called after scroll animation completes.
   */
  readonly releaseLock: () => void;

  /**
   * Update position cache entry.
   *
   * @param mapping - The position mapping to cache
   */
  readonly updateCache: (mapping: PositionMapping) => void;

  /**
   * Invalidate entire position cache (on document change).
   * Called when MDX content changes to clear stale mappings.
   */
  readonly invalidateCache: () => void;

  /**
   * Load mode from localStorage.
   * Called on application startup.
   */
  readonly loadFromStorage: () => void;

  /**
   * Persist mode to localStorage.
   * Called when mode changes.
   */
  readonly persist: () => void;

  /**
   * Reset to initial state.
   * Clears all sync state including cache.
   */
  readonly reset: () => void;
}

/**
 * Complete sync store type.
 * Combines state and actions.
 */
export type SyncStore = SyncStoreState & SyncStoreActions;

/**
 * Zustand store API for external access.
 * Used for subscribing to state changes outside React components.
 */
export interface SyncStoreApi {
  /** Get current state snapshot */
  getState: () => SyncStore;
  /** Update state (partial update) */
  setState: (partial: Partial<SyncStoreState>) => void;
  /** Subscribe to state changes */
  subscribe: (listener: (state: SyncStore) => void) => () => void;
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select current sync mode.
 *
 * @param state - Sync store state
 * @returns Current sync mode
 */
export const selectSyncMode = (state: SyncStore): SyncMode => state.mode;

/**
 * Select whether sync is enabled (any mode except disabled).
 *
 * @param state - Sync store state
 * @returns True if sync is enabled
 */
export const selectIsSyncEnabled = (state: SyncStore): boolean =>
  state.mode !== 'disabled';

/**
 * Select whether editor-to-preview sync is active.
 *
 * @param state - Sync store state
 * @returns True if editor scrolls should sync to preview
 */
export const selectIsEditorToPreviewEnabled = (state: SyncStore): boolean =>
  state.mode === 'editorToPreview' || state.mode === 'bidirectional';

/**
 * Select whether preview-to-editor sync is active.
 *
 * @param state - Sync store state
 * @returns True if preview scrolls should sync to editor
 */
export const selectIsPreviewToEditorEnabled = (state: SyncStore): boolean =>
  state.mode === 'previewToEditor' || state.mode === 'bidirectional';

/**
 * Select whether sync is currently locked.
 *
 * @param state - Sync store state
 * @returns True if scroll lock is active
 */
export const selectIsLocked = (state: SyncStore): boolean =>
  state.lock.isLocked;

/**
 * Select lock source pane.
 *
 * @param state - Sync store state
 * @returns Which pane holds the lock, or null if unlocked
 */
export const selectLockSource = (state: SyncStore): SyncPane | null =>
  state.lock.lockSource;

/**
 * Select whether sync is in progress.
 *
 * @param state - Sync store state
 * @returns True if a sync operation is currently running
 */
export const selectIsSyncing = (state: SyncStore): boolean =>
  state.isSyncing;

/**
 * Select last known editor position.
 *
 * @param state - Sync store state
 * @returns Last editor scroll position or null
 */
export const selectEditorPosition = (state: SyncStore): ScrollPosition | null =>
  state.editorPosition;

/**
 * Select last known preview position.
 *
 * @param state - Sync store state
 * @returns Last preview scroll position or null
 */
export const selectPreviewPosition = (state: SyncStore): ScrollPosition | null =>
  state.previewPosition;

/**
 * Select position cache.
 *
 * @param state - Sync store state
 * @returns Position mapping cache
 */
export const selectPositionCache = (state: SyncStore): ReadonlyMap<number, PositionMapping> =>
  state.positionCache;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid SyncMode.
 *
 * @param value - Value to check
 * @returns True if value is a valid SyncMode
 */
export function isSyncMode(value: unknown): value is SyncMode {
  return (
    value === 'disabled' ||
    value === 'editorToPreview' ||
    value === 'previewToEditor' ||
    value === 'bidirectional'
  );
}

/**
 * Check if a value is a valid SyncPane.
 *
 * @param value - Value to check
 * @returns True if value is a valid SyncPane
 */
export function isSyncPane(value: unknown): value is SyncPane {
  return value === 'editor' || value === 'preview';
}

/**
 * Check if sync should occur from editor to preview.
 *
 * @param mode - Current sync mode
 * @returns True if editor-to-preview sync is enabled
 */
export function shouldSyncEditorToPreview(mode: SyncMode): boolean {
  return mode === 'editorToPreview' || mode === 'bidirectional';
}

/**
 * Check if sync should occur from preview to editor.
 *
 * @param mode - Current sync mode
 * @returns True if preview-to-editor sync is enabled
 */
export function shouldSyncPreviewToEditor(mode: SyncMode): boolean {
  return mode === 'previewToEditor' || mode === 'bidirectional';
}

/**
 * Check if any sync is enabled.
 *
 * @param mode - Current sync mode
 * @returns True if mode is not disabled
 */
export function isSyncEnabled(mode: SyncMode): boolean {
  return mode !== 'disabled';
}
