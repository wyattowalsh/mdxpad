import type { Node as ProseMirrorNode, NodeType } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
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

const enterListItem: Command = (state, dispatch, view) => {
  const item = mdxSchema.nodes.list_item;
  if (splitListItem(item)(state, dispatch, view)) {
    return true;
  }
  const { $from, $to } = state.selection;
  const parent = $from.depth > 0 ? $from.node(-1) : null;
  const emptyAtEnd =
    $from.sameParent($to) &&
    $from.parent.content.size === 0 &&
    parent?.type === item &&
    parent.childCount === $from.indexAfter(-1);
  if (!emptyAtEnd) {
    return false;
  }
  return liftListItem(item)(state, dispatch, view);
};

function nodesCanJoin(doc: ProseMirrorNode, pos: number): boolean {
  const $pos = doc.resolve(pos);
  const before = $pos.nodeBefore;
  const after = $pos.nodeAfter;
  return Boolean(before && after && before.type.compatibleContent(after.type));
}

const joinListItemBackward: Command = (state, dispatch, view) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset !== 0 || $from.depth < 2) {
    return false;
  }
  const item = $from.node(-1);
  const list = $from.node(-2);
  const bullet = list.type === mdxSchema.nodes.bullet_list;
  const ordered = list.type === mdxSchema.nodes.ordered_list;
  if (item.type !== mdxSchema.nodes.list_item || (!bullet && !ordered) || $from.index(-1) !== 0) {
    return false;
  }
  if ($from.index(-2) === 0) {
    return liftListItem(mdxSchema.nodes.list_item)(state, dispatch, view);
  }
  const boundary = $from.before($from.depth - 1);
  if (!nodesCanJoin(state.doc, boundary)) {
    return false;
  }
  if (!dispatch) {
    return true;
  }
  const joinedItems = state.tr.join(boundary);
  const between = joinedItems.mapping.map(boundary);
  const joined = nodesCanJoin(joinedItems.doc, between) ? joinedItems.join(between) : joinedItems;
  dispatch(joined.scrollIntoView());
  return true;
};

/** Enter starts the next item, or leaves the list from an empty item. */
export function visualListKeymap(): Record<string, Command> {
  return {
    Enter: enterListItem,
    Tab: sinkListItem(mdxSchema.nodes.list_item),
    'Shift-Tab': liftListItem(mdxSchema.nodes.list_item),
    Backspace: joinListItemBackward,
  };
}
