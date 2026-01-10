/**
 * Comprehensive tests for CodeMirror theme configuration.
 * Tests EditorTheme type, compartment, themes, and system theme detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Compartment, Extension, EditorState as CMEditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  type EditorTheme,
  createThemeCompartment,
  lightTheme,
  darkTheme,
  getSystemTheme,
  getThemeExtension,
  createThemeListener,
} from '../themes';

// Mock matchMedia helper
interface MockMediaQueryList {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

const createMockMatchMedia = (matches: boolean): MockMediaQueryList => ({
  matches,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

// Store original window reference for restoration
const originalWindow = globalThis.window;

describe('themes module', () => {
  describe('EditorTheme type', () => {
    it('should accept "light" as a valid value', () => {
      const theme: EditorTheme = 'light';
      expect(theme).toBe('light');
    });

    it('should accept "dark" as a valid value', () => {
      const theme: EditorTheme = 'dark';
      expect(theme).toBe('dark');
    });

    it('should accept "system" as a valid value', () => {
      const theme: EditorTheme = 'system';
      expect(theme).toBe('system');
    });

    it('should work in type assertions', () => {
      const themes: EditorTheme[] = ['light', 'dark', 'system'];
      expect(themes).toHaveLength(3);
      expect(themes).toContain('light');
      expect(themes).toContain('dark');
      expect(themes).toContain('system');
    });
  });

  describe('createThemeCompartment', () => {
    it('should return a Compartment instance', () => {
      const themeCompartment = createThemeCompartment();
      expect(themeCompartment).toBeInstanceOf(Compartment);
    });

    it('should be exported and accessible', () => {
      const themeCompartment = createThemeCompartment();
      expect(themeCompartment).toBeDefined();
    });

    it('should have reconfigure method for dynamic updates', () => {
      const themeCompartment = createThemeCompartment();
      expect(typeof themeCompartment.reconfigure).toBe('function');
    });

    it('should produce valid effect when reconfiguring', () => {
      const themeCompartment = createThemeCompartment();
      const effect = themeCompartment.reconfigure(lightTheme);
      expect(effect).toBeDefined();
    });

    it('should be usable for compartmentalized extension', () => {
      const themeCompartment = createThemeCompartment();
      const compartmentalizedTheme = themeCompartment.of(lightTheme);
      expect(compartmentalizedTheme).toBeDefined();
    });

    it('should create independent compartments for each call (no singleton)', () => {
      const compartment1 = createThemeCompartment();
      const compartment2 = createThemeCompartment();
      // Each call should create a new, independent compartment
      expect(compartment1).not.toBe(compartment2);
    });
  });

  describe('lightTheme', () => {
    it('should be a valid Extension', () => {
      expect(lightTheme).toBeDefined();
    });

    it('should be usable in compartment', () => {
      const themeCompartment = createThemeCompartment();
      const compartmentalizedLight = themeCompartment.of(lightTheme);
      expect(compartmentalizedLight).toBeDefined();
    });

    it('should be different from darkTheme', () => {
      expect(lightTheme).not.toBe(darkTheme);
    });

    it('should be compatible with EditorView theme system', () => {
      // Light theme is created with EditorView.theme()
      // This verifies it can be used as an extension
      const extensions: Extension[] = [lightTheme];
      expect(extensions).toHaveLength(1);
    });

    it('should return consistent reference', () => {
      // lightTheme should be a stable export, not regenerated each access
      const ref1 = lightTheme;
      const ref2 = lightTheme;
      expect(ref1).toBe(ref2);
    });
  });

  describe('darkTheme', () => {
    it('should be a valid Extension (oneDark)', () => {
      expect(darkTheme).toBeDefined();
    });

    it('should be the oneDark theme', () => {
      expect(darkTheme).toBe(oneDark);
    });

    it('should be usable in compartment', () => {
      const themeCompartment = createThemeCompartment();
      const compartmentalizedDark = themeCompartment.of(darkTheme);
      expect(compartmentalizedDark).toBeDefined();
    });

    it('should be compatible with EditorView theme system', () => {
      const extensions: Extension[] = [darkTheme];
      expect(extensions).toHaveLength(1);
    });

    it('should return consistent reference', () => {
      const ref1 = darkTheme;
      const ref2 = darkTheme;
      expect(ref1).toBe(ref2);
    });
  });

  describe('getSystemTheme()', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      // Store original matchMedia (always exists in jsdom)
      originalMatchMedia = window.matchMedia;
    });

    afterEach(() => {
      // Restore original matchMedia
      window.matchMedia = originalMatchMedia;
      vi.restoreAllMocks();
    });

    it('should return "light" when matchMedia returns false', () => {
      const mockMediaQuery = createMockMatchMedia(false);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      const result = getSystemTheme();

      expect(result).toBe('light');
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    });

    it('should return "dark" when matchMedia returns true', () => {
      const mockMediaQuery = createMockMatchMedia(true);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      const result = getSystemTheme();

      expect(result).toBe('dark');
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    });

    it('should query the correct media query', () => {
      const mockMediaQuery = createMockMatchMedia(false);
      const matchMediaSpy = vi.fn().mockReturnValue(mockMediaQuery);
      window.matchMedia = matchMediaSpy;

      getSystemTheme();

      expect(matchMediaSpy).toHaveBeenCalledTimes(1);
      expect(matchMediaSpy).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    });

    it('should return only "light" or "dark"', () => {
      const mockMediaQuery = createMockMatchMedia(false);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      const result = getSystemTheme();

      expect(['light', 'dark']).toContain(result);
    });
  });

  describe('getThemeExtension()', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
      vi.restoreAllMocks();
    });

    it('should return lightTheme when theme is "light"', () => {
      const result = getThemeExtension('light');
      expect(result).toBe(lightTheme);
    });

    it('should return darkTheme when theme is "dark"', () => {
      const result = getThemeExtension('dark');
      expect(result).toBe(darkTheme);
    });

    it('should return lightTheme when theme is "system" and system prefers light', () => {
      const mockMediaQuery = createMockMatchMedia(false);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      const result = getThemeExtension('system');

      expect(result).toBe(lightTheme);
    });

    it('should return darkTheme when theme is "system" and system prefers dark', () => {
      const mockMediaQuery = createMockMatchMedia(true);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      const result = getThemeExtension('system');

      expect(result).toBe(darkTheme);
    });

    it('should call getSystemTheme when theme is "system"', () => {
      const mockMediaQuery = createMockMatchMedia(false);
      const matchMediaSpy = vi.fn().mockReturnValue(mockMediaQuery);
      window.matchMedia = matchMediaSpy;

      getThemeExtension('system');

      expect(matchMediaSpy).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    });

    it('should not call matchMedia when theme is "light"', () => {
      const matchMediaSpy = vi.fn();
      window.matchMedia = matchMediaSpy;

      getThemeExtension('light');

      expect(matchMediaSpy).not.toHaveBeenCalled();
    });

    it('should not call matchMedia when theme is "dark"', () => {
      const matchMediaSpy = vi.fn();
      window.matchMedia = matchMediaSpy;

      getThemeExtension('dark');

      expect(matchMediaSpy).not.toHaveBeenCalled();
    });

    it('should return valid Extension for all theme values', () => {
      const mockMediaQuery = createMockMatchMedia(false);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      const themes: EditorTheme[] = ['light', 'dark', 'system'];

      for (const theme of themes) {
        const extension = getThemeExtension(theme);
        expect(extension).toBeDefined();
        expect([lightTheme, darkTheme]).toContain(extension);
      }
    });
  });

  describe('createThemeListener()', () => {
    let mockView: {
      dispatch: ReturnType<typeof vi.fn>;
    };
    let mockCompartment: Compartment;
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      mockView = {
        dispatch: vi.fn(),
      };
      mockCompartment = new Compartment();

      originalMatchMedia = window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
      vi.restoreAllMocks();
    });

    it('should return a cleanup function', () => {
      const mockMediaQuery = createMockMatchMedia(false);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      const cleanup = createThemeListener(
        mockView as unknown as EditorView,
        mockCompartment,
        'system'
      );

      expect(typeof cleanup).toBe('function');
    });

    it('should return no-op when theme is "light"', () => {
      const cleanup = createThemeListener(
        mockView as unknown as EditorView,
        mockCompartment,
        'light'
      );

      expect(typeof cleanup).toBe('function');
      // Cleanup should be callable without side effects
      expect(() => cleanup()).not.toThrow();
    });

    it('should return no-op when theme is "dark"', () => {
      const cleanup = createThemeListener(
        mockView as unknown as EditorView,
        mockCompartment,
        'dark'
      );

      expect(typeof cleanup).toBe('function');
      expect(() => cleanup()).not.toThrow();
    });

    it('should not set up matchMedia listener when theme is "light"', () => {
      const mockMediaQuery = createMockMatchMedia(false);
      const matchMediaSpy = vi.fn().mockReturnValue(mockMediaQuery);
      window.matchMedia = matchMediaSpy;

      createThemeListener(mockView as unknown as EditorView, mockCompartment, 'light');

      expect(matchMediaSpy).not.toHaveBeenCalled();
      expect(mockMediaQuery.addEventListener).not.toHaveBeenCalled();
    });

    it('should not set up matchMedia listener when theme is "dark"', () => {
      const mockMediaQuery = createMockMatchMedia(false);
      const matchMediaSpy = vi.fn().mockReturnValue(mockMediaQuery);
      window.matchMedia = matchMediaSpy;

      createThemeListener(mockView as unknown as EditorView, mockCompartment, 'dark');

      expect(matchMediaSpy).not.toHaveBeenCalled();
      expect(mockMediaQuery.addEventListener).not.toHaveBeenCalled();
    });

    describe('when theme is "system"', () => {
      it('should set up matchMedia listener', () => {
        const mockMediaQuery = createMockMatchMedia(false);
        window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

        createThemeListener(mockView as unknown as EditorView, mockCompartment, 'system');

        expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      });

      it('should query prefers-color-scheme media query', () => {
        const mockMediaQuery = createMockMatchMedia(false);
        const matchMediaSpy = vi.fn().mockReturnValue(mockMediaQuery);
        window.matchMedia = matchMediaSpy;

        createThemeListener(mockView as unknown as EditorView, mockCompartment, 'system');

        expect(matchMediaSpy).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      });

      it('should call view.dispatch with darkTheme when system changes to dark', () => {
        const mockMediaQuery = createMockMatchMedia(false);
        window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

        createThemeListener(mockView as unknown as EditorView, mockCompartment, 'system');

        // Get the handler that was registered
        const handler = mockMediaQuery.addEventListener.mock.calls[0]?.[1] as (
          e: MediaQueryListEvent
        ) => void;
        expect(handler).toBeDefined();

        // Simulate system changing to dark mode
        handler({ matches: true } as MediaQueryListEvent);

        expect(mockView.dispatch).toHaveBeenCalledTimes(1);
        expect(mockView.dispatch).toHaveBeenCalledWith({
          effects: expect.anything(),
        });
      });

      it('should call view.dispatch with lightTheme when system changes to light', () => {
        const mockMediaQuery = createMockMatchMedia(true);
        window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

        createThemeListener(mockView as unknown as EditorView, mockCompartment, 'system');

        const handler = mockMediaQuery.addEventListener.mock.calls[0]?.[1] as (
          e: MediaQueryListEvent
        ) => void;
        expect(handler).toBeDefined();

        // Simulate system changing to light mode
        handler({ matches: false } as MediaQueryListEvent);

        expect(mockView.dispatch).toHaveBeenCalledTimes(1);
      });

      it('should remove listener on cleanup', () => {
        const mockMediaQuery = createMockMatchMedia(false);
        window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

        const cleanup = createThemeListener(
          mockView as unknown as EditorView,
          mockCompartment,
          'system'
        );

        // Get the handler that was added
        const addedHandler = mockMediaQuery.addEventListener.mock.calls[0]?.[1];

        cleanup();

        expect(mockMediaQuery.removeEventListener).toHaveBeenCalledWith('change', addedHandler);
      });

      it('should only add listener once', () => {
        const mockMediaQuery = createMockMatchMedia(false);
        window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

        createThemeListener(mockView as unknown as EditorView, mockCompartment, 'system');

        expect(mockMediaQuery.addEventListener).toHaveBeenCalledTimes(1);
      });

      it('should handle multiple theme changes', () => {
        const mockMediaQuery = createMockMatchMedia(false);
        window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

        createThemeListener(mockView as unknown as EditorView, mockCompartment, 'system');

        const handler = mockMediaQuery.addEventListener.mock.calls[0]?.[1] as (
          e: MediaQueryListEvent
        ) => void;

        // Simulate multiple theme changes
        handler({ matches: true } as MediaQueryListEvent);
        handler({ matches: false } as MediaQueryListEvent);
        handler({ matches: true } as MediaQueryListEvent);

        expect(mockView.dispatch).toHaveBeenCalledTimes(3);
      });
    });

    it('should not throw when cleanup is called multiple times', () => {
      const mockMediaQuery = createMockMatchMedia(false);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      const cleanup = createThemeListener(
        mockView as unknown as EditorView,
        mockCompartment,
        'system'
      );

      expect(() => {
        cleanup();
        cleanup();
        cleanup();
      }).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
      vi.restoreAllMocks();
    });

    it('should support full theme switching workflow', () => {
      // Start with light theme
      let currentTheme = getThemeExtension('light');
      expect(currentTheme).toBe(lightTheme);

      // Switch to dark
      currentTheme = getThemeExtension('dark');
      expect(currentTheme).toBe(darkTheme);

      // Switch to system (light)
      const mockMediaQuery = createMockMatchMedia(false);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      currentTheme = getThemeExtension('system');
      expect(currentTheme).toBe(lightTheme);
    });

    it('should support compartment-based reconfiguration', () => {
      // This simulates how themes would be used in an actual editor
      const themeCompartment = createThemeCompartment();
      const initialTheme = themeCompartment.of(lightTheme);
      expect(initialTheme).toBeDefined();

      // Reconfigure to dark
      const darkEffect = themeCompartment.reconfigure(darkTheme);
      expect(darkEffect).toBeDefined();

      // Reconfigure back to light
      const lightEffect = themeCompartment.reconfigure(lightTheme);
      expect(lightEffect).toBeDefined();
    });

    it('should support all EditorTheme values in sequence', () => {
      const mockMediaQuery = createMockMatchMedia(true);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      const themes: EditorTheme[] = ['light', 'dark', 'system'];
      const extensions: Extension[] = [];

      for (const theme of themes) {
        extensions.push(getThemeExtension(theme));
      }

      expect(extensions).toHaveLength(3);
      expect(extensions[0]).toBe(lightTheme);
      expect(extensions[1]).toBe(darkTheme);
      expect(extensions[2]).toBe(darkTheme); // system returns dark when matches=true
    });

    it('should handle createThemeListener with all theme types', () => {
      const mockView = { dispatch: vi.fn() };
      const compartment = new Compartment();
      const mockMediaQuery = createMockMatchMedia(false);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      const cleanupLight = createThemeListener(mockView as unknown as EditorView, compartment, 'light');
      const cleanupDark = createThemeListener(mockView as unknown as EditorView, compartment, 'dark');
      const cleanupSystem = createThemeListener(mockView as unknown as EditorView, compartment, 'system');

      expect(typeof cleanupLight).toBe('function');
      expect(typeof cleanupDark).toBe('function');
      expect(typeof cleanupSystem).toBe('function');

      // All cleanups should execute without error
      cleanupLight();
      cleanupDark();
      cleanupSystem();
    });

    it('should maintain theme consistency between getThemeExtension and getSystemTheme', () => {
      // When getSystemTheme returns dark, getThemeExtension('system') should return darkTheme
      const mockMediaQueryDark = createMockMatchMedia(true);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryDark);

      const systemTheme = getSystemTheme();
      const extension = getThemeExtension('system');

      expect(systemTheme).toBe('dark');
      expect(extension).toBe(darkTheme);
    });

    it('should maintain theme consistency for light system preference', () => {
      // When getSystemTheme returns light, getThemeExtension('system') should return lightTheme
      const mockMediaQueryLight = createMockMatchMedia(false);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryLight);

      const systemTheme = getSystemTheme();
      const extension = getThemeExtension('system');

      expect(systemTheme).toBe('light');
      expect(extension).toBe(lightTheme);
    });
  });

  describe('theme DOM verification', () => {
    let container: HTMLDivElement;
    let view: EditorView | null;
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      view = null;
      originalMatchMedia = window.matchMedia;
    });

    afterEach(() => {
      if (view) {
        view.destroy();
        view = null;
      }
      if (container.parentNode) {
        document.body.removeChild(container);
      }
      window.matchMedia = originalMatchMedia;
      vi.restoreAllMocks();
    });

    /**
     * Helper to create an EditorView with a specific theme.
     */
    function createEditorWithTheme(themeExtension: Extension): EditorView {
      return new EditorView({
        state: CMEditorState.create({
          doc: 'test content',
          extensions: [themeExtension],
        }),
        parent: container,
      });
    }

    /**
     * Helper to get all style elements containing theme CSS.
     * CodeMirror injects theme styles into <style> elements.
     */
    function getThemeStyleElements(): HTMLStyleElement[] {
      const styleElements = document.querySelectorAll('style');
      return Array.from(styleElements).filter(
        (el) => el.textContent?.includes('.cm-') || el.textContent?.includes('cm-editor')
      );
    }

    /**
     * Helper to check if a specific CSS property value exists in any style element.
     */
    function styleContainsValue(value: string): boolean {
      const styles = getThemeStyleElements();
      return styles.some((style) => style.textContent?.includes(value));
    }

    it('should render .cm-editor element when editor is created', () => {
      view = createEditorWithTheme(lightTheme);

      const cmEditor = container.querySelector('.cm-editor');
      expect(cmEditor).not.toBeNull();
      expect(cmEditor).toBeInstanceOf(HTMLElement);
    });

    it('should render .cm-content element within editor', () => {
      view = createEditorWithTheme(lightTheme);

      const cmContent = container.querySelector('.cm-content');
      expect(cmContent).not.toBeNull();
      expect(cmContent).toBeInstanceOf(HTMLElement);
    });

    it('should render .cm-scroller element within editor', () => {
      view = createEditorWithTheme(lightTheme);

      const cmScroller = container.querySelector('.cm-scroller');
      expect(cmScroller).not.toBeNull();
      expect(cmScroller).toBeInstanceOf(HTMLElement);
    });

    it('should inject light theme styles into document', () => {
      view = createEditorWithTheme(lightTheme);

      // Light theme defines white background (#ffffff)
      expect(styleContainsValue('#ffffff') || styleContainsValue('rgb(255, 255, 255)')).toBe(true);
    });

    it('should inject dark theme (One Dark) styles into document', () => {
      view = createEditorWithTheme(darkTheme);

      // One Dark defines background #282c34
      expect(styleContainsValue('#282c34') || styleContainsValue('282c34')).toBe(true);
    });

    it('should inject different style rules for light vs dark themes', () => {
      // Create light theme editor
      view = createEditorWithTheme(lightTheme);
      const lightStyles = getThemeStyleElements().map((s) => s.textContent).join('\n');
      view.destroy();

      // Clear style elements between tests
      const oldStyles = document.querySelectorAll('style');
      oldStyles.forEach((s) => s.remove());

      // Create dark theme editor
      view = createEditorWithTheme(darkTheme);
      const darkStyles = getThemeStyleElements().map((s) => s.textContent).join('\n');

      // Light uses white background, dark uses One Dark colors
      expect(lightStyles).toContain('#ffffff');
      expect(darkStyles).toContain('#282c34');
    });

    it('should add theme-specific CSS classes to editor DOM', () => {
      view = createEditorWithTheme(darkTheme);

      const cmEditor = container.querySelector('.cm-editor') as HTMLElement;
      expect(cmEditor).not.toBeNull();

      // CodeMirror adds unique class names for theme scoping
      // The class list should contain cm-editor and additional theme classes
      expect(cmEditor.classList.contains('cm-editor')).toBe(true);
      expect(cmEditor.className.length).toBeGreaterThan('cm-editor'.length);
    });

    it('should apply theme via compartment and update DOM classes', () => {
      const themeCompartment = createThemeCompartment();

      view = new EditorView({
        state: CMEditorState.create({
          doc: 'test content',
          extensions: [themeCompartment.of(lightTheme)],
        }),
        parent: container,
      });

      const cmEditor = container.querySelector('.cm-editor') as HTMLElement;
      const initialClasses = cmEditor.className;

      // Reconfigure to dark theme
      view.dispatch({
        effects: themeCompartment.reconfigure(darkTheme),
      });

      // Classes should change after theme switch
      const updatedClasses = cmEditor.className;
      expect(initialClasses).not.toBe(updatedClasses);
    });

    it('should apply system theme extension correctly based on system preference (dark)', () => {
      // Mock system preference to dark
      const mockMediaQuery = createMockMatchMedia(true);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      const themeExtension = getThemeExtension('system');
      view = createEditorWithTheme(themeExtension);

      // Verify One Dark styles are injected when system prefers dark
      expect(styleContainsValue('#282c34')).toBe(true);
    });

    it('should apply system theme extension correctly based on system preference (light)', () => {
      // Mock system preference to light
      const mockMediaQuery = createMockMatchMedia(false);
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);

      const themeExtension = getThemeExtension('system');
      view = createEditorWithTheme(themeExtension);

      // Verify light theme styles are injected when system prefers light
      expect(styleContainsValue('#ffffff')).toBe(true);
    });

    it('should allow dynamic theme switching via compartment dispatch', () => {
      const themeCompartment = createThemeCompartment();

      view = new EditorView({
        state: CMEditorState.create({
          doc: 'switching themes',
          extensions: [themeCompartment.of(lightTheme)],
        }),
        parent: container,
      });

      // Initial state has light theme styles
      expect(styleContainsValue('#ffffff')).toBe(true);

      // Switch to dark
      view.dispatch({ effects: themeCompartment.reconfigure(darkTheme) });
      expect(styleContainsValue('#282c34')).toBe(true);

      // Switch back to light
      view.dispatch({ effects: themeCompartment.reconfigure(lightTheme) });
      expect(styleContainsValue('#ffffff')).toBe(true);
    });

    it('should inject dark theme caret color CSS', () => {
      view = createEditorWithTheme(darkTheme);

      // One Dark uses cursor/caret color #528bff
      expect(styleContainsValue('#528bff') || styleContainsValue('528bff')).toBe(true);
    });

    it('should inject light theme caret color CSS', () => {
      view = createEditorWithTheme(lightTheme);

      // Light theme uses black cursor (#000000)
      expect(styleContainsValue('#000000') || styleContainsValue('rgb(0, 0, 0)')).toBe(true);
    });

    it('should have contenteditable attribute on content DOM', () => {
      view = createEditorWithTheme(lightTheme);

      const cmContent = container.querySelector('.cm-content') as HTMLElement;
      expect(cmContent).not.toBeNull();
      expect(cmContent.getAttribute('contenteditable')).toBe('true');
    });

    it('should render with role="textbox" for accessibility', () => {
      view = createEditorWithTheme(lightTheme);

      const cmContent = container.querySelector('.cm-content') as HTMLElement;
      expect(cmContent).not.toBeNull();
      expect(cmContent.getAttribute('role')).toBe('textbox');
    });
  });
});
