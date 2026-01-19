/**
 * MDXEditor React Component
 *
 * A controlled React component for editing MDX content, built on CodeMirror 6.
 * This component implements the MDXEditorProps interface from contracts/editor-api.ts.
 *
 * @see contracts/editor-api.ts MDXEditorProps interface
 * @see quickstart.md for usage examples
 * @module components/editor/MDXEditor
 */

import { useEffect, useRef, useCallback, useState, useMemo, memo } from 'react';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useCodeMirror, type UseCodeMirrorOptions, type EditorTheme } from '../../hooks/useCodeMirror';
import type { EditorState, SelectionInfo } from '../../../shared/types/editor';
import type { EditorError } from '../../lib/editor/errors';
import { lineHighlightExtension } from '../../lib/editor/line-highlight';
import { placeholderMarkerExtension } from '../../lib/editor/placeholder-markers';

// Re-export for consumer convenience
export type { EditorTheme } from '../../hooks/useCodeMirror';

/**
 * Props for the MDXEditor React component.
 * Combines configuration options, event callbacks, and controlled component props.
 */
export interface MDXEditorProps {
  /** Current document content (controlled). */
  readonly value: string;
  /** Called when document content changes (debounced). */
  readonly onChange?: (state: EditorState) => void;
  /** Called when an error occurs in the editor. */
  readonly onError?: (error: EditorError) => void;
  /** Called when selection or cursor position changes (immediate). */
  readonly onSelectionChange?: (selection: SelectionInfo) => void;
  /** Theme mode: 'light', 'dark', or 'system'. @default 'system' */
  readonly theme?: EditorTheme;
  /** Debounce delay for onChange in milliseconds. @default 150 */
  readonly debounceMs?: number;
  /** Show line numbers. @default true */
  readonly lineNumbers?: boolean;
  /** Enable soft line wrapping. @default false */
  readonly lineWrapping?: boolean;
  /** Number of spaces per tab. @default 2 */
  readonly tabSize?: number;
  /** Highlight the cursor line. @default true */
  readonly highlightActiveLine?: boolean;
  /** Enable bracket matching. @default true */
  readonly bracketMatching?: boolean;
  /** Auto-close brackets and quotes. @default true */
  readonly closeBrackets?: boolean;
  /** Show indentation guides. @default true */
  readonly indentationGuides?: boolean;
  /** Additional CSS class name(s). */
  readonly className?: string;
  /** Editor height as CSS value. @default '100%' */
  readonly height?: string;
  /**
   * Accessible label for the editor container.
   * Used as the aria-label attribute for screen readers.
   * @default 'MDX Editor'
   */
  readonly ariaLabel?: string;
  /**
   * Custom CodeMirror extensions to add to the editor.
   *
   * These extensions are appended after all built-in extensions, allowing them
   * to override or extend built-in behavior when extension precedence matters.
   *
   * @example
   * ```typescript
   * import { EditorView } from '@codemirror/view';
   *
   * const customExtensions = [
   *   EditorView.theme({ '&': { fontSize: '16px' } }),
   * ];
   *
   * <MDXEditor value={content} extensions={customExtensions} />
   * ```
   */
  readonly extensions?: Extension[];
  /**
   * Optional ref to receive the CodeMirror EditorView instance.
   * Use this for external navigation or advanced editor manipulation.
   *
   * @example
   * ```typescript
   * const editorRef = useRef<EditorView | null>(null);
   * <MDXEditor value={content} editorRef={editorRef} />
   * // Later: editorRef.current?.focus()
   * ```
   */
  readonly editorRef?: React.RefObject<EditorView | null>;
}

/**
 * Transforms MDXEditorProps into UseCodeMirrorOptions for the useCodeMirror hook.
 *
 * Extracts configuration options from component props and applies default values
 * for optional settings. Callback handlers (onChange, onError, onSelectionChange)
 * are conditionally included only when provided.
 *
 * @param props - The MDXEditorProps containing editor configuration and callbacks
 * @returns A UseCodeMirrorOptions object with initialDoc set from value, theme and
 *          formatting options with defaults applied, and optional callback handlers
 */
function buildHookOptions(props: MDXEditorProps): UseCodeMirrorOptions {
  const {
    value,
    onChange,
    onError,
    onSelectionChange,
    theme = 'system',
    debounceMs = 150,
    lineNumbers = true,
    lineWrapping = false,
    tabSize = 2,
    highlightActiveLine = true,
    bracketMatching = true,
    closeBrackets = true,
    indentationGuides = true,
    extensions,
  } = props;

  return {
    initialDoc: value,
    theme,
    debounceMs,
    lineNumbers,
    lineWrapping,
    tabSize,
    highlightActiveLine,
    bracketMatching,
    closeBrackets,
    indentationGuides,
    ...(onChange !== undefined && { onChange }),
    ...(onError !== undefined && { onError }),
    ...(onSelectionChange !== undefined && { onSelectionChange }),
    ...(extensions !== undefined && { extensions }),
  };
}

