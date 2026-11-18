/**
 * WYSIWYG Editor Component
 *
 * ProseMirror-based rich text editor for MDX content.
 * Provides toolbar formatting, keyboard shortcuts, and syncs content
 * with the source editor via markdown serialization.
 *
 * @module renderer/components/editor/WysiwygEditor
 */

import * as React from 'react';
import 'katex/dist/katex.min.css';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { history, redo, undo } from 'prosemirror-history';
import { baseKeymap, toggleMark, wrapIn } from 'prosemirror-commands';
import type { MarkType, NodeType } from 'prosemirror-model';
import { mdxSchema } from '../../lib/editor/prosemirror-mdx-schema';
import { serializeMdxContent } from '../../lib/editor/prosemirror-mdx-serializer';
import {
  documentFromMarkdown,
  insertWysiwygLink,
  replaceWysiwygDocument,
} from '../../lib/editor/wysiwyg-document';
import { WysiwygToolbar, createDefaultActions } from './WysiwygToolbar';
import type { ToolbarAction } from './WysiwygToolbar';
import { cn } from '@shared/lib/utils';
import { insertSpeechIntoView } from '../../lib/editor/wysiwyg-speech';
import { insertMarkdownBlock, registerWysiwygInsert } from '../../lib/editor/wysiwyg-insert';
import { focusOutlineInView, registerWysiwygOutline } from '../../lib/editor/wysiwyg-outline';
import {
  focusSourceLineInView,
  registerWysiwygSourceLine,
} from '../../lib/editor/wysiwyg-source-line';
import { registerWysiwygComment, wysiwygCommentAnchor } from '../../lib/editor/wysiwyg-comment';
import { applyVisualEdit, registerWysiwygEdit } from '../../lib/editor/wysiwyg-command';
import { applyVisualWrite, readVisualWrite, registerWysiwygWrite } from '../../lib/editor/wysiwyg-write';
import { toggleBlockquote, toggleHeading } from '../../lib/editor/wysiwyg-block';
import { insertHardBreak } from '../../lib/editor/wysiwyg-break';
import { toggleVisualList, visualListKeymap } from '../../lib/editor/wysiwyg-list';
import { wysiwygSlashPlugin } from '../../lib/editor/wysiwyg-slash';
import { wysiwygTableKeymap } from '../../lib/editor/wysiwyg-table-nav';
import { wysiwygMathPlugin } from '../../lib/editor/wysiwyg-math';
import { WysiwygImageView } from '../../lib/editor/wysiwyg-image';
import { FootnoteJumpView } from '../../lib/editor/prosemirror-footnote-ref';
import { TaskListItemView } from '../../lib/editor/prosemirror-task-item';

// =============================================================================
// TYPES
// =============================================================================

export interface WysiwygEditorProps {
  readonly content: string;
  readonly onChange: (content: string) => void;
  readonly className?: string;
  /** Changing this opens the visual document at the start. */
  readonly documentKey?: string;
}

export interface WysiwygEditorHandle {
  insertSpeech: (text: string) => void;
}

interface ActiveMarks {
  readonly bold: boolean;
  readonly italic: boolean;
  readonly strikethrough: boolean;
  readonly code: boolean;
}

interface ActiveBlocks {
  readonly bulletList: boolean;
  readonly orderedList: boolean;
  readonly blockquote: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if a mark type is active at the current selection.
 */
function isMarkActive(state: EditorState, markType: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) {
    return Boolean(markType.isInSet(state.storedMarks ?? $from.marks()));
  }
  return state.doc.rangeHasMark(from, to, markType);
}

/**
 * Check if a block node type is active at the current selection.
 */
function isBlockActive(state: EditorState, nodeType: NodeType): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type === nodeType) return true;
  }
  return false;
}

/**
 * Create a ProseMirror keymap for markdown shortcuts.
 */
function createMdxKeymap() {
  return keymap({
    'Mod-b': toggleMark(mdxSchema.marks.bold),
    'Mod-i': toggleMark(mdxSchema.marks.italic),
    'Mod-`': toggleMark(mdxSchema.marks.code),
    'Mod-shift-s': toggleMark(mdxSchema.marks.strikethrough),
    'Shift-Enter': insertHardBreak,
    ...visualListKeymap(),
  });
}

function computeActiveMarks(state: EditorState): ActiveMarks {
  return {
    bold: isMarkActive(state, mdxSchema.marks.bold),
    italic: isMarkActive(state, mdxSchema.marks.italic),
    strikethrough: isMarkActive(state, mdxSchema.marks.strikethrough),
    code: isMarkActive(state, mdxSchema.marks.code),
  };
}

