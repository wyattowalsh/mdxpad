import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { NodeSelection, TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { serializeMdxContent } from './prosemirror-mdx-serializer';

const COMMENT = /^(?:\{\/\*\s?([\s\S]*?)\s?\*\/\}|<!--\s?([\s\S]*?)\s?-->)$/;

interface BlockRange {
  readonly from: number;
  readonly to: number;
  readonly node: ProseMirrorNode;
}

function selectedBlock(state: EditorState): BlockRange | null {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.isBlock) {
    return { from: selection.from, to: selection.to, node: selection.node };
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth - 1).type.name !== 'doc') {
      continue;
    }
    const node = $from.node(depth);
    const from = $from.before(depth);
    return { from, to: from + node.nodeSize, node };
  }
  return null;
}

function blockSource(node: ProseMirrorNode): string {
  if (node.type.name === 'jsx_block') {
    const value = typeof node.attrs.value === 'string' ? node.attrs.value : '';
    if (value.trim().length > 0) {
      return value.trim();
    }
  }
  return serializeMdxContent(mdxSchema.nodes.doc.create(null, node)).trim();
}

function innerComment(source: string): string | null {
  const match = COMMENT.exec(source);
  if (!match) {
    return null;
  }
  return (match[1] ?? match[2] ?? '').trim();
}

function placeCaret(view: EditorView, tr: Transaction): void {
  const position = Math.min(tr.selection.from, tr.doc.content.size);
  view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(position))).scrollIntoView());
  view.focus();
}

function replaceWithMarkdown(view: EditorView, block: BlockRange, markdown: string): void {
  const parsed = parseMdxContent(markdown);
  const content =
    parsed && parsed.childCount > 0 ? parsed.content : mdxSchema.nodes.paragraph.create();
  placeCaret(view, view.state.tr.replaceWith(block.from, block.to, content));
}

/** Wrap the current block in an MDX comment, or restore a commented block. */
export function toggleCommentInView(view: EditorView): boolean {
  const block = selectedBlock(view.state);
  if (!block) {
    return false;
  }
  const source = blockSource(block.node);
  const inner = innerComment(source);
  if (inner !== null) {
    replaceWithMarkdown(view, block, inner);
    return true;
  }
  const wrapped = `{/* ${source} */}`;
  const node = mdxSchema.nodes.jsx_block.create(
    { value: wrapped },
    wrapped.length > 0 ? mdxSchema.text(wrapped) : null
  );
  placeCaret(view, view.state.tr.replaceWith(block.from, block.to, node));
  return true;
}
