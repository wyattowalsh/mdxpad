/**
 * Playground Zustand Store
 *
 * State management for the component playground feature.
 * Tracks component code, props, preview state, and errors.
 *
 * @module renderer/features/playground/playground-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// =============================================================================
// Types
// =============================================================================

/**
 * Playground state interface.
 */
export interface PlaygroundState {
  /** JSX component code */
  code: string;
  /** JSON string for component props */
  propsJson: string;
  /** Parsed props object (null if invalid JSON) */
  parsedProps: Record<string, unknown> | null;
  /** Whether the preview is currently rendering */
  isRendering: boolean;
  /** Last render error message */
  renderError: string | null;
  /** Whether the playground panel is visible */
  isOpen: boolean;
  /** Auto-refresh on code change */
  autoRefresh: boolean;
  /** Debounce delay for auto-refresh in ms */
  refreshDelayMs: number;
}

/**
 * Playground actions interface.
 */
export interface PlaygroundActions {
  /** Update the component code */
  setCode: (code: string) => void;
  /** Update the props JSON string */
  setPropsJson: (json: string) => void;
  /** Set whether preview is rendering */
  setIsRendering: (isRendering: boolean) => void;
  /** Set a render error */
  setRenderError: (error: string | null) => void;
  /** Toggle playground panel visibility */
  toggleOpen: () => void;
  /** Open the playground panel */
  open: () => void;
  /** Close the playground panel */
  close: () => void;
  /** Toggle auto-refresh */
  toggleAutoRefresh: () => void;
  /** Reset playground to defaults */
  reset: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CODE = '<div>\n  <h1>Hello Playground</h1>\n  <p>Edit this component</p>\n</div>';
const DEFAULT_PROPS_JSON = '{}';
const DEFAULT_REFRESH_DELAY_MS = 500;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Safely parse a JSON string into a props object.
 */
function parsePropsJson(json: string): Record<string, unknown> | null {
  if (!json.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// Store
// =============================================================================

/**
 * Playground store with immer middleware.
 */
export const usePlaygroundStore = create<PlaygroundState & PlaygroundActions>()(
  immer((set) => ({
    // Initial state
    code: DEFAULT_CODE,
    propsJson: DEFAULT_PROPS_JSON,
    parsedProps: {},
    isRendering: false,
    renderError: null,
    isOpen: false,
    autoRefresh: true,
    refreshDelayMs: DEFAULT_REFRESH_DELAY_MS,

    // Actions
    setCode: (code) => {
      set((state) => {
        state.code = code;
        state.renderError = null;
      });
    },

    setPropsJson: (json) => {
      set((state) => {
        state.propsJson = json;
        state.parsedProps = parsePropsJson(json);
      });
    },

    setIsRendering: (isRendering) => {
      set((state) => {
        state.isRendering = isRendering;
      });
    },

    setRenderError: (error) => {
      set((state) => {
        state.renderError = error;
      });
    },

    toggleOpen: () => {
      set((state) => {
        state.isOpen = !state.isOpen;
      });
    },

    open: () => {
      set((state) => {
        state.isOpen = true;
      });
    },

    close: () => {
      set((state) => {
        state.isOpen = false;
      });
    },

    toggleAutoRefresh: () => {
      set((state) => {
        state.autoRefresh = !state.autoRefresh;
      });
    },

    reset: () => {
      set((state) => {
        state.code = DEFAULT_CODE;
        state.propsJson = DEFAULT_PROPS_JSON;
        state.parsedProps = {};
        state.isRendering = false;
        state.renderError = null;
        state.autoRefresh = true;
      });
    },
  }))
);

// =============================================================================
// Selectors
// =============================================================================

/**
 * Whether the props JSON is valid.
 */
export function selectPropsValid(state: PlaygroundState): boolean {
  return state.parsedProps !== null;
}

/**
 * Whether the playground has any content.
 */
export function selectHasContent(state: PlaygroundState): boolean {
  return state.code.trim().length > 0;
}

// Exported for testing
export { parsePropsJson, DEFAULT_CODE, DEFAULT_PROPS_JSON };
