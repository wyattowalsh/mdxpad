/**
 * Comment list for the open file, with replies on the selected thread.
 */

import { useEffect, type RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useCommentsStore } from '@renderer/stores/comments-store';
import { CommentPanel } from './CommentPanel';
import { CommentThreadView } from './CommentThread';
import { readCommentThreads, writeCommentThreads } from './comment-storage';

const CURRENT_USER = 'You';

function revealCommentThread(view: EditorView, anchorFrom: number): void {
  view.dispatch({
    selection: EditorSelection.cursor(anchorFrom),
    scrollIntoView: true,
  });
}

export function CommentPersistence(): null {
  const filePath = useDocumentStore((state) => state.filePath);

  useEffect(() => {
    if (!filePath) {
      useCommentsStore.getState().reset();
      return;
    }
    const saved = readCommentThreads(filePath);
    useCommentsStore.setState({ threads: saved, activeThreadId: null });
    return useCommentsStore.subscribe((state) => {
      writeCommentThreads(filePath, state.threads);
    });
  }, [filePath]);

  return null;
}

export function CommentWorkspace({
  editorRef,
}: {
  readonly editorRef: RefObject<EditorView | null>;
}): React.JSX.Element {
  const threads = useCommentsStore((state) => state.threads);
  const activeThreadId = useCommentsStore((state) => state.activeThreadId);
  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null;

  return (
    <div className="space-y-3">
      <CommentPanel
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={(threadId) => useCommentsStore.getState().setActiveThread(threadId)}
        onNavigateToThread={(threadId) => {
          useCommentsStore.getState().setActiveThread(threadId);
          const thread = threads.find((item) => item.id === threadId);
          const view = editorRef.current;
          if (thread && view) {
            revealCommentThread(view, thread.anchorFrom);
          }
        }}
      />
      {activeThread && (
        <CommentThreadView
          thread={activeThread}
          currentUser={CURRENT_USER}
          onAddMessage={(threadId: string, content: string) =>
            useCommentsStore.getState().addMessage(threadId, CURRENT_USER, content)
          }
          onResolve={(threadId: string) => useCommentsStore.getState().resolveThread(threadId)}
          onUnresolve={(threadId: string) => useCommentsStore.getState().unresolveThread(threadId)}
          onDelete={(threadId: string) => useCommentsStore.getState().deleteThread(threadId)}
        />
      )}
    </div>
  );
}
