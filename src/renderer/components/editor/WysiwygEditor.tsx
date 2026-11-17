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
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import type { MarkType, NodeType } from 'prosemirror-model';
import { mdxSchema } from '../../lib/editor/prosemirror-mdx-schema';
import { parseMdxContent } from '../../lib/editor/prosemirror-mdx-parser';
import { serializeMdxContent } from '../../lib/editor/prosemirror-mdx-serializer';
import { WysiwygToolbar, createDefaultActions } from './WysiwygToolbar';
import type { ToolbarAction } from './WysiwygToolbar';
import { cn } from '@shared/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface WysiwygEditorProps {
  readonly content: string;
  readonly onChange: (content: string) => void;
  readonly className?: string;
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

function documentFromMarkdown(content: string) {
  const doc = parseMdxContent(content) ?? mdxSchema.nodes.doc.createAndFill();
  if (!doc) {
    throw new Error('Could not create a WYSIWYG document');
  }
  return doc;
}

function useEditorView(
  containerRef: React.RefObject<HTMLDivElement | null>,
  content: string,
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
      plugins: [createMdxKeymap(), keymap(baseKeymap)],
    });

    const view = new EditorView(container, {
      state,
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

  // Sync external content changes
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = serializeMdxContent(view.state.doc);
    if (currentContent === content) return;

    const doc = documentFromMarkdown(content);
    const newState = EditorState.create({
      doc,
      plugins: view.state.plugins,
    });
    view.updateState(newState);
    onStateUpdate(newState);
  }, [content, onStateUpdate]);

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
      setBlockType(mdxSchema.nodes.heading, { level })(view.state, view.dispatch);
      view.focus();
    },
    [viewRef]
  );

  const execWrapIn = React.useCallback(
    (nodeName: string) => {
      const view = viewRef.current;
      if (!view) return;
      const nodeType = mdxSchema.nodes[nodeName];
      if (!nodeType) return;
      wrapIn(nodeType)(view.state, view.dispatch);
      view.focus();
    },
    [viewRef]
  );

  return { execMark, execHeading, execWrapIn };
}

function useInsertHandlers(viewRef: React.RefObject<EditorView | null>) {
  const insertHorizontalRule = React.useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const { tr } = view.state;
    view.dispatch(
      tr.replaceSelectionWith(mdxSchema.nodes.horizontal_rule.create()).scrollIntoView()
    );
    view.focus();
  }, [viewRef]);

  const insertLink = React.useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const href = prompt('Enter URL:');
    if (!href) return;
    const { from, to } = view.state.selection;
    const mark = mdxSchema.marks.link.create({ href });
    view.dispatch(view.state.tr.addMark(from, to, mark));
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
    onBulletList: () => fmt.execWrapIn('bullet_list'),
    onOrderedList: () => fmt.execWrapIn('ordered_list'),
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

export const WysiwygEditor: React.FC<WysiwygEditorProps> = ({ content, onChange, className }) => {
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

  const viewRef = useEditorView(containerRef, content, onChangeRef, onStateUpdate);
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
        className="prosemirror-editor flex-1 overflow-auto p-4 focus-within:outline-none [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none"
      />
    </div>
  );
};

WysiwygEditor.displayName = 'WysiwygEditor';
