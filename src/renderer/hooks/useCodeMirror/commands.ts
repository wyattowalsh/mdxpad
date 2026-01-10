/**
 * Keyboard Commands for CodeMirror MDX Editor
 *
 * Implements all markdown/MDX editing commands with keybindings
 * per contracts/editor-api.ts EDITOR_COMMANDS.
 *
 * @module commands
 */

import { keymap, EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { undo, redo } from '@codemirror/commands';
import { openSearchPanel, gotoLine } from '@codemirror/search';
import { createEditorError, type EditorError } from '../../lib/editor/errors';

// =============================================================================
// Types
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
 *
 * Must match EditorCommandName from contracts/editor-api.ts
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
 * Provides metadata for programmatic toolbar building.
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
 * Use this constant for programmatic toolbar building.
 *
 * @example
 * ```typescript
 * import { EDITOR_COMMANDS } from '@renderer/hooks/useCodeMirror';
 *
 * // Build toolbar buttons from command definitions
 * const toolbarItems = EDITOR_COMMANDS.map(cmd => ({
 *   label: cmd.description,
 *   shortcut: cmd.key,
 *   onClick: () => executeCommand(view, cmd.name),
 * }));
 * ```
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

/**
 * CodeMirror command function signature.
 */
type Command = (view: EditorView) => boolean;

// =============================================================================
// Helper Types and Functions for Italic Toggle
// =============================================================================

/** Context strings around a selection for marker detection. */
interface SurroundingContext {
  readonly beforeOne: string;
  readonly afterOne: string;
  readonly beforeTwo: string;
  readonly afterTwo: string;
  readonly beforeThree: string;
  readonly afterThree: string;
}

/** Get surrounding context strings for italic marker detection. */
function getSurroundingContext(view: EditorView, from: number, to: number): SurroundingContext {
  const doc = view.state.doc;
  const len = doc.length;
  return {
    beforeOne: view.state.sliceDoc(Math.max(0, from - 1), from),
    afterOne: view.state.sliceDoc(to, Math.min(len, to + 1)),
    beforeTwo: view.state.sliceDoc(Math.max(0, from - 2), from),
    afterTwo: view.state.sliceDoc(to, Math.min(len, to + 2)),
    beforeThree: view.state.sliceDoc(Math.max(0, from - 3), from),
    afterThree: view.state.sliceDoc(to, Math.min(len, to + 3)),
  };
}

/** Handle italic toggle based on surrounding context (cursor inside markers). */
function handleContextBasedItalic(
  view: EditorView,
  from: number,
  to: number,
  selected: string,
  ctx: SurroundingContext
): boolean {
  if (ctx.beforeThree === '***' && ctx.afterThree === '***') {
    // Remove italic from bold+italic: ***text*** → **text**
    view.dispatch({
      changes: [
        { from: from - 3, to: from, insert: '**' },
        { from: to, to: to + 3, insert: '**' },
      ],
      selection: { anchor: from - 1, head: from - 1 + (to - from) },
    });
    return true;
  }
  if (ctx.beforeTwo === '**' && ctx.afterTwo === '**') {
    // Add italic to bold: **text** → ***text***
    view.dispatch({
      changes: [
        { from: from - 2, to: from, insert: '***' },
        { from: to, to: to + 2, insert: '***' },
      ],
      selection: { anchor: from + 1, head: from + 1 + (to - from) },
    });
    return true;
  }
  if (ctx.beforeOne === '*' && ctx.afterOne === '*' && ctx.beforeTwo !== '**') {
    // Remove italic: *text* → text
    view.dispatch({
      changes: [
        { from: from - 1, to: from, insert: '' },
        { from: to, to: to + 1, insert: '' },
      ],
      selection: { anchor: from - 1, head: from - 1 + (to - from) },
    });
    return true;
  }
  // Add italic markers
  view.dispatch({
    changes: { from, to, insert: `*${selected}*` },
    selection: { anchor: from + 1, head: to + 1 },
  });
  return true;
}

// =============================================================================
// Formatting Commands
// =============================================================================

/**
 * Toggle bold formatting on the current selection.
 * Wraps selection in `**` markers or removes them if already present.
 *
 * @param view - The CodeMirror EditorView instance
 * @returns true if command was handled
 *
 * @example
 * // "hello" becomes "**hello**"
 * // "**hello**" becomes "hello"
 */
const toggleBold: Command = (view: EditorView): boolean => {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  // Check if selection is already bold (wrapped in **)
  if (selected.startsWith('**') && selected.endsWith('**') && selected.length >= 4) {
    // Remove bold markers
    view.dispatch({
      changes: { from, to, insert: selected.slice(2, -2) },
      selection: { anchor: from, head: to - 4 },
    });
  } else {
    // Check if surrounding text contains bold markers
    const beforeStart = Math.max(0, from - 2);
    const afterEnd = Math.min(view.state.doc.length, to + 2);
    const before = view.state.sliceDoc(beforeStart, from);
    const after = view.state.sliceDoc(to, afterEnd);

    if (before === '**' && after === '**') {
      // Remove surrounding bold markers
      view.dispatch({
        changes: [
          { from: beforeStart, to: from, insert: '' },
          { from: to, to: afterEnd, insert: '' },
        ],
        selection: { anchor: beforeStart, head: beforeStart + (to - from) },
      });
    } else {
      // Add bold markers
      view.dispatch({
        changes: { from, to, insert: `**${selected}**` },
        selection: { anchor: from + 2, head: to + 2 },
      });
    }
  }
  return true;
};

/**
 * Toggle italic formatting on the current selection.
 * Wraps selection in `*` markers or removes them if already present.
 * Handles bold+italic combinations (***text***) correctly.
 *
 * @param view - The CodeMirror EditorView instance
 * @returns true if command was handled
 *
 * @example
 * // "hello" becomes "*hello*"
 * // "*hello*" becomes "hello"
 * // "**hello**" becomes "***hello***" (add italic to bold)
 * // "***hello***" becomes "**hello**" (remove italic from bold+italic)
 */
const toggleItalic: Command = (view: EditorView): boolean => {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  // Check for bold+italic in selection (***text***)
  if (selected.startsWith('***') && selected.endsWith('***') && selected.length >= 6) {
    view.dispatch({
      changes: { from, to, insert: selected.slice(1, -1) },
      selection: { anchor: from, head: to - 2 },
    });
    return true;
  }

  // Check if selection is italic (single * markers, not bold **)
  if (selected.startsWith('*') && selected.endsWith('*') && selected.length >= 2 && !selected.startsWith('**')) {
    view.dispatch({
      changes: { from, to, insert: selected.slice(1, -1) },
      selection: { anchor: from, head: to - 2 },
    });
    return true;
  }

  // Use context-based detection for cursor inside markers
  const ctx = getSurroundingContext(view, from, to);
  return handleContextBasedItalic(view, from, to, selected, ctx);
};

/**
 * Toggle inline code formatting on the current selection.
 * Wraps selection in backtick markers or removes them if already present.
 *
 * @param view - The CodeMirror EditorView instance
 * @returns true if command was handled
 *
 * @example
 * // "code" becomes "`code`"
 * // "`code`" becomes "code"
 */
const toggleCode: Command = (view: EditorView): boolean => {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  // Check if selection is already code (wrapped in backticks)
  if (selected.startsWith('`') && selected.endsWith('`') && selected.length >= 2) {
    // Remove code markers
    view.dispatch({
      changes: { from, to, insert: selected.slice(1, -1) },
      selection: { anchor: from, head: to - 2 },
    });
  } else {
    // Check if surrounding text contains backticks
    const beforeStart = Math.max(0, from - 1);
    const afterEnd = Math.min(view.state.doc.length, to + 1);
    const before = view.state.sliceDoc(beforeStart, from);
    const after = view.state.sliceDoc(to, afterEnd);

    if (before === '`' && after === '`') {
      // Remove surrounding code markers
      view.dispatch({
        changes: [
          { from: beforeStart, to: from, insert: '' },
          { from: to, to: afterEnd, insert: '' },
        ],
        selection: { anchor: beforeStart, head: beforeStart + (to - from) },
      });
    } else {
      // Add code markers
      view.dispatch({
        changes: { from, to, insert: `\`${selected}\`` },
        selection: { anchor: from + 1, head: to + 1 },
      });
    }
  }
  return true;
};

/**
 * Insert a markdown link at the current selection.
 * If text is selected, it becomes the link text.
 * If no text is selected, inserts a placeholder link.
 *
 * @param view - The CodeMirror EditorView instance
 * @returns true if command was handled
 *
 * @example
 * // "example" becomes "[example](url)"
 * // Empty selection becomes "[link text](url)"
 */
const insertLink: Command = (view: EditorView): boolean => {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected.length > 0) {
    // Wrap selection as link text
    const linkText = `[${selected}](url)`;
    view.dispatch({
      changes: { from, to, insert: linkText },
      // Position cursor at "url" for immediate editing
      selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
    });
  } else {
    // Insert placeholder link
    const placeholder = '[link text](url)';
    view.dispatch({
      changes: { from, to, insert: placeholder },
      // Select "link text" for immediate replacement
      selection: { anchor: from + 1, head: from + 10 },
    });
  }
  return true;
};

