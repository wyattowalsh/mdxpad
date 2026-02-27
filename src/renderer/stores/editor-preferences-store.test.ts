/**
 * Unit tests for Editor Preferences Store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing the store
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
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

// Import after mock is in place
const { useEditorPreferencesStore } = await import('./editor-preferences-store');

describe('useEditorPreferencesStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    useEditorPreferencesStore.getState().reset();
  });

  // =========================================================================
  // Initial State
  // =========================================================================

  it('has correct initial state', () => {
    const state = useEditorPreferencesStore.getState();

    expect(state.keymapMode).toBe('default');
    expect(state.fontFamily).toBe('monospace');
    expect(state.fontSize).toBe(14);
    expect(state.lineHeight).toBe(1.6);
    expect(state.spellcheckEnabled).toBe(false);
    expect(state.minimapEnabled).toBe(false);
    expect(state.focusModeEnabled).toBe(false);
    expect(state.wordWrapEnabled).toBe(false);
    expect(state.distractionFreeEnabled).toBe(false);
  });

  // =========================================================================
  // Keymap Mode
  // =========================================================================

  it('sets keymap mode to vim', () => {
    useEditorPreferencesStore.getState().setKeymapMode('vim');
    expect(useEditorPreferencesStore.getState().keymapMode).toBe('vim');
  });

  it('sets keymap mode to emacs', () => {
    useEditorPreferencesStore.getState().setKeymapMode('emacs');
    expect(useEditorPreferencesStore.getState().keymapMode).toBe('emacs');
  });

  it('sets keymap mode back to default', () => {
    useEditorPreferencesStore.getState().setKeymapMode('vim');
    useEditorPreferencesStore.getState().setKeymapMode('default');
    expect(useEditorPreferencesStore.getState().keymapMode).toBe('default');
  });

  // =========================================================================
  // Font Settings
  // =========================================================================

  it('sets font family', () => {
    useEditorPreferencesStore.getState().setFontFamily('"JetBrains Mono", monospace');
    expect(useEditorPreferencesStore.getState().fontFamily).toBe('"JetBrains Mono", monospace');
  });

  it('sets font size', () => {
    useEditorPreferencesStore.getState().setFontSize(18);
    expect(useEditorPreferencesStore.getState().fontSize).toBe(18);
  });

  it('clamps font size to minimum 8', () => {
    useEditorPreferencesStore.getState().setFontSize(4);
    expect(useEditorPreferencesStore.getState().fontSize).toBe(8);
  });

  it('clamps font size to maximum 72', () => {
    useEditorPreferencesStore.getState().setFontSize(100);
    expect(useEditorPreferencesStore.getState().fontSize).toBe(72);
  });

  it('sets line height', () => {
    useEditorPreferencesStore.getState().setLineHeight(2.0);
    expect(useEditorPreferencesStore.getState().lineHeight).toBe(2.0);
  });

  it('clamps line height to minimum 1.0', () => {
    useEditorPreferencesStore.getState().setLineHeight(0.5);
    expect(useEditorPreferencesStore.getState().lineHeight).toBe(1.0);
  });

  it('clamps line height to maximum 3.0', () => {
    useEditorPreferencesStore.getState().setLineHeight(5.0);
    expect(useEditorPreferencesStore.getState().lineHeight).toBe(3.0);
  });

  // =========================================================================
  // Toggle Actions
  // =========================================================================

  it('toggles spellcheck', () => {
    useEditorPreferencesStore.getState().toggleSpellcheck();
    expect(useEditorPreferencesStore.getState().spellcheckEnabled).toBe(true);

    useEditorPreferencesStore.getState().toggleSpellcheck();
    expect(useEditorPreferencesStore.getState().spellcheckEnabled).toBe(false);
  });

  it('toggles minimap', () => {
    useEditorPreferencesStore.getState().toggleMinimap();
    expect(useEditorPreferencesStore.getState().minimapEnabled).toBe(true);

    useEditorPreferencesStore.getState().toggleMinimap();
    expect(useEditorPreferencesStore.getState().minimapEnabled).toBe(false);
  });

  it('toggles focus mode', () => {
    useEditorPreferencesStore.getState().toggleFocusMode();
    expect(useEditorPreferencesStore.getState().focusModeEnabled).toBe(true);

    useEditorPreferencesStore.getState().toggleFocusMode();
    expect(useEditorPreferencesStore.getState().focusModeEnabled).toBe(false);
  });

  it('toggles word wrap', () => {
    useEditorPreferencesStore.getState().toggleWordWrap();
    expect(useEditorPreferencesStore.getState().wordWrapEnabled).toBe(true);

    useEditorPreferencesStore.getState().toggleWordWrap();
    expect(useEditorPreferencesStore.getState().wordWrapEnabled).toBe(false);
  });

  it('toggles distraction-free mode', () => {
    useEditorPreferencesStore.getState().toggleDistractionFree();
    expect(useEditorPreferencesStore.getState().distractionFreeEnabled).toBe(true);

    useEditorPreferencesStore.getState().toggleDistractionFree();
    expect(useEditorPreferencesStore.getState().distractionFreeEnabled).toBe(false);
  });

  // =========================================================================
  // Reset
  // =========================================================================

  it('resets all preferences to defaults', () => {
    const store = useEditorPreferencesStore.getState();
    store.setKeymapMode('vim');
    store.setFontFamily('serif');
    store.setFontSize(24);
    store.setLineHeight(2.5);
    store.toggleSpellcheck();
    store.toggleMinimap();
    store.toggleFocusMode();
    store.toggleWordWrap();
    store.toggleDistractionFree();

    useEditorPreferencesStore.getState().reset();

    const state = useEditorPreferencesStore.getState();
    expect(state.keymapMode).toBe('default');
    expect(state.fontFamily).toBe('monospace');
    expect(state.fontSize).toBe(14);
    expect(state.lineHeight).toBe(1.6);
    expect(state.spellcheckEnabled).toBe(false);
    expect(state.minimapEnabled).toBe(false);
    expect(state.focusModeEnabled).toBe(false);
    expect(state.wordWrapEnabled).toBe(false);
    expect(state.distractionFreeEnabled).toBe(false);
  });
});
