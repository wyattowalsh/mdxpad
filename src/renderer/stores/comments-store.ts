/**
 * Comments Store
 *
 * Zustand store with Immer middleware for comment threads and messages.
 * Manages comment anchors, thread lifecycle, and resolution state.
 *
 * @module renderer/stores/comments-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Draft } from 'immer';
import { uid } from '@shared/lib/utils';

// ============================================================================
// Types
// ============================================================================

/** A single message within a comment thread */
export interface CommentMessage {
  readonly id: string;
  readonly author: string;
  readonly content: string;
  readonly timestamp: number;
}

/** A comment thread anchored to a range in the document */
export interface CommentThread {
  readonly id: string;
  readonly anchorFrom: number;
  readonly anchorTo: number;
  readonly messages: readonly CommentMessage[];
  readonly resolved: boolean;
  readonly createdAt: number;
}

/** Comments store state */
export interface CommentsState {
  readonly threads: readonly CommentThread[];
  readonly activeThreadId: string | null;
  /** Document key the current threads were loaded for. */
  readonly loadedFor: string | null;
}

/** Comments store actions */
export interface CommentsActions {
  readonly createThread: (
    anchorFrom: number,
    anchorTo: number,
    author: string,
    content: string
  ) => string;
  readonly addMessage: (threadId: string, author: string, content: string) => void;
  readonly resolveThread: (threadId: string) => void;
  readonly unresolveThread: (threadId: string) => void;
  readonly deleteThread: (threadId: string) => void;
  readonly setActiveThread: (threadId: string | null) => void;
  readonly updateThreadAnchors: (threadId: string, from: number, to: number) => void;
  readonly reset: () => void;
}

/** Combined comments store type */
export type CommentsStore = CommentsState & CommentsActions;

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_COMMENTS_STATE: CommentsState = {
  threads: [],
  activeThreadId: null,
  loadedFor: null,
};

// ============================================================================
// Draft Helpers
// ============================================================================

type DraftState = Draft<CommentsState & CommentsActions>;

function findThread(draft: DraftState, threadId: string): Draft<CommentThread> | undefined {
  return draft.threads.find((t) => t.id === threadId);
}

function createMessage(author: string, content: string): CommentMessage {
  return {
    id: uid(),
    author,
    content,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Action Creators
// ============================================================================

function makeCreateThread(set: (fn: (draft: DraftState) => void) => void) {
  let lastCreatedId = '';

  return (anchorFrom: number, anchorTo: number, author: string, content: string): string => {
    const threadId = uid();
    lastCreatedId = threadId;

    const message = createMessage(author, content);
    const thread: CommentThread = {
      id: threadId,
      anchorFrom,
      anchorTo,
      messages: [message],
      resolved: false,
      createdAt: Date.now(),
    };

    set((draft) => {
      (draft.threads as CommentThread[]).push(thread);
      draft.activeThreadId = threadId;
    });

    return lastCreatedId;
  };
}

function makeAddMessage(set: (fn: (draft: DraftState) => void) => void) {
  return (threadId: string, author: string, content: string): void =>
    set((draft) => {
      const thread = findThread(draft, threadId);
      if (thread) {
        const message = createMessage(author, content);
        (thread.messages as CommentMessage[]).push(message);
      }
    });
}

function makeResolveThread(set: (fn: (draft: DraftState) => void) => void) {
  return (threadId: string): void =>
    set((draft) => {
      const thread = findThread(draft, threadId);
      if (thread) {
        (thread as { resolved: boolean }).resolved = true;
      }
    });
}

function makeUnresolveThread(set: (fn: (draft: DraftState) => void) => void) {
  return (threadId: string): void =>
    set((draft) => {
      const thread = findThread(draft, threadId);
      if (thread) {
        (thread as { resolved: boolean }).resolved = false;
      }
    });
}

function makeDeleteThread(set: (fn: (draft: DraftState) => void) => void) {
  return (threadId: string): void =>
    set((draft) => {
      const index = draft.threads.findIndex((t) => t.id === threadId);
      if (index !== -1) {
        (draft.threads as CommentThread[]).splice(index, 1);
      }
      if (draft.activeThreadId === threadId) {
        draft.activeThreadId = null;
      }
    });
}

function makeUpdateThreadAnchors(set: (fn: (draft: DraftState) => void) => void) {
  return (threadId: string, from: number, to: number): void =>
    set((draft) => {
      const thread = findThread(draft, threadId);
      if (thread) {
        (thread as { anchorFrom: number }).anchorFrom = from;
        (thread as { anchorTo: number }).anchorTo = to;
      }
    });
}

// ============================================================================
// Store
// ============================================================================

/**
 * Comments store hook.
 * Manages comment threads, messages, and resolution state.
 *
 * @example
 * ```tsx
 * const { threads, createThread, addMessage, resolveThread } = useCommentsStore();
 *
 * // Create a new thread
 * const threadId = createThread(100, 150, 'Alice', 'This needs review');
 *
 * // Add a reply
 * addMessage(threadId, 'Bob', 'Looks good to me');
 *
 * // Resolve the thread
 * resolveThread(threadId);
 * ```
 */
export const useCommentsStore = create<CommentsStore>()(
  immer((set) => ({
    ...INITIAL_COMMENTS_STATE,

    createThread: makeCreateThread(set),
    addMessage: makeAddMessage(set),
    resolveThread: makeResolveThread(set),
    unresolveThread: makeUnresolveThread(set),
    deleteThread: makeDeleteThread(set),

    setActiveThread: (threadId) =>
      set((draft) => {
        draft.activeThreadId = threadId;
      }),

    updateThreadAnchors: makeUpdateThreadAnchors(set),

    reset: () =>
      set((draft) => {
        (draft.threads as CommentThread[]).length = 0;
        draft.activeThreadId = null;
        draft.loadedFor = null;
      }),
  }))
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select all threads.
 */
export const selectThreads = (state: CommentsStore): readonly CommentThread[] => state.threads;

/**
 * Select only unresolved threads.
 */
export const selectUnresolvedThreads = (state: CommentsStore): readonly CommentThread[] =>
  state.threads.filter((t) => !t.resolved);

/**
 * Select only resolved threads.
 */
export const selectResolvedThreads = (state: CommentsStore): readonly CommentThread[] =>
  state.threads.filter((t) => t.resolved);

/**
 * Select a specific thread by ID.
 */
export const selectThreadById = (
  state: CommentsStore,
  threadId: string
): CommentThread | undefined => state.threads.find((t) => t.id === threadId);

/**
 * Select the currently active thread ID.
 */
export const selectActiveThreadId = (state: CommentsStore): string | null => state.activeThreadId;

/**
 * Select the thread count.
 */
export const selectThreadCount = (state: CommentsStore): number => state.threads.length;

/**
 * Select unresolved thread count.
 */
export const selectUnresolvedCount = (state: CommentsStore): number =>
  state.threads.filter((t) => !t.resolved).length;

/** Export initial state for testing */
export { INITIAL_COMMENTS_STATE };
