import { lift, setBlockType, wrapIn } from 'prosemirror-commands';
import type { Command } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { mdxSchema } from './prosemirror-mdx-schema';

function inside(view: EditorView, name: string): boolean {
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === name) {
      return true;
    }
  }
  return false;
}

function apply(view: EditorView, command: Command): boolean {
  const applied = command(view.state, view.dispatch);
  if (applied) {
    view.focus();
  }
  return applied;
}

/** Make the current block a heading, or turn that same heading back into a paragraph. */
export function toggleHeading(view: EditorView, level: number): boolean {
  const parent = view.state.selection.$from.parent;
  const already = parent.type === mdxSchema.nodes.heading && parent.attrs.level === level;
  const command = already
    ? setBlockType(mdxSchema.nodes.paragraph)
    : setBlockType(mdxSchema.nodes.heading, { level });
  return apply(view, command);
}

/** Wrap the current block in a quote, or lift it back out. */
export function toggleBlockquote(view: EditorView): boolean {
  const command = inside(view, 'blockquote') ? lift : wrapIn(mdxSchema.nodes.blockquote);
  return apply(view, command);
}
