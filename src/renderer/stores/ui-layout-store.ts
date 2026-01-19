/**
 * UI Layout Store
 * Manages UI panel visibility and zoom level with localStorage persistence.
 * @module renderer/stores/ui-layout-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { STORAGE_KEYS } from '@shared/types/commands';
import { SHELL_STORAGE_KEYS } from '../../../.specify/specs/006-application-shell/contracts/shell-schemas';

// =============================================================================
// STATE INTERFACE
// =============================================================================

/**
 * UI layout store state interface.
 */
export interface UILayoutStoreState {
  /** Whether preview pane is visible */
  readonly previewVisible: boolean;
  /** Whether sidebar is visible (for future use) */
  readonly sidebarVisible: boolean;
  /** Whether outline panel is visible */
  readonly outlineVisible: boolean;
  /** Whether frontmatter panel is visible */
  readonly frontmatterVisible: boolean;
  /** Current zoom level (50-200) */
  readonly zoomLevel: number;
  /** Split pane ratio (0.1 to 0.9, where 0.5 = 50% editor / 50% preview) */
  readonly splitRatio: number;
}

// =============================================================================
// ACTIONS INTERFACE
// =============================================================================

/**
 * UI layout store actions interface.
 */
export interface UILayoutStoreActions {
  /** Toggle preview pane visibility */
  togglePreview: () => void;
  /** Set preview pane visibility */
  setPreviewVisible: (visible: boolean) => void;
  /** Toggle sidebar visibility */
  toggleSidebar: () => void;
  /** Set sidebar visibility */
  setSidebarVisible: (visible: boolean) => void;
  /** Toggle outline panel visibility */
  toggleOutline: () => void;
  /** Set outline panel visibility */
  setOutlineVisible: (visible: boolean) => void;
  /** Toggle frontmatter panel visibility */
  toggleFrontmatter: () => void;
  /** Set frontmatter panel visibility */
  setFrontmatterVisible: (visible: boolean) => void;
  /** Set zoom level (clamped to 50-200) */
  setZoomLevel: (level: number) => void;
  /** Increase zoom by 10 (max 200) */
  zoomIn: () => void;
  /** Decrease zoom by 10 (min 50) */
  zoomOut: () => void;
  /** Reset zoom to 100 */
  resetZoom: () => void;
  /** Set split ratio (clamped to 0.1-0.9) */
  setSplitRatio: (ratio: number) => void;
  /** Reset split ratio to default (0.5) */
  resetSplitRatio: () => void;
  /** Load persisted state from localStorage */
  loadFromStorage: () => void;
  /** Save current state to localStorage */
  persist: () => void;
}

// =============================================================================
// COMBINED STORE TYPE
// =============================================================================

/**
 * Combined UI layout store type.
 */
export type UILayoutStore = UILayoutStoreState & UILayoutStoreActions;

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum allowed zoom level */
const MIN_ZOOM = 50;
/** Maximum allowed zoom level */
const MAX_ZOOM = 200;
/** Default zoom level */
const DEFAULT_ZOOM = 100;
/** Zoom step increment */
const ZOOM_STEP = 10;
/** Minimum allowed split ratio */
const MIN_SPLIT_RATIO = 0.1;
/** Maximum allowed split ratio */
const MAX_SPLIT_RATIO = 0.9;
/** Default split ratio */
const DEFAULT_SPLIT_RATIO = 0.5;
/** Debounce delay for split ratio persistence (ms) */
const SPLIT_RATIO_DEBOUNCE_MS = 500;

// =============================================================================
// INITIAL STATE
// =============================================================================

/**
 * Initial state for the UI layout store.
 */
const initialState: UILayoutStoreState = {
  previewVisible: true,
  sidebarVisible: true,
  outlineVisible: false,
  frontmatterVisible: true,
  zoomLevel: DEFAULT_ZOOM,
  splitRatio: DEFAULT_SPLIT_RATIO,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Clamp zoom level to valid range.
 *
 * @param level - Zoom level to clamp
 * @returns Clamped zoom level between MIN_ZOOM and MAX_ZOOM
 */
function clampZoom(level: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
}

/**
 * Clamp split ratio to valid range.
 *
 * @param ratio - Split ratio to clamp
 * @returns Clamped ratio between MIN_SPLIT_RATIO and MAX_SPLIT_RATIO
 */
function clampSplitRatio(ratio: number): number {
  return Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, ratio));
}

// =============================================================================
// DEBOUNCED PERSISTENCE
// =============================================================================

/** Timer reference for debounced split ratio persistence */
let splitRatioDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Persist split ratio to localStorage with debouncing.
 * Used to avoid excessive writes during resize drag operations.
 *
 * @param ratio - Split ratio to persist
 */
