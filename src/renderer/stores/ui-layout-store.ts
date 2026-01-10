/**
 * UI Layout Store
 * Manages UI panel visibility and zoom level with localStorage persistence.
 * @module renderer/stores/ui-layout-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { STORAGE_KEYS } from '@shared/types/commands';

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
  /** Current zoom level (50-200) */
  readonly zoomLevel: number;
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
  /** Set zoom level (clamped to 50-200) */
  setZoomLevel: (level: number) => void;
  /** Increase zoom by 10 (max 200) */
  zoomIn: () => void;
  /** Decrease zoom by 10 (min 50) */
  zoomOut: () => void;
  /** Reset zoom to 100 */
  resetZoom: () => void;
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

// =============================================================================
// INITIAL STATE
// =============================================================================

/**
 * Initial state for the UI layout store.
 */
const initialState: UILayoutStoreState = {
  previewVisible: true,
  sidebarVisible: true,
  zoomLevel: DEFAULT_ZOOM,
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

    loadFromStorage: () => {
      const persisted = loadPersistedState();
      set((draft) => {
        if (persisted.previewVisible !== undefined) {
          draft.previewVisible = persisted.previewVisible;
        }
        if (persisted.zoomLevel !== undefined) {
          draft.zoomLevel = persisted.zoomLevel;
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
          STORAGE_KEYS.zoomLevel,
          JSON.stringify(state.zoomLevel)
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
