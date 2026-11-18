/**
 * Tab and Shift-Tab inside a visual code block.
 *
 * Tab inserts two spaces at the caret, or indents every selected line.
 * Shift-Tab removes one indent from those lines. Outside a code block
 * these commands do nothing so lists can keep Tab for nesting.
 */

import { TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';

const INDENT = '  ';

function codeBlock(state: EditorState): boolean {
  const { $from, $to } = state.selection;
  const blockAt = (depth: number, pos: typeof $from): boolean => {
    for (let level = depth; level > 0; level -= 1) {
      const name = pos.node(level).type.name;
      if (name === 'code_block' || name === 'jsx_block') {
        return true;
      }
    }
    return false;
  };
  return blockAt($from.depth, $from) && blockAt($to.depth, $to) && $from.parent === $to.parent;
}

function coveredLines(state: EditorState): { from: number; to: number; text: string } {
  const { $from, $to } = state.selection;
  const text = $from.parent.textContent;
  const start = Math.min($from.parentOffset, $to.parentOffset);
  const end = Math.max($from.parentOffset, $to.parentOffset);
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const breakAt = text.indexOf('\n', end);
  const lineEnd = breakAt === -1 ? text.length : breakAt;
  const base = $from.start();
  return { from: base + lineStart, to: base + lineEnd, text: text.slice(lineStart, lineEnd) };
}

function outdentLine(line: string): string {
  if (line.startsWith(INDENT)) {
    return line.slice(INDENT.length);
  }
  if (line.startsWith('\t') || line.startsWith(' ')) {
    return line.slice(1);
  }
  return line;
}

function changeLines(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  next: string,
  from: number,
  to: number
): boolean {
  if (!dispatch) {
    return true;
  }
  const tr = state.tr.insertText(next, from, to);
  const end = from + next.length;
  tr.setSelection(TextSelection.create(tr.doc, from, end));
  dispatch(tr.scrollIntoView());
  return true;
}

/** Insert spaces, or indent the selected lines, inside a code block. */
export const indentCodeBlock: Command = (state, dispatch) => {
  if (!codeBlock(state)) {
    return false;
  }
  if (state.selection.empty) {
    if (!dispatch) {
      return true;
    }
    dispatch(state.tr.insertText(INDENT, state.selection.from).scrollIntoView());
    return true;
  }
  const lines = coveredLines(state);
  const next = lines.text
    .split('\n')
    .map((line) => `${INDENT}${line}`)
    .join('\n');
  return changeLines(state, dispatch, next, lines.from, lines.to);
};

/** Remove one indent from the current code lines. */
export const outdentCodeBlock: Command = (state, dispatch) => {
  if (!codeBlock(state)) {
    return false;
  }
  const lines = coveredLines(state);
  const next = lines.text.split('\n').map(outdentLine).join('\n');
  return changeLines(state, dispatch, next, lines.from, lines.to);
};