function computeActiveBlocks(state: EditorState): ActiveBlocks {
  return {
    bulletList: isBlockActive(state, mdxSchema.nodes.bullet_list),
    orderedList: isBlockActive(state, mdxSchema.nodes.ordered_list),
    blockquote: isBlockActive(state, mdxSchema.nodes.blockquote),
  };
}

// =============================================================================
// HOOKS
// =============================================================================

function useEditorView(
  containerRef: React.RefObject<HTMLDivElement | null>,
  content: string,
  documentKey: string | undefined,
  onChangeRef: React.RefObject<(content: string) => void>,
  onStateUpdate: (state: EditorState) => void
) {
  const viewRef = React.useRef<EditorView | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const doc = documentFromMarkdown(content);
    const state = EditorState.create({
      doc,
      plugins: [
        history(),
        wysiwygSlashPlugin(),
        wysiwygMathPlugin(),
        keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo }),
        wysiwygTableKeymap(),
        createMdxKeymap(),
        keymap(baseKeymap),
      ],
    });

    const view = new EditorView(container, {
      state,
      nodeViews: {
        image: (node) => new WysiwygImageView(node),
        list_item: (node, view, getPos) => new TaskListItemView(node, view, getPos),
        footnote_ref: (node, view) => new FootnoteJumpView(node, view, 'footnote_label'),
        footnote_label: (node, view) => new FootnoteJumpView(node, view, 'footnote_ref'),
      },
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction);
        view.updateState(newState);
        if (transaction.docChanged) {
          onChangeRef.current(serializeMdxContent(newState.doc));
        }
        onStateUpdate(newState);
      },
    });

    viewRef.current = view;
    onStateUpdate(state);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const documentKeyRef = React.useRef(documentKey);
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const openedAnotherFile = documentKeyRef.current !== documentKey;
    documentKeyRef.current = documentKey;
    replaceWysiwygDocument(view, content, openedAnotherFile ? 'start' : 'preserve');
  }, [content, documentKey]);

  return viewRef;
}

function useFormatHandlers(viewRef: React.RefObject<EditorView | null>) {
  const execMark = React.useCallback(
    (markName: string) => {
      const view = viewRef.current;
      if (!view) return;
      const mark = mdxSchema.marks[markName];
      if (!mark) return;
      toggleMark(mark)(view.state, view.dispatch);
      view.focus();
    },
    [viewRef]
  );

  const execHeading = React.useCallback(
    (level: number) => {
      const view = viewRef.current;
      if (!view) return;
      toggleHeading(view, level);
    },
    [viewRef]
  );

  const execWrapIn = React.useCallback(
    (nodeName: string) => {
      const view = viewRef.current;
      if (!view) return;
      const nodeType = mdxSchema.nodes[nodeName];
      if (!nodeType) return;
      if (nodeName === 'blockquote') {
        toggleBlockquote(view);
        return;
      }
      wrapIn(nodeType)(view.state, view.dispatch);
      view.focus();
    },
    [viewRef]
  );

  const execList = React.useCallback(
    (kind: 'bullet' | 'ordered') => {
      const view = viewRef.current;
      if (!view) return;
      toggleVisualList(view, kind);
    },
    [viewRef]
  );

  return { execMark, execHeading, execWrapIn, execList };
}

function useInsertHandlers(viewRef: React.RefObject<EditorView | null>) {
  const insertHorizontalRule = React.useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    insertMarkdownBlock(view, '---');
    view.focus();
  }, [viewRef]);

  const insertLink = React.useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const href = prompt('Enter URL:');
    if (!href) return;
    insertWysiwygLink(view, href);
    view.focus();
  }, [viewRef]);

  const insertImage = React.useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const src = prompt('Enter image URL:');
    if (!src) return;
    const alt = prompt('Enter alt text:') ?? '';
    const node = mdxSchema.nodes.image.create({ src, alt });
    view.dispatch(view.state.tr.replaceSelectionWith(node));
    view.focus();
  }, [viewRef]);

  return { insertHorizontalRule, insertLink, insertImage };
}

// =============================================================================
// COMPONENT
// =============================================================================

function buildToolbarActions(
  fmt: ReturnType<typeof useFormatHandlers>,
  ins: ReturnType<typeof useInsertHandlers>,
  marks: ActiveMarks,
  blocks: ActiveBlocks
): ToolbarAction[] {
  return createDefaultActions({
    onBold: () => fmt.execMark('bold'),
    onItalic: () => fmt.execMark('italic'),
    onStrikethrough: () => fmt.execMark('strikethrough'),
    onCode: () => fmt.execMark('code'),
    onHeading: fmt.execHeading,
    onBulletList: () => fmt.execList('bullet'),
    onOrderedList: () => fmt.execList('ordered'),
    onBlockquote: () => fmt.execWrapIn('blockquote'),
    onHorizontalRule: ins.insertHorizontalRule,
    onLink: ins.insertLink,
    onImage: ins.insertImage,
    isBold: marks.bold,
    isItalic: marks.italic,
    isStrikethrough: marks.strikethrough,
    isCode: marks.code,
    isBulletList: blocks.bulletList,
    isOrderedList: blocks.orderedList,
    isBlockquote: blocks.blockquote,
  });
}

