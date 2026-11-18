import type { ResolvedPos } from 'prosemirror-model';
import { NodeSelection, TextSelection, type Command } from 'prosemirror-state';

const TRAPPED = new Set(['code_block', 'jsx_block', 'table', 'horizontal_rule']);

function atEndOfTable($from: ResolvedPos): boolean {
  let cellDepth = 0;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (name === 'table_cell' || name === 'table_header') {
      cellDepth = depth;
      break;
    }
  }
  if (cellDepth < 2) {
    return false;
  }
  const row = $from.node(cellDepth - 1);
  const table = $from.node(cellDepth - 2);
  const lastRow = $from.index(cellDepth - 2) === table.childCount - 1;
  const lastCell = $from.index(cellDepth - 1) === row.childCount - 1;
  return lastRow && lastCell && $from.parentOffset === $from.parent.content.size;
}

/** The caret is at the end of a final block that has no paragraph after it. */
export function trappedAtDocumentEnd(state: Parameters<Command>[0]): boolean {
  const { selection } = state;
  if (selection instanceof NodeSelection) {
    return selection.node === state.doc.lastChild && TRAPPED.has(selection.node.type.name);
  }
  const { $from, empty } = selection;
  if (!empty || $from.depth < 1 || $from.node(1) !== state.doc.lastChild) {
    return false;
  }
  const name = $from.node(1).type.name;
  if (name === 'code_block' || name === 'jsx_block') {
    return $from.parentOffset === $from.parent.content.size;
  }
  if (name === 'table') {
    return atEndOfTable($from);
  }
  return false;
}

/** Add a paragraph after the final code block, table, or rule. */
export function appendTrailingParagraph(state: Parameters<Command>[0], dispatch: Parameters<Command>[1]): boolean {
  if (!trappedAtDocumentEnd(state)) {
    return false;
  }
  const paragraph = state.schema.nodes.paragraph?.create();
  if (!paragraph) {
    return false;
  }
  if (!dispatch) {
    return true;
  }
  const insertAt = state.doc.content.size;
  const tr = state.tr.insert(insertAt, paragraph);
  const position = Math.min(insertAt + 1, tr.doc.content.size);
  dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(position))).scrollIntoView());
  return true;
}

function leaveTrappedBlock(direction: 'down' | 'right'): Command {
  return (state, dispatch, view) => {
    if (view && !view.endOfTextblock(direction)) {
      return false;
    }
    return appendTrailingParagraph(state, dispatch);
  };
}

/** Arrow keys that continue the document after a trailing block. */
export function trailingBlockKeymap(): Record<string, Command> {
  return {
    ArrowDown: leaveTrappedBlock('down'),
    ArrowRight: leaveTrappedBlock('right'),
  };
}