// =============================================================================
// Heading Commands
// =============================================================================

/**
 * Factory function to create heading commands for different levels.
 * Toggles the specified heading level on the current line.
 * If the line already has the same heading level, removes it.
 * If the line has a different heading level, replaces it.
 *
 * @param level - Heading level (1-6)
 * @returns Command function
 *
 * @example
 * // "Hello" becomes "# Hello" (level 1)
 * // "## Hello" becomes "### Hello" if level is 3
 * // "# Hello" becomes "Hello" if level is 1 (toggle off)
 */
const setHeading =
  (level: number): Command =>
  (view: EditorView): boolean => {
    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    const prefix = '#'.repeat(level) + ' ';

    // Check for existing heading prefix using RegExp.exec()
    const headingRegex = /^(#{1,6})\s*/;
    const existingMatch = headingRegex.exec(line.text);

    if (existingMatch?.[1]) {
      const existingLevel = existingMatch[1].length;
      const existingPrefix = existingMatch[0];

      if (existingLevel === level) {
        // Toggle off: remove heading prefix
        view.dispatch({
          changes: { from: line.from, to: line.from + existingPrefix.length, insert: '' },
        });
      } else {
        // Replace with new heading level
        view.dispatch({
          changes: { from: line.from, to: line.from + existingPrefix.length, insert: prefix },
        });
      }
    } else {
      // Add heading prefix
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: prefix },
      });
    }
    return true;
  };

