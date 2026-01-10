/**
 * Command Registry Store
 * Central registry for all commands with shortcut indexing and recent history.
 * @module renderer/stores/command-registry-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Enable Immer's MapSet plugin to support Map and Set in stores
enableMapSet();

import type {
  Command,
  CommandInput,
  CommandId,
  CommandCategory,
  CommandRegistrationResult,
  NormalizedShortcut,
  RecentCommandEntry,
  ShortcutConflict,
} from '@shared/types/commands';
import {
  STORAGE_KEYS,
  parseRecentCommands,
  parseCommandId,
} from '@shared/types/commands';
import { normalizeShortcut } from '../lib/fuzzy-search';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum number of recent commands to track */
const MAX_RECENT_COMMANDS = 10;

/** Default limit for getRecentCommands */
const DEFAULT_RECENT_LIMIT = 5;

// =============================================================================
// STATE INTERFACE
// =============================================================================

/**
 * Command registry store state interface.
 */
export interface CommandRegistryStoreState {
  /** Registry of all commands indexed by CommandId */
  readonly commands: Map<CommandId, Command>;
  /** Shortcut lookups indexed by normalized shortcut */
  readonly shortcutIndex: Map<NormalizedShortcut, CommandId>;
  /** Recent command history (max 10 entries) */
  readonly recentCommands: RecentCommandEntry[];
}

// =============================================================================
// ACTIONS INTERFACE
// =============================================================================

/**
 * Command registry store actions interface.
 */
export interface CommandRegistryStoreActions {
  /** Register a command in the registry */
  register: (command: CommandInput) => CommandRegistrationResult;
  /** Remove a command from the registry */
  unregister: (id: CommandId) => boolean;
  /** Get a command by ID */
  getCommand: (id: CommandId) => Command | undefined;
  /** Get a command by its shortcut */
  getCommandByShortcut: (shortcut: NormalizedShortcut) => Command | undefined;
  /** Get all registered commands */
  getAllCommands: () => readonly Command[];
  /** Get commands filtered by category */
  getCommandsByCategory: (category: CommandCategory) => readonly Command[];
  /** Detect shortcut conflicts among registered commands */
  detectConflicts: () => readonly ShortcutConflict[];
  /** Track a command in recent history */
  trackRecentCommand: (id: CommandId) => void;
  /** Get recent commands with optional limit */
  getRecentCommands: (limit?: number) => readonly RecentCommandEntry[];
  /** Clear recent command history */
  clearRecentCommands: () => void;
  /** Load recent commands from localStorage */
  loadRecentFromStorage: () => void;
  /** Persist recent commands to localStorage */
  persistRecent: () => void;
}

// =============================================================================
// COMBINED STORE TYPE
// =============================================================================

/**
 * Combined command registry store type.
 */
export type CommandRegistryStore = CommandRegistryStoreState &
  CommandRegistryStoreActions;

// =============================================================================
// INITIAL STATE
// =============================================================================

/**
 * Initial state for the command registry store.
 */
