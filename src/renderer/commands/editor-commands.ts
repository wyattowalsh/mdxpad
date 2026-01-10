/**
 * Editor Commands
 *
 * Built-in editor formatting commands for the command palette.
 * Wraps CodeMirror commands as Command palette commands.
 *
 * @module renderer/commands/editor-commands
 */

import type { Command, CommandId, CommandContext, CommandResult, ShortcutBinding } from '@shared/types/commands';
import { executeCommand as executeCMCommand, type EditorCommandName } from '../hooks/useCodeMirror/commands';
import { useCommandRegistry } from '../stores/command-registry-store';

/**
 * Create an editor command that wraps a CodeMirror command.
 */
function createEditorCommand(
  id: CommandId,
  name: string,
  description: string,
  cmCommand: EditorCommandName,
  shortcut?: ShortcutBinding
): Command {
  const base = {
    id,
    name,
    description,
    category: 'edit' as const,
    execute: (ctx: CommandContext): CommandResult => {
      if (!ctx.editor) {
        ctx.notify({ type: 'warning', message: 'No editor available' });
        return { ok: false, error: 'No editor available' };
      }
      const success = executeCMCommand(ctx.editor, cmCommand);
      return success ? { ok: true } : { ok: false, error: 'Command failed' };
    },
    enabled: (ctx: CommandContext) => ctx.editor !== null,
  };
  return shortcut ? { ...base, shortcut } : base;
}

// =============================================================================
// COMMAND DEFINITIONS
// =============================================================================

const boldCommand = createEditorCommand(
  'edit.bold' as CommandId,
  'Bold',
  'Toggle bold formatting',
  'bold',
  { key: 'b', modifiers: ['Mod'] }
);

const italicCommand = createEditorCommand(
  'edit.italic' as CommandId,
  'Italic',
  'Toggle italic formatting',
  'italic',
  { key: 'i', modifiers: ['Mod'] }
);

const codeCommand = createEditorCommand(
  'edit.code' as CommandId,
  'Inline Code',
  'Toggle inline code formatting',
  'code',
  { key: 'e', modifiers: ['Mod'] }
);

const linkCommand = createEditorCommand(
  'edit.link' as CommandId,
  'Insert Link',
  'Insert a markdown link',
  'link',
  { key: 'k', modifiers: ['Mod'] }
);

const codeBlockCommand = createEditorCommand(
  'edit.code-block' as CommandId,
  'Insert Code Block',
  'Insert a fenced code block',
  'codeBlock',
  { key: 'k', modifiers: ['Mod', 'Shift'] }
);

const toggleCommentCommand = createEditorCommand(
  'edit.toggle-comment' as CommandId,
  'Toggle Comment',
  'Toggle comment on current line',
  'toggleComment',
  { key: '/', modifiers: ['Mod'] }
);

const undoCommand = createEditorCommand(
  'edit.undo' as CommandId,
  'Undo',
  'Undo last change',
  'undo',
  { key: 'z', modifiers: ['Mod'] }
);

const redoCommand = createEditorCommand(
  'edit.redo' as CommandId,
  'Redo',
  'Redo last undone change',
  'redo',
  { key: 'z', modifiers: ['Mod', 'Shift'] }
);

const findCommand = createEditorCommand(
  'edit.find' as CommandId,
  'Find',
  'Open find dialog',
  'find',
  { key: 'f', modifiers: ['Mod'] }
);

const findReplaceCommand = createEditorCommand(
  'edit.find-replace' as CommandId,
  'Find and Replace',
  'Open find and replace dialog',
  'findReplace',
  { key: 'f', modifiers: ['Mod', 'Shift'] }
);

const goToLineCommand = createEditorCommand(
  'edit.go-to-line' as CommandId,
  'Go to Line',
  'Jump to a specific line number',
  'goToLine',
  { key: 'g', modifiers: ['Mod'] }
);

const heading1Command = createEditorCommand(
  'edit.heading-1' as CommandId,
  'Heading 1',
  'Convert line to heading level 1',
  'heading1',
  { key: '1', modifiers: ['Mod'] }
);

const heading2Command = createEditorCommand(
  'edit.heading-2' as CommandId,
  'Heading 2',
  'Convert line to heading level 2',
  'heading2',
  { key: '2', modifiers: ['Mod'] }
);

const heading3Command = createEditorCommand(
  'edit.heading-3' as CommandId,
  'Heading 3',
  'Convert line to heading level 3',
  'heading3',
  { key: '3', modifiers: ['Mod'] }
);

// =============================================================================
// REGISTRATION
// =============================================================================

const EDITOR_COMMANDS: readonly Command[] = [
  boldCommand,
  italicCommand,
  codeCommand,
  linkCommand,
  codeBlockCommand,
  toggleCommentCommand,
  undoCommand,
  redoCommand,
  findCommand,
  findReplaceCommand,
  goToLineCommand,
  heading1Command,
  heading2Command,
  heading3Command,
];

/**
 * Register all editor commands with the command registry.
 * @returns Unregister function
 */
export function registerEditorCommands(): () => void {
  const { register, unregister } = useCommandRegistry.getState();
  const registeredIds: CommandId[] = [];

  for (const command of EDITOR_COMMANDS) {
    const result = register(command);
    if (result.ok) {
      registeredIds.push(command.id);
    }
  }

  return () => {
    for (const id of registeredIds) {
      unregister(id);
    }
  };
}

export { EDITOR_COMMANDS };
