/**
 * Command System Zod Schemas
 *
 * Runtime validation schemas for the command registry and palette system.
 * These schemas validate data at system boundaries (IPC, localStorage, etc.)
 *
 * @module contracts/command-schemas
 */

import { z } from 'zod';

// =============================================================================
// BRANDED TYPES
// =============================================================================

/**
 * Command identifier schema.
 * Format: category.action (e.g., 'file.save', 'edit.bold')
 */
export const CommandIdSchema = z
  .string()
  .regex(/^[a-z]+\.[a-z][a-z-]*$/, 'CommandId must be category.action format')
  .brand('CommandId');

export type CommandId = z.infer<typeof CommandIdSchema>;

/**
 * Normalized shortcut string schema.
 * Format: Mod+Shift+Key (sorted modifiers + key)
 */
export const NormalizedShortcutSchema = z
  .string()
  .regex(/^(Mod\+)?(Ctrl\+)?(Alt\+)?(Shift\+)?(Meta\+)?[a-zA-Z0-9\\\/\-=\[\]`;',.]$/)
  .brand('NormalizedShortcut');

export type NormalizedShortcut = z.infer<typeof NormalizedShortcutSchema>;

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Command category for palette grouping.
 */
export const CommandCategorySchema = z.enum([
  'file',
  'edit',
  'view',
  'format',
  'help',
]);

export type CommandCategory = z.infer<typeof CommandCategorySchema>;

/**
 * Modifier keys for shortcuts.
 */
export const ModifierKeySchema = z.enum([
  'Mod',   // Cmd on macOS, Ctrl on Windows/Linux
  'Ctrl',
  'Shift',
  'Alt',
  'Meta',
]);

export type ModifierKey = z.infer<typeof ModifierKeySchema>;

/**
 * Notification type for styling.
 */
export const NotificationTypeSchema = z.enum([
  'info',
  'success',
  'warning',
  'error',
]);

export type NotificationType = z.infer<typeof NotificationTypeSchema>;

/**
 * Notification priority for ordering.
 */
export const NotificationPrioritySchema = z.enum([
  'low',
  'normal',
  'high',
  'critical',
]);

export type NotificationPriority = z.infer<typeof NotificationPrioritySchema>;

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Keyboard shortcut binding schema.
 */
export const ShortcutBindingSchema = z.object({
  /** Main key (lowercase letter, number, or special key name) */
  key: z.string().min(1).max(20),
  /** Modifier keys required */
  modifiers: z.array(ModifierKeySchema),
});

export type ShortcutBinding = z.infer<typeof ShortcutBindingSchema>;

/**
 * Success result from command execution.
 */
export const CommandResultOkSchema = z.object({
  ok: z.literal(true),
  /** Optional undo function (not serializable, for runtime only) */
  undo: z.function().optional(),
});

/**
 * Failure result from command execution.
 */
export const CommandResultErrorSchema = z.object({
  ok: z.literal(false),
  /** User-friendly error message */
  error: z.string(),
});

/**
 * Discriminated union for command results.
 */
export const CommandResultSchema = z.discriminatedUnion('ok', [
  CommandResultOkSchema,
  CommandResultErrorSchema,
]);

export type CommandResult = z.infer<typeof CommandResultSchema>;

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

/**
 * Notification action schema.
 */
export const NotificationActionSchema = z.object({
  /** Button label */
  label: z.string().min(1).max(50),
  /** Action callback (runtime only) */
  onClick: z.function(),
  /** Is this the primary action? */
  primary: z.boolean().optional(),
});

export type NotificationAction = z.infer<typeof NotificationActionSchema>;

/**
 * Input for creating a notification.
 */
export const NotificationInputSchema = z.object({
  /** Notification type */
  type: NotificationTypeSchema,
  /** Main message text */
  message: z.string().min(1).max(200),
  /** Optional detailed description */
  description: z.string().max(500).optional(),
  /** Duration in ms (0 = persistent, default 5000) */
  duration: z.number().min(0).max(60000).optional(),
  /** Priority for ordering */
  priority: NotificationPrioritySchema.optional(),
  /** Optional actions (runtime only, not serializable) */
  actions: z.array(NotificationActionSchema).max(3).optional(),
  /** Source identifier for deduplication */
  source: z.string().max(100).optional(),
});

export type NotificationInput = z.infer<typeof NotificationInputSchema>;

// =============================================================================
// PERSISTENCE SCHEMAS
// =============================================================================

/**
 * Recent command entry for localStorage persistence.
 */
export const RecentCommandEntrySchema = z.object({
  /** Command ID that was executed */
  commandId: CommandIdSchema,
  /** Unix timestamp of last execution */
  lastUsed: z.number().int().positive(),
  /** Number of times executed */
  useCount: z.number().int().min(1),
});

export type RecentCommandEntry = z.infer<typeof RecentCommandEntrySchema>;

/**
 * Recent commands list for localStorage.
 */
export const RecentCommandsListSchema = z.array(RecentCommandEntrySchema).max(10);

export type RecentCommandsList = z.infer<typeof RecentCommandsListSchema>;

/**
 * UI layout persisted state.
 */
export const UILayoutPersistedSchema = z.object({
  /** Preview pane visibility */
  previewVisible: z.boolean(),
  /** Zoom level (50-200) */
  zoomLevel: z.number().min(50).max(200),
});

export type UILayoutPersisted = z.infer<typeof UILayoutPersistedSchema>;

// =============================================================================
// SHORTCUT CONFLICT
// =============================================================================

/**
 * Shortcut conflict detection result.
 */
export const ShortcutConflictSchema = z.object({
  /** Normalized shortcut string */
  shortcut: NormalizedShortcutSchema,
  /** Command IDs that share this shortcut */
  commandIds: z.array(CommandIdSchema).min(2),
});

export type ShortcutConflict = z.infer<typeof ShortcutConflictSchema>;

// =============================================================================
// FUZZY SEARCH
// =============================================================================

/**
 * Highlight segment for rendering matched text.
 */
export const HighlightSegmentSchema = z.object({
  /** Text content */
  text: z.string(),
  /** Is this segment a match? */
  isMatch: z.boolean(),
});

export type HighlightSegment = z.infer<typeof HighlightSegmentSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Parse and validate a CommandId string.
 */
export function parseCommandId(value: unknown): CommandId | null {
  const result = CommandIdSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Parse and validate a NormalizedShortcut string.
 */
export function parseNormalizedShortcut(value: unknown): NormalizedShortcut | null {
  const result = NormalizedShortcutSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Parse and validate recent commands from localStorage.
 */
export function parseRecentCommands(value: unknown): RecentCommandsList {
  const result = RecentCommandsListSchema.safeParse(value);
  return result.success ? result.data : [];
}

/**
 * Parse and validate UI layout from localStorage.
 */
export function parseUILayout(value: unknown): UILayoutPersisted | null {
  const result = UILayoutPersistedSchema.safeParse(value);
  return result.success ? result.data : null;
}

// =============================================================================
// STORAGE KEYS
// =============================================================================

/**
 * LocalStorage keys for command system persistence.
 */
export const STORAGE_KEYS = {
  recentCommands: 'mdxpad:recent-commands',
  zoomLevel: 'mdxpad:ui:zoom-level',
  previewVisible: 'mdxpad:ui:preview-visible',
} as const;
