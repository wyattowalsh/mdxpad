/**
 * High Contrast Theme for CodeMirror 6
 *
 * Provides a CodeMirror theme extension optimized for high contrast mode
 * with WCAG AAA compliant contrast ratios, increased font sizes, strong
 * cursor and selection colors, and enhanced gutter contrast.
 *
 * @module renderer/hooks/useCodeMirror/high-contrast-theme
 */

import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

// ============================================================================
// Theme Colors
// ============================================================================

const colors = {
  bg: '#000000',
  bgSecondary: '#1a1a1a',
  bgHover: '#2a2a2a',
  fg: '#ffffff',
  fgSecondary: '#e0e0e0',
  fgMuted: '#cccccc',
  accent: '#00e5ff',
  accentSecondary: '#ffff00',
  error: '#ff4444',
  success: '#44ff44',
  warning: '#ffaa00',
  selection: '#004d66',
  cursor: '#ffff00',
  border: '#ffffff',
  lineNumber: '#b0b0b0',
  activeLineNumber: '#ffffff',
  activeLine: '#1a1a2e',
} as const;

// ============================================================================
// Editor Theme
// ============================================================================

/**
 * High contrast CodeMirror editor theme.
 *
 * Provides maximum contrast for all editor elements with
 * increased font sizes and strong visual indicators.
 */
const highContrastEditorTheme = EditorView.theme(
  {
    // Root editor styles
    '&': {
      backgroundColor: colors.bg,
      color: colors.fg,
      fontSize: '16px',
      lineHeight: '1.6',
    },

    // Content area
    '.cm-content': {
      caretColor: colors.cursor,
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    },

    // Cursor
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: colors.cursor,
      borderLeftWidth: '3px',
    },

    // Selection
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: `${colors.selection} !important`,
    },

    // Active line
    '.cm-activeLine': {
      backgroundColor: colors.activeLine,
    },

    // Gutters
    '.cm-gutters': {
      backgroundColor: colors.bgSecondary,
      color: colors.lineNumber,
      borderRight: `2px solid ${colors.border}`,
      fontSize: '15px',
    },

    '.cm-activeLineGutter': {
      backgroundColor: colors.bgHover,
      color: colors.activeLineNumber,
    },

    // Line numbers
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 4px',
    },

    // Search match highlighting
    '.cm-searchMatch': {
      backgroundColor: '#665500',
      outline: `2px solid ${colors.accentSecondary}`,
    },

    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#445500',
    },

    // Matching brackets
    '&.cm-focused .cm-matchingBracket': {
      backgroundColor: '#336633',
      outline: `2px solid ${colors.success}`,
    },

    // Panels
    '.cm-panels': {
      backgroundColor: colors.bgSecondary,
      color: colors.fg,
      borderBottom: `2px solid ${colors.border}`,
    },

    '.cm-panels.cm-panels-top': {
      borderBottom: `2px solid ${colors.border}`,
    },

    '.cm-panels.cm-panels-bottom': {
      borderTop: `2px solid ${colors.border}`,
    },

    // Tooltip
    '.cm-tooltip': {
      backgroundColor: colors.bgSecondary,
      color: colors.fg,
      border: `2px solid ${colors.border}`,
    },

    '.cm-tooltip .cm-tooltip-arrow:before': {
      borderTopColor: colors.border,
    },

    // Autocomplete
    '.cm-tooltip-autocomplete': {
      '& > ul > li': {
        padding: '4px 8px',
      },
      '& > ul > li[aria-selected]': {
        backgroundColor: colors.selection,
        color: colors.fg,
      },
    },

    // Fold gutter
    '.cm-foldGutter .cm-gutterElement': {
      color: colors.fgMuted,
      fontSize: '16px',
    },

    // Focus outline
    '&.cm-focused': {
      outline: `3px solid ${colors.accent}`,
      outlineOffset: '-1px',
    },
  },
  { dark: true }
);

// ============================================================================
// Syntax Highlighting
// ============================================================================

/**
 * High contrast syntax highlighting style.
 *
 * Uses bold, high-contrast colors for each syntax category to ensure
 * readability and distinction between different code elements.
 */
const highContrastHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: colors.accent, fontWeight: 'bold' },
  { tag: t.operator, color: colors.fg },
  { tag: t.special(t.variableName), color: colors.accentSecondary },
  { tag: t.typeName, color: colors.accent, fontStyle: 'italic' },
  { tag: t.atom, color: colors.accent },
  { tag: t.number, color: colors.success },
  { tag: t.bool, color: colors.success, fontWeight: 'bold' },
  { tag: t.string, color: colors.warning },
  { tag: t.regexp, color: colors.warning, fontStyle: 'italic' },
  { tag: t.escape, color: colors.error },
  { tag: t.definition(t.variableName), color: colors.fg, fontWeight: 'bold' },
  { tag: t.local(t.variableName), color: colors.fg },
  { tag: t.variableName, color: colors.fgSecondary },
  { tag: t.function(t.variableName), color: colors.accentSecondary },
  { tag: t.propertyName, color: colors.fgSecondary },
  { tag: t.comment, color: colors.fgMuted, fontStyle: 'italic' },
  { tag: t.lineComment, color: colors.fgMuted, fontStyle: 'italic' },
  { tag: t.blockComment, color: colors.fgMuted, fontStyle: 'italic' },
  { tag: t.meta, color: colors.fgMuted },
  { tag: t.link, color: colors.accent, textDecoration: 'underline' },
  { tag: t.heading, color: colors.accentSecondary, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.invalid, color: colors.error, textDecoration: 'wavy underline' },
  { tag: t.tagName, color: colors.accent },
  { tag: t.attributeName, color: colors.accentSecondary },
  { tag: t.attributeValue, color: colors.warning },
]);

// ============================================================================
// Exports
// ============================================================================

/**
 * Complete high contrast theme extension for CodeMirror 6.
 *
 * Includes both the editor theme (colors, layout, cursor) and syntax
 * highlighting styles. Apply this extension to a CodeMirror editor
 * to enable high contrast mode.
 *
 * @example
 * ```typescript
 * import { highContrastTheme } from './high-contrast-theme';
 *
 * const view = new EditorView({
 *   extensions: [highContrastTheme],
 * });
 * ```
 */
export const highContrastTheme: Extension = [
  highContrastEditorTheme,
  syntaxHighlighting(highContrastHighlightStyle),
];
