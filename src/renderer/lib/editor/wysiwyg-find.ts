import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

interface Match {
  readonly from: number;
  readonly to: number;
}

function matches(doc: ProseMirrorNode, query: string): Match[] {
  const found: Match[] = [];
  if (query.length === 0) {
    return found;
  }
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }
    let index = 0;
    while (index <= node.text.length - query.length) {
      const at = node.text.indexOf(query, index);
      if (at === -1) {
        return;
      }
      found.push({ from: pos + at, to: pos + at + query.length });
      index = at + query.length;
    }
  });
  return found;
}

function selectMatch(view: EditorView, match: Match): void {
  const selection = TextSelection.create(view.state.doc, match.from, match.to);
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  view.focus();
}

/** Select the next occurrence of `query`, wrapping to the start. */
export function findNextInView(view: EditorView, query: string): boolean {
  const found = matches(view.state.doc, query);
  const next = found.find((match) => match.from >= view.state.selection.to) ?? found[0];
  if (!next) {
    return false;
  }
  selectMatch(view, next);
  return true;
}

/** Replace the selected match, or the next one, with `replacement`. */
export function replaceNextInView(view: EditorView, query: string, replacement: string): boolean {
  const found = matches(view.state.doc, query);
  const selected = view.state.doc.textBetween(view.state.selection.from, view.state.selection.to);
  const current =
    selected === query
      ? { from: view.state.selection.from, to: view.state.selection.to }
      : (found.find((match) => match.from >= view.state.selection.to) ?? found[0]);
  if (!current) {
    return false;
  }
  const tr = view.state.tr.replaceWith(
    current.from,
    current.to,
    replacement.length > 0 ? view.state.schema.text(replacement) : []
  );
  const end = current.from + replacement.length;
  const selection =
    replacement.length === 0
      ? TextSelection.near(tr.doc.resolve(Math.min(current.from, tr.doc.content.size)))
      : TextSelection.create(tr.doc, current.from, end);
  view.dispatch(tr.setSelection(selection).scrollIntoView());
  view.focus();
  return true;
}

export function findFromPrompt(view: EditorView): boolean {
  const query = globalThis.prompt('Find:');
  if (!query) {
    view.focus();
    return true;
  }
  return findNextInView(view, query);
}

export function replaceFromPrompt(view: EditorView): boolean {
  const query = globalThis.prompt('Find:');
  if (!query) {
    view.focus();
    return true;
  }
  const replacement = globalThis.prompt('Replace with:');
  if (replacement === null) {
    view.focus();
    return true;
  }
  return replaceNextInView(view, query, replacement);
}
