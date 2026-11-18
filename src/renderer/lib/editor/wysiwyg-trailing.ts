import type { ResolvedPos } from 'prosemirror-model';
import { NodeSelection, TextSelection, type Command } from 'prosemirror-state';

const TRAPPED = new Set([
  'code_block',
  'jsx_block',
  'table',
  'horizontal_rule',
  'blockquote',
  'bullet_list',
  'ordered_list',
]);

function tableCellDepth($from: ResolvedPos): number {
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (name === 'table_cell' || name === 'table_header') {
      return depth;
    }
  }
  return 0;
}

function atEndOfTable($from: ResolvedPos): boolean {
  const cellDepth = tableCellDepth($from);
  if (cellDepth < 2) {
    return false;
  }
  const row = $from.node(cellDepth - 1);
  const table = $from.node(cellDepth - 2);
  const lastRow = $from.index(cellDepth - 2) === table.childCount - 1;
  const lastCell = $from.index(cellDepth - 1) === row.childCount - 1;
  return lastRow && lastCell && $from.parentOffset === $from.parent.content.size;
}

function atQuoteEdge($from: ResolvedPos, edge: 'start' | 'end'): boolean {
  if ($from.node(1).type.name !== 'blockquote') {
    return false;
  }
  const quote = $from.node(1);
  if (edge === 'end') {
    return (
      $from.index(1) === quote.childCount - 1 && $from.parentOffset === $from.parent.content.size
    );
  }
  return $from.index(1) === 0 && $from.parentOffset === 0;
}

function atListEdge($from: ResolvedPos, edge: 'start' | 'end'): boolean {
  const name = $from.node(1).type.name;
  if ((name !== 'bullet_list' && name !== 'ordered_list') || $from.depth < 2) {
    return false;
  }
  const list = $from.node(1);
  const item = $from.node(2);
  if (item.type.name !== 'list_item') {
    return false;
  }
  if (edge === 'end') {
    const lastItem = $from.index(1) === list.childCount - 1;
    const lastBlock = $from.index(2) === item.childCount - 1;
    return lastItem && lastBlock && $from.parentOffset === $from.parent.content.size;
  }
  return $from.index(1) === 0 && $from.index(2) === 0 && $from.parentOffset === 0;
}

function atStartOfTable($from: ResolvedPos): boolean {
  const cellDepth = tableCellDepth($from);
  if (cellDepth < 2) {
    return false;
  }
  const firstRow = $from.index(cellDepth - 2) === 0;
  const firstCell = $from.index(cellDepth - 1) === 0;
  return firstRow && firstCell && $from.parentOffset === 0;
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
  if (name === 'blockquote') {
    return atQuoteEdge($from, 'end');
  }
  if (name === 'bullet_list' || name === 'ordered_list') {
    return atListEdge($from, 'end');
  }
  return false;
}

/** The caret is at the start of a leading block that has no paragraph before it. */
export function trappedAtDocumentStart(state: Parameters<Command>[0]): boolean {
  const { selection } = state;
  if (selection instanceof NodeSelection) {
    return selection.node === state.doc.firstChild && TRAPPED.has(selection.node.type.name);
  }
  const { $from, empty } = selection;
  if (!empty || $from.depth < 1 || $from.node(1) !== state.doc.firstChild) {
    return false;
  }
  const name = $from.node(1).type.name;
  if (name === 'code_block' || name === 'jsx_block') {
    return $from.parentOffset === 0;
  }
  if (name === 'table') {
    return atStartOfTable($from);
  }
  if (name === 'blockquote') {
    return atQuoteEdge($from, 'start');
  }
  if (name === 'bullet_list' || name === 'ordered_list') {
    return atListEdge($from, 'start');
  }
  return false;
}

/** Add a paragraph before the leading code block, quote, list, table, or rule. */
export function prependLeadingParagraph(
  state: Parameters<Command>[0],
  dispatch: Parameters<Command>[1]
): boolean {
  if (!trappedAtDocumentStart(state)) {
    return false;
  }
  const paragraph = state.schema.nodes.paragraph?.create();
  if (!paragraph) {
    return false;
  }
  if (!dispatch) {
    return true;
  }
  const tr = state.tr.insert(0, paragraph);
  dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(1))).scrollIntoView());
  return true;
}

/** Add a paragraph after the final code block, quote, list, table, or rule. */
export function appendTrailingParagraph(
  state: Parameters<Command>[0],
  dispatch: Parameters<Command>[1]
): boolean {
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

function leaveTrappedBlock(
  direction: 'down' | 'right' | 'up' | 'left',
  insert: (state: Parameters<Command>[0], dispatch: Parameters<Command>[1]) => boolean
): Command {
  return (state, dispatch, view) => {
    if (view && !view.endOfTextblock(direction)) {
      return false;
    }
    return insert(state, dispatch);
  };
}

/** Arrow keys that continue the document around a leading or trailing block. */
export function trailingBlockKeymap(): Record<string, Command> {
  return {
    ArrowDown: leaveTrappedBlock('down', appendTrailingParagraph),
    ArrowRight: leaveTrappedBlock('right', appendTrailingParagraph),
    ArrowUp: leaveTrappedBlock('up', prependLeadingParagraph),
    ArrowLeft: leaveTrappedBlock('left', prependLeadingParagraph),
  };
}
