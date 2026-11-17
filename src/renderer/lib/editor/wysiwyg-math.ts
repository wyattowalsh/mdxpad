import katex from 'katex';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { Plugin, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const MATH_PATTERN =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$(?![\s$])([^$\n]+?)(?<![\s$])\$/g;

function isPrice(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && /\d/.test(trimmed) && /^[\d\s.,:;]+$/.test(trimmed);
}

function formulaWidget(tex: string, display: boolean): HTMLElement {
  const host = document.createElement(display ? 'div' : 'span');
  host.className = display ? 'wysiwyg-math wysiwyg-math-display' : 'wysiwyg-math';
  host.setAttribute('contenteditable', 'false');
  host.setAttribute('aria-label', tex);
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

function decorateText(
  state: EditorState,
  node: ProseMirrorNode,
  pos: number,
  parent: ProseMirrorNode | null,
  decorations: Decoration[]
): void {
  if (parent?.type.name === 'code_block' || node.marks.some((mark) => mark.type.name === 'code')) {
    return;
  }
  const text = node.text ?? '';
  for (const match of text.matchAll(MATH_PATTERN)) {
    const index = match.index;
    const tex = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
    if (tex.trim().length === 0 || (match[4] !== undefined && isPrice(tex))) {
      continue;
    }
    const from = pos + index;
    const to = from + match[0].length;
    if (selectionCovers(state, from, to)) {
      continue;
    }
    const display = match[1] !== undefined || match[2] !== undefined;
    decorations.push(
      Decoration.inline(from, to, { class: 'wysiwyg-math-source' }),
      Decoration.widget(from, () => formulaWidget(tex, display), { side: -1, ignoreSelection: true })
    );
  }
}

/** Show KaTeX for math outside the caret, and the source while it is being edited. */
export function mathDecorations(state: EditorState): DecorationSet {
  const decorations: Decoration[] = [];
  state.doc.descendants((node, pos, parent) => {
    if (node.isText) {
      decorateText(state, node, pos, parent, decorations);
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
