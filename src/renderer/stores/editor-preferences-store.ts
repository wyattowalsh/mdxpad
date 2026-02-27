/**
 * Editor Preferences Store
 *
 * Zustand store with Immer middleware for editor preference state.
 * Persists to localStorage for cross-session retention.
 *
 * @module renderer/stores/editor-preferences-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type { KeymapMode } from '../lib/editor/keymaps';

// =============================================================================
// Types
// =============================================================================

/**
 * Editor preferences state.
 */
export interface EditorPreferencesState {
  /** Keymap mode: default, vim, or emacs */
  keymapMode: KeymapMode;
  /** Font family CSS value */
  fontFamily: string;
  /** Font size in pixels */
  fontSize: number;
  /** Line height multiplier */
  lineHeight: number;
  /** Whether spellcheck is enabled */
  spellcheckEnabled: boolean;
  /** Whether minimap is enabled */
  minimapEnabled: boolean;
  /** Whether focus mode is enabled */
  focusModeEnabled: boolean;
  /** Whether word wrap is enabled */
  wordWrapEnabled: boolean;
  /** Whether distraction-free mode is enabled */
  distractionFreeEnabled: boolean;
}

/**
 * Editor preferences actions.
 */
export interface EditorPreferencesActions {
  /** Set the keymap mode */
  setKeymapMode: (mode: KeymapMode) => void;
  /** Set the font family */
  setFontFamily: (family: string) => void;
  /** Set the font size */
  setFontSize: (size: number) => void;
  /** Set the line height */
  setLineHeight: (height: number) => void;
  /** Toggle spellcheck */
  toggleSpellcheck: () => void;
  /** Toggle minimap */
  toggleMinimap: () => void;
  /** Toggle focus mode */
  toggleFocusMode: () => void;
  /** Toggle word wrap */
  toggleWordWrap: () => void;
  /** Toggle distraction-free mode */
  toggleDistractionFree: () => void;
  /** Reset all preferences to defaults */
  reset: () => void;
}

// =============================================================================
// Combined Type
// =============================================================================

export type EditorPreferencesStore = EditorPreferencesState & EditorPreferencesActions;

// =============================================================================
// Defaults
// =============================================================================

const DEFAULT_PREFERENCES: EditorPreferencesState = {
  keymapMode: 'default',
  fontFamily: 'monospace',
  fontSize: 14,
  lineHeight: 1.6,
  spellcheckEnabled: false,
  minimapEnabled: false,
  focusModeEnabled: false,
  wordWrapEnabled: false,
  distractionFreeEnabled: false,
};

// =============================================================================
// Store
// =============================================================================

/**
 * Editor preferences store hook.
 *
 * Manages editor preferences with localStorage persistence.
 * Uses Immer for immutable state updates.
 *
 * @example
 * ```tsx
 * const fontSize = useEditorPreferencesStore((s) => s.fontSize);
 * const setFontSize = useEditorPreferencesStore((s) => s.setFontSize);
 *
 * <input
 *   type="range"
 *   value={fontSize}
 *   onChange={(e) => setFontSize(Number(e.target.value))}
 * />
 * ```
 */
export const useEditorPreferencesStore = create<EditorPreferencesStore>()(
  persist(
    immer((set) => ({
      ...DEFAULT_PREFERENCES,

      setKeymapMode: (mode) =>
        set((draft) => {
          draft.keymapMode = mode;
        }),

      setFontFamily: (family) =>
        set((draft) => {
          draft.fontFamily = family;
        }),

      setFontSize: (size) =>
        set((draft) => {
          draft.fontSize = Math.max(8, Math.min(72, size));
        }),

      setLineHeight: (height) =>
        set((draft) => {
          draft.lineHeight = Math.max(1.0, Math.min(3.0, height));
        }),

      toggleSpellcheck: () =>
        set((draft) => {
          draft.spellcheckEnabled = !draft.spellcheckEnabled;
        }),

      toggleMinimap: () =>
        set((draft) => {
          draft.minimapEnabled = !draft.minimapEnabled;
        }),

      toggleFocusMode: () =>
        set((draft) => {
          draft.focusModeEnabled = !draft.focusModeEnabled;
        }),

      toggleWordWrap: () =>
        set((draft) => {
          draft.wordWrapEnabled = !draft.wordWrapEnabled;
        }),

      toggleDistractionFree: () =>
        set((draft) => {
          draft.distractionFreeEnabled = !draft.distractionFreeEnabled;
        }),

      reset: () =>
        set((draft) => {
          Object.assign(draft, DEFAULT_PREFERENCES);
        }),
    })),
    {
      name: 'mdxpad-editor-preferences',
    }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectKeymapMode = (s: EditorPreferencesStore): KeymapMode => s.keymapMode;
export const selectFontFamily = (s: EditorPreferencesStore): string => s.fontFamily;
export const selectFontSize = (s: EditorPreferencesStore): number => s.fontSize;
export const selectLineHeight = (s: EditorPreferencesStore): number => s.lineHeight;
export const selectSpellcheckEnabled = (s: EditorPreferencesStore): boolean => s.spellcheckEnabled;
export const selectMinimapEnabled = (s: EditorPreferencesStore): boolean => s.minimapEnabled;
export const selectFocusModeEnabled = (s: EditorPreferencesStore): boolean => s.focusModeEnabled;
export const selectWordWrapEnabled = (s: EditorPreferencesStore): boolean => s.wordWrapEnabled;
export const selectDistractionFreeEnabled = (s: EditorPreferencesStore): boolean =>
  s.distractionFreeEnabled;
