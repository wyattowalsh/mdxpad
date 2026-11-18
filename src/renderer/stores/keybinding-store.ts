/**
 * Keybinding Store
 *
 * Zustand store with Immer middleware for user-customizable keyboard shortcuts.
 * Supports rebinding, conflict detection, and localStorage persistence.
 *
 * @module renderer/stores/keybinding-store
 */

import { create } from 'zustand';
import { cachedWhen, createSelectorCache } from './cached-selector';
import { immer } from 'zustand/middleware/immer';
import type { Draft } from 'immer';
import type { Command, CommandId } from '@shared/types/commands';
import { useCommandRegistry } from './command-registry-store';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A single modifier key.
 */
export type Modifier = 'Mod' | 'Ctrl' | 'Shift' | 'Alt' | 'Meta';

/**
 * A keybinding entry mapping a command to a key combination.
 */
export interface Keybinding {
  readonly commandId: string;
  readonly key: string;
  readonly modifiers: Modifier[];
  readonly label: string;
  readonly category: string;
}

/**
 * A conflict between two keybindings sharing the same key combination.
 */
export interface KeybindingConflict {
  readonly normalized: string;
  readonly commandIds: readonly string[];
}

// =============================================================================
// STATE INTERFACE
// =============================================================================

export interface KeybindingState {
  readonly bindings: readonly Keybinding[];
  readonly defaults: readonly Keybinding[];
}

// =============================================================================
// ACTIONS INTERFACE
// =============================================================================

export interface KeybindingStoreActions {
  readonly initDefaults: (defaults: readonly Keybinding[]) => void;
  readonly setBinding: (commandId: string, key: string, modifiers: readonly Modifier[]) => void;
  readonly resetBinding: (commandId: string) => void;
  readonly resetAll: () => void;
  readonly importBindings: (bindings: readonly Keybinding[]) => void;
  readonly exportBindings: () => readonly Keybinding[];
  readonly detectConflicts: () => readonly KeybindingConflict[];
}

export type KeybindingStore = KeybindingState & KeybindingStoreActions;

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'mdxpad:keybinding-store';

// =============================================================================
// INITIAL STATE
// =============================================================================

const INITIAL_KEYBINDING_STATE: KeybindingState = {
  bindings: [],
  defaults: [],
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Normalize a key + modifiers to a stable string for comparison.
 */
export function normalizeKeybinding(key: string, modifiers: readonly Modifier[]): string {
  const sorted = [...modifiers].sort();
  return [...sorted, key.toLowerCase()].join('+');
}

const MODIFIER_NAMES = new Set<Modifier>(['Mod', 'Ctrl', 'Shift', 'Alt', 'Meta']);

function toModifiers(values: readonly string[]): Modifier[] {
  return values.filter((value): value is Modifier => MODIFIER_NAMES.has(value as Modifier));
}

export function bindingsFromCommands(commands: readonly Command[]): readonly Keybinding[] {
  const bindings: Keybinding[] = [];
  for (const command of commands) {
    if (!command.shortcut) {
      continue;
    }
    bindings.push({
      commandId: command.id,
      key: command.shortcut.key,
      modifiers: toModifiers(command.shortcut.modifiers),
      label: command.name,
      category: command.category,
    });
  }
  return bindings;
}

function syncCommandShortcut(commandId: string, key: string, modifiers: readonly Modifier[]): void {
  useCommandRegistry.getState().replaceShortcut(commandId as CommandId, {
    key,
    modifiers: [...modifiers],
  });
}

function applyBindings(bindings: readonly Keybinding[]): void {
  for (const binding of bindings) {
    syncCommandShortcut(binding.commandId, binding.key, binding.modifiers);
  }
}

function loadFromStorage(): Partial<KeybindingState> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed === 'object' && parsed !== null && 'bindings' in parsed) {
        return { bindings: (parsed as { bindings: Keybinding[] }).bindings };
      }
    }
  } catch {
    // Silently fail
  }
  return {};
}

function persistToStorage(state: KeybindingState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bindings: state.bindings }));
  } catch {
    // Silently fail
  }
}

// =============================================================================
// STORE CREATION
// =============================================================================

// =============================================================================
// ACTION HELPERS
// =============================================================================

type KbSetter = (fn: (draft: Draft<KeybindingState>) => void) => void;
type KbGetter = () => KeybindingState;

