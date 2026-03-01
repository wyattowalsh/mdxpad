/**
 * Integration tests for Collaboration + Comments flow.
 *
 * Tests cross-store interactions between collab-store and comments-store:
 * connecting to room, adding comments, awareness state updates, disconnecting.
 *
 * @module tests/integration/collab-comments.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// localStorage mock (node environment)
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store;
      store = rest;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Import stores after mocks
import {
  useCollabStore,
  INITIAL_COLLAB_STATE,
  selectIsConnected,
  selectPeerCount,
  selectRoomId,
} from '@renderer/stores/collab-store';
import {
  useCommentsStore,
  INITIAL_COMMENTS_STATE,
  selectThreads,
  selectUnresolvedThreads,
  selectResolvedThreads,
  selectThreadById,
  selectUnresolvedCount,
} from '@renderer/stores/comments-store';
import type { CollabPeer } from '@shared/contracts/collab-schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createPeer(overrides?: Partial<CollabPeer>): CollabPeer {
  return {
    clientId: 1,
    username: 'alice',
    color: '#ff0000',
    lastActive: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Collaboration + Comments Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    act(() => {
      useCollabStore.setState({ ...INITIAL_COLLAB_STATE });
      useCommentsStore.setState({ ...INITIAL_COMMENTS_STATE });
    });
  });

  describe('connect to room -> add comment -> disconnect', () => {
    it('should allow adding a comment while connected to a collab room', () => {
      const collab = useCollabStore.getState();
      const comments = useCommentsStore.getState();

      // Step 1: Join a room
      act(() => {
        collab.setLocalUser({ username: 'alice', color: '#ff0000' });
        collab.joinRoom('room-1', 8080, []);
      });

      const state1 = useCollabStore.getState();
      expect(selectIsConnected(state1)).toBe(true);
      expect(selectRoomId(state1)).toBe('room-1');

      // Step 2: Create a comment thread
      let threadId: string;
      act(() => {
        threadId = comments.createThread(10, 20, 'alice', 'This needs review');
      });

      const commentsState = useCommentsStore.getState();
      expect(selectThreads(commentsState)).toHaveLength(1);
      expect(selectThreadById(commentsState, threadId!)).toBeDefined();
      expect(selectThreadById(commentsState, threadId!)?.messages).toHaveLength(1);
      expect(selectThreadById(commentsState, threadId!)?.messages[0]?.content).toBe(
        'This needs review'
      );

      // Step 3: Disconnect
      act(() => {
        useCollabStore.getState().leaveRoom();
      });

      const state3 = useCollabStore.getState();
      expect(selectIsConnected(state3)).toBe(false);

      // Comments should persist after disconnect
      const commentsAfter = useCommentsStore.getState();
      expect(selectThreads(commentsAfter)).toHaveLength(1);
    });
  });

  describe('multiple users and awareness', () => {
    it('should track peer awareness state updates', () => {
      const collab = useCollabStore.getState();

      // User joins
      const peer1 = createPeer({ clientId: 1, username: 'alice', color: '#ff0000' });
      const peer2 = createPeer({ clientId: 2, username: 'bob', color: '#00ff00' });

      act(() => {
        collab.setLocalUser({ username: 'alice', color: '#ff0000' });
        collab.joinRoom('room-1', 8080, [peer1, peer2]);
      });

      let state = useCollabStore.getState();
      expect(selectPeerCount(state)).toBe(2);

      // Peer update: bob moves cursor
      const updatedPeer2 = createPeer({
        clientId: 2,
        username: 'bob',
        color: '#00ff00',
        cursorLine: 5,
        cursorColumn: 10,
      });

      act(() => {
        useCollabStore.getState().updatePeers([peer1, updatedPeer2]);
      });

      state = useCollabStore.getState();
      expect(selectPeerCount(state)).toBe(2);
      const bob = state.peers.find((p) => p.username === 'bob');
      expect(bob?.cursorLine).toBe(5);
      expect(bob?.cursorColumn).toBe(10);

      // Peer leaves
      act(() => {
        useCollabStore.getState().updatePeers([peer1]);
      });

      state = useCollabStore.getState();
      expect(selectPeerCount(state)).toBe(1);
    });

    it('should allow multiple users to comment on the same thread', () => {
      const comments = useCommentsStore.getState();

      // Alice creates a thread
      let threadId: string;
      act(() => {
        threadId = comments.createThread(0, 50, 'alice', 'Should we refactor this?');
      });

      // Bob replies
      act(() => {
        useCommentsStore.getState().addMessage(threadId!, 'bob', 'Yes, I agree');
      });

      // Charlie replies
      act(() => {
        useCommentsStore.getState().addMessage(threadId!, 'charlie', 'LGTM once refactored');
      });

      const state = useCommentsStore.getState();
      const thread = selectThreadById(state, threadId!);
      expect(thread?.messages).toHaveLength(3);
      expect(thread?.messages[0]?.author).toBe('alice');
      expect(thread?.messages[1]?.author).toBe('bob');
      expect(thread?.messages[2]?.author).toBe('charlie');
    });
  });

  describe('comment thread lifecycle', () => {
    it('should support create -> resolve -> unresolve flow', () => {
      const comments = useCommentsStore.getState();

      let threadId: string;
      act(() => {
        threadId = comments.createThread(0, 10, 'alice', 'Fix typo');
      });

      let state = useCommentsStore.getState();
      expect(selectUnresolvedCount(state)).toBe(1);
      expect(selectResolvedThreads(state)).toHaveLength(0);

      // Resolve
      act(() => {
        useCommentsStore.getState().resolveThread(threadId!);
      });

      state = useCommentsStore.getState();
      expect(selectUnresolvedCount(state)).toBe(0);
      expect(selectResolvedThreads(state)).toHaveLength(1);

      // Unresolve
      act(() => {
        useCommentsStore.getState().unresolveThread(threadId!);
      });

      state = useCommentsStore.getState();
      expect(selectUnresolvedCount(state)).toBe(1);
      expect(selectResolvedThreads(state)).toHaveLength(0);
    });

    it('should delete a thread and clear active thread if it was active', () => {
      const comments = useCommentsStore.getState();

      let threadId: string;
      act(() => {
        threadId = comments.createThread(0, 10, 'alice', 'Remove this section');
      });

      // Creating a thread auto-selects it
      let state = useCommentsStore.getState();
      expect(state.activeThreadId).toBe(threadId!);

      // Delete
      act(() => {
        useCommentsStore.getState().deleteThread(threadId!);
      });

      state = useCommentsStore.getState();
      expect(selectThreads(state)).toHaveLength(0);
      expect(state.activeThreadId).toBeNull();
    });

    it('should update thread anchors when document changes', () => {
      const comments = useCommentsStore.getState();

      let threadId: string;
      act(() => {
        threadId = comments.createThread(100, 150, 'alice', 'Original range');
      });

      // Document shifts: text inserted before anchor
      act(() => {
        useCommentsStore.getState().updateThreadAnchors(threadId!, 110, 160);
      });

      const state = useCommentsStore.getState();
      const thread = selectThreadById(state, threadId!);
      expect(thread?.anchorFrom).toBe(110);
      expect(thread?.anchorTo).toBe(160);
    });
  });

  describe('connection error handling', () => {
    it('should transition to error state and clear on reconnect', () => {
      const collab = useCollabStore.getState();

      act(() => {
        collab.setLocalUser({ username: 'alice', color: '#ff0000' });
        collab.joinRoom('room-1', 8080, []);
      });

      expect(selectIsConnected(useCollabStore.getState())).toBe(true);

      // Error occurs
      act(() => {
        useCollabStore.getState().setError('Connection lost');
      });

      let state = useCollabStore.getState();
      expect(state.connectionStatus).toBe('error');
      expect(state.error).toBe('Connection lost');

      // Reconnect
      act(() => {
        useCollabStore.getState().joinRoom('room-1', 8080, []);
      });

      state = useCollabStore.getState();
      expect(selectIsConnected(state)).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset both stores independently', () => {
      const collab = useCollabStore.getState();
      const comments = useCommentsStore.getState();

      // Set up state
      act(() => {
        collab.setLocalUser({ username: 'alice', color: '#ff0000' });
        collab.joinRoom('room-1', 8080, [createPeer()]);
        comments.createThread(0, 10, 'alice', 'test');
      });

      // Reset collab only
      act(() => {
        useCollabStore.getState().reset();
      });

      expect(selectIsConnected(useCollabStore.getState())).toBe(false);
      expect(selectThreads(useCommentsStore.getState())).toHaveLength(1);

      // Reset comments
      act(() => {
        useCommentsStore.getState().reset();
      });

      expect(selectThreads(useCommentsStore.getState())).toHaveLength(0);
    });
  });

  describe('filtered selectors', () => {
    it('should filter unresolved vs resolved threads correctly', () => {
      const comments = useCommentsStore.getState();

      let id1: string, id2: string, id3: string;
      act(() => {
        id1 = comments.createThread(0, 10, 'alice', 'Thread 1');
        id2 = useCommentsStore.getState().createThread(20, 30, 'bob', 'Thread 2');
        id3 = useCommentsStore.getState().createThread(40, 50, 'charlie', 'Thread 3');
      });

      // Resolve thread 2
      act(() => {
        useCommentsStore.getState().resolveThread(id2!);
      });

      const state = useCommentsStore.getState();
      expect(selectUnresolvedThreads(state)).toHaveLength(2);
      expect(selectResolvedThreads(state)).toHaveLength(1);
      expect(selectResolvedThreads(state)[0]?.id).toBe(id2!);
    });
  });
});
