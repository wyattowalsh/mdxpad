/**
 * File Commands
 *
 * Built-in file operation commands for the command palette.
 * Handles new, open, save, save as, and close file operations.
 *
 * @module renderer/commands/file-commands
 */

import type { Command, CommandId, CommandContext, CommandResult } from '@shared/types/commands';
import type { FileError, FileHandle, FileId } from '@shared/types/file';
import type { DocumentFileHandle, DocumentId } from '@shared/types/document';
import type { FileExportError } from '@shared/contracts/file-schemas';
import { useCommandRegistry } from '../stores/command-registry-store';
import { useDocumentStore } from '../stores/document-store';
import { isFeatureEnabled } from '../stores/feature-flags-store';
import { liveDocumentContent } from './live-document';
import { useTabStore } from '../stores/tab-store';
import { revealNextDirtyTab } from '../components/tabs/document-tabs';
import { fileIsMissing, hasPendingExternalChange } from '../components/tabs/external-tab-change';

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
  saveAs: 'file.save-as' as CommandId,
  export: 'file.export' as CommandId,
  plugins: 'file.plugins' as CommandId,
  close: 'file.close' as CommandId,
} as const;

// =============================================================================
// DIRTY STATE CHECK
// =============================================================================

/**
 * Check if user wants to proceed when document has unsaved changes.
 * Returns true to proceed, false to cancel.
 */
export { checkDirtyState } from './dirty-state';

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
 * Format file export errors into user-friendly text.
 */
function formatExportError(error: FileExportError): string {
  switch (error.code) {
    case 'CANCELLED':
      return 'Operation cancelled';
    case 'UNSUPPORTED_FORMAT':
      return error.message;
    case 'WRITE_FAILED':
      return error.message;
    case 'UNKNOWN':
      return error.message;
    default:
      return 'Unknown export error';
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

/**
 * Save current document with Save As and report whether a save actually happened.
 */
// eslint-disable-next-line max-lines-per-function
async function executeSaveFileAs(
  ctx: CommandContext
): Promise<{ result: CommandResult; saved: boolean }> {
  try {
    const result = await ctx.api.saveFileAs(liveDocumentContent(ctx));

    if (!result.ok) {
      // User cancelled Save As dialog
      if (result.error.code === 'CANCELLED') {
        return { result: { ok: true }, saved: false };
      }
      const errorMessage = formatFileError(result.error);
      ctx.notify({
        type: 'error',
        message: `Failed to save: ${errorMessage}`,
      });
      return { result: { ok: false, error: errorMessage }, saved: false };
    }

    // Ensure path exists (should always be set when saveFileAs returns success)
    const savedPath = result.value.path;
    if (!savedPath) {
      ctx.notify({
        type: 'error',
        message: 'Failed to save: No file path returned',
      });
      return { result: { ok: false, error: 'No file path returned' }, saved: false };
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
    return { result: { ok: true }, saved: true };
  } catch (error) {
    // Check if error has FileError shape (with code property)
    if (error && typeof error === 'object' && 'code' in error) {
      const fileError = error as FileError;
      const message = formatFileError(fileError);
      ctx.notify({
        type: 'error',
        message: `Failed to save: ${message}`,
      });
      return { result: { ok: false, error: message }, saved: false };
    }
    // Fallback for non-FileError errors
    const message = error instanceof Error ? error.message : String(error);
    ctx.notify({
      type: 'error',
      message: `Failed to save: ${message}`,
    });
    return { result: { ok: false, error: message }, saved: false };
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
  id: FILE_COMMAND_IDS.new,
  name: 'New File',
  description: 'Create a new empty document',
  category: 'file',
  shortcut: { key: 'n', modifiers: ['Mod'] },
  icon: '📄',
  execute: (ctx: CommandContext): CommandResult => {
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
      // Check if error has FileError shape (with code property)
      if (error && typeof error === 'object' && 'code' in error) {
        const fileError = error as FileError;
        const message = formatFileError(fileError);
        ctx.notify({ type: 'error', message: `Failed to open file: ${message}` });
        return { ok: false, error: message };
      }
      // Fallback for non-FileError errors
      const message = error instanceof Error ? error.message : String(error);
      ctx.notify({ type: 'error', message: `Failed to open file: ${message}` });
      return { ok: false, error: message };
    }
  },
  enabled: () => true,
};

function saveChangedOnDisk(ctx: CommandContext): CommandResult | Promise<CommandResult> {
  ctx.notify({
    type: 'info',
    message: 'This file changed on disk. Choose a new location so that copy stays intact.',
  });
  return saveFileAsCommand.execute(ctx);
}

async function saveOtherOpenFiles(ctx: CommandContext): Promise<CommandResult | null> {
  const inactiveSaved = await saveInactiveDocuments(ctx.api);
  if (!inactiveSaved) {
    ctx.notify({ type: 'error', message: 'Failed to save an open file' });
    return { ok: false, error: 'Failed to save an open file' };
  }
  const openDocument = useDocumentStore.getState();
  if (!ctx.document.isDirty && !openDocument.isDirty && !openDocument.fileMissing) {
    revealNextDirtyTab();
    return { ok: true };
  }
  return null;
}

export async function saveInactiveDocuments(api: CommandContext['api']): Promise<boolean> {
  const activeId = useTabStore.getState().activeTabId;
  const pending = useTabStore.getState().tabs.filter((tab) => {
    return (
      tab.id !== activeId && tab.filePath !== null && (tab.isDirty || fileIsMissing(tab.filePath))
    );
  });
  for (const tab of pending) {
    if (!tab.filePath || hasPendingExternalChange(tab.filePath)) {
      continue;
    }
    const result = await api.writeFile(tab.filePath, tab.content);
    if (!result.ok) {
      return false;
    }
    useTabStore.getState().updateTab(tab.id, {
      savedContent: tab.content,
      isDirty: false,
    });
  }
  return true;
}

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
    const otherFiles = await saveOtherOpenFiles(ctx);
    if (otherFiles) return otherFiles;

    // If no file path (untitled), delegate to Save As
    if (!document.filePath) return saveFileAsCommand.execute(ctx);

    if (useDocumentStore.getState().externalChangeDetected) {
      return saveChangedOnDisk(ctx);
    }

    try {
      // Construct FileHandle from document context
      // Note: fileId should exist when filePath exists
      const handle: FileHandle = {
        id: document.fileId as FileId,
        path: document.filePath,
        name: document.filePath.split('/').pop() ?? 'untitled',
      };
      const result = await api.saveFile(handle, liveDocumentContent(ctx));

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
      revealNextDirtyTab();

      ctx.notify({
        type: 'success',
        message: 'File saved',
      });
      return { ok: true };
    } catch (error) {
      // Check if error has FileError shape (with code property)
      if (error && typeof error === 'object' && 'code' in error) {
        const fileError = error as FileError;
        const message = formatFileError(fileError);
        ctx.notify({
          type: 'error',
          message: `Failed to save: ${message}`,
        });
        return { ok: false, error: message };
      }
      // Fallback for non-FileError errors
      const message = error instanceof Error ? error.message : String(error);
      ctx.notify({
        type: 'error',
        message: `Failed to save: ${message}`,
      });
      return { ok: false, error: message };
    }
  },
  enabled: (ctx) => ctx.document.isDirty || useDocumentStore.getState().fileMissing,
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
    const saveResult = await executeSaveFileAs(ctx);
    return saveResult.result;
  },
  enabled: () => true,
};

