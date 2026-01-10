/**
 * Editor Core API Contract (Spec 002)
 *
 * This file defines the public API surface for the editor component.
 * Implementation MUST conform to these type signatures.
 *
 * @module editor-api
 */

import type {
  EditorState,
  Selection,
  SelectionInfo,
  EditorConfig,
  EditorChange,
} from '@shared/types/editor';

// =============================================================================
// New Types (defined by this spec)
// =============================================================================

/**
 * Structured error event for logging and external consumption.
 */
export interface EditorError {
  /** Category of error */
  readonly type: 'syntax' | 'command' | 'extension';
  /** Human-readable error description */
  readonly message: string;
  /** Unix timestamp (ms) when error occurred */
  readonly timestamp: number;
  /** Optional additional data for debugging */
  readonly context?: Record<string, unknown>;
}

/**
 * Theme configuration for light/dark mode support.
 */
export type EditorTheme = 'light' | 'dark' | 'system';

/**
 * Callback configuration for editor events.
 */
export interface EditorCallbacks {
  /**
   * Called when document content changes (debounced).
   * @param state - Current editor state snapshot
   */
  readonly onChange?: (state: EditorState) => void;

  /**
   * Called when an error occurs.
   * @param error - Structured error information
   */
  readonly onError?: (error: EditorError) => void;

  /**
   * Called when selection/cursor changes.
   * @param selection - Current selection information
   */
  readonly onSelectionChange?: (selection: SelectionInfo) => void;
}

/**
 * Extended configuration for the MDX editor component.
 */
export interface MDXEditorConfig extends EditorConfig {
  /** Theme mode (default: 'system') */
  readonly theme?: EditorTheme;

  /** Debounce delay for onChange in ms (default: 150) */
  readonly debounceMs?: number;

  /** Enable active line highlighting (default: true) */
  readonly highlightActiveLine?: boolean;

  /** Enable bracket matching (default: true) */
  readonly bracketMatching?: boolean;

  /** Enable auto-close brackets (default: true) */
  readonly closeBrackets?: boolean;

  /** Enable indentation guides (default: true) */
  readonly indentationGuides?: boolean;
}

// =============================================================================
// React Component Props
// =============================================================================

/**
 * Props for the MDXEditor React component.
 */
export interface MDXEditorProps extends MDXEditorConfig, EditorCallbacks {
  /** Current document content (controlled) */
  readonly value: string;

  /** Additional CSS class name */
  readonly className?: string;

  /** Editor height (CSS value, default: '100%') */
  readonly height?: string;
}

// =============================================================================
// Hook Return Types
// =============================================================================

/**
 * Return type for useCodeMirror hook.
 */
export interface UseCodeMirrorReturn {
  /** Ref to attach to container div */
  readonly containerRef: React.RefObject<HTMLDivElement | null>;

  /** Current editor state (read-only snapshot) */
  readonly state: EditorState | null;

  /** Current selection info */
  readonly selection: SelectionInfo | null;

  /** Set document content programmatically */
  readonly setValue: (value: string) => void;

  /** Set selection/cursor position */
  readonly setSelection: (anchor: number, head?: number) => void;

  /** Execute a named command */
  readonly executeCommand: (command: EditorCommandName) => boolean;

  /** Focus the editor */
  readonly focus: () => void;

  /** Check if editor is focused */
  readonly isFocused: boolean;
}

// =============================================================================
// Command Types
// =============================================================================

/**
 * Available editor command names for executeCommand().
 *
 * **Formatting Commands:**
 * - `'bold'` (Mod-b) - Toggle bold formatting on selection
 * - `'italic'` (Mod-i) - Toggle italic formatting on selection
 * - `'code'` (Mod-e) - Toggle inline code formatting on selection
 * - `'link'` (Mod-k) - Insert/wrap link at cursor/selection
 *
 * **Heading Commands:**
 * - `'heading1'` (Mod-1) - Convert line to heading level 1
 * - `'heading2'` (Mod-2) - Convert line to heading level 2
 * - `'heading3'` (Mod-3) - Convert line to heading level 3
 *
 * **History Commands:**
 * - `'undo'` (Mod-z) - Undo last change
 * - `'redo'` (Mod-Shift-z) - Redo last undone change
 *
 * **Search Commands:**
 * - `'find'` (Mod-f) - Open find dialog
 * - `'findReplace'` (Mod-Shift-f) - Open find and replace dialog
 * - `'goToLine'` (Mod-g) - Go to line number
 *
 * Note: `Mod` is `Cmd` on macOS and `Ctrl` on Windows/Linux.
 */
export type EditorCommandName =
  | 'bold'
  | 'italic'
  | 'code'
  | 'link'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'undo'
  | 'redo'
  | 'find'
  | 'findReplace'
  | 'goToLine';

/**
 * Command definition for custom commands.
 */
export interface EditorCommandDefinition {
  /** Unique command name */
  readonly name: EditorCommandName;
  /** Keyboard shortcut (e.g., 'Mod-b') */
  readonly key: string;
  /** Human-readable description */
  readonly description: string;
}

/**
 * All supported editor commands with their keybindings.
 */
export const EDITOR_COMMANDS: readonly EditorCommandDefinition[] = [
  { name: 'bold', key: 'Mod-b', description: 'Toggle bold' },
  { name: 'italic', key: 'Mod-i', description: 'Toggle italic' },
  { name: 'code', key: 'Mod-e', description: 'Toggle inline code' },
  { name: 'link', key: 'Mod-k', description: 'Insert link' },
  { name: 'heading1', key: 'Mod-1', description: 'Heading level 1' },
  { name: 'heading2', key: 'Mod-2', description: 'Heading level 2' },
  { name: 'heading3', key: 'Mod-3', description: 'Heading level 3' },
  { name: 'undo', key: 'Mod-z', description: 'Undo' },
  { name: 'redo', key: 'Mod-Shift-z', description: 'Redo' },
  { name: 'find', key: 'Mod-f', description: 'Find in document' },
  { name: 'findReplace', key: 'Mod-Shift-f', description: 'Find and replace' },
  { name: 'goToLine', key: 'Mod-g', description: 'Go to line' },
] as const;

// =============================================================================
// Utility Functions (signatures only)
// =============================================================================

/**
 * Convert CodeMirror state to shared EditorState type.
 * @param cmState - CodeMirror EditorState instance
 * @returns Shared EditorState snapshot
 */
export type StateBridgeFn = (cmState: unknown) => EditorState;

/**
 * Create selection info from anchor/head positions.
 * @param anchor - Selection anchor position
 * @param head - Selection head position
 * @returns Computed selection info
 */
export type CreateSelectionInfoFn = (anchor: number, head: number) => SelectionInfo;

/**
 * Debounce utility function type.
 * @param fn - Function to debounce
 * @param ms - Debounce delay in milliseconds
 * @returns Debounced function
 */
export type DebounceFn = <T extends (...args: never[]) => void>(
  fn: T,
  ms: number
) => (...args: Parameters<T>) => void;
