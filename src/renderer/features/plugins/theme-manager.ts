/**
 * Theme Manager
 *
 * Manages loading, applying, and switching editor themes.
 * Supports built-in themes and user-installed themes from ~/.mdxpad/themes/.
 *
 * @module renderer/features/plugins/theme-manager
 */

import type { ThemeDefinition } from '@shared/contracts/plugin-schemas';

import { builtInThemes, getBuiltInTheme } from './theme-definitions';
import { injectCss, removeCss } from './css-injector';

// ============================================================================
// Constants
// ============================================================================

const THEME_CSS_ID = 'mdxpad-theme';
const STORAGE_KEY = 'mdxpad:active-theme';

// ============================================================================
// State
// ============================================================================

let activeThemeId: string | null = null;
let userThemes: ThemeDefinition[] = [];

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize the theme manager. Loads saved theme preference.
 */
export function initThemeManager(): void {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    applyTheme(saved);
  }
}

/**
 * Get all available themes (built-in + user-installed).
 */
export function getAllThemes(): ThemeDefinition[] {
  return [...builtInThemes, ...userThemes];
}

/**
 * Get the currently active theme ID.
 */
export function getActiveThemeId(): string | null {
  return activeThemeId;
}

/**
 * Apply a theme by ID.
 * Sets CSS variables and generates editor theme styles.
 */
export function applyTheme(themeId: string): boolean {
  const theme = getBuiltInTheme(themeId) ?? userThemes.find((t) => t.id === themeId);

  if (!theme) {
    return false;
  }

  // Generate CSS from theme definition
  const css = generateThemeCss(theme);
  injectCss(THEME_CSS_ID, css, 'app');

  // Apply CSS variables
  if (theme.cssVariables) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.cssVariables)) {
      root.style.setProperty(key, value);
    }
  }

  activeThemeId = themeId;
  localStorage.setItem(STORAGE_KEY, themeId);
  return true;
}

/**
 * Remove the current theme and reset to defaults.
 */
export function resetTheme(): void {
  removeCss(THEME_CSS_ID);
  activeThemeId = null;
  localStorage.removeItem(STORAGE_KEY);

  // Clean CSS variables
  const root = document.documentElement;
  const allThemes = getAllThemes();
  for (const theme of allThemes) {
    if (theme.cssVariables) {
      for (const key of Object.keys(theme.cssVariables)) {
        root.style.removeProperty(key);
      }
    }
  }
}

/**
 * Register user-installed themes.
 */
export function registerUserThemes(themes: ThemeDefinition[]): void {
  userThemes = themes.filter((t) => !t.builtIn);
}

/**
 * Get a theme definition by ID.
 */
export function getTheme(themeId: string): ThemeDefinition | undefined {
  return getBuiltInTheme(themeId) ?? userThemes.find((t) => t.id === themeId);
}

// ============================================================================
// Internals
// ============================================================================

/**
 * Generate CSS string from theme tokens for the editor.
 */
function generateThemeCss(theme: ThemeDefinition): string {
  const { tokens } = theme;
  const lines: string[] = [];

  lines.push(':root {');
  lines.push(`  --cm-background: ${tokens.background};`);
  lines.push(`  --cm-foreground: ${tokens.foreground};`);

  if (tokens.cursor) {
    lines.push(`  --cm-cursor: ${tokens.cursor};`);
  }
  if (tokens.selection) {
    lines.push(`  --cm-selection: ${tokens.selection};`);
  }
  if (tokens.lineHighlight) {
    lines.push(`  --cm-line-highlight: ${tokens.lineHighlight};`);
  }
  if (tokens.comment) {
    lines.push(`  --cm-comment: ${tokens.comment};`);
  }
  if (tokens.keyword) {
    lines.push(`  --cm-keyword: ${tokens.keyword};`);
  }
  if (tokens.string) {
    lines.push(`  --cm-string: ${tokens.string};`);
  }
  if (tokens.number) {
    lines.push(`  --cm-number: ${tokens.number};`);
  }
  if (tokens.function) {
    lines.push(`  --cm-function: ${tokens.function};`);
  }
  if (tokens.variable) {
    lines.push(`  --cm-variable: ${tokens.variable};`);
  }
  if (tokens.type) {
    lines.push(`  --cm-type: ${tokens.type};`);
  }
  if (tokens.operator) {
    lines.push(`  --cm-operator: ${tokens.operator};`);
  }

  lines.push('}');

  // Add CSS variables from theme
  if (theme.cssVariables) {
    lines.push(':root {');
    for (const [key, value] of Object.entries(theme.cssVariables)) {
      lines.push(`  ${key}: ${value};`);
    }
    lines.push('}');
  }

  return lines.join('\n');
}
