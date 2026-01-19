/**
 * Template Commands
 *
 * Built-in template operation commands for the command palette.
 * Handles creating new documents from templates, saving as templates,
 * and importing/exporting templates.
 *
 * Feature: 016-template-library
 *
 * @module renderer/commands/template-commands
 */

import type {
  Command,
  CommandId,
  CommandContext,
  CommandResult,
} from '@shared/types/commands';
import { useCommandRegistry } from '../stores/command-registry-store';
import { useTemplateBrowserModalStore } from '../stores/template-browser-store';
import { useTemplateStore } from '../stores/template-store';

// =============================================================================
// COMMAND IDS
// =============================================================================

/**
 * Template command identifiers.
 * Use these constants when executing commands programmatically.
 */
export const TEMPLATE_COMMAND_IDS = {
  newFromTemplate: 'file.newFromTemplate' as CommandId,
  browseTemplates: 'template.browse' as CommandId,
  saveAsTemplate: 'template.saveAsTemplate' as CommandId,
  importTemplate: 'template.import' as CommandId,
} as const;

// =============================================================================
// COMMAND DEFINITIONS
// =============================================================================

/**
 * New file from template command.
 * Opens the template browser modal to create a new document from a template.
 */
const newFromTemplateCommand: Command = {
  id: TEMPLATE_COMMAND_IDS.newFromTemplate,
  name: 'New File from Template...',
  description: 'Create a new document from a template',
  category: 'file',
  shortcut: { key: 'n', modifiers: ['Mod', 'Shift'] },
  icon: '📋',
  execute: (_ctx: CommandContext): CommandResult => {
    // Open the template browser modal
    useTemplateBrowserModalStore.getState().openTemplateBrowser();
    return { ok: true };
  },
  enabled: () => true,
};

/**
 * Browse templates command.
 * Opens the template browser modal for exploring available templates.
 */
const browseTemplatesCommand: Command = {
  id: TEMPLATE_COMMAND_IDS.browseTemplates,
  name: 'Template: Browse Templates',
  description: 'Browse available templates',
  category: 'file',
  icon: '📚',
  execute: (_ctx: CommandContext): CommandResult => {
    useTemplateBrowserModalStore.getState().openTemplateBrowser();
    return { ok: true };
  },
  enabled: () => true,
};

/**
 * Save as template command.
 * Opens the save template dialog to save current document as a template.
 */
const saveAsTemplateCommand: Command = {
  id: TEMPLATE_COMMAND_IDS.saveAsTemplate,
  name: 'Template: Save as Template...',
  description: 'Save current document as a reusable template',
  category: 'file',
  icon: '💾',
  execute: (ctx: CommandContext): CommandResult => {
    // Check if there's content to save
    if (!ctx.document.content.trim()) {
      ctx.notify({
        type: 'warning',
        message: 'Cannot save empty document as template',
      });
      return { ok: false, error: 'Empty document' };
    }
    useTemplateBrowserModalStore.getState().openSaveTemplateDialog();
    return { ok: true };
  },
  enabled: (ctx) => ctx.document.content.trim().length > 0,
};

/**
 * Import template command.
 * Opens file dialog to import a .mdxt template file.
 */
const importTemplateCommand: Command = {
  id: TEMPLATE_COMMAND_IDS.importTemplate,
  name: 'Template: Import Template...',
  description: 'Import a template from a .mdxt file',
  category: 'file',
  icon: '📥',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    try {
      // Show open dialog
      const dialogResult = await window.mdxpad.template.showOpenDialog();
      if (!dialogResult.success) {
        ctx.notify({
          type: 'error',
          message: `Failed to open file dialog: ${dialogResult.error}`,
        });
        return { ok: false, error: dialogResult.error };
      }

      // Check if user cancelled
      if (dialogResult.data.canceled || !dialogResult.data.path) {
        return { ok: true }; // User cancelled, not an error
      }

      // Import the template
      await useTemplateStore.getState().importTemplate(dialogResult.data.path, false);

      ctx.notify({
        type: 'success',
        message: 'Template imported successfully',
      });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.notify({
        type: 'error',
        message: `Failed to import template: ${message}`,
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
 * All template commands to register.
 */
const TEMPLATE_COMMANDS: readonly Command[] = [
  newFromTemplateCommand,
  browseTemplatesCommand,
  saveAsTemplateCommand,
  importTemplateCommand,
];

/**
 * Register all template commands with the command registry.
 * Call this once during app initialization.
 *
 * @returns Unregister function to remove all template commands
 */
export function registerTemplateCommands(): () => void {
  const { register, unregister } = useCommandRegistry.getState();
  const registeredIds: CommandId[] = [];

  for (const command of TEMPLATE_COMMANDS) {
    const result = register(command);
    if (result.ok) {
      registeredIds.push(command.id);
    } else {
      console.warn(`Failed to register template command ${command.id}: ${result.error}`);
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
  newFromTemplateCommand,
  browseTemplatesCommand,
  saveAsTemplateCommand,
  importTemplateCommand,
  TEMPLATE_COMMANDS,
};
