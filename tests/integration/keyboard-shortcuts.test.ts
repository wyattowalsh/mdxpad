/**
 * Integration tests for Keyboard Shortcuts.
 *
 * Tests default bindings, rebinding, conflict detection, reset,
 * import/export, and category filtering.
 *
 * @module tests/integration/keyboard-shortcuts.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store;
      store = rest;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Import after mocks
import {
  useKeybindingStore,
  normalizeKeybinding,
  selectAllBindings,
  selectBindingByCommand,
  selectBindingsByCategory,
  selectIsModified,
  selectCategories,
} from '@renderer/stores/keybinding-store';
import type { Keybinding } from '@renderer/stores/keybinding-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_BINDINGS: Keybinding[] = [
  {
    commandId: 'file.save',
    key: 's',
    modifiers: ['Mod'],
    label: 'Save',
    category: 'file',
  },
  {
    commandId: 'file.open',
    key: 'o',
    modifiers: ['Mod'],
    label: 'Open',
    category: 'file',
  },
  {
    commandId: 'edit.bold',
    key: 'b',
    modifiers: ['Mod'],
    label: 'Bold',
    category: 'edit',
  },
  {
    commandId: 'edit.italic',
    key: 'i',
    modifiers: ['Mod'],
    label: 'Italic',
    category: 'edit',
  },
  {
    commandId: 'view.togglePreview',
    key: 'p',
    modifiers: ['Mod', 'Shift'],
    label: 'Toggle Preview',
    category: 'view',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Keyboard Shortcuts Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    act(() => {
      useKeybindingStore.setState({ bindings: [], defaults: [] });
    });
  });

  describe('default bindings', () => {
    it('should initialize with defaults when no persisted state', () => {
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      const state = useKeybindingStore.getState();
      const bindings = selectAllBindings(state);

      expect(bindings).toHaveLength(5);
      expect(selectBindingByCommand('file.save')(state)?.key).toBe('s');
      expect(selectBindingByCommand('edit.bold')(state)?.key).toBe('b');
    });

    it('should not overwrite existing bindings when re-initializing defaults', () => {
      // First init
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      // Rebind save to Mod+W
      act(() => {
        useKeybindingStore.getState().setBinding('file.save', 'w', ['Mod']);
      });

      // Re-init defaults (should preserve custom bindings)
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      const state = useKeybindingStore.getState();
      expect(selectBindingByCommand('file.save')(state)?.key).toBe('w');
    });
  });

  describe('rebinding', () => {
    it('should rebind a key', () => {
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      act(() => {
        useKeybindingStore.getState().setBinding('file.save', 'w', ['Mod']);
      });

      const state = useKeybindingStore.getState();
      const binding = selectBindingByCommand('file.save')(state);
      expect(binding?.key).toBe('w');
      expect(binding?.modifiers).toEqual(['Mod']);
    });

    it('should track modified state', () => {
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      let state = useKeybindingStore.getState();
      expect(selectIsModified('file.save')(state)).toBe(false);

      act(() => {
        useKeybindingStore.getState().setBinding('file.save', 'w', ['Mod']);
      });

      state = useKeybindingStore.getState();
      expect(selectIsModified('file.save')(state)).toBe(true);
    });

    it('should persist rebinding to localStorage', () => {
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      act(() => {
        useKeybindingStore.getState().setBinding('file.save', 'w', ['Mod']);
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const calls = localStorageMock.setItem.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[0]).toBe('mdxpad:keybinding-store');
    });
  });

  describe('conflict detection', () => {
    it('should detect no conflicts with default bindings', () => {
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      const conflicts = useKeybindingStore.getState().detectConflicts();
      expect(conflicts).toHaveLength(0);
    });

    it('should detect conflicts when two commands share the same keybinding', () => {
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      // Rebind bold to same key as save (Mod+S)
      act(() => {
        useKeybindingStore.getState().setBinding('edit.bold', 's', ['Mod']);
      });

      const conflicts = useKeybindingStore.getState().detectConflicts();
      expect(conflicts.length).toBeGreaterThan(0);

      const conflict = conflicts.find(
        (c) => c.commandIds.includes('file.save') && c.commandIds.includes('edit.bold')
      );
      expect(conflict).toBeDefined();
      expect(conflict?.normalized).toBe(normalizeKeybinding('s', ['Mod']));
    });
  });

  describe('reset', () => {
    it('should reset a single binding to default', () => {
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      act(() => {
        useKeybindingStore.getState().setBinding('file.save', 'w', ['Mod']);
      });

      expect(selectBindingByCommand('file.save')(useKeybindingStore.getState())?.key).toBe('w');

      act(() => {
        useKeybindingStore.getState().resetBinding('file.save');
      });

      const state = useKeybindingStore.getState();
      expect(selectBindingByCommand('file.save')(state)?.key).toBe('s');
      expect(selectIsModified('file.save')(state)).toBe(false);
    });

    it('should reset all bindings to defaults', () => {
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      // Modify multiple bindings
      act(() => {
        useKeybindingStore.getState().setBinding('file.save', 'w', ['Mod']);
        useKeybindingStore.getState().setBinding('edit.bold', 'x', ['Mod']);
      });

      act(() => {
        useKeybindingStore.getState().resetAll();
      });

      const state = useKeybindingStore.getState();
      expect(selectBindingByCommand('file.save')(state)?.key).toBe('s');
      expect(selectBindingByCommand('edit.bold')(state)?.key).toBe('b');
      expect(selectIsModified('file.save')(state)).toBe(false);
      expect(selectIsModified('edit.bold')(state)).toBe(false);
    });
  });

  describe('import/export', () => {
    it('should export and reimport bindings', () => {
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      // Customize
      act(() => {
        useKeybindingStore.getState().setBinding('file.save', 'w', ['Mod']);
      });

      // Export
      const exported = useKeybindingStore.getState().exportBindings();
      expect(exported).toHaveLength(5);

      // Reset
      act(() => {
        useKeybindingStore.getState().resetAll();
      });

      expect(selectBindingByCommand('file.save')(useKeybindingStore.getState())?.key).toBe('s');

      // Import
      act(() => {
        useKeybindingStore.getState().importBindings(exported);
      });

      expect(selectBindingByCommand('file.save')(useKeybindingStore.getState())?.key).toBe('w');
    });
  });

  describe('category filtering', () => {
    it('should filter bindings by category', () => {
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      const state = useKeybindingStore.getState();

      const fileBindings = selectBindingsByCategory('file')(state);
      expect(fileBindings).toHaveLength(2);
      expect(fileBindings.every((b) => b.category === 'file')).toBe(true);

      const editBindings = selectBindingsByCategory('edit')(state);
      expect(editBindings).toHaveLength(2);

      const viewBindings = selectBindingsByCategory('view')(state);
      expect(viewBindings).toHaveLength(1);
    });

    it('should list all categories', () => {
      act(() => {
        useKeybindingStore.getState().initDefaults(DEFAULT_BINDINGS);
      });

      const categories = selectCategories(useKeybindingStore.getState());
      expect(categories).toContain('file');
      expect(categories).toContain('edit');
      expect(categories).toContain('view');
      expect(categories).toHaveLength(3);
    });
  });

  describe('normalizeKeybinding', () => {
    it('should normalize modifier order', () => {
      const a = normalizeKeybinding('s', ['Shift', 'Mod']);
      const b = normalizeKeybinding('s', ['Mod', 'Shift']);
      expect(a).toBe(b);
    });

    it('should lowercase the key', () => {
      const a = normalizeKeybinding('S', ['Mod']);
      const b = normalizeKeybinding('s', ['Mod']);
      expect(a).toBe(b);
    });
  });
});