/**
 * Set heading level 1 on current line.
 * Keybinding: Mod-1
 */
const setHeading1 = setHeading(1);

/**
 * Set heading level 2 on current line.
 * Keybinding: Mod-2
 */
const setHeading2 = setHeading(2);

/**
 * Set heading level 3 on current line.
 * Keybinding: Mod-3
 */
const setHeading3 = setHeading(3);

// =============================================================================
// History Commands (delegated to @codemirror/commands)
// =============================================================================

/**
 * Undo the last change.
 * Keybinding: Mod-z
 * Delegates to @codemirror/commands undo.
 */
const undoCommand: Command = (view: EditorView): boolean => {
  return undo(view);
};

/**
 * Redo the last undone change.
 * Keybinding: Mod-Shift-z
 * Delegates to @codemirror/commands redo.
 */
const redoCommand: Command = (view: EditorView): boolean => {
  return redo(view);
};

// =============================================================================
// Navigation/Search Commands
// =============================================================================

/**
 * Open the find panel.
 * Keybinding: Mod-f
 * Delegates to @codemirror/search openSearchPanel.
 */
const openFind: Command = (view: EditorView): boolean => {
  return openSearchPanel(view);
};

/**
 * Open the find and replace panel with focus on the replace field.
 * Keybinding: Mod-Shift-f
 * Opens search panel and focuses the replace input for immediate replace operations.
 *
 * Note: CodeMirror 6's default search panel includes both search and replace fields.
 * This command differentiates from `openFind` by focusing the replace field,
 * signaling user intent to perform replace operations.
 */
