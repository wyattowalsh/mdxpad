/**
 * Filter Commands
 *
 * Built-in filter commands for the file tree explorer.
 * Provides keyboard shortcuts for filter focus and clear operations.
 *
 * @module renderer/commands/filter-commands
 * Feature: 014-smart-filtering
 */

import type { Command, CommandId, CommandResult } from '@shared/types/commands';
import { useCommandRegistry } from '../stores/command-registry-store';

// =============================================================================
// FILTER EVENTS
// =============================================================================

/**
 * Custom event names for filter actions.
 * Used for decoupled communication between command handlers and UI components.
 */
const FILTER_EVENTS = {
  focus: 'mdxpad:filter:focus',
  clear: 'mdxpad:filter:clear',
} as const;

// =============================================================================
// COMMAND DEFINITIONS
// =============================================================================

/**
 * Focus filter input command.
 *
 * Dispatches a custom event to focus the filter input field.
 * Uses Mod+P (matches VS Code's "Quick Open" mental model).
 */
const focusFilterCommand: Command = {
  id: 'filter.focus' as CommandId,
  name: 'Focus File Filter',
  description: 'Focus the file tree filter input for quick file search',
  category: 'view',
  shortcut: { key: 'p', modifiers: ['Mod'] },
  execute: (): CommandResult => {
    window.dispatchEvent(new CustomEvent(FILTER_EVENTS.focus));
    return { ok: true };
  },
};

/**
 * Clear filter command.
 *
 * Dispatches a custom event to clear the current filter query.
 * No global shortcut - Escape key is handled locally by the filter input.
 */
const clearFilterCommand: Command = {
  id: 'filter.clear' as CommandId,
  name: 'Clear File Filter',
  description: 'Clear the file tree filter and show all files',
  category: 'view',
  // No global shortcut - Escape handled by component
  execute: (): CommandResult => {
    window.dispatchEvent(new CustomEvent(FILTER_EVENTS.clear));
    return { ok: true };
  },
};

// =============================================================================
// REGISTRATION
// =============================================================================

const FILTER_COMMANDS: readonly Command[] = [
  focusFilterCommand,
  clearFilterCommand,
];

/**
 * Register all filter commands with the command registry.
 * @returns Unregister function
 */
export function registerFilterCommands(): () => void {
  const { register, unregister } = useCommandRegistry.getState();
  const registeredIds: CommandId[] = [];

  for (const command of FILTER_COMMANDS) {
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

export { FILTER_COMMANDS, FILTER_EVENTS };
