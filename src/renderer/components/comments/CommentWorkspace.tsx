/**
 * Comment list for the open file, with replies on the selected thread.
 */

import { useEffect, useRef, type RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { useDocumentStore } from '@renderer/stores/document-store';
import { selectActiveTabId, useTabStore } from '@renderer/stores/tab-store';
import { useCommentsStore, type CommentThread } from '@renderer/stores/comments-store';
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

function commentStorageKey(filePath: string | null, activeTabId: string | null): string | null {
  if (filePath) {
    return filePath;
  }
  if (activeTabId) {
    return `untitled:${activeTabId}`;
  }
  return null;
}

function threadsForDocument(
  storageKey: string,
  previousKey: string | null,
  activeTabId: string | null
): readonly CommentThread[] {
  const saved = readCommentThreads(storageKey);
  const savingThisUntitledTab =
    activeTabId !== null && previousKey === `untitled:${activeTabId}` && saved.length === 0;
  return savingThisUntitledTab ? useCommentsStore.getState().threads : saved;
}

export function CommentPersistence(): null {
  const filePath = useDocumentStore((state) => state.filePath);
  const activeTabId = useTabStore(selectActiveTabId);
  const storageKey = commentStorageKey(filePath, activeTabId);
  const previousKey = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousKey.current;
    previousKey.current = storageKey;
    if (!storageKey) {
      useCommentsStore.getState().reset();
      return;
    }
    const threads = threadsForDocument(storageKey, previous, activeTabId);
    useCommentsStore.setState({ threads: [...threads], activeThreadId: null });
    if (activeTabId !== null && previous === `untitled:${activeTabId}`) {
      writeCommentThreads(storageKey, threads);
    }
    return useCommentsStore.subscribe((state) => {
      writeCommentThreads(storageKey, state.threads);
    });
  }, [activeTabId, storageKey]);

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