/**
 * Export file command.
 * Exports current document to a selected format and path.
 */
const exportFileCommand: Command = {
  id: FILE_COMMAND_IDS.export,
  name: 'Export...',
  description:
    'Export the current document to PDF, Word, EPUB, LaTeX, Pandoc, HTML, Markdown, or MDX',
  category: 'file',
  shortcut: { key: 'e', modifiers: ['Mod', 'Shift'] },
  icon: '📤',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    if (!isFeatureEnabled('export')) {
      ctx.notify({
        type: 'warning',
        message: 'Export feature is disabled',
      });
      return { ok: false, error: 'Export feature is disabled' };
    }

    try {
      const result = await ctx.api.exportFile(liveDocumentContent(ctx), {
        sourcePath: ctx.document.filePath,
      });

      if (!result.ok) {
        if (result.error.code === 'CANCELLED') {
          return { ok: true };
        }

        const message = formatExportError(result.error);
        ctx.notify({
          type: 'error',
          message: `Failed to export: ${message}`,
        });
        return { ok: false, error: message };
      }

      const exportedFileName = result.value.path.split('/').pop() ?? result.value.path;
      ctx.notify({
        type: 'success',
        message: `Exported: ${exportedFileName}`,
      });

      if (result.value.warnings.length > 0) {
        ctx.notify({
          type: 'info',
          message: result.value.warnings[0] ?? 'Export completed with warnings',
        });
      }

      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.notify({
        type: 'error',
        message: `Failed to export: ${message}`,
      });
      return { ok: false, error: message };
    }
  },
  enabled: () => isFeatureEnabled('export'),
};

const managePluginsCommand: Command = {
  id: FILE_COMMAND_IDS.plugins,
  name: 'Manage Plugins',
  description: 'View installed plugins and plugin surface status',
  category: 'file',
  icon: '🧩',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    if (!isFeatureEnabled('plugin')) {
      ctx.notify({
        type: 'warning',
        message: 'Plugin surface is disabled',
      });
      return { ok: false, error: 'Plugin surface is disabled' };
    }

    if (!ctx.api.plugin) {
      ctx.notify({
        type: 'error',
        message: 'Plugin API is unavailable',
      });
      return { ok: false, error: 'Plugin API is unavailable' };
    }

    try {
      const { plugins } = await ctx.api.plugin.list();
      ctx.notify({
        type: 'info',
        message: `${plugins.length} plugin${plugins.length === 1 ? '' : 's'} installed`,
      });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.notify({
        type: 'error',
        message: `Failed to load plugins: ${message}`,
      });
      return { ok: false, error: message };
    }
  },
  enabled: () => isFeatureEnabled('plugin'),
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
  icon: '❌',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      await ctx.api.closeWindow();
      return { ok: true };
    } catch (error) {
      // Check if error has FileError shape (with code property)
      if (error && typeof error === 'object' && 'code' in error) {
        const fileError = error as FileError;
        const message = formatFileError(fileError);
        ctx.notify({
          type: 'error',
          message: `Failed to close: ${message}`,
        });
        return { ok: false, error: message };
      }
      // Fallback for non-FileError errors
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
  exportFileCommand,
  managePluginsCommand,
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
  exportFileCommand,
  managePluginsCommand,
  closeWindowCommand,
  FILE_COMMANDS,
};
