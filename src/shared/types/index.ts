/**
 * Shared type definitions.
 * Re-exports types for convenient importing.
 */

// Re-export types from lib
export type { Result } from '../lib/result';
export type { EventMap, EventHandler } from '../lib/events';
export type { IpcChannel, SecurityInfo, IpcPayloads, IpcRequest, IpcResponse } from '../lib/ipc';

// Re-export types from type modules (Spec 001)
export * from './editor';
export * from './errors';
export * from './file';
export * from './preview';
export * from './preview-iframe';
export * from './ipc';
export * from './ui';
export * from './document';

// Re-export command types (excluding Command to avoid conflict with editor.ts)
// Use explicit imports from './commands' for the Command interface
export type {
  CommandId,
  NormalizedShortcut,
  CommandCategory,
  ModifierKey,
  ShortcutBinding,
  CommandResult,
  NotificationType,
  NotificationPriority,
  NotificationInput,
  NotificationAction,
  RecentCommandEntry,
  RecentCommandsList,
  HighlightSegment,
  UILayoutPersisted,
  ShortcutConflict,
  DocumentContext,
  UIContext,
  PlatformContext,
  CommandContext,
  Command as PaletteCommand,
  CommandRuntimeState,
  FuzzyMatchResult,
  CommandPaletteState,
  CommandInput,
  CommandRegistrationResult,
  ExecuteCommandOptions,
  CommandExecutedEvent,
} from './commands';

// Re-export validation helpers and constants from commands
export {
  parseCommandId,
  parseNormalizedShortcut,
  parseRecentCommands,
  parseUILayout,
  STORAGE_KEYS,
  // Schemas for runtime validation
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
} from './commands';

/**
 * Platform information exposed to renderer.
 */
export interface PlatformInfo {
  os: 'darwin'; // macOS only per constitution
  arch: 'arm64' | 'x64';
}

/**
 * Application metadata.
 */
export interface AppInfo {
  name: string;
  version: string;
  platform: PlatformInfo;
}
