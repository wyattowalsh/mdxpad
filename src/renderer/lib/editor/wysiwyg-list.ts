import type { Command } from 'prosemirror-state';
import type { NodeType } from 'prosemirror-model';
import { liftListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import type { EditorView } from 'prosemirror-view';

import { mdxSchema } from './prosemirror-mdx-schema';

export type VisualListKind = 'bullet' | 'ordered';

function listType(kind: VisualListKind): NodeType {
  return kind === 'bullet' ? mdxSchema.nodes.bullet_list : mdxSchema.nodes.ordered_list;
}

function listAroundSelection(view: EditorView): { pos: number; type: NodeType } | null {
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type === mdxSchema.nodes.bullet_list || node.type === mdxSchema.nodes.ordered_list) {
      return { pos: $from.before(depth), type: node.type };
    }
  }
  return null;
}

function listAttrs(kind: VisualListKind, tight: unknown): Record<string, unknown> {
  return kind === 'ordered'
    ? { order: 1, tight: tight !== false, delimiter: '.' }
    : { tight: tight !== false, marker: '-' };
}

function run(view: EditorView, command: Command): boolean {
  const applied = command(view.state, view.dispatch);
  if (applied) {
    view.focus();
  }
  return applied;
}

/** Turn the current block into a list, switch its marker, or lift it back out. */
export function toggleVisualList(view: EditorView, kind: VisualListKind): boolean {
  const type = listType(kind);
  const current = listAroundSelection(view);
  if (current?.type === type) {
    return run(view, liftListItem(mdxSchema.nodes.list_item));
  }
  if (current) {
    const node = view.state.doc.nodeAt(current.pos);
    if (!node) {
      return false;
    }
    view.dispatch(
      view.state.tr.setNodeMarkup(current.pos, type, listAttrs(kind, node.attrs.tight)).scrollIntoView()
    );
    view.focus();
    return true;
  }
  return run(view, wrapInList(type));
}

/** Enter inside a list item starts the next item. */
export function visualListKeymap(): Record<string, Command> {
  return {
    Enter: splitListItem(mdxSchema.nodes.list_item),
  };
}
