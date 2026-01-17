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
import type { DocumentFileHandle, DocumentId } from '@shared/types/document';
import { useCommandRegistry } from '../stores/command-registry-store';
import { useDocumentStore } from '../stores/document-store';

// =============================================================================
// COMMAND IDS
// =============================================================================

/**
 * File command identifiers.
 * Use these constants when executing commands programmatically.
 */
export const FILE_COMMAND_IDS = {
  new: 'file.new' as CommandId,
  open: 'file.open' as CommandId,
  save: 'file.save' as CommandId,
  saveAs: 'file.saveAs' as CommandId,
  close: 'file.close' as CommandId,
} as const;

// =============================================================================
// DIRTY STATE CHECK
// =============================================================================

/**
 * Placeholder function to check if user wants to proceed when document is dirty.
 * Returns true to proceed, false to cancel.
 *
 * TODO: Integrate with T008 (unsaved changes dialog) to show actual confirmation.
 *
 * @returns true - always proceeds (placeholder behavior)
 */
export function checkDirtyState(): boolean {
  // Placeholder: always proceed for now
  // Will be integrated with unsaved changes dialog in T008
  return true;
}

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

/**
 * Helper to load file content and update document store.
 * @returns CommandResult indicating success or failure with error message
 */
async function loadFileIntoStore(
  handle: FileHandle,
  api: CommandContext['api']
): Promise<CommandResult> {
  // Ensure path exists (should always be set when openFile returns success)
  const filePath = handle.path;
  if (!filePath) {
    return { ok: false, error: 'No file path returned' };
  }

  // Read the file content
  const readResult = await api.readFile(filePath);
  if (!readResult.ok) {
    return { ok: false, error: formatFileError(readResult.error) };
  }

  // Convert FileHandle to DocumentFileHandle and update document store
  const docHandle: DocumentFileHandle = {
    fileId: handle.id as unknown as DocumentId,
    filePath,
    mtime: Date.now(), // Use current time as mtime (will be updated by file watcher)
  };
  useDocumentStore.getState().openDocument(docHandle, readResult.value);

  return { ok: true };
}

// =============================================================================
// COMMAND DEFINITIONS
// =============================================================================

/**
 * Create a new file command.
 * Clears the editor and resets document state.
 */
const newFileCommand: Command = {
  id: FILE_COMMAND_IDS.new,
  name: 'New File',
  description: 'Create a new empty document',
  category: 'file',
  shortcut: { key: 'n', modifiers: ['Mod'] },
  icon: '📄',
  execute: (ctx: CommandContext): CommandResult => {
    // Check dirty state before creating new document
    if (ctx.document.isDirty && !checkDirtyState()) {
      return { ok: true }; // User cancelled
    }

    // Reset document store to new document state
    useDocumentStore.getState().newDocument();

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
  id: FILE_COMMAND_IDS.open,
  name: 'Open File...',
  description: 'Open an existing file',
  category: 'file',
  shortcut: { key: 'o', modifiers: ['Mod'] },
  icon: '📂',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    // Check dirty state before opening a new file
    if (ctx.document.isDirty && !checkDirtyState()) {
      return { ok: true }; // User cancelled
    }

    try {
      const result = await ctx.api.openFile();
      if (!result.ok) {
        // User cancelled or error occurred
        if (result.error.code === 'CANCELLED') {
          return { ok: true }; // Cancelled is not an error
        }
        const errorMessage = formatFileError(result.error);
        ctx.notify({ type: 'error', message: `Failed to open file: ${errorMessage}` });
        return { ok: false, error: errorMessage };
      }

      // Load file content and update document store
      const loadResult = await loadFileIntoStore(result.value, ctx.api);
      if (!loadResult.ok) {
        ctx.notify({ type: 'error', message: `Failed to open file: ${loadResult.error}` });
        return loadResult;
      }

      ctx.notify({ type: 'success', message: `Opened: ${result.value.name}` });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.notify({ type: 'error', message: `Failed to open file: ${message}` });
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
  id: FILE_COMMAND_IDS.save,
  name: 'Save',
  description: 'Save the current file',
  category: 'file',
  shortcut: { key: 's', modifiers: ['Mod'] },
  icon: '💾',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { document, api } = ctx;

    // If no file path (untitled), delegate to Save As
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

      // Mark document as saved in the store
      useDocumentStore.getState().markSaved();

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
  id: FILE_COMMAND_IDS.saveAs,
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

      // Ensure path exists (should always be set when saveFileAs returns success)
      const savedPath = result.value.path;
      if (!savedPath) {
        ctx.notify({
          type: 'error',
          message: 'Failed to save: No file path returned',
        });
        return { ok: false, error: 'No file path returned' };
      }

      // Convert FileHandle to DocumentFileHandle and mark as saved with new handle
      const docHandle: DocumentFileHandle = {
        fileId: result.value.id as unknown as DocumentId,
        filePath: savedPath,
        mtime: Date.now(), // Use current time as mtime
      };
      useDocumentStore.getState().markSaved(docHandle);

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
  id: FILE_COMMAND_IDS.close,
  name: 'Close Window',
  description: 'Close the current window',
  category: 'file',
  shortcut: { key: 'w', modifiers: ['Mod'] },
  icon: '❌',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    // Check dirty state before closing
    if (ctx.document.isDirty && !checkDirtyState()) {
      return { ok: true }; // User cancelled
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
