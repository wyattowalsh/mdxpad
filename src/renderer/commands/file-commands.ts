/**
 * File Commands
 *
 * Built-in file operation commands for the command palette.
 * Handles new, open, save, save as, and close file operations.
 *
 * @module renderer/commands/file-commands
 */

import type {
  Command,
  CommandId,
  CommandContext,
  CommandResult,
} from '@shared/types/commands';
import type { FileError, FileHandle, FileId } from '@shared/types/file';
import { useCommandRegistry } from '../stores/command-registry-store';

/**
 * Format a FileError into a user-friendly message.
 */
function formatFileError(error: FileError): string {
  switch (error.code) {
    case 'NOT_FOUND':
      return `File not found: ${error.path}`;
    case 'PERMISSION_DENIED':
      return `Permission denied: ${error.path}`;
    case 'CANCELLED':
      return 'Operation cancelled';
    case 'UNKNOWN':
      return error.message;
    default:
      return 'Unknown error';
  }
}

// =============================================================================
// COMMAND DEFINITIONS
// =============================================================================

/**
 * Create a new file command.
 * Clears the editor and resets document state.
 */
const newFileCommand: Command = {
  id: 'file.new' as CommandId,
  name: 'New File',
  description: 'Create a new empty document',
  category: 'file',
  shortcut: { key: 'n', modifiers: ['Mod'] },
  icon: '📄',
  execute: (ctx: CommandContext): CommandResult => {
    // For now, notify user - actual implementation will be added when editor is integrated
    ctx.notify({
      type: 'info',
      message: 'New file created',
    });
    return { ok: true };
  },
  enabled: () => true,
};

/**
 * Open file command.
 * Shows native file dialog and loads selected file.
 */
const openFileCommand: Command = {
  id: 'file.open' as CommandId,
  name: 'Open File...',
  description: 'Open an existing file',
  category: 'file',
  shortcut: { key: 'o', modifiers: ['Mod'] },
  icon: '📂',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const result = await ctx.api.openFile();
      if (!result.ok) {
        // User cancelled or error occurred
        if (result.error.code === 'CANCELLED') {
          return { ok: true }; // Cancelled is not an error
        }
        const errorMessage = formatFileError(result.error);
        ctx.notify({
          type: 'error',
          message: `Failed to open file: ${errorMessage}`,
        });
        return { ok: false, error: errorMessage };
      }

      ctx.notify({
        type: 'success',
        message: `Opened: ${result.value.name}`,
      });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.notify({
        type: 'error',
        message: `Failed to open file: ${message}`,
      });
      return { ok: false, error: message };
    }
  },
  enabled: () => true,
};

/**
 * Save file command.
 * Saves current document to its existing path, or shows Save As if new.
 */
const saveFileCommand: Command = {
  id: 'file.save' as CommandId,
  name: 'Save',
  description: 'Save the current file',
  category: 'file',
  shortcut: { key: 's', modifiers: ['Mod'] },
  icon: '💾',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { document, api } = ctx;

    // If no file path, use Save As
    if (!document.filePath) {
      return saveFileAsCommand.execute(ctx);
    }

    try {
      // Construct FileHandle from document context
      // Note: fileId should exist when filePath exists
      const handle: FileHandle = {
        id: document.fileId as FileId,
        path: document.filePath,
        name: document.filePath.split('/').pop() ?? 'untitled',
      };
      const result = await api.saveFile(handle, document.content);

      if (!result.ok) {
        const errorMessage = formatFileError(result.error);
        ctx.notify({
          type: 'error',
          message: `Failed to save: ${errorMessage}`,
        });
        return { ok: false, error: errorMessage };
      }

      ctx.notify({
        type: 'success',
        message: 'File saved',
      });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.notify({
        type: 'error',
        message: `Failed to save: ${message}`,
      });
      return { ok: false, error: message };
    }
  },
  enabled: (ctx) => ctx.document.isDirty,
};

/**
 * Save file as command.
 * Shows native save dialog and saves to new location.
 */
const saveFileAsCommand: Command = {
  id: 'file.save-as' as CommandId,
  name: 'Save As...',
  description: 'Save the current file to a new location',
  category: 'file',
  shortcut: { key: 's', modifiers: ['Mod', 'Shift'] },
  icon: '💾',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      const result = await ctx.api.saveFileAs(ctx.document.content);

      if (!result.ok) {
        // User cancelled or error occurred
        if (result.error.code === 'CANCELLED') {
          return { ok: true }; // Cancelled is not an error
        }
        const errorMessage = formatFileError(result.error);
        ctx.notify({
          type: 'error',
          message: `Failed to save: ${errorMessage}`,
        });
        return { ok: false, error: errorMessage };
      }

      ctx.notify({
        type: 'success',
        message: `Saved as: ${result.value.name}`,
      });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.notify({
        type: 'error',
        message: `Failed to save: ${message}`,
      });
      return { ok: false, error: message };
    }
  },
  enabled: () => true,
};

/**
 * Close window command.
 * Prompts for unsaved changes before closing.
 */
const closeWindowCommand: Command = {
  id: 'file.close' as CommandId,
  name: 'Close Window',
  description: 'Close the current window',
  category: 'file',
  shortcut: { key: 'w', modifiers: ['Mod'] },
  icon: '❌',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    // TODO: Check for unsaved changes and prompt user
    if (ctx.document.isDirty) {
      ctx.notify({
        type: 'warning',
        message: 'You have unsaved changes. Save before closing?',
      });
      // For now, just warn - actual dialog will be added later
      return { ok: true };
    }

    try {
      await ctx.api.closeWindow();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.notify({
        type: 'error',
        message: `Failed to close: ${message}`,
      });
      return { ok: false, error: message };
    }
  },
  enabled: () => true,
};

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * All file commands to register.
 */
const FILE_COMMANDS: readonly Command[] = [
  newFileCommand,
  openFileCommand,
  saveFileCommand,
  saveFileAsCommand,
  closeWindowCommand,
];

/**
 * Register all file commands with the command registry.
 * Call this once during app initialization.
 *
 * @returns Unregister function to remove all file commands
 */
export function registerFileCommands(): () => void {
  const { register, unregister } = useCommandRegistry.getState();
  const registeredIds: CommandId[] = [];

  for (const command of FILE_COMMANDS) {
    const result = register(command);
    if (result.ok) {
      registeredIds.push(command.id);
    } else {
      console.warn(`Failed to register file command ${command.id}: ${result.error}`);
    }
  }

  // Return unregister function
  return () => {
    for (const id of registeredIds) {
      unregister(id);
    }
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  newFileCommand,
  openFileCommand,
  saveFileCommand,
  saveFileAsCommand,
  closeWindowCommand,
  FILE_COMMANDS,
};
