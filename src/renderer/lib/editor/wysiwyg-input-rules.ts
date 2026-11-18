import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
} from 'prosemirror-inputrules';
import type { MarkType } from 'prosemirror-model';
import type { EditorState, Transaction } from 'prosemirror-state';

import { mdxSchema } from './prosemirror-mdx-schema';

function markRule(pattern: RegExp, mark: MarkType): InputRule {
  return new InputRule(
    pattern,
    (state, match, start, end) => {
      const words = match[1];
      if (!words) {
        return null;
      }
      const tr = state.tr.replaceWith(start, end, state.schema.text(words, [mark.create()]));
      return tr.removeStoredMark(mark);
    },
    { inCodeMark: false }
  );
}

function horizontalRule(state: EditorState, _match: RegExpMatchArray, start: number, end: number): Transaction | null {
  const $start = state.doc.resolve(start);
  const rule = state.schema.nodes.horizontal_rule?.create();
  if (!rule || $start.parentOffset !== 0 || $start.parent.content.size !== end - start) {
    return null;
  }
  return state.tr.replaceWith($start.before(), $start.after(), rule);
}

function markdownShortcutRules(): InputRule[] {
  const heading = textblockTypeInputRule(/^(#{1,6})\s$/, mdxSchema.nodes.heading, (match) => ({
    level: match[1]?.length ?? 1,
  }));
  return [
    markRule(/(?:\*\*|__)([^*_]+)(?:\*\*|__)$/, mdxSchema.marks.bold),
    markRule(/~~([^~]+)~~$/, mdxSchema.marks.strikethrough),
    markRule(/`([^`]+)`$/, mdxSchema.marks.code),
    markRule(/(?<!\*)\*([^*]+)\*$/, mdxSchema.marks.italic),
    heading,
    wrappingInputRule(/^\s*>\s$/, mdxSchema.nodes.blockquote),
    wrappingInputRule(/^\s*[-+*]\s$/, mdxSchema.nodes.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, mdxSchema.nodes.ordered_list, (match) => ({
      order: Number(match[1] ?? 1),
    })),
    textblockTypeInputRule(/^```$/, mdxSchema.nodes.code_block),
    new InputRule(/^(?:---|___|\*\*\*)$/, horizontalRule),
  ];
}

/** Markdown characters become formatting while typing in the visual editor. */
export function wysiwygInputRules() {
  return inputRules({ rules: markdownShortcutRules() });
}
