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
import { sourcePosition } from './comment-position';
import { readCommentThreads, writeCommentThreads } from './comment-storage';
import { focusWysiwygSourceLine } from '@renderer/lib/editor/wysiwyg-source-line';

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
  const content = useDocumentStore((state) => state.content);
  const activeThreadId = useCommentsStore((state) => state.activeThreadId);
  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null;

  return (
    <div className="space-y-3">
      <CommentPanel
        threads={threads}
        content={content}
        activeThreadId={activeThreadId}
        onSelectThread={(threadId) => useCommentsStore.getState().setActiveThread(threadId)}
        onNavigateToThread={(threadId) => {
          useCommentsStore.getState().setActiveThread(threadId);
          const thread = threads.find((item) => item.id === threadId);
          if (!thread) {
            return;
          }
          const view = editorRef.current;
          if (view) {
            revealCommentThread(view, thread.anchorFrom);
            return;
          }
          const position = sourcePosition(content, thread.anchorFrom);
          focusWysiwygSourceLine(position.line, position.column);
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
