/**
 * EditorPane Component
 *
 * Wrapper component that integrates the MDXEditor with the document store.
 * Provides bidirectional sync between editor content and store state,
 * and exposes cursor position for the StatusBar.
 *
 * @module renderer/components/shell/EditorPane
 */

import { useCallback, memo } from 'react';
import { MDXEditor, type EditorTheme } from '../editor/MDXEditor';
import { useDocumentStore, selectContent } from '@renderer/stores/document-store';
import type { EditorState, SelectionInfo } from '@shared/types/editor';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Cursor position with 1-indexed line and column.
 * Suitable for display in a status bar.
 */
export interface CursorPosition {
  /** 1-indexed line number */
  readonly line: number;
  /** 1-indexed column number */
  readonly column: number;
}

/**
 * Props for the EditorPane component.
 */
export interface EditorPaneProps {
  /** Callback when cursor position changes */
  readonly onCursorChange?: (position: CursorPosition) => void;
  /** Optional className for styling */
  readonly className?: string;
  /** Theme mode for the editor */
  readonly theme?: EditorTheme;
  /** Height of the editor container */
  readonly height?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Converts a document offset to 1-indexed line and column numbers.
 *
 * @param doc - The full document content
 * @param offset - The character offset (0-indexed)
 * @returns CursorPosition with 1-indexed line and column
 */
function offsetToLineColumn(doc: string, offset: number): CursorPosition {
  // Clamp offset to valid range
  const clampedOffset = Math.max(0, Math.min(doc.length, offset));

  // Count lines by finding newlines before the offset
  const textBeforeCursor = doc.slice(0, clampedOffset);
  const lines = textBeforeCursor.split('\n');
  const line = lines.length;

  // Column is the offset from the last newline (1-indexed)
  const lastLine = lines[lines.length - 1] ?? '';
  const column = lastLine.length + 1;

  return { line, column };
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * EditorPane component that wraps MDXEditor with document store integration.
 *
 * This component:
 * 1. Reads content from the document store
 * 2. Updates the document store when content changes
 * 3. Tracks cursor position and reports it via callback
 *
 * @param props - Component props
 * @returns JSX element containing the editor
 *
 * @example
 * ```tsx
 * function App() {
 *   const [cursor, setCursor] = useState({ line: 1, column: 1 });
 *
 *   return (
 *     <div className="editor-container">
 *       <EditorPane
 *         onCursorChange={setCursor}
 *         theme="dark"
 *         className="flex-1"
 *       />
 *       <StatusBar line={cursor.line} column={cursor.column} />
 *     </div>
 *   );
 * }
 * ```
 */
function EditorPaneComponent(props: EditorPaneProps): React.JSX.Element {
  const { onCursorChange, className, theme = 'system', height = '100%' } = props;

  // Connect to document store
  const content = useDocumentStore(selectContent);
  const setContent = useDocumentStore((state) => state.setContent);

  /**
   * Handle content changes from the editor.
   * Updates the document store with the new content.
   */
  const handleChange = useCallback(
    (state: EditorState) => {
      setContent(state.doc);
    },
    [setContent]
  );

  /**
   * Handle selection changes from the editor.
   * Converts the selection to a cursor position and reports it.
   */
  const handleSelectionChange = useCallback(
    (selection: SelectionInfo) => {
      if (!onCursorChange) return;

      // Use the 'from' position (start of selection) for cursor display
      // This represents where the cursor visually appears
      const position = offsetToLineColumn(content, selection.from);
      onCursorChange(position);
    },
    [onCursorChange, content]
  );

  // Build props object, only including className when defined
  // This satisfies exactOptionalPropertyTypes
  const editorProps = {
    value: content,
    onChange: handleChange,
    onSelectionChange: handleSelectionChange,
    theme,
    height,
    lineNumbers: true,
    lineWrapping: false,
    tabSize: 2,
    highlightActiveLine: true,
    bracketMatching: true,
    closeBrackets: true,
    indentationGuides: true,
    ariaLabel: 'MDX Document Editor',
    ...(className !== undefined && { className }),
  };

  return <MDXEditor {...editorProps} />;
}

/**
 * Memoized EditorPane component.
 * Prevents unnecessary re-renders when parent components update.
 */
export const EditorPane = memo(EditorPaneComponent);
EditorPane.displayName = 'EditorPane';

export default EditorPane;
