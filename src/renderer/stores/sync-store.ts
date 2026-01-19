/**
 * Sync Store
 *
 * Manages bidirectional scroll synchronization state between editor and preview panes.
 * Provides mode control, scroll lock management, and position caching with localStorage persistence.
 *
 * @module renderer/stores/sync-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Enable Immer's MapSet plugin for Map support in positionCache
enableMapSet();

import type {
  SyncStore,
  SyncStoreState,
  SyncMode,
  SyncPane,
  ScrollPosition,
  PositionMapping,
  ScrollLockState,
} from '@shared/types/sync';
import { isSyncMode } from '@shared/types/sync';
import { SYNC_STORAGE_KEYS, SYNC_CONSTANTS } from '@renderer/lib/sync';

// ============================================================================
// Initial State
// ============================================================================

/**
 * Initial scroll lock state.
 * Unlocked with no source or timestamp.
 */
const INITIAL_SCROLL_LOCK: ScrollLockState = {
  isLocked: false,
  lockSource: null,
  lockTimestamp: 0,
};

/**
 * Initial sync store state.
 * Default mode is bidirectional with empty cache.
 */
const INITIAL_SYNC_STATE: SyncStoreState = {
  mode: 'bidirectional',
  lastActiveMode: 'bidirectional',
  lock: INITIAL_SCROLL_LOCK,
  lastSyncTimestamp: 0,
  positionCache: new Map(),
  isSyncing: false,
  editorPosition: null,
  previewPosition: null,
};

// ============================================================================
// Lock Release Timer
// ============================================================================

/** Timer reference for auto-releasing scroll lock */
let lockReleaseTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Clear any pending lock release timer.
 * Called before setting a new timer or on explicit release.
 */
function clearLockTimer(): void {
  if (lockReleaseTimer !== null) {
    clearTimeout(lockReleaseTimer);
    lockReleaseTimer = null;
  }
}

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Sync store hook.
 * Manages bidirectional scroll sync state with localStorage persistence.
 *
 * @example
 * ```tsx
 * const { mode, toggleSync, acquireLock, releaseLock } = useSyncStore();
 *
 * // Toggle sync on/off
 * toggleSync();
 *
 * // Acquire lock before programmatic scroll
 * if (acquireLock('editor')) {
 *   scrollPreview(targetPosition);
 *   // Lock auto-releases after SYNC_DEBOUNCE_MS
 * }
 *
 * // Persist settings
 * persist();
 * ```
 */
export const useSyncStore = create<SyncStore>()(
  immer((set, get) => ({
    ...INITIAL_SYNC_STATE,

    // ========================================================================
    // Mode Actions
    // ========================================================================

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

    // ========================================================================
    // Lock Actions
    // ========================================================================

    acquireLock: (source: SyncPane): boolean => {
      const state = get();

      // If already locked by this source, don't re-acquire (prevents re-triggering)
      if (state.lock.isLocked && state.lock.lockSource === source) {
        return false;
      }

      set((draft) => {
        draft.lock = {
          isLocked: true,
          lockSource: source,
          lockTimestamp: Date.now(),
        };
        draft.isSyncing = true;
      });

      // Clear any existing timer and set auto-release
      clearLockTimer();
      lockReleaseTimer = setTimeout(() => {
        get().releaseLock();
      }, SYNC_CONSTANTS.SYNC_DEBOUNCE_MS);

      return true;
    },

    releaseLock: () => {
      clearLockTimer();
      set((draft) => {
        draft.lock = INITIAL_SCROLL_LOCK;
        draft.isSyncing = false;
      });
    },

    // ========================================================================
    // Scroll Position Actions
    // ========================================================================

    handleEditorScroll: (position: ScrollPosition) =>
      set((draft) => {
        draft.editorPosition = position;
        draft.lastSyncTimestamp = position.timestamp;
      }),

    handlePreviewScroll: (position: ScrollPosition) =>
      set((draft) => {
        draft.previewPosition = position;
        draft.lastSyncTimestamp = position.timestamp;
      }),

    // ========================================================================
    // Cache Actions
    // ========================================================================

    updateCache: (mapping: PositionMapping) =>
      set((draft) => {
        // Cast to mutable Map for Immer operations
        const cache = draft.positionCache as Map<number, PositionMapping>;
        cache.set(mapping.editorLine, mapping);
      }),

    invalidateCache: () =>
      set((draft) => {
        // Cast to mutable Map for Immer operations
        const cache = draft.positionCache as Map<number, PositionMapping>;
        cache.clear();
      }),

    // ========================================================================
    // Persistence Actions
    // ========================================================================

    loadFromStorage: () => {
      try {
        const modeStr = localStorage.getItem(SYNC_STORAGE_KEYS.mode);
        const lastActiveStr = localStorage.getItem(SYNC_STORAGE_KEYS.lastActiveMode);

        set((draft) => {
          // Parse and validate mode
          if (modeStr !== null) {
            try {
              const parsed = JSON.parse(modeStr);
              if (isSyncMode(parsed)) {
                draft.mode = parsed;
              }
            } catch {
              // Ignore invalid JSON
            }
          }

          // Parse and validate lastActiveMode
          if (lastActiveStr !== null) {
            try {
              const parsed = JSON.parse(lastActiveStr);
              if (isSyncMode(parsed) && parsed !== 'disabled') {
                draft.lastActiveMode = parsed;
              }
            } catch {
              // Ignore invalid JSON
            }
          }
        });
      } catch {
        // Silently fail on localStorage errors (e.g., SecurityError in private browsing)
      }
    },

    persist: () => {
      const state = get();
      try {
        localStorage.setItem(SYNC_STORAGE_KEYS.mode, JSON.stringify(state.mode));
        localStorage.setItem(
          SYNC_STORAGE_KEYS.lastActiveMode,
          JSON.stringify(state.lastActiveMode)
        );
      } catch {
        // Silently fail on localStorage errors
      }
    },

    // ========================================================================
    // Reset Action
    // ========================================================================

    reset: () => {
      clearLockTimer();
      set((draft) => {
        draft.mode = INITIAL_SYNC_STATE.mode;
        draft.lastActiveMode = INITIAL_SYNC_STATE.lastActiveMode;
        draft.lock = INITIAL_SCROLL_LOCK;
        draft.lastSyncTimestamp = 0;
        // Cast to mutable Map for clear operation
        const cache = draft.positionCache as Map<number, PositionMapping>;
        cache.clear();
        draft.isSyncing = false;
        draft.editorPosition = null;
        draft.previewPosition = null;
      });
    },
  }))
);

// Load persisted state on module initialization
useSyncStore.getState().loadFromStorage();

// ============================================================================
// Selectors (re-exported from types for convenience)
// ============================================================================

export {
  selectSyncMode,
  selectIsSyncEnabled,
  selectIsEditorToPreviewEnabled,
  selectIsPreviewToEditorEnabled,
  selectIsLocked,
  selectLockSource,
  selectIsSyncing,
  selectEditorPosition,
  selectPreviewPosition,
  selectPositionCache,
  // Type guards
  isSyncMode,
  isSyncPane,
  shouldSyncEditorToPreview,
  shouldSyncPreviewToEditor,
  isSyncEnabled,
} from '@shared/types/sync';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Clear the lock release timer.
 * Exposed for testing cleanup.
 */
export function clearSyncLockTimer(): void {
  clearLockTimer();
}
