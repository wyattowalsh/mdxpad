import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { mdxSchema } from './prosemirror-mdx-schema';
import { documentFromMarkdown } from './wysiwyg-document';
import { mathDecorations, wysiwygMathPlugin } from './wysiwyg-math';

function stateFor(text: string, selectionAt?: number): EditorState {
  const doc = mdxSchema.node('doc', null, [
    mdxSchema.node('paragraph', null, text.length > 0 ? [mdxSchema.text(text)] : []),
  ]);
  return EditorState.create({
    doc,
    ...(selectionAt === undefined ? {} : { selection: TextSelection.create(doc, selectionAt) }),
    plugins: [],
  });
}

describe('WYSIWYG math decorations', () => {
  it('renders a formula and leaves a price as text', () => {
    const decorations = mathDecorations(stateFor('Area $x^2$ costs $5'));
    expect(decorations.find()).toHaveLength(2);
  });

  it('renders TeX delimiters', () => {
    const decorations = mathDecorations(stateFor('The area is \\(x^2\\).'));
    expect(decorations.find()).toHaveLength(2);
  });

  it('renders a display formula that is split across lines', () => {
    const doc = documentFromMarkdown('$$\na^2+b^2\n$$\n');
    const decorations = mathDecorations(EditorState.create({ doc }));
    expect(decorations.find()).toHaveLength(2);
  });

  it('leaves a formula inside a code fence as source', () => {
    const doc = documentFromMarkdown('```\n$x^2$\n```\n');
    const decorations = mathDecorations(EditorState.create({ doc }));
    expect(decorations.find()).toHaveLength(0);
  });

  it('shows the source while the caret is inside the formula', () => {
    const decorations = mathDecorations(stateFor('Area $x^2$', 8));
    expect(decorations.find()).toHaveLength(0);
  });

  it('puts the caret inside a formula when its preview is clicked', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const doc = documentFromMarkdown('Area $x^2$ costs $5\n');
    const view = new EditorView(host, {
      state: EditorState.create({ doc, schema: mdxSchema, plugins: [wysiwygMathPlugin()] }),
    });
    const preview = view.dom.querySelector('.wysiwyg-math');
    expect(preview).toBeInstanceOf(HTMLElement);
    preview?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    const around = view.state.doc.textBetween(
      view.state.selection.from,
      view.state.selection.from + 1
    );
    expect(around).toBe('x');
    expect(mathDecorations(view.state).find()).toHaveLength(0);
    view.destroy();
    host.remove();
  });
});