function debouncedPersistSplitRatio(ratio: number): void {
  if (splitRatioDebounceTimer !== null) {
    clearTimeout(splitRatioDebounceTimer);
  }
  splitRatioDebounceTimer = setTimeout(() => {
    try {
      localStorage.setItem(SHELL_STORAGE_KEYS.splitRatio, JSON.stringify(ratio));
    } catch {
      // Silently fail if localStorage is unavailable
    }
    splitRatioDebounceTimer = null;
  }, SPLIT_RATIO_DEBOUNCE_MS);
}

/**
 * Cancel any pending debounced split ratio persistence.
 * Useful for testing and cleanup.
 */
export function cancelDebouncedPersistSplitRatio(): void {
  if (splitRatioDebounceTimer !== null) {
    clearTimeout(splitRatioDebounceTimer);
    splitRatioDebounceTimer = null;
  }
}

/**
 * Immediately persist split ratio (bypassing debounce).
 * Useful for testing.
 *
 * @param ratio - Split ratio to persist
 */
export function flushDebouncedPersistSplitRatio(ratio: number): void {
  cancelDebouncedPersistSplitRatio();
  try {
    localStorage.setItem(SHELL_STORAGE_KEYS.splitRatio, JSON.stringify(ratio));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/** Mutable version of UILayoutStoreState for internal use */
type MutableUILayoutState = {
  -readonly [K in keyof UILayoutStoreState]?: UILayoutStoreState[K];
};

/**
 * Load persisted UI layout from localStorage.
 * Validates each field individually to support partial data.
 *
 * @returns Partial state from localStorage or empty object
 */
function loadPersistedState(): Partial<UILayoutStoreState> {
  const result: MutableUILayoutState = {};

  try {
    // Load and validate previewVisible
    const previewVisibleRaw = localStorage.getItem(STORAGE_KEYS.previewVisible);
    if (previewVisibleRaw !== null) {
      const parsed = JSON.parse(previewVisibleRaw);
      if (typeof parsed === 'boolean') {
        result.previewVisible = parsed;
      }
    }
  } catch {
    // Ignore invalid previewVisible, will use default
  }

  try {
    // Load and validate outlineVisible
    const outlineVisibleRaw = localStorage.getItem(STORAGE_KEYS.outlineVisible);
    if (outlineVisibleRaw !== null) {
      const parsed = JSON.parse(outlineVisibleRaw);
      if (typeof parsed === 'boolean') {
        result.outlineVisible = parsed;
      }
    }
  } catch {
    // Ignore invalid outlineVisible, will use default
  }

  try {
    // Load and validate zoomLevel
    const zoomLevelRaw = localStorage.getItem(STORAGE_KEYS.zoomLevel);
    if (zoomLevelRaw !== null) {
      const parsed = JSON.parse(zoomLevelRaw);
      if (typeof parsed === 'number' && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
        result.zoomLevel = parsed;
      } else if (typeof parsed === 'number') {
        // Clamp invalid zoom values
        result.zoomLevel = clampZoom(parsed);
      }
    }
  } catch {
    // Ignore invalid zoomLevel, will use default
  }

  try {
    // Load and validate splitRatio
    const splitRatioRaw = localStorage.getItem(SHELL_STORAGE_KEYS.splitRatio);
    if (splitRatioRaw !== null) {
      const parsed = JSON.parse(splitRatioRaw);
      if (typeof parsed === 'number' && parsed >= MIN_SPLIT_RATIO && parsed <= MAX_SPLIT_RATIO) {
        result.splitRatio = parsed;
      } else if (typeof parsed === 'number') {
        // Clamp invalid split ratio values
        result.splitRatio = clampSplitRatio(parsed);
      }
    }
  } catch {
    // Ignore invalid splitRatio, will use default
  }

  return result;
}

// =============================================================================
// STORE CREATION
// =============================================================================

/**
 * UI layout store hook.
 * Manages panel visibility and zoom level with localStorage persistence.
 *
 * @example
 * ```tsx
 * const { previewVisible, togglePreview, zoomLevel, zoomIn } = useUILayoutStore();
 *
 * // Toggle preview
 * togglePreview();
 *
 * // Zoom in
 * zoomIn(); // 100 -> 110
 *
 * // Persist to localStorage
 * persist();
 * ```
 */
export const useUILayoutStore = create<UILayoutStore>()(
  immer((set, get) => ({
    ...initialState,

    togglePreview: () =>
      set((draft) => {
        draft.previewVisible = !draft.previewVisible;
      }),

    setPreviewVisible: (visible) =>
      set((draft) => {
        draft.previewVisible = visible;
      }),

    toggleSidebar: () =>
      set((draft) => {
        draft.sidebarVisible = !draft.sidebarVisible;
      }),

    setSidebarVisible: (visible) =>
      set((draft) => {
        draft.sidebarVisible = visible;
      }),

    toggleOutline: () =>
      set((draft) => {
        draft.outlineVisible = !draft.outlineVisible;
      }),

    setOutlineVisible: (visible) =>
      set((draft) => {
        draft.outlineVisible = visible;
      }),

    toggleFrontmatter: () =>
      set((draft) => {
        draft.frontmatterVisible = !draft.frontmatterVisible;
      }),

    setFrontmatterVisible: (visible) =>
      set((draft) => {
        draft.frontmatterVisible = visible;
      }),

    setZoomLevel: (level) =>
      set((draft) => {
        draft.zoomLevel = clampZoom(level);
      }),

    zoomIn: () =>
      set((draft) => {
        draft.zoomLevel = clampZoom(draft.zoomLevel + ZOOM_STEP);
      }),

    zoomOut: () =>
      set((draft) => {
        draft.zoomLevel = clampZoom(draft.zoomLevel - ZOOM_STEP);
      }),

    resetZoom: () =>
      set((draft) => {
        draft.zoomLevel = DEFAULT_ZOOM;
      }),

    setSplitRatio: (ratio) => {
      const clampedRatio = clampSplitRatio(ratio);
      set((draft) => {
        draft.splitRatio = clampedRatio;
      });
      // Debounced persistence to avoid excessive writes during drag
      debouncedPersistSplitRatio(clampedRatio);
    },

    resetSplitRatio: () => {
      set((draft) => {
        draft.splitRatio = DEFAULT_SPLIT_RATIO;
      });
      // Debounced persistence
      debouncedPersistSplitRatio(DEFAULT_SPLIT_RATIO);
    },

    loadFromStorage: () => {
      const persisted = loadPersistedState();
      set((draft) => {
        if (persisted.previewVisible !== undefined) {
          draft.previewVisible = persisted.previewVisible;
        }
        if (persisted.outlineVisible !== undefined) {
          draft.outlineVisible = persisted.outlineVisible;
        }
        if (persisted.zoomLevel !== undefined) {
          draft.zoomLevel = persisted.zoomLevel;
        }
        if (persisted.splitRatio !== undefined) {
          draft.splitRatio = persisted.splitRatio;
        }
      });
    },

    persist: () => {
      const state = get();
      try {
        localStorage.setItem(
          STORAGE_KEYS.previewVisible,
          JSON.stringify(state.previewVisible)
        );
        localStorage.setItem(
          STORAGE_KEYS.outlineVisible,
          JSON.stringify(state.outlineVisible)
        );
        localStorage.setItem(
          STORAGE_KEYS.zoomLevel,
          JSON.stringify(state.zoomLevel)
        );
        // Note: splitRatio uses debounced persistence via setSplitRatio,
        // but we also persist it here for consistency when persist() is called directly
        localStorage.setItem(
          SHELL_STORAGE_KEYS.splitRatio,
          JSON.stringify(state.splitRatio)
        );
      } catch {
        // Silently fail if localStorage is unavailable
      }
    },
  }))
);

// Load persisted state on store creation
useUILayoutStore.getState().loadFromStorage();

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Selector for preview visibility.
 *
 * @param state - UI layout store state
 * @returns Whether preview pane is visible
 */
export const selectPreviewVisible = (state: UILayoutStore): boolean =>
  state.previewVisible;

/**
 * Selector for sidebar visibility.
 *
 * @param state - UI layout store state
 * @returns Whether sidebar is visible
 */
export const selectSidebarVisible = (state: UILayoutStore): boolean =>
  state.sidebarVisible;

/**
 * Selector for zoom level.
 *
 * @param state - UI layout store state
 * @returns Current zoom level (50-200)
 */
export const selectZoomLevel = (state: UILayoutStore): number =>
  state.zoomLevel;

/**
 * Selector for split ratio.
 *
 * @param state - UI layout store state
 * @returns Current split ratio (0.1-0.9)
 */
export const selectSplitRatio = (state: UILayoutStore): number =>
  state.splitRatio;

/**
 * Selector for outline panel visibility.
 *
 * @param state - UI layout store state
 * @returns Whether outline panel is visible
 */
export const selectOutlineVisible = (state: UILayoutStore): boolean =>
  state.outlineVisible;

/**
 * Selector for frontmatter panel visibility.
 *
 * @param state - UI layout store state
 * @returns Whether frontmatter panel is visible
 */
export const selectFrontmatterVisible = (state: UILayoutStore): boolean =>
  state.frontmatterVisible;