const openFindReplace: Command = (view: EditorView): boolean => {
  // Open search panel first
  openSearchPanel(view);

  // Focus the replace field after the panel is rendered
  // Use requestAnimationFrame to ensure the DOM is updated
  requestAnimationFrame(() => {
    const panel = view.dom.querySelector('.cm-search');
    if (panel) {
      const replaceInput = panel.querySelector('input[name="replace"]');
      if (replaceInput instanceof HTMLInputElement) {
        replaceInput.focus();
        replaceInput.select();
      }
    }
  });

  return true;
};

/**
 * Open the go to line dialog.
 * Keybinding: Mod-g
 * Delegates to @codemirror/search gotoLine.
 */
const goToLineCommand: Command = (view: EditorView): boolean => {
  return gotoLine(view);
};

// =============================================================================
// Command Registry
// =============================================================================

/**
 * Map of command names to their implementations.
 * Used by executeCommand to dispatch commands by name.
 */
const commandMap: Record<EditorCommandName, Command> = {
  bold: toggleBold,
  italic: toggleItalic,
  code: toggleCode,
  link: insertLink,
  heading1: setHeading1,
  heading2: setHeading2,
  heading3: setHeading3,
  undo: undoCommand,
  redo: redoCommand,
  find: openFind,
  findReplace: openFindReplace,
  goToLine: goToLineCommand,
};

// =============================================================================
// Exports
// =============================================================================

/**
 * Markdown keymap with high precedence to override default bindings.
 * Contains all keybindings for markdown/MDX editing commands.
 *
 * Keybindings:
 * - Mod-b: Toggle bold
 * - Mod-i: Toggle italic
 * - Mod-e: Toggle inline code
 * - Mod-k: Insert link
 * - Mod-1: Heading level 1
 * - Mod-2: Heading level 2
 * - Mod-3: Heading level 3
 * - Mod-z: Undo
 * - Mod-Shift-z: Redo
 * - Mod-f: Find in document
 * - Mod-Shift-f: Find and replace
 * - Mod-g: Go to line
 *
 * Note: "Mod" maps to Cmd on macOS and Ctrl on Windows/Linux.
 */
export const markdownKeymap = Prec.high(
  keymap.of([
    // Formatting
    { key: 'Mod-b', run: toggleBold },
    { key: 'Mod-i', run: toggleItalic },
    { key: 'Mod-e', run: toggleCode },
    { key: 'Mod-k', run: insertLink },
    // Headings
    { key: 'Mod-1', run: setHeading1 },
    { key: 'Mod-2', run: setHeading2 },
    { key: 'Mod-3', run: setHeading3 },
    // History
    { key: 'Mod-z', run: undoCommand },
    { key: 'Mod-Shift-z', run: redoCommand },
    // Navigation/Search
    { key: 'Mod-f', run: openFind },
    { key: 'Mod-Shift-f', run: openFindReplace },
    { key: 'Mod-g', run: goToLineCommand },
  ])
);

/**
 * Error callback type for command execution.
 */
export type OnErrorCallback = (error: EditorError) => void;

/**
 * Execute a command by name with error handling.
 * Allows programmatic execution of editor commands.
 * If the command throws, the error is caught, reported via onError callback,
 * and false is returned.
 *
 * @param view - The CodeMirror EditorView instance
 * @param name - The command name to execute
 * @param onError - Optional callback for error reporting
 * @returns true if command was found and executed successfully, false otherwise
 *
 * @example
 * // Execute bold command programmatically
 * const success = executeCommand(view, 'bold');
 *
 * @example
 * // Execute from toolbar button with error handling
 * onClick={() => executeCommand(editorView, 'heading1', handleError)}
 *
 * @example
 * // Execute with error callback
 * executeCommand(view, 'bold', (error) => {
 *   console.error('Command failed:', error.message);
 * });
 */
export function executeCommand(
  view: EditorView,
  name: EditorCommandName,
  onError?: OnErrorCallback
): boolean {
  const command = commandMap[name];
  try {
    return command(view);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const error = createEditorError(
      'command',
      `Command '${name}' failed: ${errorMessage}`,
      { commandName: name, originalError: err }
    );
    onError?.(error);
    return false;
  }
}

// Re-export the command type for external use
export type { Command };
