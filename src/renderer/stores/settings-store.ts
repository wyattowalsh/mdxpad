/**
 * Settings Store
 *
 * Zustand store for managing settings panel visibility state.
 *
 * @module renderer/stores/settings-store
 */

import { create } from 'zustand';

interface SettingsState {
  /** Whether the settings panel is open */
  isOpen: boolean;
  /** Open the settings panel */
  open: () => void;
  /** Close the settings panel */
  close: () => void;
  /** Toggle the settings panel */
  toggle: () => void;
}

/**
 * Settings store for managing settings panel visibility.
 *
 * @example
 * ```tsx
 * const isOpen = useSettingsStore((s) => s.isOpen);
 * const close = useSettingsStore((s) => s.close);
 *
 * <SettingsPanel isOpen={isOpen} onClose={close} />
 * ```
 */
export const useSettingsStore = create<SettingsState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select whether the settings panel is open.
 */
export const selectSettingsOpen = (s: SettingsState): boolean => s.isOpen;
