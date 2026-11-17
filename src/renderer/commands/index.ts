/**
 * Command Registration Entry Point
 *
 * Registers all built-in commands on application initialization.
 * Import and call registerAllCommands() in App.tsx.
 *
 * @module renderer/commands
 */

import { registerFileCommands } from './file-commands';
import { registerEditorCommands } from './editor-commands';
import { registerViewCommands } from './view-commands';
import { registerFilterCommands } from './filter-commands';
import { registerTemplateCommands } from './template-commands';
import { registerServiceCommands } from './service-commands';
import { registerPanelCommands } from './panel-commands';

/**
 * Register all built-in commands with the command registry.
 * Call this once during app initialization.
 *
 * @returns Unregister function to remove all commands
 */
export function registerAllCommands(): () => void {
  const unregisterFile = registerFileCommands();
  const unregisterEditor = registerEditorCommands();
  const unregisterView = registerViewCommands();
  const unregisterFilter = registerFilterCommands();
  const unregisterTemplate = registerTemplateCommands();
  const unregisterService = registerServiceCommands();
  const unregisterPanels = registerPanelCommands();

  return () => {
    unregisterFile();
    unregisterEditor();
    unregisterView();
    unregisterFilter();
    unregisterTemplate();
    unregisterService();
    unregisterPanels();
  };
}

// Re-export individual registration functions for selective use
export { registerFileCommands } from './file-commands';
export { registerEditorCommands } from './editor-commands';
export { registerViewCommands } from './view-commands';
export { registerFilterCommands } from './filter-commands';
export { registerTemplateCommands } from './template-commands';
export { registerServiceCommands } from './service-commands';
export { registerPanelCommands } from './panel-commands';