/**
 * MDX Editor component built on CodeMirror 6.
 *
 * A controlled React component providing MDX editing with syntax highlighting,
 * keyboard commands for formatting, find/replace, and theme support.
 *
 * @param props - Component props (see MDXEditorProps)
 * @returns JSX element containing the editor
 *
 * @example
 * ```tsx
 * import { useState, useRef } from 'react';
 * import { MDXEditor } from './MDXEditor';
 * import type { EditorView } from '@codemirror/view';
 *
 * function MyEditor() {
 *   const [content, setContent] = useState('# Hello World');
 *   const editorRef = useRef<EditorView | null>(null);
 *
 *   return (
 *     <MDXEditor
 *       value={content}
 *       onChange={(state) => setContent(state.doc)}
 *       editorRef={editorRef}
 *       theme="dark"
 *       lineNumbers={true}
 *       height="400px"
 *     />
 *   );
 * }
 * ```
 */
/** Duration in milliseconds before clearing the error message from the live region. */
const ERROR_ANNOUNCEMENT_DURATION_MS = 5000;

function MDXEditorComponent(props: MDXEditorProps): React.JSX.Element {
  const { value, onChange, onError, className, height = '100%', ariaLabel = 'MDX Editor', editorRef } = props;
  const isFirstRender = useRef(true);
  const isInternalChange = useRef(false);
  // Track version of external value to prevent race conditions with rapid updates
  const valueVersionRef = useRef(0);
  const lastSyncedVersionRef = useRef(0);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State for ARIA live region error announcements
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Wrap onError to announce errors via ARIA live region
  const wrappedOnError = useCallback(
    (error: EditorError) => {
      // Clear any existing timeout
      if (errorTimeoutRef.current !== null) {
        clearTimeout(errorTimeoutRef.current);
      }

      // Set the error message for the live region
      setErrorMessage(error.message);

      // Call the original onError prop if provided
      onError?.(error);

      // Clear the message after the announcement duration
      errorTimeoutRef.current = setTimeout(() => {
        setErrorMessage(null);
        errorTimeoutRef.current = null;
      }, ERROR_ANNOUNCEMENT_DURATION_MS);
    },
    [onError]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current !== null) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Wrap onChange to track internal changes (user typing)
  const wrappedOnChange = useCallback(
    (state: EditorState) => {
      isInternalChange.current = true;
      onChange?.(state);
    },
    [onChange]
  );

  // Memoize hook options to prevent unnecessary recreations on each render
  const {
    theme = 'system',
    debounceMs = 150,
    lineNumbers = true,
    lineWrapping = false,
    tabSize = 2,
    highlightActiveLine = true,
    bracketMatching = true,
    closeBrackets = true,
    indentationGuides = true,
    onSelectionChange,
    extensions,
  } = props;

  const hookOptions = useMemo(
    () =>
      buildHookOptions({
        value,
        onChange: wrappedOnChange,
        onError: wrappedOnError,
        theme,
        debounceMs,
        lineNumbers,
        lineWrapping,
        tabSize,
        highlightActiveLine,
        bracketMatching,
        closeBrackets,
        indentationGuides,
        ...(onSelectionChange !== undefined && { onSelectionChange }),
        // Always include built-in extensions (line highlight, placeholder markers), plus any user extensions
        extensions: extensions !== undefined
          ? [lineHighlightExtension, placeholderMarkerExtension, ...extensions]
          : [lineHighlightExtension, placeholderMarkerExtension],
      }),
    [
      value,
      wrappedOnChange,
      wrappedOnError,
      onSelectionChange,
      theme,
      debounceMs,
      lineNumbers,
      lineWrapping,
      tabSize,
      highlightActiveLine,
      bracketMatching,
      closeBrackets,
      indentationGuides,
      extensions,
    ]
  );

  const { containerRef, state, setValue, getView } = useCodeMirror(hookOptions);

  // Sync external editorRef with the internal view
  useEffect(() => {
    if (editorRef) {
      // Update editorRef to point to current view
      (editorRef as React.MutableRefObject<EditorView | null>).current = getView();
    }
  }, [editorRef, getView]);

  // Increment version when external value prop changes
  useEffect(() => {
    valueVersionRef.current += 1;
  }, [value]);

  // Sync external value changes to the editor
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      lastSyncedVersionRef.current = valueVersionRef.current;
      return;
    }

    // Skip if this was an internal change (user typing)
    if (isInternalChange.current) {
      isInternalChange.current = false;
      lastSyncedVersionRef.current = valueVersionRef.current;
      return;
    }

    // Skip if we've already synced this version (prevents duplicate updates from rapid changes)
    if (lastSyncedVersionRef.current === valueVersionRef.current) {
      return;
    }

    if (state && value !== state.doc) {
      lastSyncedVersionRef.current = valueVersionRef.current;
      setValue(value);
    }
  }, [value, state, setValue]);

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        style={{ height, overflow: 'auto' }}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
      />
      {/* ARIA live region for error announcements - visually hidden but accessible to screen readers */}
      <div
        role="alert"
        aria-live="assertive"
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {errorMessage}
      </div>
    </>
  );
}

export const MDXEditor = memo(MDXEditorComponent);
MDXEditor.displayName = 'MDXEditor';

export default MDXEditor;
