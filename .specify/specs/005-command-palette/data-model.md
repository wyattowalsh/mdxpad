# Data Model: Keyboard Shortcuts & Command Palette

**Feature Branch**: `005-command-palette`
**Date**: 2026-01-10
**Spec Reference**: [spec.md](./spec.md)

---

## Core Entities

### Command

Represents an executable action in the application.

```typescript
/**
 * Unique identifier for a command.
 * Branded type for compile-time safety.
 */
export type CommandId = string & { readonly __brand: 'CommandId' };

/**
 * Command category for organization in palette.
 */
export type CommandCategory = 'file' | 'edit' | 'view' | 'format' | 'help';

/**
 * Registered command definition.
 *
 * @example
 * {
 *   id: 'file.save' as CommandId,
 *   name: 'Save',
 *   description: 'Save the current document',
 *   category: 'file',
 *   shortcut: { key: 's', modifiers: ['Mod'] },
 *   execute: async (ctx) => {
 *     const result = await ctx.api.saveFile(ctx.document.fileId, ctx.document.content);
 *     return result.ok ? { ok: true } : { ok: false, error: result.error.message };
 *   },
 *   enabled: (ctx) => ctx.document.isDirty,
 * }
 */
export interface Command {
  /** Unique identifier (e.g., 'file.save', 'edit.bold') */
  readonly id: CommandId;

  /** Display name in command palette */
  readonly name: string;

  /** Optional description shown below name */
  readonly description?: string;

  /** Category for grouping in palette */
  readonly category: CommandCategory;

  /** Optional keyboard shortcut binding */
  readonly shortcut?: ShortcutBinding;

  /** Optional icon identifier (for future use) */
  readonly icon?: string;

  /** Execute function - receives context, returns result */
  readonly execute: (ctx: CommandContext) => CommandResult | Promise<CommandResult>;

  /** Optional predicate - is command enabled? */
  readonly enabled?: (ctx: CommandContext) => boolean;

  /** Optional predicate - is command visible in palette? */
  readonly visible?: (ctx: CommandContext) => boolean;
}
```

---

### CommandContext

Injected context for command execution. Enables testability and multi-window support.

```typescript
/**
 * Context injected into command execute functions.
 * Provides access to editor, stores, document state, and APIs.
 */
export interface CommandContext {
  /** Current editor view (if available) */
  readonly editor: EditorView | null;

  /** Current document state */
  readonly document: {
    readonly fileId: string | null;
    readonly filePath: string | null;
    readonly content: string;
    readonly isDirty: boolean;
  };

  /** UI state */
  readonly ui: {
    readonly previewVisible: boolean;
    readonly sidebarVisible: boolean;
    readonly zoomLevel: number;
  };

  /** Platform-specific info */
  readonly platform: {
    readonly isMac: boolean;
    readonly isWindows: boolean;
    readonly isLinux: boolean;
  };

  /** Access to IPC API */
  readonly api: MdxpadAPI;

  /** Show notification */
  readonly notify: (notification: NotificationInput) => void;
}
```

---

### CommandResult

Structured result type for command execution.

```typescript
/**
 * Success result from command execution.
 */
export interface CommandResultOk {
  readonly ok: true;
  /** Optional undo function for reversible commands */
  readonly undo?: () => void | Promise<void>;
}

/**
 * Failure result from command execution.
 */
export interface CommandResultError {
  readonly ok: false;
  /** User-friendly error message */
  readonly error: string;
}

/**
 * Discriminated union for command results.
 */
export type CommandResult = CommandResultOk | CommandResultError;
```

---

### ShortcutBinding

Maps a keyboard combination to a command.

```typescript
/**
 * Modifier keys for shortcuts.
 * 'Mod' = Cmd on macOS, Ctrl on Windows/Linux
 */
export type ModifierKey = 'Mod' | 'Ctrl' | 'Shift' | 'Alt' | 'Meta';

/**
 * Keyboard shortcut definition.
 *
 * @example
 * { key: 's', modifiers: ['Mod'] }           // Cmd+S / Ctrl+S
 * { key: 'p', modifiers: ['Mod', 'Shift'] }  // Cmd+Shift+P / Ctrl+Shift+P
 */
export interface ShortcutBinding {
  /** Main key (lowercase letter, number, or special key name) */
  readonly key: string;

  /** Modifier keys required */
  readonly modifiers: readonly ModifierKey[];
}

/**
 * Normalized shortcut string for indexing and display.
 * Format: "Mod+Shift+P" (sorted modifiers + key)
 */
export type NormalizedShortcut = string & { readonly __brand: 'NormalizedShortcut' };
```

---

### ShortcutConflict

Detected conflict when multiple commands bind the same shortcut.

```typescript
/**
 * Represents a shortcut conflict between commands.
 */
export interface ShortcutConflict {
  /** Normalized shortcut string */
  readonly shortcut: NormalizedShortcut;

  /** Command IDs that share this shortcut */
  readonly commandIds: readonly CommandId[];
}
```

