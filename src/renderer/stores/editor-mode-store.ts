/**
 * Editor Mode Store
 *
 * Zustand store with Immer middleware for toggling between
 * source (CodeMirror) and WYSIWYG (ProseMirror) editing modes.
 * Persists preference to localStorage.
 *
 * @module renderer/stores/editor-mode-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// =============================================================================
// TYPES
// =============================================================================

/**
 * The available editor modes.
 */
export type EditorMode = 'source' | 'wysiwyg';

// =============================================================================
// STATE INTERFACE
// =============================================================================

export interface EditorModeState {
  readonly mode: EditorMode;
}

// =============================================================================
// ACTIONS INTERFACE
// =============================================================================

export interface EditorModeStoreActions {
  readonly setMode: (mode: EditorMode) => void;
  readonly toggleMode: () => void;
}

export type EditorModeStore = EditorModeState & EditorModeStoreActions;

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'mdxpad:editor-mode';

const DEFAULT_MODE: EditorMode = 'source';

// =============================================================================
// PERSISTENCE
// =============================================================================

function loadModeFromStorage(): EditorMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'source' || stored === 'wysiwyg') {
      return stored;
    }
  } catch {
    // Silently fail
  }
  return DEFAULT_MODE;
}

function persistMode(mode: EditorMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Silently fail
  }
}

// =============================================================================
// STORE CREATION
// =============================================================================

export const useEditorModeStore = create<EditorModeStore>()(
  immer((set, get) => ({
    mode: loadModeFromStorage(),

    setMode: (mode: EditorMode): void => {
      set((draft) => {
        draft.mode = mode;
      });
      persistMode(mode);
    },

    toggleMode: (): void => {
      const next = get().mode === 'source' ? 'wysiwyg' : 'source';
      set((draft) => {
        draft.mode = next;
      });
      persistMode(next);
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectEditorMode = (state: EditorModeStore): EditorMode => state.mode;

export const selectIsSourceMode = (state: EditorModeStore): boolean => state.mode === 'source';

export const selectIsWysiwygMode = (state: EditorModeStore): boolean => state.mode === 'wysiwyg';
