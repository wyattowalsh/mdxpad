/**
 * Command System Type Definitions
 *
 * Type definitions for the command registry and palette system.
 * Re-exports Zod-inferred types from contracts and defines runtime interfaces.
 *
 * @module shared/types/commands
 */

import type { EditorView } from '@codemirror/view';
import type { MdxpadAPI } from '../../preload/api';

// =============================================================================
// RE-EXPORTS FROM CONTRACTS
// =============================================================================

/**
 * Re-export all types inferred from Zod schemas in command-schemas.ts.
 * These types are the source of truth for runtime validation.
 */
export type {
  /** Command identifier (branded type: category.action format) */
  CommandId,
  /** Normalized shortcut string (branded type: Mod+Shift+Key format) */
  NormalizedShortcut,
  /** Command category for palette grouping */
  CommandCategory,
  /** Modifier keys for shortcuts */
  ModifierKey,
  /** Keyboard shortcut binding configuration */
  ShortcutBinding,
  /** Discriminated union for command execution results */
  CommandResult,
  /** Notification display type for styling */
  NotificationType,
  /** Notification priority for ordering */
  NotificationPriority,
  /** Input for creating a notification */
  NotificationInput,
  /** Notification action button configuration */
  NotificationAction,
  /** Recent command entry for localStorage persistence */
  RecentCommandEntry,
  /** List of recent commands for localStorage */
  RecentCommandsList,
  /** Highlight segment for rendering matched text in fuzzy search */
  HighlightSegment,
  /** UI layout persisted state */
  UILayoutPersisted,
  /** Shortcut conflict detection result */
  ShortcutConflict,
} from '../../../.specify/specs/005-command-palette/contracts/command-schemas';

/**
 * Re-export validation helpers and storage keys.
 */
export {
  parseCommandId,
  parseNormalizedShortcut,
  parseRecentCommands,
  parseUILayout,
  STORAGE_KEYS,
} from '../../../.specify/specs/005-command-palette/contracts/command-schemas';

/**
 * Re-export schemas for runtime validation at system boundaries.
 */
export {
  CommandIdSchema,
  NormalizedShortcutSchema,
  CommandCategorySchema,
  ModifierKeySchema,
  ShortcutBindingSchema,
  CommandResultSchema,
  NotificationTypeSchema,
  NotificationPrioritySchema,
  NotificationInputSchema,
  NotificationActionSchema,
  RecentCommandEntrySchema,
  RecentCommandsListSchema,
  HighlightSegmentSchema,
  UILayoutPersistedSchema,
  ShortcutConflictSchema,
} from '../../../.specify/specs/005-command-palette/contracts/command-schemas';

// =============================================================================
// COMMAND CONTEXT
// =============================================================================

/**
 * Document state exposed to command execute functions.
 * Provides read-only access to current document information.
 */
export interface DocumentContext {
  /** Unique file identifier (null if unsaved) */
  readonly fileId: string | null;
  /** Absolute file path (null if unsaved) */
  readonly filePath: string | null;
  /** Current document content */
  readonly content: string;
  /** Whether document has unsaved changes */
  readonly isDirty: boolean;
}

/**
 * UI state exposed to command execute functions.
 * Provides read-only access to current UI configuration.
 */
export interface UIContext {
  /** Whether preview pane is visible */
  readonly previewVisible: boolean;
  /** Whether sidebar is visible */
  readonly sidebarVisible: boolean;
  /** Current zoom level (50-200) */
  readonly zoomLevel: number;
}

/**
 * Platform information exposed to command execute functions.
 * Allows platform-specific command behavior.
 */
export interface PlatformContext {
  /** Running on macOS */
  readonly isMac: boolean;
  /** Running on Windows */
  readonly isWindows: boolean;
  /** Running on Linux */
  readonly isLinux: boolean;
}

/**
 * Context injected into command execute functions.
 * Provides access to editor, document, UI state, and platform APIs.
 */
export interface CommandContext {
  /** CodeMirror editor view (null if not mounted) */
  readonly editor: EditorView | null;
  /** Current document state */
  readonly document: DocumentContext;
  /** Current UI configuration */
  readonly ui: UIContext;
  /** Platform detection flags */
  readonly platform: PlatformContext;
  /** Preload API for IPC communication */
  readonly api: MdxpadAPI;
  /** Display a notification to the user */
  readonly notify: (notification: NotificationInput) => void;
}

