import katex from 'katex';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { Plugin, TextSelection, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

import { isCurrencySpan } from '@shared/lib/currency-span';

const MATH_PATTERN =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<=(?<!\\)(?:\\\\)*)\$(?![\s$])((?:\\[\s\S]|[^$\n])+?)(?<![\s\\$])\$/g;

function placeCaretInFormula(
  view: EditorView,
  pos: number | undefined,
  opener: number,
  end: number
): void {
  if (pos === undefined) {
    return;
  }
  const target = Math.min(Math.max(pos + opener, pos + 1), end - 1);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, target)));
  view.focus();
}

function formulaWidget(
  tex: string,
  display: boolean,
  edit: (event: Event) => void
): HTMLElement {
  const host = document.createElement(display ? 'div' : 'span');
  host.className = display ? 'wysiwyg-math wysiwyg-math-display' : 'wysiwyg-math';
  host.setAttribute('contenteditable', 'false');
  host.setAttribute('aria-label', tex);
  host.addEventListener('mousedown', edit);
  host.innerHTML = katex.renderToString(tex, {
    throwOnError: false,
    displayMode: display,
    output: 'html',
  });
  return host;
}

function selectionCovers(state: EditorState, from: number, to: number): boolean {
  const { from: start, to: end } = state.selection;
  return start < to && end > from;
}

interface TextRun {
  readonly text: string;
  readonly positions: readonly number[];
}

function collectRuns(parent: ProseMirrorNode, parentPos: number): TextRun[] {
  const runs: TextRun[] = [];
  let text = '';
  let positions: number[] = [];
  const flush = (): void => {
    if (text.length > 0) {
      runs.push({ text, positions });
    }
    text = '';
    positions = [];
  };
  let pos = parentPos + 1;
  parent.forEach((child) => {
    const coded = child.isText && child.marks.some((mark) => mark.type.name === 'code');
    if (child.type.name === 'hard_break' || (child.isText && !coded)) {
      if (child.type.name === 'hard_break') {
        text += '\n';
        positions.push(pos);
      } else {
        const value = child.text ?? '';
        for (let index = 0; index < value.length; index += 1) {
          positions.push(pos + index);
        }
        text += value;
      }
    } else {
      flush();
    }
    pos += child.nodeSize;
  });
  flush();
  return runs;
}

function decorateRun(state: EditorState, run: TextRun, decorations: Decoration[]): void {
  for (const match of run.text.matchAll(MATH_PATTERN)) {
    const index = match.index;
    const tex = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
    const endIndex = index + match[0].length - 1;
    const start = run.positions[index];
    const end = run.positions[endIndex];
    if (start === undefined || end === undefined || tex.trim().length === 0) {
      continue;
    }
    if (match[4] !== undefined && isCurrencySpan(tex)) {
      continue;
    }
    const from = start;
    const to = end + 1;
    if (selectionCovers(state, from, to)) {
      continue;
    }
    const display = match[1] !== undefined || match[2] !== undefined;
    const opener = match[4] === undefined ? 2 : 1;
    decorations.push(
      Decoration.inline(from, to, { class: 'wysiwyg-math-source' }),
      Decoration.widget(
        from,
        (view, getPos) =>
          formulaWidget(tex, display, (event) => {
            event.preventDefault();
            event.stopPropagation();
            placeCaretInFormula(view, getPos(), opener, to);
          }),
        { side: -1, ignoreSelection: true }
      )
    );
  }
}

/** Show KaTeX for math outside the caret, and the source while it is being edited. */
export function mathDecorations(state: EditorState): DecorationSet {
  const decorations: Decoration[] = [];
  state.doc.descendants((node, pos) => {
    if (!node.isTextblock || node.type.spec.code) {
      return;
    }
    for (const run of collectRuns(node, pos)) {
      decorateRun(state, run, decorations);
    }
  });
  return DecorationSet.create(state.doc, decorations);
}

export function wysiwygMathPlugin(): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        return mathDecorations(state);
      },
    },
  });
}
