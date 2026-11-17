/**
 * Tests for Keybinding Store.
 *
 * Tests keybinding CRUD, conflict detection, persistence, and selectors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useKeybindingStore,
  bindingsFromCommands,
  normalizeKeybinding,
  selectAllBindings,
  selectBindingByCommand,
  selectBindingsByCategory,
  selectIsModified,
  selectCategories,
} from './keybinding-store';
import type { Keybinding, KeybindingState } from './keybinding-store';
import type { Command } from '@shared/types/commands';

// =============================================================================
// SETUP
// =============================================================================

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      Reflect.deleteProperty(store, key);
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

const DEFAULT_BINDINGS: Keybinding[] = [
  { commandId: 'file.save', key: 's', modifiers: ['Mod'], label: 'Save', category: 'file' },
  { commandId: 'file.open', key: 'o', modifiers: ['Mod'], label: 'Open', category: 'file' },
  {
    commandId: 'edit.undo',
    key: 'z',
    modifiers: ['Mod'],
    label: 'Undo',
    category: 'edit',
  },
  {
    commandId: 'edit.redo',
    key: 'z',
    modifiers: ['Mod', 'Shift'],
    label: 'Redo',
    category: 'edit',
  },
];

const INITIAL: KeybindingState = {
  bindings: [],
  defaults: [],
};

describe('normalizeKeybinding', () => {
  it('should normalize key and modifiers to a stable string', () => {
    expect(normalizeKeybinding('s', ['Mod'])).toBe('Mod+s');
    expect(normalizeKeybinding('z', ['Shift', 'Mod'])).toBe('Mod+Shift+z');
    expect(normalizeKeybinding('Z', ['Mod'])).toBe('Mod+z');
  });

  it('should sort modifiers alphabetically', () => {
    expect(normalizeKeybinding('a', ['Shift', 'Alt', 'Mod'])).toBe('Alt+Mod+Shift+a');
  });
});

describe('bindingsFromCommands', () => {
  it('keeps commands that have a shortcut', () => {
    const commands = [
      {
        id: 'file.save',
        name: 'Save',
        category: 'file',
        shortcut: { key: 's', modifiers: ['Mod'] },
        execute: () => ({ ok: true as const }),
      },
      {
        id: 'view.toggle-comments',
        name: 'Toggle Comments',
        category: 'view',
        execute: () => ({ ok: true as const }),
      },
    ] as unknown as Command[];

    expect(bindingsFromCommands(commands)).toEqual([
      {
        commandId: 'file.save',
        key: 's',
        modifiers: ['Mod'],
        label: 'Save',
        category: 'file',
      },
    ]);
  });
});

describe('useKeybindingStore', () => {
  beforeEach(() => {
    useKeybindingStore.setState(INITIAL);
    localStorageMock.clear();
  });

  describe('initDefaults', () => {
    it('should set defaults and bindings when no persisted bindings', () => {
      useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      const state = useKeybindingStore.getState();
      expect(state.defaults).toHaveLength(4);
      expect(state.bindings).toHaveLength(4);
    });

    it('should preserve persisted bindings over defaults', () => {
      const customBindings: Keybinding[] = [
        { commandId: 'file.save', key: 'x', modifiers: ['Mod'], label: 'Save', category: 'file' },
      ];
      useKeybindingStore.setState({ ...INITIAL, bindings: customBindings });
      useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);

      const state = useKeybindingStore.getState();
      expect(state.defaults).toHaveLength(4);
      expect(state.bindings).toHaveLength(1); // preserved custom
      expect(state.bindings[0]?.key).toBe('x');
    });
  });

  describe('setBinding', () => {
    it('should update a binding for a command', () => {
      useKeybindingStore.setState({ ...INITIAL });
      useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      useKeybindingStore.getState().setBinding('file.save', 'p', ['Mod', 'Shift']);
      const binding = useKeybindingStore
        .getState()
        .bindings.find((b) => b.commandId === 'file.save');
      expect(binding?.key).toBe('p');
      expect(binding?.modifiers).toEqual(['Mod', 'Shift']);
    });
  });

  describe('resetBinding', () => {
    it('should reset a single binding to its default', () => {
      useKeybindingStore.setState({ ...INITIAL });
      useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      useKeybindingStore.getState().setBinding('file.save', 'x', ['Alt']);
      useKeybindingStore.getState().resetBinding('file.save');

      const binding = useKeybindingStore
        .getState()
        .bindings.find((b) => b.commandId === 'file.save');
      expect(binding?.key).toBe('s');
      expect(binding?.modifiers).toEqual(['Mod']);
    });
  });

  describe('resetAll', () => {
    it('should reset all bindings to defaults', () => {
      useKeybindingStore.setState({ ...INITIAL });
      useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      useKeybindingStore.getState().setBinding('file.save', 'x', ['Alt']);
      useKeybindingStore.getState().setBinding('edit.undo', 'y', ['Mod']);
      useKeybindingStore.getState().resetAll();

      const state = useKeybindingStore.getState();
      const save = state.bindings.find((b) => b.commandId === 'file.save');
      const undo = state.bindings.find((b) => b.commandId === 'edit.undo');
      expect(save?.key).toBe('s');
      expect(undo?.key).toBe('z');
    });
  });

  describe('importBindings / exportBindings', () => {
    it('should import and export bindings', () => {
      useKeybindingStore.setState({ ...INITIAL });
      useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      const exported = useKeybindingStore.getState().exportBindings();
      expect(exported).toHaveLength(4);

      const modified: Keybinding[] = exported.map((b) =>
        b.commandId === 'file.save' ? { ...b, key: 'q' } : b
      );
      useKeybindingStore.getState().importBindings(modified);
      const save = useKeybindingStore.getState().bindings.find((b) => b.commandId === 'file.save');
      expect(save?.key).toBe('q');
    });
  });

  describe('detectConflicts', () => {
    it('should return no conflicts for default bindings', () => {
      useKeybindingStore.setState({ ...INITIAL });
      useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      const conflicts = useKeybindingStore.getState().detectConflicts();
      expect(conflicts).toHaveLength(0);
    });

    it('should detect a conflict when two commands share a shortcut', () => {
      useKeybindingStore.setState({ ...INITIAL });
      useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      // Set edit.undo to same shortcut as file.save
      useKeybindingStore.getState().setBinding('edit.undo', 's', ['Mod']);
      const conflicts = useKeybindingStore.getState().detectConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.commandIds).toContain('file.save');
      expect(conflicts[0]?.commandIds).toContain('edit.undo');
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    useKeybindingStore.setState({ ...INITIAL });
    localStorageMock.clear();
    useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
  });

  it('selectAllBindings returns all bindings', () => {
    expect(selectAllBindings(useKeybindingStore.getState())).toHaveLength(4);
  });

  it('selectBindingByCommand finds a binding by commandId', () => {
    const binding = selectBindingByCommand('file.save')(useKeybindingStore.getState());
    expect(binding?.label).toBe('Save');
  });

  it('selectBindingsByCategory filters by category', () => {
    const fileBindings = selectBindingsByCategory('file')(useKeybindingStore.getState());
    expect(fileBindings).toHaveLength(2);
    const editBindings = selectBindingsByCategory('edit')(useKeybindingStore.getState());
    expect(editBindings).toHaveLength(2);
  });

  it('selectIsModified returns false for unmodified binding', () => {
    expect(selectIsModified('file.save')(useKeybindingStore.getState())).toBe(false);
  });

  it('selectIsModified returns true for modified binding', () => {
    useKeybindingStore.getState().setBinding('file.save', 'x', ['Alt']);
    expect(selectIsModified('file.save')(useKeybindingStore.getState())).toBe(true);
  });

  it('selectCategories returns sorted unique categories', () => {
    const cats = selectCategories(useKeybindingStore.getState());
    expect(cats).toEqual(['edit', 'file']);
  });
});
