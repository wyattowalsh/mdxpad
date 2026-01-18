/**
 * Smart Filtering Command Definitions
 *
 * Command definitions for the file tree filtering system.
 * Integrates with the command registry for keyboard shortcut handling.
 *
 * Feature: 014-smart-filtering
 * @module contracts/filter-commands
 */

import type {
  Command,
  CommandId,
  CommandContext,
  CommandResult,
  ShortcutBinding,
} from '@shared/types/commands';

// =============================================================================
// COMMAND IDENTIFIERS
// =============================================================================

/**
 * Command IDs for filter-related actions.
 * Following category.action naming convention.
 */
export const FILTER_COMMAND_IDS = {
  /** Focus the filter input field */
  focus: 'filter.focus' as CommandId,
  /** Clear the current filter query */
  clear: 'filter.clear' as CommandId,
} as const;

// =============================================================================
// KEYBOARD SHORTCUTS
// =============================================================================

/**
 * Keyboard shortcut for focusing the filter input.
 * Uses Mod+P (matches VS Code's "Quick Open" mental model).
 *
 * Note: Mod+Shift+F was originally specified but conflicts with
 * edit.find-replace command. See research.md for rationale.
 */
export const FILTER_FOCUS_SHORTCUT: ShortcutBinding = {
  key: 'p',
  modifiers: ['Mod'],
};

/**
 * Keyboard shortcut for clearing the filter.
 * Escape key clears filter when input is focused.
 * (Handled by component, not global shortcut)
 */
export const FILTER_CLEAR_SHORTCUT: ShortcutBinding = {
  key: 'Escape',
  modifiers: [],
};

// =============================================================================
// CUSTOM EVENTS
// =============================================================================

/**
 * Custom event names for filter actions.
 * Used for decoupled communication between command handlers and UI components.
 */
export const FILTER_EVENTS = {
  /** Event to trigger focus on filter input */
  focus: 'mdxpad:filter:focus',
  /** Event to trigger filter clear */
  clear: 'mdxpad:filter:clear',
} as const;

/**
 * Type for filter focus event.
 */
export type FilterFocusEvent = CustomEvent<void>;

/**
 * Type for filter clear event.
 */
export type FilterClearEvent = CustomEvent<void>;

// =============================================================================
// COMMAND DEFINITIONS
// =============================================================================

/**
 * Focus Filter Input command.
 * Dispatches a custom event to focus the filter input field.
 *
 * Shortcut: Mod+P
 * Category: view (since it affects UI focus, not file operations)
 */
export const focusFilterCommand: Command = {
  id: FILTER_COMMAND_IDS.focus,
  name: 'Focus File Filter',
  description: 'Focus the file tree filter input for quick file search',
  category: 'view',
  shortcut: FILTER_FOCUS_SHORTCUT,
  execute: (_ctx: CommandContext): CommandResult => {
    window.dispatchEvent(new CustomEvent(FILTER_EVENTS.focus));
    return { ok: true };
  },
  // Always enabled - filter input is always available when file explorer is visible
  enabled: (_ctx: CommandContext): boolean => true,
  visible: (_ctx: CommandContext): boolean => true,
};

/**
 * Clear Filter command.
 * Dispatches a custom event to clear the current filter query.
 *
 * Note: No global shortcut - Escape key is handled locally by the filter input
 * component for better UX (clear on first Escape, blur on second).
 *
 * Category: view (since it affects UI state, not file operations)
 */
export const clearFilterCommand: Command = {
  id: FILTER_COMMAND_IDS.clear,
  name: 'Clear File Filter',
  description: 'Clear the file tree filter and show all files',
  category: 'view',
  // No global shortcut - Escape handled by component
  execute: (_ctx: CommandContext): CommandResult => {
    window.dispatchEvent(new CustomEvent(FILTER_EVENTS.clear));
    return { ok: true };
  },
  // Always enabled - clearing an empty filter is a no-op but valid
  enabled: (_ctx: CommandContext): boolean => true,
  visible: (_ctx: CommandContext): boolean => true,
};

// =============================================================================
// COMMAND COLLECTION
// =============================================================================

/**
 * All filter-related commands for registration with the command registry.
 */
export const FILTER_COMMANDS: readonly Command[] = [
  focusFilterCommand,
  clearFilterCommand,
] as const;

// =============================================================================
// REGISTRATION HELPER
// =============================================================================

/**
 * Type for command registration function.
 * Matches the signature from command-registry-store.
 */
export type RegisterFunction = (command: Command) => { ok: boolean };

/**
 * Type for command unregistration function.
 */
export type UnregisterFunction = (id: CommandId) => void;

/**
 * Register all filter commands with the command registry.
 *
 * @param register - Registration function from command registry
 * @param unregister - Unregistration function from command registry
 * @returns Cleanup function to unregister all commands
 *
 * @example
 * ```ts
 * import { useCommandRegistry } from '../stores/command-registry-store';
 * import { registerFilterCommands } from './filter-commands';
 *
 * // In component or effect:
 * const { register, unregister } = useCommandRegistry.getState();
 * const cleanup = registerFilterCommands(register, unregister);
 *
 * // On unmount:
 * cleanup();
 * ```
 */
export function registerFilterCommands(
  register: RegisterFunction,
  unregister: UnregisterFunction
): () => void {
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

// =============================================================================
// EVENT LISTENER HELPERS
// =============================================================================

/**
 * Add event listener for filter focus event.
 * Returns cleanup function for easy use in useEffect.
 *
 * @param handler - Handler function called when focus is requested
 * @returns Cleanup function to remove the listener
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   return onFilterFocus(() => {
 *     inputRef.current?.focus();
 *   });
 * }, []);
 * ```
 */
export function onFilterFocus(handler: () => void): () => void {
  window.addEventListener(FILTER_EVENTS.focus, handler);
  return () => window.removeEventListener(FILTER_EVENTS.focus, handler);
}

/**
 * Add event listener for filter clear event.
 * Returns cleanup function for easy use in useEffect.
 *
 * @param handler - Handler function called when clear is requested
 * @returns Cleanup function to remove the listener
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   return onFilterClear(() => {
 *     setQuery('');
 *   });
 * }, []);
 * ```
 */
export function onFilterClear(handler: () => void): () => void {
  window.addEventListener(FILTER_EVENTS.clear, handler);
  return () => window.removeEventListener(FILTER_EVENTS.clear, handler);
}
