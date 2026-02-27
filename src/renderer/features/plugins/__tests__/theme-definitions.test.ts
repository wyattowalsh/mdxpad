/**
 * Theme Definitions Tests
 *
 * @module renderer/features/plugins/__tests__/theme-definitions.test
 */

import { describe, expect, it } from 'vitest';

import { ThemeDefinitionSchema } from '@shared/contracts/plugin-schemas';

import { builtInThemes, getBuiltInTheme } from '../theme-definitions';

describe('builtInThemes', () => {
  it('has 5 built-in themes', () => {
    expect(builtInThemes).toHaveLength(5);
  });

  it('all themes are marked as builtIn', () => {
    for (const theme of builtInThemes) {
      expect(theme.builtIn).toBe(true);
    }
  });

  it('all themes have unique IDs', () => {
    const ids = builtInThemes.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes expected theme IDs', () => {
    const ids = builtInThemes.map((t) => t.id);
    expect(ids).toContain('light');
    expect(ids).toContain('dark');
    expect(ids).toContain('solarized');
    expect(ids).toContain('dracula');
    expect(ids).toContain('monokai');
  });

  it('all themes validate against ThemeDefinitionSchema', () => {
    for (const theme of builtInThemes) {
      const result = ThemeDefinitionSchema.safeParse(theme);
      expect(result.success).toBe(true);
    }
  });

  it('all themes have required token fields', () => {
    for (const theme of builtInThemes) {
      expect(theme.tokens.background).toBeDefined();
      expect(theme.tokens.foreground).toBeDefined();
    }
  });

  it('all themes have CSS variables', () => {
    for (const theme of builtInThemes) {
      expect(theme.cssVariables).toBeDefined();
      expect(Object.keys(theme.cssVariables ?? {})).toContain('--mdxpad-bg');
      expect(Object.keys(theme.cssVariables ?? {})).toContain('--mdxpad-fg');
    }
  });
});

describe('getBuiltInTheme', () => {
  it('returns a theme by ID', () => {
    const theme = getBuiltInTheme('dracula');
    expect(theme?.name).toBe('Dracula');
  });

  it('returns undefined for unknown ID', () => {
    const theme = getBuiltInTheme('nonexistent');
    expect(theme).toBeUndefined();
  });
});
