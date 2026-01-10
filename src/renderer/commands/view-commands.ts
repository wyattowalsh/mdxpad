/**
 * View Commands
 *
 * Built-in view control commands for the command palette.
 * Controls preview pane, sidebar, and zoom level.
 *
 * @module renderer/commands/view-commands
 */

import type { Command, CommandId, CommandResult } from '@shared/types/commands';
import { useCommandRegistry } from '../stores/command-registry-store';
import { useUILayoutStore } from '../stores/ui-layout-store';

// =============================================================================
// COMMAND DEFINITIONS
// =============================================================================

const togglePreviewCommand: Command = {
  id: 'view.toggle-preview' as CommandId,
  name: 'Toggle Preview',
  description: 'Show or hide the preview pane',
  category: 'view',
  shortcut: { key: '\\', modifiers: ['Mod'] },
  execute: (): CommandResult => {
    useUILayoutStore.getState().togglePreview();
    return { ok: true };
  },
};

const toggleSidebarCommand: Command = {
  id: 'view.toggle-sidebar' as CommandId,
  name: 'Toggle Sidebar',
  description: 'Show or hide the sidebar',
  category: 'view',
  shortcut: { key: 'b', modifiers: ['Mod', 'Shift'] },
  execute: (): CommandResult => {
    useUILayoutStore.getState().toggleSidebar();
    return { ok: true };
  },
};

const zoomInCommand: Command = {
  id: 'view.zoom-in' as CommandId,
  name: 'Zoom In',
  description: 'Increase zoom level',
  category: 'view',
  shortcut: { key: '=', modifiers: ['Mod'] },
  execute: (): CommandResult => {
    useUILayoutStore.getState().zoomIn();
    return { ok: true };
  },
};

const zoomOutCommand: Command = {
  id: 'view.zoom-out' as CommandId,
  name: 'Zoom Out',
  description: 'Decrease zoom level',
  category: 'view',
  shortcut: { key: '-', modifiers: ['Mod'] },
  execute: (): CommandResult => {
    useUILayoutStore.getState().zoomOut();
    return { ok: true };
  },
};

const resetZoomCommand: Command = {
  id: 'view.reset-zoom' as CommandId,
  name: 'Reset Zoom',
  description: 'Reset zoom to 100%',
  category: 'view',
  shortcut: { key: '0', modifiers: ['Mod'] },
  execute: (): CommandResult => {
    useUILayoutStore.getState().resetZoom();
    return { ok: true };
  },
};

// =============================================================================
// REGISTRATION
// =============================================================================

const VIEW_COMMANDS: readonly Command[] = [
  togglePreviewCommand,
  toggleSidebarCommand,
  zoomInCommand,
  zoomOutCommand,
  resetZoomCommand,
];

/**
 * Register all view commands with the command registry.
 * @returns Unregister function
 */
export function registerViewCommands(): () => void {
  const { register, unregister } = useCommandRegistry.getState();
  const registeredIds: CommandId[] = [];

  for (const command of VIEW_COMMANDS) {
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

export { VIEW_COMMANDS };
