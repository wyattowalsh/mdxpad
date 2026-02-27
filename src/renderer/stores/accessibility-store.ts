/**
 * Accessibility Store
 *
 * Zustand store with Immer middleware for accessibility state management.
 * Tracks high contrast mode, reduced motion, large text, and screen reader announcements.
 * Auto-detects system preferences and persists user overrides to localStorage.
 *
 * @module renderer/stores/accessibility-store
 */

import type { Draft } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// Types
// ============================================================================

/**
 * Screen reader announcement entry.
 */
export interface ScreenReaderAnnouncement {
  readonly id: string;
  readonly message: string;
  readonly timestamp: number;
  readonly priority: 'polite' | 'assertive';
}

/**
 * Accessibility state interface.
 */
export interface A11yState {
  readonly highContrastEnabled: boolean;
  readonly reducedMotion: boolean;
  readonly largeText: boolean;
  readonly screenReaderAnnouncements: readonly ScreenReaderAnnouncement[];
  /** Whether user has explicitly overridden high contrast */
  readonly highContrastUserOverride: boolean;
  /** Whether user has explicitly overridden reduced motion */
  readonly reducedMotionUserOverride: boolean;
}

/**
 * Accessibility store actions interface.
 */
export interface A11yActions {
  /** Toggle high contrast mode */
  readonly toggleHighContrast: () => void;
  /** Toggle reduced motion */
  readonly toggleReducedMotion: () => void;
  /** Toggle large text */
  readonly toggleLargeText: () => void;
  /** Add a screen reader announcement */
  readonly announce: (message: string, priority?: 'polite' | 'assertive') => void;
  /** Clear all announcements */
  readonly clearAnnouncements: () => void;
  /** Sync system preference for high contrast (respects user override) */
  readonly syncHighContrast: (systemValue: boolean) => void;
  /** Sync system preference for reduced motion (respects user override) */
  readonly syncReducedMotion: (systemValue: boolean) => void;
  /** Reset all preferences */
  readonly reset: () => void;
}

/**
 * Combined accessibility store type.
 */
export type A11yStore = A11yState & A11yActions;

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'mdxpad:accessibility';
const MAX_ANNOUNCEMENTS = 50;

/**
 * Initial accessibility state.
 */
export const INITIAL_A11Y_STATE: A11yState = {
  highContrastEnabled: false,
  reducedMotion: false,
  largeText: false,
  screenReaderAnnouncements: [],
  highContrastUserOverride: false,
  reducedMotionUserOverride: false,
};

// ============================================================================
// Persistence Helpers
// ============================================================================

interface PersistedA11y {
  readonly highContrastEnabled: boolean;
  readonly reducedMotion: boolean;
  readonly largeText: boolean;
  readonly highContrastUserOverride: boolean;
  readonly reducedMotionUserOverride: boolean;
}

function loadPersistedState(): Partial<PersistedA11y> {
  try {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return {};
    return JSON.parse(stored) as Partial<PersistedA11y>;
  } catch {
    return {};
  }
}

function persistState(state: A11yState): void {
  try {
    if (typeof window === 'undefined') return;
    const persisted: PersistedA11y = {
      highContrastEnabled: state.highContrastEnabled,
      reducedMotion: state.reducedMotion,
      largeText: state.largeText,
      highContrastUserOverride: state.highContrastUserOverride,
      reducedMotionUserOverride: state.reducedMotionUserOverride,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

let announcementCounter = 0;

// ============================================================================
// Action Helpers
// ============================================================================

/** Mutable draft setter type used by Immer middleware */
type ImmerSet = (fn: (draft: Draft<A11yStore>) => void) => void;

function createToggleActions(
  set: ImmerSet
): Pick<A11yActions, 'toggleHighContrast' | 'toggleReducedMotion' | 'toggleLargeText'> {
  return {
    toggleHighContrast: () =>
      set((draft) => {
        draft.highContrastEnabled = !draft.highContrastEnabled;
        draft.highContrastUserOverride = true;
        persistState(draft);
      }),
    toggleReducedMotion: () =>
      set((draft) => {
        draft.reducedMotion = !draft.reducedMotion;
        draft.reducedMotionUserOverride = true;
        persistState(draft);
      }),
    toggleLargeText: () =>
      set((draft) => {
        draft.largeText = !draft.largeText;
        persistState(draft);
      }),
  };
}

function createSyncAndLifecycleActions(
  set: ImmerSet
): Pick<
  A11yActions,
  'announce' | 'clearAnnouncements' | 'syncHighContrast' | 'syncReducedMotion' | 'reset'
> {
  return {
    announce: (message, priority = 'polite') =>
      set((draft) => {
        announcementCounter += 1;
        const announcement: ScreenReaderAnnouncement = {
          id: `a11y-${Date.now()}-${announcementCounter}`,
          message,
          timestamp: Date.now(),
          priority,
        };
        draft.screenReaderAnnouncements = [
          ...draft.screenReaderAnnouncements.slice(-(MAX_ANNOUNCEMENTS - 1)),
          announcement,
        ];
      }),
    clearAnnouncements: () =>
      set((draft) => {
        draft.screenReaderAnnouncements = [];
      }),
    syncHighContrast: (systemValue) =>
      set((draft) => {
        if (!draft.highContrastUserOverride) {
          draft.highContrastEnabled = systemValue;
          persistState(draft);
        }
      }),
    syncReducedMotion: (systemValue) =>
      set((draft) => {
        if (!draft.reducedMotionUserOverride) {
          draft.reducedMotion = systemValue;
          persistState(draft);
        }
      }),
    reset: () =>
      set((draft) => {
        draft.highContrastEnabled = INITIAL_A11Y_STATE.highContrastEnabled;
        draft.reducedMotion = INITIAL_A11Y_STATE.reducedMotion;
        draft.largeText = INITIAL_A11Y_STATE.largeText;
        draft.screenReaderAnnouncements = [];
        draft.highContrastUserOverride = false;
        draft.reducedMotionUserOverride = false;
        persistState(draft);
      }),
  };
}

// ============================================================================
// Store Creation
// ============================================================================

/**
 * Accessibility store hook.
 * Manages accessibility preferences including high contrast, reduced motion,
 * large text, and screen reader announcements.
 */
export const useAccessibilityStore = create<A11yStore>()(
  immer((set) => {
    const persisted = loadPersistedState();
    const initialState: A11yState = { ...INITIAL_A11Y_STATE, ...persisted };

    return {
      ...initialState,
      ...createToggleActions(set),
      ...createSyncAndLifecycleActions(set),
    };
  })
);

// ============================================================================
// Selectors
// ============================================================================

/** Select high contrast enabled state */
export const selectHighContrastEnabled = (state: A11yStore): boolean => state.highContrastEnabled;

/** Select reduced motion state */
export const selectReducedMotion = (state: A11yStore): boolean => state.reducedMotion;

/** Select large text state */
export const selectLargeText = (state: A11yStore): boolean => state.largeText;

/** Select screen reader announcements */
export const selectAnnouncements = (state: A11yStore): readonly ScreenReaderAnnouncement[] =>
  state.screenReaderAnnouncements;

/** Select the latest announcement */
export const selectLatestAnnouncement = (state: A11yStore): ScreenReaderAnnouncement | undefined =>
  state.screenReaderAnnouncements[state.screenReaderAnnouncements.length - 1];
