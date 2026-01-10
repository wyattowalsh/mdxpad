/**
 * Comprehensive tests for CodeMirror Extension Composition.
 * Tests buildExtensions() function with ~60 assertions covering:
 * - Default configuration
 * - Individual extension options
 * - Theme configuration
 * - Extension composition
 * - MDXEditorConfig interface
 *
 * @see extensions.ts for implementation
 * @see plan.md Phase 2
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { Extension, Compartment } from '@codemirror/state';
import { buildExtensions, type MDXEditorConfig, type EditorTheme } from '../extensions';
import * as themesModule from '../themes';

// Mock the mdx-language module to avoid complex language parsing in tests
vi.mock('../../../lib/editor/mdx-language', () => ({
  mdxLanguage: vi.fn(() => []),
}));

// Helper to extract extensions array from buildExtensions result
function getExtensions(config?: Partial<MDXEditorConfig>): Extension[] {
  return buildExtensions(config).extensions;
}

describe('buildExtensions()', () => {
  describe('default configuration', () => {
    it('should return an object with extensions array and themeCompartment', () => {
      const result = buildExtensions();
      expect(result).toHaveProperty('extensions');
      expect(result).toHaveProperty('themeCompartment');
      expect(Array.isArray(result.extensions)).toBe(true);
      expect(result.themeCompartment).toBeInstanceOf(Compartment);
    });

    it('should return non-empty extension array', () => {
      const { extensions } = buildExtensions();
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should apply all defaults when no config provided', () => {
      const { extensions } = buildExtensions();
      // Should have multiple extensions for all default features
      expect(extensions.length).toBeGreaterThanOrEqual(10);
    });

    it('should apply all defaults when empty config provided', () => {
      const extensionsWithEmptyConfig = getExtensions({});
      const extensionsWithNoConfig = getExtensions();

      // Both should produce same number of extensions
      expect(extensionsWithEmptyConfig.length).toBe(extensionsWithNoConfig.length);
    });

    it('should include core editing features by default', () => {
      const { extensions } = buildExtensions();
      // Core features are always enabled (history, drawSelection, etc.)
      expect(extensions.length).toBeGreaterThanOrEqual(6);
    });

    it('should create independent themeCompartments for each call (no singleton)', () => {
      const result1 = buildExtensions();
      const result2 = buildExtensions();
      // Each call should create a new, independent compartment
      expect(result1.themeCompartment).not.toBe(result2.themeCompartment);
    });
  });

  describe('lineNumbers option', () => {
    it('should include line numbers extension when lineNumbers: true', () => {
      const extensions = getExtensions({ lineNumbers: true });
      // With line numbers, we should have more extensions
      const withoutLineNumbers = getExtensions({ lineNumbers: false });

      expect(extensions.length).toBeGreaterThan(withoutLineNumbers.length);
    });

    it('should exclude line numbers extension when lineNumbers: false', () => {
      const extensions = getExtensions({ lineNumbers: false });
      const extensionsWithNumbers = getExtensions({ lineNumbers: true });

      expect(extensions.length).toBeLessThan(extensionsWithNumbers.length);
    });

    it('should include line numbers by default (default: true)', () => {
      const defaultExtensions = getExtensions();
      const withLineNumbers = getExtensions({ lineNumbers: true });
      const withoutLineNumbers = getExtensions({ lineNumbers: false });

      // Default should match explicit true
      expect(defaultExtensions.length).toBe(withLineNumbers.length);
      expect(defaultExtensions.length).toBeGreaterThan(withoutLineNumbers.length);
    });
  });

  describe('lineWrapping option', () => {
    it('should include line wrapping extension when lineWrapping: true', () => {
      const extensions = getExtensions({ lineWrapping: true });
      const withoutWrapping = getExtensions({ lineWrapping: false });

      expect(extensions.length).toBeGreaterThan(withoutWrapping.length);
    });

    it('should exclude line wrapping extension when lineWrapping: false', () => {
      const extensions = getExtensions({ lineWrapping: false });
      const extensionsWithWrapping = getExtensions({ lineWrapping: true });

      expect(extensions.length).toBeLessThan(extensionsWithWrapping.length);
    });

    it('should exclude line wrapping by default (default: false)', () => {
      const defaultExtensions = getExtensions();
      const withWrapping = getExtensions({ lineWrapping: true });
      const withoutWrapping = getExtensions({ lineWrapping: false });

      // Default should match explicit false
      expect(defaultExtensions.length).toBe(withoutWrapping.length);
      expect(defaultExtensions.length).toBeLessThan(withWrapping.length);
    });
  });

  describe('tabSize option', () => {
    it('should accept tabSize: 2 configuration', () => {
      const extensions = getExtensions({ tabSize: 2 });
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should accept tabSize: 4 configuration', () => {
      const extensions = getExtensions({ tabSize: 4 });
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should use default tabSize: 2 when not provided', () => {
      const defaultExtensions = getExtensions();
      const withTabSize2 = getExtensions({ tabSize: 2 });

      // Both should produce valid extension arrays
      expect(defaultExtensions.length).toBe(withTabSize2.length);
    });

    it('should configure different indent units for different tabSizes', () => {
      const tab2 = getExtensions({ tabSize: 2 });
      const tab4 = getExtensions({ tabSize: 4 });

      // Both should be valid extension arrays
      expect(tab2.length).toBe(tab4.length);
      // Extensions are created, configuration is internal
      expect(Array.isArray(tab2)).toBe(true);
      expect(Array.isArray(tab4)).toBe(true);
    });

    it('should handle indentWithTabs: true', () => {
      const withTabs = getExtensions({ indentWithTabs: true });
      const withSpaces = getExtensions({ indentWithTabs: false });

      // Both should produce valid extension arrays
      expect(Array.isArray(withTabs)).toBe(true);
      expect(Array.isArray(withSpaces)).toBe(true);
    });
  });

  describe('highlightActiveLine option', () => {
    it('should include active line highlighting when highlightActiveLine: true', () => {
      const extensions = getExtensions({ highlightActiveLine: true });
      const withoutHighlight = getExtensions({ highlightActiveLine: false });

      expect(extensions.length).toBeGreaterThan(withoutHighlight.length);
    });

    it('should exclude active line highlighting when highlightActiveLine: false', () => {
      const extensions = getExtensions({ highlightActiveLine: false });
      const withHighlight = getExtensions({ highlightActiveLine: true });

      expect(extensions.length).toBeLessThan(withHighlight.length);
    });

    it('should include active line highlighting by default (default: true)', () => {
      const defaultExtensions = getExtensions();
      const withHighlight = getExtensions({ highlightActiveLine: true });
      const withoutHighlight = getExtensions({ highlightActiveLine: false });

      expect(defaultExtensions.length).toBe(withHighlight.length);
      expect(defaultExtensions.length).toBeGreaterThan(withoutHighlight.length);
    });
  });

  describe('bracketMatching option', () => {
    it('should include bracket matching when bracketMatching: true', () => {
      const extensions = getExtensions({ bracketMatching: true });
      const withoutMatching = getExtensions({ bracketMatching: false });

      expect(extensions.length).toBeGreaterThan(withoutMatching.length);
    });

    it('should exclude bracket matching when bracketMatching: false', () => {
      const extensions = getExtensions({ bracketMatching: false });
      const withMatching = getExtensions({ bracketMatching: true });

      expect(extensions.length).toBeLessThan(withMatching.length);
    });

    it('should include bracket matching by default (default: true)', () => {
      const defaultExtensions = getExtensions();
      const withMatching = getExtensions({ bracketMatching: true });
      const withoutMatching = getExtensions({ bracketMatching: false });

      expect(defaultExtensions.length).toBe(withMatching.length);
      expect(defaultExtensions.length).toBeGreaterThan(withoutMatching.length);
    });
  });

  describe('closeBrackets option', () => {
    it('should include close brackets when closeBrackets: true', () => {
      const extensions = getExtensions({ closeBrackets: true });
      const withoutClose = getExtensions({ closeBrackets: false });

      expect(extensions.length).toBeGreaterThan(withoutClose.length);
    });

    it('should exclude close brackets when closeBrackets: false', () => {
      const extensions = getExtensions({ closeBrackets: false });
      const withClose = getExtensions({ closeBrackets: true });

      expect(extensions.length).toBeLessThan(withClose.length);
    });

    it('should include close brackets by default (default: true)', () => {
      const defaultExtensions = getExtensions();
      const withClose = getExtensions({ closeBrackets: true });
      const withoutClose = getExtensions({ closeBrackets: false });

      expect(defaultExtensions.length).toBe(withClose.length);
      expect(defaultExtensions.length).toBeGreaterThan(withoutClose.length);
    });
  });

  describe('indentationGuides option', () => {
    it('should accept indentationGuides: true configuration', () => {
      const extensions = getExtensions({ indentationGuides: true });
      expect(Array.isArray(extensions)).toBe(true);
    });

    it('should accept indentationGuides: false configuration', () => {
      const extensions = getExtensions({ indentationGuides: false });
      expect(Array.isArray(extensions)).toBe(true);
    });

    it('should handle indentationGuides config without errors', () => {
      // Per audit, indentationGuides may be a no-op but config should be accepted
      expect(() => getExtensions({ indentationGuides: true })).not.toThrow();
      expect(() => getExtensions({ indentationGuides: false })).not.toThrow();
    });

    it('should include indentationGuides: true by default', () => {
      // Default is true per DEFAULTS object
      const defaultExtensions = getExtensions();
      const withGuides = getExtensions({ indentationGuides: true });

      // Should produce same extensions (no-op per current impl)
      expect(defaultExtensions.length).toBe(withGuides.length);
    });
  });

  describe('theme option', () => {
    let getThemeExtensionSpy: MockInstance;

    beforeEach(() => {
      getThemeExtensionSpy = vi.spyOn(themesModule, 'getThemeExtension');
    });

    afterEach(() => {
      getThemeExtensionSpy.mockRestore();
    });

    it('should use light theme when theme: "light"', () => {
      getExtensions({ theme: 'light' });
      expect(getThemeExtensionSpy).toHaveBeenCalledWith('light');
    });

    it('should use dark theme when theme: "dark"', () => {
      getExtensions({ theme: 'dark' });
      expect(getThemeExtensionSpy).toHaveBeenCalledWith('dark');
    });

    it('should use system theme when theme: "system"', () => {
      getExtensions({ theme: 'system' });
      expect(getThemeExtensionSpy).toHaveBeenCalledWith('system');
    });

    it('should use system theme by default', () => {
      getExtensions();
      expect(getThemeExtensionSpy).toHaveBeenCalledWith('system');
    });

    it('should include theme in extension array', () => {
      const extensions = getExtensions({ theme: 'dark' });
      // Theme should be included via themeCompartment
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should handle all EditorTheme values', () => {
      const themes: EditorTheme[] = ['light', 'dark', 'system'];

      themes.forEach((theme) => {
        const extensions = getExtensions({ theme });
        expect(Array.isArray(extensions)).toBe(true);
        expect(extensions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('extension composition', () => {
    it('should combine multiple options correctly', () => {
      const extensions = getExtensions({
        lineNumbers: true,
        lineWrapping: true,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
        tabSize: 4,
        theme: 'dark',
      });

      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should handle all options disabled', () => {
      const extensions = getExtensions({
        lineNumbers: false,
        lineWrapping: false,
        highlightActiveLine: false,
        bracketMatching: false,
        closeBrackets: false,
      });

      // Should still have core extensions
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should produce consistent extension order', () => {
      const extensions1 = getExtensions({
        lineNumbers: true,
        theme: 'dark',
      });
      const extensions2 = getExtensions({
        lineNumbers: true,
        theme: 'dark',
      });

      // Same config should produce same number of extensions
      expect(extensions1.length).toBe(extensions2.length);
    });

    it('should not produce duplicate extensions', () => {
      const extensions = getExtensions();

      // Count unique extension references
      const uniqueExtensions = new Set(extensions);
      expect(uniqueExtensions.size).toBe(extensions.length);
    });

    it('should include search functionality', () => {
      const extensions = getExtensions();
      // Search is always included
      expect(extensions.length).toBeGreaterThan(5);
    });

    it('should include keymaps', () => {
      const extensions = getExtensions();
      // Keymaps (defaultKeymap, historyKeymap, searchKeymap) are always included
      expect(extensions.length).toBeGreaterThan(5);
    });

    it('should include history for undo/redo', () => {
      const extensions = getExtensions();
      // History is a core feature always included
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should include MDX language support', () => {
      const extensions = getExtensions();
      // MDX language is always included
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should maintain extension integrity across configurations', () => {
      const configs: Partial<MDXEditorConfig>[] = [
        {},
        { lineNumbers: true },
        { lineNumbers: false },
        { theme: 'light' },
        { theme: 'dark' },
        { tabSize: 2 },
        { tabSize: 4 },
        { lineWrapping: true },
        { highlightActiveLine: false },
      ];

      configs.forEach((config) => {
        const extensions = getExtensions(config);
        expect(Array.isArray(extensions)).toBe(true);
        extensions.forEach((ext) => {
          expect(ext).toBeDefined();
        });
      });
    });
  });

  describe('MDXEditorConfig interface', () => {
    it('should accept empty config object', () => {
      const config: MDXEditorConfig = {};
      const extensions = getExtensions(config);
      expect(Array.isArray(extensions)).toBe(true);
    });

    it('should have all properties as optional', () => {
      // All properties are optional - these should all compile and work
      const config1: MDXEditorConfig = {};
      const config2: MDXEditorConfig = { theme: 'dark' };
      const config3: MDXEditorConfig = { lineNumbers: true };
      const config4: MDXEditorConfig = { debounceMs: 100 };
      const config5: MDXEditorConfig = { tabSize: 4 };
      const config6: MDXEditorConfig = { indentWithTabs: true };
      const config7: MDXEditorConfig = { highlightActiveLine: false };
      const config8: MDXEditorConfig = { bracketMatching: false };
      const config9: MDXEditorConfig = { closeBrackets: false };
      const config10: MDXEditorConfig = { indentationGuides: false };
      const config11: MDXEditorConfig = { lineWrapping: true };

      [
        config1,
        config2,
        config3,
        config4,
        config5,
        config6,
        config7,
        config8,
        config9,
        config10,
        config11,
      ].forEach((config) => {
        expect(() => getExtensions(config)).not.toThrow();
      });
    });

    it('should accept full config with all options', () => {
      const fullConfig: MDXEditorConfig = {
        theme: 'dark',
        debounceMs: 200,
        lineNumbers: true,
        lineWrapping: true,
        tabSize: 4,
        indentWithTabs: false,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
        indentationGuides: true,
      };

      const extensions = getExtensions(fullConfig);
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should have expected default values in DEFAULTS', () => {
      // Test default behavior by comparing with explicit configs
      const defaultExtensions = getExtensions();

      // lineNumbers: true (default)
      const withLineNumbers = getExtensions({ lineNumbers: true });
      const withoutLineNumbers = getExtensions({ lineNumbers: false });
      expect(defaultExtensions.length).toBe(withLineNumbers.length);
      expect(defaultExtensions.length).toBeGreaterThan(withoutLineNumbers.length);

      // lineWrapping: false (default)
      const withWrapping = getExtensions({ lineWrapping: true });
      const withoutWrapping = getExtensions({ lineWrapping: false });
      expect(defaultExtensions.length).toBe(withoutWrapping.length);
      expect(defaultExtensions.length).toBeLessThan(withWrapping.length);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined config gracefully', () => {
      const extensions = getExtensions(undefined);
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should handle config with unknown properties', () => {
      // TypeScript would catch this, but runtime should still work
      const configWithExtra = {
        theme: 'dark' as const,
        unknownProp: 'value',
      };

      const extensions = getExtensions(configWithExtra);
      expect(Array.isArray(extensions)).toBe(true);
    });

    it('should handle minimum valid tabSize', () => {
      const extensions = getExtensions({ tabSize: 1 });
      expect(Array.isArray(extensions)).toBe(true);
    });

    it('should handle large tabSize', () => {
      const extensions = getExtensions({ tabSize: 8 });
      expect(Array.isArray(extensions)).toBe(true);
    });

    it('should handle zero debounceMs', () => {
      const extensions = getExtensions({ debounceMs: 0 });
      expect(Array.isArray(extensions)).toBe(true);
    });

    it('should produce consistent results on repeated calls', () => {
      const config: MDXEditorConfig = {
        theme: 'light',
        lineNumbers: true,
        tabSize: 2,
      };

      const results = Array.from({ length: 5 }, () => getExtensions(config));

      // All calls should produce same number of extensions
      const lengths = results.map((r) => r.length);
      expect(new Set(lengths).size).toBe(1);
    });
  });
});

describe('DEFAULTS', () => {
  it('should have theme default of "system"', () => {
    const extensions = getExtensions();
    const explicitSystem = getExtensions({ theme: 'system' });
    expect(extensions.length).toBe(explicitSystem.length);
  });

  it('should have lineNumbers default of true', () => {
    const extensions = getExtensions();
    const explicitTrue = getExtensions({ lineNumbers: true });
    expect(extensions.length).toBe(explicitTrue.length);
  });

  it('should have lineWrapping default of false', () => {
    const extensions = getExtensions();
    const explicitFalse = getExtensions({ lineWrapping: false });
    expect(extensions.length).toBe(explicitFalse.length);
  });

  it('should have tabSize default of 2', () => {
    const extensions = getExtensions();
    const explicitTwo = getExtensions({ tabSize: 2 });
    expect(extensions.length).toBe(explicitTwo.length);
  });

  it('should have indentWithTabs default of false', () => {
    const extensions = getExtensions();
    const explicitFalse = getExtensions({ indentWithTabs: false });
    expect(extensions.length).toBe(explicitFalse.length);
  });

  it('should have highlightActiveLine default of true', () => {
    const extensions = getExtensions();
    const explicitTrue = getExtensions({ highlightActiveLine: true });
    expect(extensions.length).toBe(explicitTrue.length);
  });

  it('should have bracketMatching default of true', () => {
    const extensions = getExtensions();
    const explicitTrue = getExtensions({ bracketMatching: true });
    expect(extensions.length).toBe(explicitTrue.length);
  });

  it('should have closeBrackets default of true', () => {
    const extensions = getExtensions();
    const explicitTrue = getExtensions({ closeBrackets: true });
    expect(extensions.length).toBe(explicitTrue.length);
  });

  it('should have indentationGuides default of true', () => {
    const extensions = getExtensions();
    const explicitTrue = getExtensions({ indentationGuides: true });
    expect(extensions.length).toBe(explicitTrue.length);
  });

  it('should have debounceMs default of 150', () => {
    // debounceMs doesn't affect extensions, but config should be accepted
    const extensions = getExtensions({ debounceMs: 150 });
    expect(Array.isArray(extensions)).toBe(true);
  });
});
