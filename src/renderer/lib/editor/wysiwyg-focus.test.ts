import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { mdxSchema } from './prosemirror-mdx-schema';
import { type FocusModeFlag, refreshFocusMode, wysiwygFocusPlugin } from './wysiwyg-focus';

function open(source: string, enabled: FocusModeFlag): EditorView {
  const doc = parseMdxContent(source);
  if (!doc) {
    throw new Error('markdown did not parse');
  }
  const host = document.createElement('div');
  document.body.appendChild(host);
  return new EditorView(host, {
    state: EditorState.create({
      doc,
      schema: mdxSchema,
      plugins: [wysiwygFocusPlugin(enabled)],
    }),
  });
}

function paragraphs(view: EditorView): HTMLElement[] {
  return Array.from(view.dom.querySelectorAll(':scope > p'));
}

describe('visual focus mode', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.dom.parentElement?.remove();
      view.destroy();
    }
  });

  it('dims every paragraph except the one containing the caret', () => {
    const enabled = { current: true };
    const view = open('Hello\n\nWorld\n', enabled);
    views.push(view);
    const [first, second] = paragraphs(view);
    expect(first?.classList.contains('wysiwyg-focus-dimmed')).toBe(false);
    expect(second?.classList.contains('wysiwyg-focus-dimmed')).toBe(true);
    expect(second?.style.opacity).toBe('0.3');

    const world = second?.textContent ?? '';
    expect(world).toBe('World');
    let inside = 0;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'World') {
        inside = pos + 1;
      }
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, inside)));
    const [nextFirst, nextSecond] = paragraphs(view);
    expect(nextFirst?.classList.contains('wysiwyg-focus-dimmed')).toBe(true);
    expect(nextSecond?.classList.contains('wysiwyg-focus-dimmed')).toBe(false);
  });

  it('clears the dimming when focus mode turns off', () => {
    const enabled: FocusModeFlag = { current: true };
    const view = open('Hello\n\nWorld\n', enabled);
    views.push(view);
    expect(paragraphs(view)[1]?.classList.contains('wysiwyg-focus-dimmed')).toBe(true);
    enabled.current = false;
    view.dispatch(refreshFocusMode(view));
    expect(view.dom.querySelector('.wysiwyg-focus-dimmed')).toBeNull();
  });
});