export const WysiwygEditor = React.forwardRef<WysiwygEditorHandle, WysiwygEditorProps>(
  function WysiwygEditor({ content, documentKey, onChange, className }, ref) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const onChangeRef = React.useRef(onChange);
    onChangeRef.current = onChange;

    const [activeMarks, setActiveMarks] = React.useState<ActiveMarks>({
      bold: false,
      italic: false,
      strikethrough: false,
      code: false,
    });
    const [activeBlocks, setActiveBlocks] = React.useState<ActiveBlocks>({
      bulletList: false,
      orderedList: false,
      blockquote: false,
    });

    const onStateUpdate = React.useCallback((state: EditorState) => {
      setActiveMarks(computeActiveMarks(state));
      setActiveBlocks(computeActiveBlocks(state));
    }, []);

    const viewRef = useEditorView(containerRef, content, documentKey, onChangeRef, onStateUpdate);
    React.useEffect(() => {
      registerWysiwygInsert((markdown) => {
        const view = viewRef.current;
        return view ? insertMarkdownBlock(view, markdown) : false;
      });
      registerWysiwygOutline((item) => {
        const view = viewRef.current;
        return view ? focusOutlineInView(view, item) : false;
      });
      registerWysiwygSourceLine((line, column) => {
        const view = viewRef.current;
        return view ? focusSourceLineInView(view, line, column) : false;
      });
      registerWysiwygComment(() => {
        const view = viewRef.current;
        if (!view) {
          return null;
        }
        const { from, to } = view.state.selection;
        return wysiwygCommentAnchor(view.state.doc, from, to);
      });
      registerWysiwygEdit((command) => {
        const view = viewRef.current;
        return view ? applyVisualEdit(view, command) : false;
      });
      registerWysiwygWrite({
        read: () => {
          const view = viewRef.current;
          return view ? readVisualWrite(view) : null;
        },
        apply: (expected, next) => {
          const view = viewRef.current;
          return view ? applyVisualWrite(view, expected, next) : false;
        },
      });
      return () => {
        registerWysiwygInsert(null);
        registerWysiwygOutline(null);
        registerWysiwygSourceLine(null);
        registerWysiwygComment(null);
        registerWysiwygEdit(null);
        registerWysiwygWrite(null);
      };
    }, [viewRef]);
    React.useImperativeHandle(
      ref,
      () => ({
        insertSpeech(text: string) {
          const view = viewRef.current;
          if (view) {
            insertSpeechIntoView(view, text);
          }
        },
      }),
      [viewRef]
    );
    const fmt = useFormatHandlers(viewRef);
    const ins = useInsertHandlers(viewRef);

    const toolbarActions = React.useMemo(
      () => buildToolbarActions(fmt, ins, activeMarks, activeBlocks),
      [fmt, ins, activeMarks, activeBlocks]
    );

    return (
      <div className={cn('flex flex-col', className)}>
        <WysiwygToolbar actions={toolbarActions} />
        <div
          ref={containerRef}
          className="prosemirror-editor flex-1 overflow-auto p-4 focus-within:outline-none [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none [&_.wysiwyg-math-source]:text-[0px] [&_.wysiwyg-math]:inline-block [&_.wysiwyg-math-display]:my-2 [&_.wysiwyg-slash]:my-1 [&_.wysiwyg-slash]:flex [&_.wysiwyg-slash]:w-72 [&_.wysiwyg-slash]:flex-col [&_.wysiwyg-slash]:rounded-md [&_.wysiwyg-slash]:border [&_.wysiwyg-slash]:border-zinc-300 [&_.wysiwyg-slash]:bg-white [&_.wysiwyg-slash]:p-1 dark:[&_.wysiwyg-slash]:border-zinc-700 dark:[&_.wysiwyg-slash]:bg-zinc-900 [&_.wysiwyg-slash-item]:px-2 [&_.wysiwyg-slash-item]:py-1 [&_.wysiwyg-slash-item]:text-left [&_.wysiwyg-slash-item[data-selected=true]]:bg-zinc-200 dark:[&_.wysiwyg-slash-item[data-selected=true]]:bg-zinc-800 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-zinc-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-zinc-300 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold dark:[&_td]:border-zinc-700 dark:[&_th]:border-zinc-700"
        />
      </div>
    );
  }
);

WysiwygEditor.displayName = 'WysiwygEditor';
