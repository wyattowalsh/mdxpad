import type { Command } from 'prosemirror-state';

/** Insert a Markdown hard break inside the current paragraph. */
export const insertHardBreak: Command = (state, dispatch) => {
  const parent = state.selection.$from.parent;
  const breakType = state.schema.nodes.hard_break;
  if (!parent.isTextblock || parent.type.spec.code || !breakType) {
    return false;
  }
  if (dispatch) {
    const lineBreak = breakType.create({ hard: true });
    dispatch(state.tr.replaceSelectionWith(lineBreak, false).scrollIntoView());
  }
  return true;
};
