import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';

import { mdxSchema } from './prosemirror-mdx-schema';
import { documentFromMarkdown } from './wysiwyg-document';
import { mathDecorations } from './wysiwyg-math';

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
});
