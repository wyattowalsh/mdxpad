/**
 * EditorPane Component
 *
 * Wrapper component that integrates the MDXEditor with the document store.
 * Provides bidirectional sync between editor content and store state,
 * and exposes cursor position for the StatusBar.
 *
 * @module renderer/components/shell/EditorPane
 */

import { useCallback, memo, useMemo, useRef, useEffect, useSyncExternalStore } from 'react';
import type { EditorView } from '@codemirror/view';
import { MDXEditor, type EditorTheme } from '../editor/MDXEditor';
import { EditorModeToggle } from '../editor/EditorModeToggle';
import { ExternalChangeNotice } from './ExternalChangeNotice';
import { EditorVoiceControl } from '../voice/EditorVoiceControl';
import { WysiwygEditor, type WysiwygEditorHandle } from '../editor/WysiwygEditor';
import { useDocumentStore, selectContent } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';
import {
  selectHighContrastEnabled,
  selectLargeText,
  useAccessibilityStore,
} from '@renderer/stores/accessibility-store';
import { selectEditorMode, useEditorModeStore } from '@renderer/stores/editor-mode-store';
import {
  useEditorPreferencesStore,
  selectKeymapMode,
  selectFontFamily,
  selectFontSize,
  selectLineHeight,
  selectSpellcheckEnabled,
  selectMinimapEnabled,
  selectFocusModeEnabled,
  selectWordWrapEnabled,
  selectDistractionFreeEnabled,
} from '@renderer/stores/editor-preferences-store';
import type { EditorState, SelectionInfo } from '@shared/types/editor';
import { cn } from '@shared/lib/utils';
import { extensionForTheme } from '@renderer/features/plugins/editor-theme';
import { getActiveTheme, subscribeActiveTheme } from '@renderer/features/plugins/theme-manager';
import { useFeatureFlagsStore } from '@renderer/stores/feature-flags-store';

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
  /** Optional ref to receive the CodeMirror EditorView instance */
  readonly editorRef?: React.RefObject<EditorView | null>;
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
  const { onCursorChange, className, theme = 'system', height = '100%', editorRef } = props;

  // Connect to document store
  const content = useDocumentStore(selectContent);
  const filePath = useDocumentStore((state) => state.filePath);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const documentKey = filePath ?? activeTabId ?? 'untitled';
  const setContent = useDocumentStore((state) => state.setContent);
  const keymapMode = useEditorPreferencesStore(selectKeymapMode);
  const fontFamily = useEditorPreferencesStore(selectFontFamily);
  const fontSize = useEditorPreferencesStore(selectFontSize);
  const lineHeight = useEditorPreferencesStore(selectLineHeight);
  const spellcheckEnabled = useEditorPreferencesStore(selectSpellcheckEnabled);
  const minimapEnabled = useEditorPreferencesStore(selectMinimapEnabled);
  const focusModeEnabled = useEditorPreferencesStore(selectFocusModeEnabled);
  const wordWrapEnabled = useEditorPreferencesStore(selectWordWrapEnabled);
  const editorMode = useEditorModeStore(selectEditorMode);
  const wysiwygRef = useRef<WysiwygEditorHandle>(null);
  const insertWysiwygSpeech = useCallback((text: string) => {
    wysiwygRef.current?.insertSpeech(text);
  }, []);
  const distractionFree = useEditorPreferencesStore(selectDistractionFreeEnabled);
  const highContrast = useAccessibilityStore(selectHighContrastEnabled);
  const largeText = useAccessibilityStore(selectLargeText);
  useEffect(() => {
    const dom = editorRef?.current?.dom;
    if (!dom) {
      return;
    }
    dom.classList.toggle('cm-distraction-free', distractionFree);
  }, [distractionFree, editorRef]);
  const pluginThemesEnabled = useFeatureFlagsStore((state) => state.flags.plugin);
  const activeTheme = useSyncExternalStore(subscribeActiveTheme, getActiveTheme);
  const syntaxTheme = useMemo(
    () => (pluginThemesEnabled && activeTheme ? extensionForTheme(activeTheme) : null),
    [pluginThemesEnabled, activeTheme]
  );

  // Use ref to track content for stable callback dependency
  const contentRef = useRef(content);

  // Update ref when content changes
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

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
      const position = offsetToLineColumn(contentRef.current, selection.from);
      onCursorChange(position);
    },
    [onCursorChange]
  );

  // Build props object, only including optional props when defined
  // This satisfies exactOptionalPropertyTypes
  const editorProps = {
    value: content,
    documentKey,
    onChange: handleChange,
    onSelectionChange: handleSelectionChange,
    theme,
    height,
    lineNumbers: true,
    lineWrapping: wordWrapEnabled,
    tabSize: 2,
    highlightActiveLine: true,
    bracketMatching: true,
    closeBrackets: true,
    indentationGuides: true,
    keymapMode,
    enableMinimap: minimapEnabled,
    enableFocusMode: focusModeEnabled,
    enableSpellcheck: spellcheckEnabled,
    fontFamily,
    fontSize: largeText ? 20 : fontSize,
    fontLineHeight: largeText ? 1.6 : lineHeight,
    enableHighContrast: highContrast,
    syntaxTheme,
    ariaLabel: 'MDX Document Editor',
    ...(className !== undefined && { className }),
    ...(editorRef !== undefined && { editorRef }),
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)} style={{ height }}>
      <div className="flex items-center justify-end gap-2 border-b px-2 py-1">
        <EditorVoiceControl
          editorRef={editorMode === 'wysiwyg' ? null : editorRef}
          insertSpeech={editorMode === 'wysiwyg' ? insertWysiwygSpeech : null}
        />
        <EditorModeToggle />
      </div>
      <ExternalChangeNotice />
      {editorMode === 'wysiwyg' ? (
        <WysiwygEditor
          ref={wysiwygRef}
          content={content}
          documentKey={documentKey}
          onChange={setContent}
          {...(onCursorChange !== undefined && { onCursorChange })}
          className="min-h-0 flex-1"
        />
      ) : (
        <MDXEditor {...editorProps} />
      )}
    </div>
  );
}

/**
 * Memoized EditorPane component.
 * Prevents unnecessary re-renders when parent components update.
 */
export const EditorPane = memo(EditorPaneComponent);
EditorPane.displayName = 'EditorPane';

export default EditorPane;
