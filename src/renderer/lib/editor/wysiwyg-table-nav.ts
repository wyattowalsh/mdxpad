import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { keymap } from 'prosemirror-keymap';
import { TextSelection, type EditorState, type Plugin, type Transaction } from 'prosemirror-state';

interface CellLocation {
  readonly cellPos: number;
  readonly rowPos: number;
  readonly tablePos: number;
  readonly cellIndex: number;
  readonly rowIndex: number;
  readonly row: ProseMirrorNode;
  readonly table: ProseMirrorNode;
}

function locateCell(state: EditorState): CellLocation | null {
  const { $from } = state.selection;
  let cellDepth = 0;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (name === 'table_cell' || name === 'table_header') {
      cellDepth = depth;
      break;
    }
  }
  if (cellDepth < 2) {
    return null;
  }
  const row = $from.node(cellDepth - 1);
  const table = $from.node(cellDepth - 2);
  if (row.type.name !== 'table_row' || table.type.name !== 'table') {
    return null;
  }
  return {
    cellPos: $from.before(cellDepth),
    rowPos: $from.before(cellDepth - 1),
    tablePos: $from.before(cellDepth - 2),
    cellIndex: $from.index(cellDepth - 1),
    rowIndex: $from.index(cellDepth - 2),
    row,
    table,
  };
}

function selectCell(tr: Transaction, cellPos: number): Transaction {
  const position = Math.min(cellPos + 1, tr.doc.content.size);
  return tr.setSelection(TextSelection.near(tr.doc.resolve(position), 1)).scrollIntoView();
}

function appendRow(state: EditorState, cell: CellLocation): Transaction {
  const cellType = state.schema.nodes.table_cell;
  const rowType = state.schema.nodes.table_row;
  if (!cellType || !rowType) {
    return selectCell(state.tr, cell.cellPos);
  }
  const cells = [];
  for (let index = 0; index < cell.row.childCount; index += 1) {
    cells.push(cellType.create());
  }
  const row = rowType.create(null, cells);
  const insertAt = cell.tablePos + cell.table.nodeSize - 1;
  return selectCell(state.tr.insert(insertAt, row), insertAt + 1);
}

function forwardCell(state: EditorState, cell: CellLocation): Transaction {
  if (cell.cellIndex + 1 < cell.row.childCount) {
    return selectCell(state.tr, cell.cellPos + cell.row.child(cell.cellIndex).nodeSize);
  }
  if (cell.rowIndex + 1 < cell.table.childCount) {
    return selectCell(state.tr, cell.rowPos + cell.row.nodeSize + 1);
  }
  return appendRow(state, cell);
}

function backwardCell(state: EditorState, cell: CellLocation): Transaction | null {
  if (cell.cellIndex > 0) {
    const previous = cell.row.child(cell.cellIndex - 1);
    return selectCell(state.tr, cell.cellPos - previous.nodeSize);
  }
  if (cell.rowIndex === 0) {
    return null;
  }
  const previousRow = cell.table.child(cell.rowIndex - 1);
  const rowStart = cell.rowPos - previousRow.nodeSize;
  let lastCell = rowStart + 1;
  previousRow.forEach((_child, offset) => {
    lastCell = rowStart + 1 + offset;
  });
  return selectCell(state.tr, lastCell);
}

/** Move to the next or previous table cell. Tab in the last cell adds a row. */
export function moveTableCell(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  direction: 1 | -1
): boolean {
  const cell = locateCell(state);
  if (!cell) {
    return false;
  }
  const tr = direction > 0 ? forwardCell(state, cell) : backwardCell(state, cell);
  if (tr && dispatch) {
    dispatch(tr);
  }
  return true;
}

/** Tab and Shift-Tab move between table cells before list indentation. */
export function wysiwygTableKeymap(): Plugin {
  return keymap({
    Tab: (state, dispatch) => moveTableCell(state, dispatch, 1),
    'Shift-Tab': (state, dispatch) => moveTableCell(state, dispatch, -1),
  });
}
