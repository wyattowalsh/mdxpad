/**
 * Built-in Theme Definitions
 *
 * Provides default themes for the editor: light, dark, solarized, dracula, monokai.
 *
 * @module renderer/features/plugins/theme-definitions
 */

import type { ThemeDefinition } from '@shared/contracts/plugin-schemas';

// ============================================================================
// Built-in Themes
// ============================================================================

export const lightTheme: ThemeDefinition = {
  id: 'light',
  name: 'Light',
  type: 'light',
  builtIn: true,
  tokens: {
    background: '#ffffff',
    foreground: '#24292e',
    cursor: '#24292e',
    selection: '#c8c8fa',
    lineHighlight: '#f6f8fa',
    comment: '#6a737d',
    keyword: '#d73a49',
    string: '#032f62',
    number: '#005cc5',
    function: '#6f42c1',
    variable: '#e36209',
    type: '#005cc5',
    operator: '#d73a49',
  },
  cssVariables: {
    '--mdxpad-bg': '#ffffff',
    '--mdxpad-fg': '#24292e',
    '--mdxpad-accent': '#0366d6',
    '--mdxpad-border': '#e1e4e8',
    '--mdxpad-muted': '#6a737d',
  },
};

export const darkTheme: ThemeDefinition = {
  id: 'dark',
  name: 'Dark',
  type: 'dark',
  builtIn: true,
  tokens: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#d4d4d4',
    selection: '#264f78',
    lineHighlight: '#2a2d2e',
    comment: '#6a9955',
    keyword: '#569cd6',
    string: '#ce9178',
    number: '#b5cea8',
    function: '#dcdcaa',
    variable: '#9cdcfe',
    type: '#4ec9b0',
    operator: '#d4d4d4',
  },
  cssVariables: {
    '--mdxpad-bg': '#1e1e1e',
    '--mdxpad-fg': '#d4d4d4',
    '--mdxpad-accent': '#569cd6',
    '--mdxpad-border': '#404040',
    '--mdxpad-muted': '#808080',
  },
};

export const solarizedTheme: ThemeDefinition = {
  id: 'solarized',
  name: 'Solarized',
  type: 'light',
  builtIn: true,
  tokens: {
    background: '#fdf6e3',
    foreground: '#657b83',
    cursor: '#586e75',
    selection: '#eee8d5',
    lineHighlight: '#eee8d5',
    comment: '#93a1a1',
    keyword: '#859900',
    string: '#2aa198',
    number: '#d33682',
    function: '#268bd2',
    variable: '#b58900',
    type: '#268bd2',
    operator: '#657b83',
  },
  cssVariables: {
    '--mdxpad-bg': '#fdf6e3',
    '--mdxpad-fg': '#657b83',
    '--mdxpad-accent': '#268bd2',
    '--mdxpad-border': '#eee8d5',
    '--mdxpad-muted': '#93a1a1',
  },
};

export const draculaTheme: ThemeDefinition = {
  id: 'dracula',
  name: 'Dracula',
  type: 'dark',
  builtIn: true,
  tokens: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selection: '#44475a',
    lineHighlight: '#44475a',
    comment: '#6272a4',
    keyword: '#ff79c6',
    string: '#f1fa8c',
    number: '#bd93f9',
    function: '#50fa7b',
    variable: '#f8f8f2',
    type: '#8be9fd',
    operator: '#ff79c6',
  },
  cssVariables: {
    '--mdxpad-bg': '#282a36',
    '--mdxpad-fg': '#f8f8f2',
    '--mdxpad-accent': '#bd93f9',
    '--mdxpad-border': '#44475a',
    '--mdxpad-muted': '#6272a4',
  },
};

export const monokaiTheme: ThemeDefinition = {
  id: 'monokai',
  name: 'Monokai',
  type: 'dark',
  builtIn: true,
  tokens: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    selection: '#49483e',
    lineHighlight: '#3e3d32',
    comment: '#75715e',
    keyword: '#f92672',
    string: '#e6db74',
    number: '#ae81ff',
    function: '#a6e22e',
    variable: '#f8f8f2',
    type: '#66d9ef',
    operator: '#f92672',
  },
  cssVariables: {
    '--mdxpad-bg': '#272822',
    '--mdxpad-fg': '#f8f8f2',
    '--mdxpad-accent': '#a6e22e',
    '--mdxpad-border': '#49483e',
    '--mdxpad-muted': '#75715e',
  },
};

// ============================================================================
// Registry
// ============================================================================

export const builtInThemes: ThemeDefinition[] = [
  lightTheme,
  darkTheme,
  solarizedTheme,
  draculaTheme,
  monokaiTheme,
];

/**
 * Get a built-in theme by ID.
 */
export function getBuiltInTheme(id: string): ThemeDefinition | undefined {
  return builtInThemes.find((t) => t.id === id);
}
