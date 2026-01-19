/**
 * View Commands
 *
 * Built-in view control commands for the command palette.
 * Controls preview pane, sidebar, and zoom level.
 *
 * @module renderer/commands/view-commands
 */

import type { Command, CommandId, CommandResult, CommandContext } from '@shared/types/commands';
import { useCommandRegistry } from '../stores/command-registry-store';
import { useUILayoutStore } from '../stores/ui-layout-store';
import { useSyncStore } from '../stores/sync-store';

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

const toggleOutlineCommand: Command = {
  id: 'view.toggle-outline' as CommandId,
  name: 'Toggle Outline',
  description: 'Show or hide the document outline panel',
  category: 'view',
  shortcut: { key: 'o', modifiers: ['Mod', 'Shift'] },
  execute: (): CommandResult => {
    useUILayoutStore.getState().toggleOutline();
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

/**
 * Toggle preview scroll synchronization command.
 * Feature: 008-bidirectional-sync (T020, T021)
 *
 * Shortcut: Cmd+Shift+Y (macOS) / Ctrl+Shift+Y (Windows/Linux)
 * Shows a 2-second notification with the new sync state (T022).
 */
const toggleSyncCommand: Command = {
  id: 'view.toggle-sync' as CommandId,
  name: 'Toggle Preview Sync',
  description: 'Enable or disable scroll synchronization between editor and preview',
  category: 'view',
  shortcut: { key: 'y', modifiers: ['Mod', 'Shift'] },
  execute: (ctx: CommandContext): CommandResult => {
    const store = useSyncStore.getState();
    store.toggleSync();

    // Persist change to localStorage
    store.persist();

    // Show notification with new state (T022: 2-second duration per FR-052)
    const newState = useSyncStore.getState().mode === 'disabled' ? 'disabled' : 'enabled';
    ctx.notify({
      type: 'info',
      message: `Preview sync ${newState}`,
      duration: 2000,
    });

    return { ok: true };
  },
};

const toggleSettingsCommand: Command = {
  id: 'view.toggle-settings' as CommandId,
  name: 'Open Settings',
  description: 'Open application settings',
  category: 'view',
  shortcut: { key: ',', modifiers: ['Mod'] },
  execute: (): CommandResult => {
    // Dynamic import to avoid circular dependencies
    import('../stores/settings-store').then(({ useSettingsStore }) => {
      useSettingsStore.getState().toggle();
    });
    return { ok: true };
  },
};

// =============================================================================
// REGISTRATION
// =============================================================================

const VIEW_COMMANDS: readonly Command[] = [
  togglePreviewCommand,
  toggleSidebarCommand,
  toggleOutlineCommand,
  zoomInCommand,
  zoomOutCommand,
  resetZoomCommand,
  toggleSyncCommand,
  toggleSettingsCommand,
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