---

### RecentCommands

Ordered list of recently executed commands for quick re-access.

```typescript
/**
 * Entry in the recent commands list.
 */
export interface RecentCommandEntry {
  /** Command ID that was executed */
  readonly commandId: CommandId;

  /** Unix timestamp of last execution */
  readonly lastUsed: number;

  /** Number of times executed */
  readonly useCount: number;
}

/**
 * Recent commands configuration.
 */
export interface RecentCommandsConfig {
  /** Maximum entries to store */
  readonly maxEntries: number;

  /** localStorage key for persistence */
  readonly storageKey: string;
}

// Default: max 5 recent, stored in 'mdxpad:recent-commands'
```

---

### CommandRegistry (Store State)

Singleton store holding all registered commands.

```typescript
/**
 * Runtime state for a registered command.
 */
export interface CommandRuntimeState {
  /** Is the command currently enabled? */
  readonly enabled: boolean;

  /** Is the command visible in palette? */
  readonly visible: boolean;

  /** Is the command currently executing? (async commands) */
  readonly executing: boolean;
}

/**
 * Command registry store state.
 */
export interface CommandRegistryState {
  /** All registered commands by ID */
  readonly commands: ReadonlyMap<CommandId, Command>;

  /** Runtime state per command */
  readonly runtimeStates: ReadonlyMap<CommandId, CommandRuntimeState>;

  /** Shortcut -> CommandId index for lookup */
  readonly shortcutIndex: ReadonlyMap<NormalizedShortcut, CommandId>;

  /** Detected shortcut conflicts */
  readonly conflicts: readonly ShortcutConflict[];

  /** Recent commands (persisted to localStorage) */
  readonly recentCommands: readonly RecentCommandEntry[];
}

/**
 * Command registry store actions.
 */
export interface CommandRegistryActions {
  /** Register a command (warns on conflict) */
  register: (command: Command) => void;

  /** Unregister a command */
  unregister: (id: CommandId) => void;

  /** Execute a command by ID */
  execute: (id: CommandId) => Promise<CommandResult>;

  /** Update runtime state */
  setEnabled: (id: CommandId, enabled: boolean) => void;
  setVisible: (id: CommandId, visible: boolean) => void;

  /** Get command by shortcut */
  getByShortcut: (shortcut: NormalizedShortcut) => Command | undefined;

  /** Record command usage (updates recent list) */
  recordUsage: (id: CommandId) => void;

  /** Clear recent commands */
  clearRecent: () => void;
}
```

---

### UILayoutStore (Store State)

UI-only state for panel visibility, separate from compile-focused previewStore.

```typescript
/**
 * UI layout store state.
 */
export interface UILayoutState {
  /** Is preview pane visible? */
  readonly previewVisible: boolean;

  /** Is sidebar visible? (future) */
  readonly sidebarVisible: boolean;

  /** Current zoom level (50-200) */
  readonly zoomLevel: number;
}

/**
 * UI layout store actions.
 */
export interface UILayoutActions {
  /** Toggle preview pane visibility */
  togglePreview: () => void;

  /** Set preview visibility explicitly */
  setPreviewVisible: (visible: boolean) => void;

  /** Toggle sidebar visibility */
  toggleSidebar: () => void;

  /** Set sidebar visibility explicitly */
  setSidebarVisible: (visible: boolean) => void;

  /** Zoom in (increment by 10%, max 200%) */
  zoomIn: () => void;

  /** Zoom out (decrement by 10%, min 50%) */
  zoomOut: () => void;

  /** Reset zoom to 100% */
  resetZoom: () => void;

  /** Set zoom level explicitly */
  setZoomLevel: (level: number) => void;
}
```

---

### Notification

Unified notification model for command feedback.

```typescript
/**
 * Notification type for styling.
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * Notification priority for ordering.
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * User action within a notification.
 */
export interface NotificationAction {
  /** Button label */
  readonly label: string;

  /** Action callback */
  readonly onClick: () => void;

  /** Is this the primary action? */
  readonly primary?: boolean;
}

/**
 * Input for creating a notification.
 */
export interface NotificationInput {
  /** Notification type */
  readonly type: NotificationType;

  /** Main message text */
  readonly message: string;

  /** Optional detailed description */
  readonly description?: string;

  /** Duration in ms (0 = persistent, default 5000) */
  readonly duration?: number;

  /** Priority for ordering */
  readonly priority?: NotificationPriority;

  /** Optional actions */
  readonly actions?: readonly NotificationAction[];

  /** Source identifier for deduplication */
  readonly source?: string;
}

/**
 * Full notification with metadata.
 */
export interface Notification extends NotificationInput {
  /** Unique notification ID */
  readonly id: string;

  /** Creation timestamp */
  readonly createdAt: number;

  /** Is notification dismissed? */
  readonly dismissed: boolean;
}
```

---

### NotificationStore (Store State)

Manages active notifications and history.