// =============================================================================
// COMMAND DEFINITION
// =============================================================================

// Import types needed for Command interface
import type {
  CommandId,
  CommandCategory,
  ShortcutBinding,
  CommandResult,
  NotificationInput,
} from '../../../.specify/specs/005-command-palette/contracts/command-schemas';

/**
 * Registered command definition.
 * Immutable configuration for a command in the registry.
 */
export interface Command {
  /** Unique command identifier (category.action format) */
  readonly id: CommandId;
  /** Human-readable command name for display */
  readonly name: string;
  /** Optional longer description for tooltips/help */
  readonly description?: string;
  /** Category for palette grouping */
  readonly category: CommandCategory;
  /** Optional keyboard shortcut binding */
  readonly shortcut?: ShortcutBinding;
  /** Optional icon identifier for UI display */
  readonly icon?: string;
  /**
   * Execute the command action.
   * @param ctx - Command context with access to editor, document, and APIs
   * @returns Result indicating success or failure
   */
  readonly execute: (ctx: CommandContext) => CommandResult | Promise<CommandResult>;
  /**
   * Optional predicate to determine if command is enabled.
   * @param ctx - Command context for state checks
   * @returns true if command can be executed
   */
  readonly enabled?: (ctx: CommandContext) => boolean;
  /**
   * Optional predicate to determine if command is visible.
   * @param ctx - Command context for state checks
   * @returns true if command should appear in palette
   */
  readonly visible?: (ctx: CommandContext) => boolean;
}

// =============================================================================
// RUNTIME STATE
// =============================================================================

/**
 * Runtime state for a registered command.
 * Computed state that changes based on context.
 */
export interface CommandRuntimeState {
  /** Whether command can currently be executed */
  readonly enabled: boolean;
  /** Whether command should appear in UI */
  readonly visible: boolean;
  /** Whether command is currently executing */
  readonly executing: boolean;
}

// =============================================================================
// FUZZY SEARCH
// =============================================================================

/**
 * Fuzzy match result for command search.
 * Generic to support matching different item types.
 *
 * @typeParam T - Type of matched item
 */
export interface FuzzyMatchResult<T> {
  /** The matched item */
  readonly item: T;
  /** Match score (higher is better match) */
  readonly score: number;
  /** Character indices that matched in the searchable text */
  readonly matches: readonly number[];
}

// =============================================================================
// COMMAND PALETTE STATE
// =============================================================================

/**
 * Command palette UI state.
 * Represents the current state of the command palette overlay.
 */
export interface CommandPaletteState {
  /** Whether palette is currently open */
  readonly isOpen: boolean;
  /** Current search query */
  readonly query: string;
  /** Currently selected result index */
  readonly selectedIndex: number;
  /** Filtered and scored command results */
  readonly results: readonly FuzzyMatchResult<Command>[];
}

// =============================================================================
// COMMAND REGISTRATION
// =============================================================================

/**
 * Input for registering a new command.
 * Omits runtime-computed fields from Command.
 */
export type CommandInput = Omit<Command, 'enabled' | 'visible'> & {
  /** Optional predicate to determine if command is enabled */
  readonly enabled?: (ctx: CommandContext) => boolean;
  /** Optional predicate to determine if command is visible */
  readonly visible?: (ctx: CommandContext) => boolean;
};

/**
 * Result of command registration.
 * Returns the registered command or an error message.
 */
export type CommandRegistrationResult =
  | { readonly ok: true; readonly command: Command }
  | { readonly ok: false; readonly error: string };

// =============================================================================
// COMMAND EXECUTION
// =============================================================================

/**
 * Options for command execution.
 */
export interface ExecuteCommandOptions {
  /** Skip enabled check (for internal use) */
  readonly skipEnabledCheck?: boolean;
  /** Track in recent commands history */
  readonly trackRecent?: boolean;
}

/**
 * Event emitted when a command is executed.
 */
export interface CommandExecutedEvent {
  /** Command that was executed */
  readonly commandId: CommandId;
  /** Execution result */
  readonly result: CommandResult;
  /** Execution duration in milliseconds */
  readonly durationMs: number;
  /** Timestamp of execution */
  readonly timestamp: number;
}