function createBindingActions(set: KbSetter, get: KbGetter) {
  return {
    initDefaults: (defaults: readonly Keybinding[]): void => {
      set((draft) => {
        draft.defaults = [...defaults];
        if (draft.bindings.length === 0) {
          draft.bindings = [...defaults];
        }
      });
      applyBindings(get().bindings);
    },

    setBinding: (commandId: string, key: string, modifiers: readonly Modifier[]): void => {
      set((draft) => {
        const idx = draft.bindings.findIndex((b) => b.commandId === commandId);
        if (idx >= 0) {
          const existing = draft.bindings[idx];
          if (existing) {
            draft.bindings[idx] = {
              ...existing,
              key,
              modifiers: [...modifiers],
            };
          }
        }
      });
      persistToStorage(get());
      syncCommandShortcut(commandId, key, modifiers);
    },
  };
}

function createResetActions(set: KbSetter, get: KbGetter) {
  return {
    resetBinding: (commandId: string): void => {
      set((draft) => {
        const defaultBinding = draft.defaults.find((b) => b.commandId === commandId);
        if (!defaultBinding) return;
        const idx = draft.bindings.findIndex((b) => b.commandId === commandId);
        if (idx >= 0) {
          draft.bindings[idx] = { ...defaultBinding };
        }
      });
      persistToStorage(get());
      const restored = get().bindings.find((binding) => binding.commandId === commandId);
      if (restored) {
        syncCommandShortcut(commandId, restored.key, restored.modifiers);
      }
    },

    resetAll: (): void => {
      set((draft) => {
        draft.bindings = [...draft.defaults];
      });
      persistToStorage(get());
      applyBindings(get().bindings);
    },

    importBindings: (bindings: readonly Keybinding[]): void => {
      set((draft) => {
        draft.bindings = [...bindings];
      });
      persistToStorage(get());
      applyBindings(get().bindings);
    },
  };
}

function createReadActions(get: KbGetter) {
  return {
    exportBindings: (): readonly Keybinding[] => {
      return get().bindings;
    },

    detectConflicts: (): readonly KeybindingConflict[] => {
      const { bindings } = get();
      const map = new Map<string, string[]>();

      for (const binding of bindings) {
        const norm = normalizeKeybinding(binding.key, binding.modifiers);
        const existing = map.get(norm);
        if (existing) {
          existing.push(binding.commandId);
        } else {
          map.set(norm, [binding.commandId]);
        }
      }

      const conflicts: KeybindingConflict[] = [];
      for (const [normalized, commandIds] of map) {
        if (commandIds.length >= 2) {
          conflicts.push({ normalized, commandIds });
        }
      }

      return conflicts;
    },
  };
}

export const useKeybindingStore = create<KeybindingStore>()(
  immer((set, get) => {
    const persisted = loadFromStorage();

    return {
      ...INITIAL_KEYBINDING_STATE,
      ...persisted,
      ...createBindingActions(set, get),
      ...createResetActions(set, get),
      ...createReadActions(get),
    };
  })
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectAllBindings = (state: KeybindingStore): readonly Keybinding[] => state.bindings;

export const selectBindingByCommand =
  (commandId: string) =>
  (state: KeybindingStore): Keybinding | undefined =>
    state.bindings.find((b) => b.commandId === commandId);

const bindingsByCategory = new Map<string, ReturnType<typeof createSelectorCache<readonly Keybinding[]>>>();

export const selectBindingsByCategory =
  (category: string) =>
  (state: KeybindingStore): readonly Keybinding[] => {
    const cache = bindingsByCategory.get(category) ?? createSelectorCache<readonly Keybinding[]>([]);
    if (!bindingsByCategory.has(category)) {
      bindingsByCategory.set(category, cache);
    }
    return cachedWhen(cache, [state.bindings, category], () =>
      state.bindings.filter((binding) => binding.category === category)
    );
  };

export const selectIsModified =
  (commandId: string) =>
  (state: KeybindingStore): boolean => {
    const current = state.bindings.find((b) => b.commandId === commandId);
    const defaultBinding = state.defaults.find((b) => b.commandId === commandId);
    if (!current || !defaultBinding) return false;
    return (
      normalizeKeybinding(current.key, current.modifiers) !==
      normalizeKeybinding(defaultBinding.key, defaultBinding.modifiers)
    );
  };

const categoryCache = createSelectorCache<readonly string[]>([]);

export const selectCategories = (state: KeybindingStore): readonly string[] =>
  cachedWhen(categoryCache, [state.bindings], () => {
    const categories = new Set(state.bindings.map((binding) => binding.category));
    return [...categories].sort();
  });
