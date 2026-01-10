/**
 * CodeMirror React Integration Hook
 *
 * Provides a React hook for integrating CodeMirror 6 editor with React components.
 * CodeMirror owns all editor state (per Constitution Article III Section 3.4).
 *
 * @see contracts/editor-api.ts UseCodeMirrorReturn interface
 * @see research.md Decision 3 (React Integration Strategy)
 * @module
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState as CMEditorState, Extension } from '@codemirror/state';

import { buildExtensions, type MDXEditorConfig } from './extensions';
import { createThemeListener, type EditorTheme } from './themes';
import { executeCommand as execCmd, markdownKeymap, type EditorCommandName, type OnErrorCallback } from './commands';
import { toEditorState, toSelectionInfo, debounce, type DebouncedFunction } from '../../lib/editor/state-bridge';
import type { EditorError } from '../../lib/editor/errors';
import type { EditorState, SelectionInfo } from '../../../shared/types/editor';

// =============================================================================
// Types
// =============================================================================

/** Configuration options for the useCodeMirror hook. */
export interface UseCodeMirrorOptions {
  readonly initialDoc?: string;
  readonly theme?: EditorTheme;
  readonly lineNumbers?: boolean;
  readonly lineWrapping?: boolean;
  readonly tabSize?: number;
  readonly highlightActiveLine?: boolean;
  readonly bracketMatching?: boolean;
  readonly closeBrackets?: boolean;
  readonly indentationGuides?: boolean;
  readonly debounceMs?: number;
  readonly onChange?: (state: EditorState) => void;
  readonly onSelectionChange?: (selection: SelectionInfo) => void;
  readonly onError?: (error: EditorError) => void;
  /**
   * Custom CodeMirror extensions to add to the editor.
   *
   * These extensions are appended after all built-in extensions, allowing them
   * to override or extend built-in behavior when extension precedence matters.
   *
   * @see MDXEditorConfig.extensions for detailed documentation
   */
  readonly extensions?: Extension[];
}

/** Return value from useCodeMirror hook. */
export interface UseCodeMirrorReturn {
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly state: EditorState | null;
  readonly selection: SelectionInfo | null;
  readonly setValue: (value: string) => void;
  readonly setSelection: (anchor: number, head?: number) => void;
  readonly executeCommand: (command: EditorCommandName) => boolean;
  readonly focus: () => void;
  readonly isFocused: boolean;
  /**
   * Returns the raw CodeMirror EditorView instance, or null if not initialized.
   *
   * **WARNING: This is an escape hatch for advanced use cases only.**
   *
   * Use this when you need direct access to CodeMirror APIs that are not exposed
   * through the hook's provided methods, such as:
   * - Custom transactions or annotations
   * - Direct DOM manipulation within the editor
   * - Advanced plugin/extension development
   * - Performance-critical batch operations
   *
   * **Caveats:**
   * - Direct modifications to the EditorView may conflict with React state management.
   *   The hook's internal state (e.g., `state`, `selection`) may become out of sync
   *   if you dispatch transactions directly without going through the hook's methods.
   * - The view reference may be null before initialization or after unmount.
   * - Prefer using the hook's provided methods (`setValue`, `setSelection`,
   *   `executeCommand`, `focus`) when possible, as they handle state synchronization
   *   correctly.
   *
   * @returns The raw EditorView instance, or null if not initialized
   */
  readonly getView: () => EditorView | null;
}

const DEFAULT_DEBOUNCE_MS = 150;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Builds an extension configuration object from hook options.
 *
 * Extracts editor-specific configuration fields from the hook options and
 * filters out any undefined values to produce a clean partial configuration.
 *
 * @param options - The UseCodeMirrorOptions containing editor configuration settings
 *   such as theme, lineNumbers, lineWrapping, tabSize, and other editor features.
 * @returns A Partial<MDXEditorConfig> containing only the defined configuration
 *   values, with undefined entries filtered out to allow defaults to apply.
 */
function buildExtensionConfig(options: UseCodeMirrorOptions): Partial<MDXEditorConfig> {
  return Object.fromEntries(
    Object.entries({
      theme: options.theme,
      lineNumbers: options.lineNumbers,
      lineWrapping: options.lineWrapping,
      tabSize: options.tabSize,
      highlightActiveLine: options.highlightActiveLine,
      bracketMatching: options.bracketMatching,
      closeBrackets: options.closeBrackets,
      indentationGuides: options.indentationGuides,
      extensions: options.extensions,
    }).filter(([, value]) => value !== undefined)
  );
}