const initialState: CommandRegistryStoreState = {
  commands: new Map(),
  shortcutIndex: new Map(),
  recentCommands: [],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate CommandId format.
 * @param id - The ID to validate
 * @returns true if valid, false otherwise
 */
function isValidCommandId(id: unknown): id is CommandId {
  return parseCommandId(id) !== null;
}

/**
 * Sort recent commands by lastUsed descending.
 * @param entries - Recent command entries to sort
 * @returns Sorted entries (mutates in place for Immer)
 */
function sortRecentByLastUsed(entries: RecentCommandEntry[]): void {
  entries.sort((a, b) => b.lastUsed - a.lastUsed);
}

/**
 * Find index of a command in recent commands list.
 * @param entries - Recent command entries
 * @param id - CommandId to find
 * @returns Index or -1 if not found
 */
function findRecentIndex(entries: readonly RecentCommandEntry[], id: CommandId): number {
  return entries.findIndex((entry) => entry.commandId === id);
}

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

/**
 * Command registry store hook.
 * Central registry for all commands with shortcut indexing and recent history.
 *
 * @example
 * ```tsx
 * const { register, getCommand, getAllCommands } = useCommandRegistry();
 *
 * // Register a command
 * const result = register({
 *   id: 'file.save' as CommandId,
 *   name: 'Save File',
 *   category: 'file',
 *   execute: (ctx) => ({ ok: true }),
 * });
 *
 * // Get all commands for palette
 * const commands = getAllCommands();
 * ```
 */
export const useCommandRegistry = create<CommandRegistryStore>()(
  immer((set, get) => ({
    ...initialState,

    register: (command: CommandInput): CommandRegistrationResult => {
      // Validate CommandId format
      if (!isValidCommandId(command.id)) {
        return { ok: false, error: `Invalid CommandId format: ${command.id}` };
      }

      const state = get();

      // Check for duplicate ID
      if (state.commands.has(command.id)) {
        return { ok: false, error: `Command already registered: ${command.id}` };
      }

      // Create the command object (only include optional props if defined)
      const registeredCommand: Command = {
        id: command.id,
        name: command.name,
        category: command.category,
        execute: command.execute,
        ...(command.description !== undefined && { description: command.description }),
        ...(command.shortcut !== undefined && { shortcut: command.shortcut }),
        ...(command.icon !== undefined && { icon: command.icon }),
        ...(command.enabled !== undefined && { enabled: command.enabled }),
        ...(command.visible !== undefined && { visible: command.visible }),
      };

      // Register the command
      set((draft) => {
        draft.commands.set(command.id, registeredCommand);

        // Index shortcut if present
        if (command.shortcut) {
          const normalized = normalizeShortcut(command.shortcut);
          draft.shortcutIndex.set(normalized, command.id);
        }
      });

      return { ok: true, command: registeredCommand };
    },

    unregister: (id: CommandId): boolean => {
      const state = get();
      const command = state.commands.get(id);

      if (!command) {
        return false;
      }

      set((draft) => {
        // Remove from shortcut index if it has a shortcut
        if (command.shortcut) {
          const normalized = normalizeShortcut(command.shortcut);
          draft.shortcutIndex.delete(normalized);
        }

        // Remove from commands
        draft.commands.delete(id);
      });

      return true;
    },

    getCommand: (id: CommandId): Command | undefined => {
      return get().commands.get(id);
    },

    getCommandByShortcut: (shortcut: NormalizedShortcut): Command | undefined => {
      const state = get();
      const commandId = state.shortcutIndex.get(shortcut);
      if (!commandId) return undefined;
      return state.commands.get(commandId);
    },

    getAllCommands: (): readonly Command[] => {
      return Array.from(get().commands.values());
    },

    getCommandsByCategory: (category: CommandCategory): readonly Command[] => {
      return Array.from(get().commands.values()).filter(
        (cmd) => cmd.category === category
      );
    },

    detectConflicts: (): readonly ShortcutConflict[] => {
      const state = get();
      const shortcutMap = new Map<NormalizedShortcut, CommandId[]>();

      // Group commands by their shortcuts
      for (const command of state.commands.values()) {
        if (command.shortcut) {
          const normalized = normalizeShortcut(command.shortcut);
          const existing = shortcutMap.get(normalized) ?? [];
          existing.push(command.id);
          shortcutMap.set(normalized, existing);
        }
      }

      // Find conflicts (shortcuts with more than one command)
      const conflicts: ShortcutConflict[] = [];
      for (const [shortcut, commandIds] of shortcutMap) {
        if (commandIds.length >= 2) {
          conflicts.push({ shortcut, commandIds });
        }
      }

      return conflicts;
    },

    trackRecentCommand: (id: CommandId): void => {
      set((draft) => {
        const existingIndex = findRecentIndex(draft.recentCommands, id);
        const now = Date.now();

        if (existingIndex >= 0) {
          // Update existing entry (non-null assertion safe due to index check)
          const entry = draft.recentCommands[existingIndex]!;
          entry.lastUsed = now;
          entry.useCount += 1;
        } else {
          // Add new entry
          draft.recentCommands.push({
            commandId: id,
            lastUsed: now,
            useCount: 1,
          });

          // Trim to max size if needed
          if (draft.recentCommands.length > MAX_RECENT_COMMANDS) {
            // Sort first so we remove the oldest
            sortRecentByLastUsed(draft.recentCommands);
            draft.recentCommands.pop();
          }
        }

        // Sort by lastUsed descending
        sortRecentByLastUsed(draft.recentCommands);
      });
    },

    getRecentCommands: (limit: number = DEFAULT_RECENT_LIMIT): readonly RecentCommandEntry[] => {
      const state = get();
      return state.recentCommands.slice(0, limit);
    },

    clearRecentCommands: (): void => {
      set((draft) => {
        draft.recentCommands = [];
      });
    },

    loadRecentFromStorage: (): void => {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.recentCommands);
        if (stored) {
          const parsed = JSON.parse(stored);
          const validated = parseRecentCommands(parsed);
          set((draft) => {
            draft.recentCommands = validated;
            sortRecentByLastUsed(draft.recentCommands);
          });
        }
      } catch {
        // Silently fail on localStorage errors
        // Keep existing state unchanged
      }
    },

    persistRecent: (): void => {
      try {
        const state = get();
        localStorage.setItem(
          STORAGE_KEYS.recentCommands,
          JSON.stringify(state.recentCommands)
        );
      } catch {
        // Silently fail on localStorage errors
      }
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Selector for count of registered commands.
 *
 * @param state - Command registry store state
 * @returns Number of registered commands
 */
export const selectCommandCount = (state: CommandRegistryStore): number =>
  state.commands.size;

/**
 * Selector factory for checking if a command is registered.
 *
 * @param id - CommandId to check
 * @returns Selector function that returns true if command exists
 */
export const selectHasCommand =
  (id: CommandId) =>
  (state: CommandRegistryStore): boolean =>
    state.commands.has(id);
