/**
 * Theme Manager Tests
 *
 * @module renderer/features/plugins/__tests__/theme-manager.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ThemeDefinition } from '@shared/contracts/plugin-schemas';

import {
  initThemeManager,
  getAllThemes,
  getActiveThemeId,
  applyTheme,
  resetTheme,
  registerUserThemes,
  getTheme,
} from '../theme-manager';
import { removeAllCss } from '../css-injector';

// Mock localStorage for happy-dom
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  removeItem: vi.fn((key: string) => store.delete(key)),
  clear: vi.fn(() => store.clear()),
  get length() {
    return store.size;
  },
  key: vi.fn((_index: number) => null),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('theme-manager', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    registerUserThemes([]);
    removeAllCss();
    resetTheme();
  });

  afterEach(() => {
    resetTheme();
    removeAllCss();
    store.clear();
  });

  describe('getAllThemes', () => {
    it('returns built-in themes', () => {
      const themes = getAllThemes();
      expect(themes.length).toBeGreaterThanOrEqual(5);
    });

    it('includes user themes when registered', () => {
      const custom: ThemeDefinition = {
        id: 'custom-theme',
        name: 'Custom Theme',
        type: 'dark',
        builtIn: false,
        tokens: { background: '#000', foreground: '#fff' },
      };
      registerUserThemes([custom]);

      const themes = getAllThemes();
      expect(themes.find((t) => t.id === 'custom-theme')).toBeDefined();
    });
  });

  describe('applyTheme', () => {
    it('applies a built-in theme', () => {
      const success = applyTheme('dark');
      expect(success).toBe(true);
      expect(getActiveThemeId()).toBe('dark');
    });

    it('returns false for unknown theme', () => {
      const success = applyTheme('nonexistent');
      expect(success).toBe(false);
    });

    it('saves theme preference to localStorage', () => {
      applyTheme('dracula');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('mdxpad:active-theme', 'dracula');
    });

    it('injects CSS variables into the document', () => {
      applyTheme('dark');

      const style = document.querySelector('[data-mdxpad-injected="mdxpad-theme"]');
      expect(style).not.toBeNull();
    });
  });

  describe('resetTheme', () => {
    it('clears the active theme', () => {
      applyTheme('dark');
      resetTheme();

      expect(getActiveThemeId()).toBeNull();
    });

    it('removes saved preference', () => {
      applyTheme('dark');
      resetTheme();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('mdxpad:active-theme');
    });
  });

  describe('initThemeManager', () => {
    it('restores saved theme on init', () => {
      store.set('mdxpad:active-theme', 'monokai');
      initThemeManager();

      expect(getActiveThemeId()).toBe('monokai');
    });

    it('does nothing if no saved theme', () => {
      initThemeManager();
      expect(getActiveThemeId()).toBeNull();
    });
  });

  describe('getTheme', () => {
    it('returns built-in theme by ID', () => {
      const theme = getTheme('solarized');
      expect(theme?.name).toBe('Solarized');
    });

    it('returns user theme by ID', () => {
      const custom: ThemeDefinition = {
        id: 'my-custom',
        name: 'My Custom',
        type: 'light',
        builtIn: false,
        tokens: { background: '#fff', foreground: '#000' },
      };
      registerUserThemes([custom]);

      const theme = getTheme('my-custom');
      expect(theme?.name).toBe('My Custom');
    });

    it('returns undefined for unknown ID', () => {
      expect(getTheme('unknown')).toBeUndefined();
    });
  });

  describe('registerUserThemes', () => {
    it('filters out built-in themes', () => {
      const builtIn: ThemeDefinition = {
        id: 'fake-builtin',
        name: 'Fake BuiltIn',
        type: 'dark',
        builtIn: true,
        tokens: { background: '#000', foreground: '#fff' },
      };
      registerUserThemes([builtIn]);

      expect(getTheme('fake-builtin')).toBeUndefined();
    });
  });
});