/** Create update listener extension for state synchronization. */
function createUpdateListener(
  setState: React.Dispatch<React.SetStateAction<EditorState | null>>,
  setSelection: React.Dispatch<React.SetStateAction<SelectionInfo | null>>,
  setIsFocused: React.Dispatch<React.SetStateAction<boolean>>,
  debouncedOnChange: DebouncedFunction<(state: EditorState) => void> | undefined,
  onSelectionChange: ((selection: SelectionInfo) => void) | undefined
): Extension {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const newState = toEditorState(update.state);
      setState(newState);
      debouncedOnChange?.call(newState);
    }
    if (update.selectionSet) {
      const { anchor, head } = update.state.selection.main;
      const newSelection = toSelectionInfo(anchor, head);
      setSelection(newSelection);
      onSelectionChange?.(newSelection);
    }
    if (update.focusChanged) {
      setIsFocused(update.view.hasFocus);
    }
  });
}

/** Initialize EditorView and return cleanup function. */
function initializeEditor(
  container: HTMLElement,
  options: UseCodeMirrorOptions,
  setState: React.Dispatch<React.SetStateAction<EditorState | null>>,
  setSelection: React.Dispatch<React.SetStateAction<SelectionInfo | null>>,
  setIsFocused: React.Dispatch<React.SetStateAction<boolean>>,
  viewRef: React.RefObject<EditorView | null>
): () => void {
  const debouncedOnChange = options.onChange
    ? debounce(options.onChange, options.debounceMs ?? DEFAULT_DEBOUNCE_MS)
    : undefined;

  // Get extensions and per-instance theme compartment (fixes singleton issue with multiple editors)
  const { extensions: configExtensions, themeCompartment } = buildExtensions(buildExtensionConfig(options));
  const updateListener = createUpdateListener(
    setState,
    setSelection,
    setIsFocused,
    debouncedOnChange,
    options.onSelectionChange
  );

  const view = new EditorView({
    state: CMEditorState.create({
      doc: options.initialDoc ?? '',
      extensions: [...configExtensions, markdownKeymap, updateListener],
    }),
    parent: container,
  });

  viewRef.current = view;
  setState(toEditorState(view.state));
  const { anchor, head } = view.state.selection.main;
  setSelection(toSelectionInfo(anchor, head));
  setIsFocused(view.hasFocus);

  // Use the per-instance themeCompartment for theme switching
  const cleanupThemeListener = createThemeListener(view, themeCompartment, options.theme ?? 'system');

  return () => {
    debouncedOnChange?.cancel();
    cleanupThemeListener();
    view.destroy();
    viewRef.current = null;
  };
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * React hook for integrating CodeMirror 6 editor.
 *
 * Manages the full lifecycle of a CodeMirror editor instance within a React component,
 * including initialization, state synchronization, theme switching, and cleanup.
 * CodeMirror owns all editor state (per Constitution Article III Section 3.4).
 *
 * @param options - Configuration options for the editor
 *
 * @returns An object containing refs, state, and control methods:
 *   - `containerRef` - React ref to attach to the container `<div>` element where CodeMirror
 *     will mount. Must be attached to a DOM element for the editor to initialize.
 *   - `state` - Current editor state as a readonly snapshot (`EditorState`), or `null` before
 *     initialization. Contains document content, cursor position, and computed metadata.
 *   - `selection` - Current selection info (`SelectionInfo`) with anchor/head positions and
 *     computed properties like `isCollapsed` and `selectedText`, or `null` before initialization.
 *   - `setValue` - Replaces the entire document content. Accepts a string and dispatches a
 *     transaction that replaces all text from position 0 to document end.
 *   - `setSelection` - Sets the cursor position or selection range. Takes an anchor position
 *     and optional head position (defaults to anchor for cursor placement). Positions are
 *     clamped to valid document range.
 *   - `executeCommand` - Executes a named editor command (e.g., 'toggleBold', 'undo').
 *     Returns `true` if the command was executed successfully, `false` otherwise.
 *   - `focus` - Programmatically focuses the editor, bringing keyboard focus to the CodeMirror
 *     instance.
 *   - `isFocused` - Boolean indicating whether the editor currently has keyboard focus.
 *     Updated automatically via CodeMirror's update listener.
 *
 * @example
 * ```tsx
 * function MarkdownEditor() {
 *   const {
 *     containerRef,
 *     state,
 *     selection,
 *     setValue,
 *     setSelection,
 *     executeCommand,
 *     focus,
 *     isFocused,
 *   } = useCodeMirror({
 *     initialDoc: '# Hello World',
 *     theme: 'dark',
 *     lineNumbers: true,
 *     onChange: (newState) => console.log('Content changed:', newState.doc),
 *     onSelectionChange: (sel) => console.log('Selection:', sel),
 *     onError: (err) => console.error('Editor error:', err),
 *   });
 *
 *   return (
 *     <div>
 *       <div className="toolbar">
 *         <button onClick={() => executeCommand('toggleBold')}>Bold</button>
 *         <button onClick={() => executeCommand('undo')}>Undo</button>
 *         <button onClick={focus}>Focus Editor</button>
 *       </div>
 *       <div ref={containerRef} className="editor-container" />
 *       <div className="status-bar">
 *         {state && `Lines: ${state.lineCount} | Chars: ${state.charCount}`}
 *         {selection && ` | Cursor: ${selection.anchor}`}
 *         {isFocused ? ' | Focused' : ' | Blurred'}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCodeMirror(options: UseCodeMirrorOptions = {}): UseCodeMirrorReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onErrorRef = useRef<OnErrorCallback | undefined>(options.onError);
  const [state, setState] = useState<EditorState | null>(null);
  const [selection, setSelectionState] = useState<SelectionInfo | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Keep onError ref in sync with latest callback
  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  /**
   * Editor Initialization Effect - INTENTIONAL EMPTY DEPENDENCY ARRAY
   *
   * This effect creates the CodeMirror EditorView exactly once on mount and destroys
   * it on unmount. The empty dependency array (`[]`) is deliberate and critical to
   * the hook's design.
   *
   * ## Why Config Options Won't Reconfigure After Mount
   *
   * Configuration options passed to `useCodeMirror` (such as `lineNumbers`,
   * `lineWrapping`, `tabSize`, `highlightActiveLine`, `bracketMatching`,
   * `closeBrackets`, `indentationGuides`) are only read during initial EditorView
   * creation. Changing these props after mount will NOT update the editor because:
   *
   * 1. **EditorView is created once**: The EditorView instance is created with
   *    extensions built from the initial options. CodeMirror's extension system
   *    requires explicit reconfiguration via `view.dispatch({ effects: ... })`
   *    with compartment reconfiguration to change extensions at runtime.
   *
   * 2. **Performance by design**: Rebuilding the entire extension stack on every
   *    prop change would be expensive and could cause editor state loss (undo
   *    history, scroll position, etc.).
   *
   * ## Exception: Theme Changes ARE Reactive
   *
   * The `theme` option is the exception—it uses a CodeMirror Compartment
   * (`themeCompartment`) with a listener that responds to system preference
   * changes. Theme switching works because it's explicitly wired up via
   * `createThemeListener()` which dispatches compartment reconfiguration effects.
   *
   * ## If You Need Full Reconfiguration
   *
   * To force a complete editor reconfiguration with new options, use React's `key`
   * prop on the parent component containing the editor:
   *
   * ```tsx
   * // Changing the key forces React to unmount and remount the editor
   * <EditorComponent key={`editor-${configVersion}`} {...newOptions} />
   * ```
   *
   * This unmounts the old editor (triggering cleanup) and mounts a fresh instance
   * with the new configuration. Use sparingly as it resets all editor state
   * including undo history, scroll position, and cursor position.
   *
   * ## Alternative: Extend with More Compartments
   *
   * For options that need runtime reconfiguration, the recommended approach is to:
   * 1. Wrap the relevant extension in a Compartment (like `themeCompartment`)
   * 2. Store the compartment reference
   * 3. Add a useEffect that dispatches compartment reconfiguration on prop changes
   *
   * @see buildExtensions() for how extensions are constructed
   * @see createThemeListener() for an example of compartment-based reconfiguration
   */
  useEffect(() => {
    if (!containerRef.current) return;
    return initializeEditor(
      containerRef.current,
      options,
      setState,
      setSelectionState,
      setIsFocused,
      viewRef
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- INTENTIONAL: Empty deps creates EditorView once on mount. Config options (except theme) are baked into extensions at creation time and won't reconfigure on prop changes. See JSDoc above for full explanation and workarounds.
  }, []);

  const setValue = useCallback((value: string): void => {
    const view = viewRef.current;
    if (!view) return;
    // Skip if content is already identical
    if (view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, []);

  const setSelection = useCallback((anchor: number, head?: number): void => {
    const view = viewRef.current;
    if (!view) return;

    const docLength = view.state.doc.length;
    // Clamp to valid range [0, docLength]
    const clampedAnchor = Math.max(0, Math.min(docLength, anchor));
    const clampedHead = Math.max(0, Math.min(docLength, head ?? anchor));

    view.dispatch({ selection: { anchor: clampedAnchor, head: clampedHead } });
  }, []);

  const executeCommand = useCallback((command: EditorCommandName): boolean => {
    const view = viewRef.current;
    return view ? execCmd(view, command, onErrorRef.current) : false;
  }, []);

  const focus = useCallback((): void => { viewRef.current?.focus(); }, []);

  const getView = useCallback((): EditorView | null => viewRef.current, []);

  return { containerRef, state, selection, setValue, setSelection, executeCommand, focus, isFocused, getView };
}

// Type Re-exports for Consumers
export type { EditorCommandName } from './commands';
export type { EditorTheme } from './themes';
export type { EditorError, EditorErrorType } from '../../lib/editor/errors';
export { isSyntaxError, isCommandError, isExtensionError } from '../../lib/editor/errors';
export type { EditorState, SelectionInfo } from '../../../shared/types/editor';
