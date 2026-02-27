/**
 * Tests for Editor Mode Store.
 *
 * Tests mode switching, persistence, and selectors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useEditorModeStore,
  selectEditorMode,
  selectIsSourceMode,
  selectIsWysiwygMode,
} from './editor-mode-store';

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

describe('useEditorModeStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useEditorModeStore.setState({ mode: 'source' });
  });

  it('should default to source mode', () => {
    expect(useEditorModeStore.getState().mode).toBe('source');
  });

  it('should set mode to wysiwyg', () => {
    useEditorModeStore.getState().setMode('wysiwyg');
    expect(useEditorModeStore.getState().mode).toBe('wysiwyg');
  });

  it('should set mode back to source', () => {
    useEditorModeStore.getState().setMode('wysiwyg');
    useEditorModeStore.getState().setMode('source');
    expect(useEditorModeStore.getState().mode).toBe('source');
  });

  it('should toggle from source to wysiwyg', () => {
    useEditorModeStore.getState().toggleMode();
    expect(useEditorModeStore.getState().mode).toBe('wysiwyg');
  });

  it('should toggle from wysiwyg back to source', () => {
    useEditorModeStore.getState().setMode('wysiwyg');
    useEditorModeStore.getState().toggleMode();
    expect(useEditorModeStore.getState().mode).toBe('source');
  });

  it('should persist mode to localStorage', () => {
    useEditorModeStore.getState().setMode('wysiwyg');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('mdxpad:editor-mode', 'wysiwyg');
  });
});

describe('selectors', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useEditorModeStore.setState({ mode: 'source' });
  });

  it('selectEditorMode returns the current mode', () => {
    expect(selectEditorMode(useEditorModeStore.getState())).toBe('source');
  });

  it('selectIsSourceMode returns true when in source mode', () => {
    expect(selectIsSourceMode(useEditorModeStore.getState())).toBe(true);
    expect(selectIsWysiwygMode(useEditorModeStore.getState())).toBe(false);
  });

  it('selectIsWysiwygMode returns true when in wysiwyg mode', () => {
    useEditorModeStore.getState().setMode('wysiwyg');
    expect(selectIsWysiwygMode(useEditorModeStore.getState())).toBe(true);
    expect(selectIsSourceMode(useEditorModeStore.getState())).toBe(false);
  });
});
