/**
 * Command palette hook.
 * Manages command palette state, search, and execution.
 *
 * @module renderer/hooks/useCommandPalette
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import type {
  Command,
  CommandId,
  CommandContext,
  CommandResult,
  FuzzyMatchResult,
} from '@shared/types/commands';
import { useCommandRegistry } from '../stores/command-registry-store';
import { useUILayoutStore } from '../stores/ui-layout-store';
import { fuzzySearch } from '../lib/fuzzy-search';

// =============================================================================
// TYPES
// =============================================================================

export interface CommandPaletteState {
  /** Whether the palette is open */
  readonly isOpen: boolean;
  /** Current search query */
  readonly query: string;
  /** Currently selected index in results */
  readonly selectedIndex: number;
  /** Filtered and scored results */
  readonly results: readonly FuzzyMatchResult<Command>[];
  /** Whether a command is currently executing */
  readonly isExecuting: boolean;
}

export interface CommandPaletteActions {
  /** Open the palette */
  open: () => void;
  /** Close the palette */
  close: () => void;
  /** Toggle the palette open/closed */
  toggle: () => void;
  /** Set the search query */
  setQuery: (query: string) => void;
  /** Move selection up */
  selectPrevious: () => void;
  /** Move selection down */
  selectNext: () => void;
  /** Select a specific index */
  selectIndex: (index: number) => void;
  /** Execute the selected command */
  executeSelected: (ctx: CommandContext) => Promise<CommandResult>;
  /** Execute a specific command by ID */
  executeCommand: (id: CommandId, ctx: CommandContext) => Promise<CommandResult>;
  /** Reset state (query and selection) */
  reset: () => void;
}

export type UseCommandPaletteReturn = CommandPaletteState & CommandPaletteActions;

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for managing command palette state and behavior.
 *
 * @example
 * ```tsx
 * function CommandPalette() {
 *   const palette = useCommandPalette();
 *
 *   // Render palette UI
 *   return palette.isOpen ? (
 *     <div>
 *       <input
 *         value={palette.query}
 *         onChange={(e) => palette.setQuery(e.target.value)}
 *       />
 *       <ul>
 *         {palette.results.map((result, i) => (
 *           <li key={result.item.id} aria-selected={i === palette.selectedIndex}>
 *             {result.item.name}
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   ) : null;
 * }
 * ```
 */
export function useCommandPalette(): UseCommandPaletteReturn {
  // ==========================================================================
  // STATE
  // ==========================================================================

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQueryState] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);

  // Get commands from registry
  const getAllCommands = useCommandRegistry((state) => state.getAllCommands);
  const getCommand = useCommandRegistry((state) => state.getCommand);
  const trackRecentCommand = useCommandRegistry((state) => state.trackRecentCommand);
  const getRecentCommands = useCommandRegistry((state) => state.getRecentCommands);

  // ==========================================================================
  // COMPUTED: FILTERED RESULTS
  // ==========================================================================

  const results = useMemo((): readonly FuzzyMatchResult<Command>[] => {
    const allCommands = getAllCommands();

    // Filter out invisible commands
    const visibleCommands = allCommands.filter((cmd) => {
      // If command has visible predicate, we'd check it here
      // For now, all commands are visible
      return true;
    });

    if (!query.trim()) {
      // No query: show recent commands first, then all commands
      const recentEntries = getRecentCommands(5);
      const recentIds = new Set(recentEntries.map((e) => e.commandId));

      // Recent commands at top with high scores
      const recentResults: FuzzyMatchResult<Command>[] = [];
      for (const entry of recentEntries) {
        const cmd = getCommand(entry.commandId);
        if (cmd) {
          recentResults.push({
            item: cmd,
            score: 1000 + entry.useCount, // High score for recent
            matches: [],
          });
        }
      }

      // Remaining commands sorted alphabetically
      const otherCommands = visibleCommands
        .filter((cmd) => !recentIds.has(cmd.id))
        .sort((a, b) => a.name.localeCompare(b.name));

      const otherResults: FuzzyMatchResult<Command>[] = otherCommands.map((cmd) => ({
        item: cmd,
        score: 0,
        matches: [],
      }));

      return [...recentResults, ...otherResults];
    }

    // With query: fuzzy search
    return fuzzySearch(query, visibleCommands, (cmd) => cmd.name);
  }, [query, getAllCommands, getRecentCommands, getCommand]);

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  const open = useCallback(() => {
    setIsOpen(true);
    setQueryState('');
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQueryState('');
    setSelectedIndex(0);
    setIsExecuting(false);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
    setSelectedIndex(0); // Reset selection when query changes
  }, []);

  const selectPrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
  }, [results.length]);

  const selectNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
  }, [results.length]);

  const selectIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < results.length) {
        setSelectedIndex(index);
      }
    },
    [results.length]
  );

  const executeCommand = useCallback(
    async (id: CommandId, ctx: CommandContext): Promise<CommandResult> => {
      const command = getCommand(id);
      if (!command) {
        return { ok: false, error: `Command not found: ${id}` };
      }

      // Check if enabled
      if (command.enabled && !command.enabled(ctx)) {
        return { ok: false, error: `Command is disabled: ${id}` };
      }

      setIsExecuting(true);

      try {
        const result = await command.execute(ctx);

        // Track in recent commands on success
        if (result.ok) {
          trackRecentCommand(id);
        }

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message };
      } finally {
        setIsExecuting(false);
        close();
      }
    },
    [getCommand, trackRecentCommand, close]
  );

  const executeSelected = useCallback(
    async (ctx: CommandContext): Promise<CommandResult> => {
      const selected = results[selectedIndex];
      if (!selected) {
        return { ok: false, error: 'No command selected' };
      }
      return executeCommand(selected.item.id, ctx);
    },
    [results, selectedIndex, executeCommand]
  );

  const reset = useCallback(() => {
    setQueryState('');
    setSelectedIndex(0);
  }, []);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // State
    isOpen,
    query,
    selectedIndex,
    results,
    isExecuting,
    // Actions
    open,
    close,
    toggle,
    setQuery,
    selectPrevious,
    selectNext,
    selectIndex,
    executeSelected,
    executeCommand,
    reset,
  };
}

// =============================================================================
// CONTEXT BUILDER
// =============================================================================

/**
 * Build a CommandContext from current application state.
 * This is a helper to construct the context object for command execution.
 */
export function buildCommandContext(
  editor: import('@codemirror/view').EditorView | null,
  api: import('../../preload/api').MdxpadAPI,
  document: {
    fileId: string | null;
    filePath: string | null;
    content: string;
    isDirty: boolean;
  },
  notify: (notification: import('@shared/types/commands').NotificationInput) => void
): CommandContext {
  const uiState = useUILayoutStore.getState();

  return {
    editor,
    document: {
      fileId: document.fileId,
      filePath: document.filePath,
      content: document.content,
      isDirty: document.isDirty,
    },
    ui: {
      previewVisible: uiState.previewVisible,
      sidebarVisible: uiState.sidebarVisible,
      zoomLevel: uiState.zoomLevel,
    },
    platform: {
      isMac: api.platform.os === 'darwin',
      isWindows: false, // macOS only per constitution
      isLinux: false,
    },
    api,
    notify,
  };
}
