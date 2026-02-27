/**
 * Slash Commands Extension for CodeMirror
 *
 * Provides a `/` triggered autocomplete source that inserts
 * Markdown/MDX syntax blocks. Triggered at start of line or
 * after whitespace.
 *
 * @module renderer/lib/editor/extensions/slash-commands
 */

import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';

import { BUILTIN_SLASH_COMMANDS, type SlashCommand } from './slash-command-definitions';

// =============================================================================
// Completion Builder
// =============================================================================

/**
 * Convert a SlashCommand to a CodeMirror Completion.
 */
function commandToCompletion(cmd: SlashCommand): Completion {
  return {
    label: `/${cmd.name}`,
    displayLabel: cmd.label,
    detail: cmd.description,
    type: 'keyword',
    boost: 1,
    apply: (view, _completion, from, to) => {
      const { template, cursorOffset = 0 } = cmd;
      view.dispatch({
        changes: { from, to, insert: template },
        selection: { anchor: from + template.length - cursorOffset },
      });
    },
  };
}

// =============================================================================
// Completion Source
// =============================================================================

/**
 * Create a slash-command completion source from a list of commands.
 *
 * Triggers when the user types `/` at the start of a line or after whitespace.
 */
function createSlashCommandSource(
  commands: readonly SlashCommand[]
): (context: CompletionContext) => CompletionResult | null {
  const completions = commands.map(commandToCompletion);

  return (context: CompletionContext): CompletionResult | null => {
    // Match `/` followed by optional word characters
    const match = context.matchBefore(/\/\w*/);
    if (!match) return null;

    // Ensure `/` is at start of line or after whitespace
    const charBefore = match.from > 0 ? context.state.sliceDoc(match.from - 1, match.from) : '';
    const isStartOfLine = match.from === 0 || charBefore === '\n';
    const isAfterWhitespace = /\s/.test(charBefore);

    if (!isStartOfLine && !isAfterWhitespace) return null;

    return {
      from: match.from,
      options: completions,
      validFor: /^\/\w*$/,
    };
  };
}

// =============================================================================
// Extension
// =============================================================================

/**
 * Slash commands extension for CodeMirror.
 *
 * Provides a `/`-triggered autocomplete that inserts Markdown/MDX syntax.
 * Includes built-in commands and supports custom command registration.
 *
 * @param commands - Additional custom slash commands to include
 * @returns CodeMirror Extension
 *
 * @example
 * ```typescript
 * import { slashCommandsExtension } from './slash-commands';
 *
 * // Use with default commands only
 * const ext = slashCommandsExtension();
 *
 * // Add custom commands
 * const ext = slashCommandsExtension([
 *   { name: 'callout', label: 'Callout', description: 'Insert callout', template: '<Callout>\n\n</Callout>' },
 * ]);
 * ```
 */
/**
 * Create a slash command completion source combining built-in commands
 * with optional custom commands.
 *
 * Returns a CompletionSource for use with `autocompletion({ override })`.
 * Do NOT wrap in `autocompletion()` — that must be called once centrally.
 */
export function createSlashCommandCompletionSource(
  commands: SlashCommand[] = []
): (context: CompletionContext) => CompletionResult | null {
  return createSlashCommandSource([...BUILTIN_SLASH_COMMANDS, ...commands]);
}

export type { SlashCommand } from './slash-command-definitions';
