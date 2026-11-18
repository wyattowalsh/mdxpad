import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { mdxSchema } from './prosemirror-mdx-schema';
import { documentFromMarkdown } from './wysiwyg-document';
import { firstVisibleSourceLine, sourceLineCount } from './wysiwyg-scroll';

function rect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}

describe('visual scroll position', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.dom.parentElement?.parentElement?.remove();
      view.destroy();
    }
  });

  it('reports the source line of the first block still in view', () => {
    const scroller = document.createElement('div');
    const host = document.createElement('div');
    scroller.appendChild(host);
    document.body.appendChild(scroller);
    const view = new EditorView(host, {
      state: EditorState.create({
        doc: documentFromMarkdown('Hello\n\nWorld'),
        schema: mdxSchema,
      }),
    });
    views.push(view);
    scroller.getBoundingClientRect = () => rect(100, 400);
    const blocks = view.dom.querySelectorAll(':scope > *');
    expect(blocks.length).toBeGreaterThan(1);
    (blocks[0] as HTMLElement).getBoundingClientRect = () => rect(0, 40);
    (blocks[1] as HTMLElement).getBoundingClientRect = () => rect(80, 160);

    expect(firstVisibleSourceLine(view, scroller)).toBe(3);
    expect(sourceLineCount(view.state.doc)).toBe(3);
  });
});
