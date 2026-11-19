import { afterEach, describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { useCommentsStore, type CommentThread } from '@renderer/stores/comments-store';
import { useUtilityPanelStore } from '@renderer/stores/utility-panel-store';

import { commentGutterExtension, focusCommentThread, gutterItemsFromThreads } from './CommentGutter';

function thread(id: string, anchorFrom: number, resolved: boolean): CommentThread {
  return {
    id,
    anchorFrom,
    anchorTo: anchorFrom,
    messages: [],
    resolved,
    createdAt: 1,
  };
}

describe('gutterItemsFromThreads', () => {
  it('groups threads on one line and keeps an open thread', () => {
    const doc = EditorState.create({ doc: 'alpha\nbeta' }).doc;
    expect(
      gutterItemsFromThreads(doc, [thread('done', 0, true), thread('open', 2, false)])
    ).toEqual([{ line: 1, threadId: 'open', threadCount: 2, hasUnresolved: true }]);
  });
});

describe('comment gutter', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
      view.dom.remove();
    }
    useCommentsStore.getState().reset();
    useUtilityPanelStore.setState({ activeUtilityPanel: null });
  });

  it('shows a marker for a thread', async () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: 'alpha\nbeta',
        extensions: [commentGutterExtension()],
      }),
    });
    views.push(view);
    useCommentsStore.setState({
      threads: [thread('open', 6, false)],
      activeThreadId: null,
    });

    await new Promise<void>((resolve) => {
      queueMicrotask(resolve);
    });

    expect(view.dom.querySelector('[data-thread-id="open"]')).not.toBeNull();
  });

  it('opens the comments panel on the chosen thread', () => {
    focusCommentThread('open');
    expect(useCommentsStore.getState().activeThreadId).toBe('open');
    expect(useUtilityPanelStore.getState().activeUtilityPanel).toBe('comments');
  });
});
