/**
 * Build a CodeMirror theme from a plugin theme definition.
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as highlightTags } from '@lezer/highlight';
import type { ThemeDefinition, ThemeTokens } from '@shared/contracts/plugin-schemas';

function tokenColor(
  tag: (typeof highlightTags)['comment'],
  color: string | undefined
): { tag: (typeof highlightTags)['comment']; color: string }[] {
  return color === undefined ? [] : [{ tag, color }];
}

function highlightForTokens(tokens: ThemeTokens): HighlightStyle {
  return HighlightStyle.define([
    ...tokenColor(highlightTags.comment, tokens.comment),
    ...tokenColor(highlightTags.keyword, tokens.keyword),
    ...tokenColor(highlightTags.string, tokens.string),
    ...tokenColor(highlightTags.number, tokens.number),
    ...tokenColor(highlightTags.function(highlightTags.variableName), tokens.function),
    ...tokenColor(highlightTags.variableName, tokens.variable),
    ...tokenColor(highlightTags.typeName, tokens.type),
    ...tokenColor(highlightTags.operator, tokens.operator),
  ]);
}

/** Chrome and syntax colors for an applied plugin theme. */
export function extensionForTheme(theme: ThemeDefinition): Extension {
  const { tokens } = theme;
  const cursor = tokens.cursor ?? tokens.foreground;
  return [
    EditorView.theme(
      {
        '&': {
          backgroundColor: tokens.background,
          color: tokens.foreground,
        },
        '.cm-content': {
          caretColor: cursor,
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: cursor,
        },
        '.cm-selectionBackground, .cm-content ::selection': {
          backgroundColor: tokens.selection ?? '#c8c8fa',
        },
        '.cm-activeLine': {
          backgroundColor: tokens.lineHighlight ?? 'transparent',
        },
      },
      { dark: theme.type === 'dark' }
    ),
    syntaxHighlighting(highlightForTokens(tokens)),
  ];
}