```typescript
/**
 * Notification store state.
 */
export interface NotificationStoreState {
  /** Active notifications (visible) */
  readonly notifications: readonly Notification[];

  /** Notification history (all, for potential NotificationCenter) */
  readonly history: readonly Notification[];
}

/**
 * Notification store configuration.
 */
export interface NotificationStoreConfig {
  /** Max visible notifications */
  readonly maxVisible: number;

  /** Max history entries */
  readonly maxHistory: number;
}

/**
 * Notification store actions.
 */
export interface NotificationStoreActions {
  /** Show a new notification */
  show: (input: NotificationInput) => string; // Returns notification ID

  /** Dismiss a notification */
  dismiss: (id: string) => void;

  /** Dismiss all notifications */
  dismissAll: () => void;

  /** Clear history */
  clearHistory: () => void;
}
```

---

### FuzzyMatchResult

Result from fuzzy search matching.

```typescript
/**
 * Result of fuzzy matching a query against an item.
 */
export interface FuzzyMatchResult<T> {
  /** The matched item */
  readonly item: T;

  /** Match score (higher = better match) */
  readonly score: number;

  /** Indices of matched characters (for highlighting) */
  readonly matches: readonly number[];
}

/**
 * Segment for rendering highlighted matches.
 */
export interface HighlightSegment {
  /** Text content */
  readonly text: string;

  /** Is this segment a match? */
  readonly isMatch: boolean;
}
```

---

### CommandPaletteState

UI state for the command palette component.

```typescript
/**
 * Command palette UI state.
 */
export interface CommandPaletteState {
  /** Is palette open? */
  readonly isOpen: boolean;

  /** Current search query */
  readonly query: string;

  /** Index of selected item (0-based) */
  readonly selectedIndex: number;

  /** Filtered and scored results */
  readonly results: readonly FuzzyMatchResult<Command>[];
}

/**
 * Command palette actions.
 */
export interface CommandPaletteActions {
  /** Open the palette */
  open: () => void;

  /** Close the palette */
  close: () => void;

  /** Toggle open/closed */
  toggle: () => void;

  /** Update search query */
  setQuery: (query: string) => void;

  /** Move selection up */
  selectPrevious: () => void;

  /** Move selection down */
  selectNext: () => void;

  /** Execute selected command */
  executeSelected: () => Promise<void>;
}
```

---

## Entity Relationships

```
┌─────────────────────┐
│   CommandRegistry   │
│     (Store)         │
├─────────────────────┤
│ commands: Map       │─────┬──────────────────────────┐
│ runtimeStates: Map  │     │                          │
│ shortcutIndex: Map  │─────┼──► ShortcutBinding       │
│ conflicts: []       │     │                          │
│ recentCommands: []  │     ▼                          ▼
└─────────────────────┘  Command ◄───── ShortcutConflict
         │                  │
         │ execute()        │ execute(ctx)
         ▼                  ▼
┌─────────────────────┐  ┌─────────────────┐
│  CommandContext     │  │  CommandResult  │
├─────────────────────┤  ├─────────────────┤
│ editor: EditorView  │  │ ok: boolean     │
│ document: {...}     │  │ undo?: ()=>void │
│ ui: {...}           │  │ error?: string  │
│ api: MdxpadAPI      │  └─────────────────┘
│ notify: (...)=>void │
└─────────────────────┘
         │
         │ notify()
         ▼
┌─────────────────────┐
│ NotificationStore   │
├─────────────────────┤
│ notifications: []   │──► Notification
│ history: []         │
└─────────────────────┘

┌─────────────────────┐
│   UILayoutStore     │
├─────────────────────┤
│ previewVisible      │
│ sidebarVisible      │
│ zoomLevel           │
└─────────────────────┘

┌─────────────────────┐
│  CommandPalette     │
│    (Component)      │
├─────────────────────┤
│ isOpen              │
│ query               │──► FuzzyMatchResult<Command>
│ selectedIndex       │
│ results: []         │
└─────────────────────┘
```

---

## Persistence

| Data | Storage | Key |
|------|---------|-----|
| Recent commands | localStorage | `mdxpad:recent-commands` |
| Zoom level | localStorage | `mdxpad:ui:zoom-level` |
| Preview visibility | localStorage | `mdxpad:ui:preview-visible` |

---

## Validation Schemas (Zod)

See `contracts/command-schemas.ts` for full Zod schema definitions.

```typescript
// Key schemas
export const CommandIdSchema = z.string().brand('CommandId');
export const NormalizedShortcutSchema = z.string().brand('NormalizedShortcut');
export const CommandCategorySchema = z.enum(['file', 'edit', 'view', 'format', 'help']);
export const ShortcutBindingSchema = z.object({
  key: z.string(),
  modifiers: z.array(z.enum(['Mod', 'Ctrl', 'Shift', 'Alt', 'Meta'])),
});
export const CommandResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), undo: z.function().optional() }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
```
