/**
 * Tests for Comments Store.
 *
 * Tests comment thread lifecycle, message management,
 * resolution state, and selectors.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useCommentsStore,
  INITIAL_COMMENTS_STATE,
  selectThreads,
  selectUnresolvedThreads,
  selectResolvedThreads,
  selectThreadById,
  selectActiveThreadId,
  selectThreadCount,
  selectUnresolvedCount,
} from './comments-store';

// ============================================================================
// Tests
// ============================================================================

describe('useCommentsStore', () => {
  beforeEach(() => {
    useCommentsStore.getState().reset();
  });

  describe('initial state', () => {
    it('should start with no threads', () => {
      const state = useCommentsStore.getState();
      expect(state.threads).toHaveLength(0);
    });

    it('should start with no active thread', () => {
      const state = useCommentsStore.getState();
      expect(state.activeThreadId).toBeNull();
    });
  });

  describe('createThread', () => {
    it('should create a thread with initial message', () => {
      const threadId = useCommentsStore.getState().createThread(10, 50, 'Alice', 'Test comment');
      const state = useCommentsStore.getState();

      expect(state.threads).toHaveLength(1);
      expect(state.threads[0]?.id).toBe(threadId);
      expect(state.threads[0]?.anchorFrom).toBe(10);
      expect(state.threads[0]?.anchorTo).toBe(50);
      expect(state.threads[0]?.resolved).toBe(false);
      expect(state.threads[0]?.messages).toHaveLength(1);
      expect(state.threads[0]?.messages[0]?.author).toBe('Alice');
      expect(state.threads[0]?.messages[0]?.content).toBe('Test comment');
    });

    it('should set the created thread as active', () => {
      const threadId = useCommentsStore.getState().createThread(0, 10, 'Bob', 'Comment');
      expect(useCommentsStore.getState().activeThreadId).toBe(threadId);
    });

    it('should return a unique thread ID', () => {
      const id1 = useCommentsStore.getState().createThread(0, 10, 'A', 'First');
      const id2 = useCommentsStore.getState().createThread(20, 30, 'B', 'Second');
      expect(id1).not.toBe(id2);
    });

    it('should create threads with timestamps', () => {
      const before = Date.now();
      useCommentsStore.getState().createThread(0, 10, 'Alice', 'Test');
      const after = Date.now();
      const thread = useCommentsStore.getState().threads[0];

      expect(thread?.createdAt).toBeGreaterThanOrEqual(before);
      expect(thread?.createdAt).toBeLessThanOrEqual(after);
    });

    it('should create multiple independent threads', () => {
      useCommentsStore.getState().createThread(0, 10, 'A', 'First');
      useCommentsStore.getState().createThread(20, 30, 'B', 'Second');
      useCommentsStore.getState().createThread(40, 50, 'C', 'Third');
      expect(useCommentsStore.getState().threads).toHaveLength(3);
    });
  });

  describe('addMessage', () => {
    it('should add a message to an existing thread', () => {
      const threadId = useCommentsStore.getState().createThread(0, 10, 'Alice', 'Start');
      useCommentsStore.getState().addMessage(threadId, 'Bob', 'Reply');
      const thread = useCommentsStore.getState().threads[0];

      expect(thread?.messages).toHaveLength(2);
      expect(thread?.messages[1]?.author).toBe('Bob');
      expect(thread?.messages[1]?.content).toBe('Reply');
    });

    it('should not add message to non-existent thread', () => {
      useCommentsStore.getState().addMessage('nonexistent', 'Alice', 'Test');
      expect(useCommentsStore.getState().threads).toHaveLength(0);
    });

    it('should generate unique message IDs', () => {
      const threadId = useCommentsStore.getState().createThread(0, 10, 'A', 'First');
      useCommentsStore.getState().addMessage(threadId, 'B', 'Second');
      const thread = useCommentsStore.getState().threads[0];
      expect(thread?.messages[0]?.id).not.toBe(thread?.messages[1]?.id);
    });

    it('should set message timestamps', () => {
      const threadId = useCommentsStore.getState().createThread(0, 10, 'A', 'First');
      const before = Date.now();
      useCommentsStore.getState().addMessage(threadId, 'B', 'Second');
      const msg = useCommentsStore.getState().threads[0]?.messages[1];
      expect(msg?.timestamp).toBeGreaterThanOrEqual(before);
    });

    it('should handle adding multiple messages', () => {
      const threadId = useCommentsStore.getState().createThread(0, 10, 'A', 'Start');
      useCommentsStore.getState().addMessage(threadId, 'B', 'Reply 1');
      useCommentsStore.getState().addMessage(threadId, 'C', 'Reply 2');
      useCommentsStore.getState().addMessage(threadId, 'A', 'Reply 3');
      expect(useCommentsStore.getState().threads[0]?.messages).toHaveLength(4);
    });
  });

  describe('resolveThread / unresolveThread', () => {
    it('should resolve a thread', () => {
      const threadId = useCommentsStore.getState().createThread(0, 10, 'Alice', 'Test');
      useCommentsStore.getState().resolveThread(threadId);
      expect(useCommentsStore.getState().threads[0]?.resolved).toBe(true);
    });

    it('should unresolve a thread', () => {
      const threadId = useCommentsStore.getState().createThread(0, 10, 'Alice', 'Test');
      useCommentsStore.getState().resolveThread(threadId);
      useCommentsStore.getState().unresolveThread(threadId);
      expect(useCommentsStore.getState().threads[0]?.resolved).toBe(false);
    });

    it('should not affect non-existent thread', () => {
      useCommentsStore.getState().createThread(0, 10, 'Alice', 'Test');
      useCommentsStore.getState().resolveThread('nonexistent');
      expect(useCommentsStore.getState().threads[0]?.resolved).toBe(false);
    });
  });

  describe('deleteThread', () => {
    it('should remove a thread', () => {
      const threadId = useCommentsStore.getState().createThread(0, 10, 'Alice', 'Test');
      useCommentsStore.getState().deleteThread(threadId);
      expect(useCommentsStore.getState().threads).toHaveLength(0);
    });

    it('should clear active thread if deleted', () => {
      const threadId = useCommentsStore.getState().createThread(0, 10, 'Alice', 'Test');
      expect(useCommentsStore.getState().activeThreadId).toBe(threadId);
      useCommentsStore.getState().deleteThread(threadId);
      expect(useCommentsStore.getState().activeThreadId).toBeNull();
    });

    it('should not affect other threads', () => {
      const id1 = useCommentsStore.getState().createThread(0, 10, 'A', 'First');
      useCommentsStore.getState().createThread(20, 30, 'B', 'Second');
      useCommentsStore.getState().deleteThread(id1);
      expect(useCommentsStore.getState().threads).toHaveLength(1);
    });
  });

  describe('setActiveThread', () => {
    it('should set the active thread', () => {
      const threadId = useCommentsStore.getState().createThread(0, 10, 'Alice', 'Test');
      useCommentsStore.getState().setActiveThread(null);
      expect(useCommentsStore.getState().activeThreadId).toBeNull();
      useCommentsStore.getState().setActiveThread(threadId);
      expect(useCommentsStore.getState().activeThreadId).toBe(threadId);
    });
  });

  describe('updateThreadAnchors', () => {
    it('should update anchor positions', () => {
      const threadId = useCommentsStore.getState().createThread(10, 50, 'Alice', 'Test');
      useCommentsStore.getState().updateThreadAnchors(threadId, 20, 60);
      const thread = useCommentsStore.getState().threads[0];
      expect(thread?.anchorFrom).toBe(20);
      expect(thread?.anchorTo).toBe(60);
    });
  });

  describe('reset', () => {
    it('should clear all threads', () => {
      useCommentsStore.getState().createThread(0, 10, 'A', 'First');
      useCommentsStore.getState().createThread(20, 30, 'B', 'Second');
      useCommentsStore.getState().reset();
      expect(useCommentsStore.getState().threads).toHaveLength(0);
      expect(useCommentsStore.getState().activeThreadId).toBeNull();
    });
  });
});

describe('comments selectors', () => {
  beforeEach(() => {
    useCommentsStore.getState().reset();
  });

  it('selectThreads returns all threads', () => {
    expect(selectThreads(useCommentsStore.getState())).toHaveLength(0);
    useCommentsStore.getState().createThread(0, 10, 'A', 'Test');
    expect(selectThreads(useCommentsStore.getState())).toHaveLength(1);
  });

  it('selectUnresolvedThreads filters correctly', () => {
    const id1 = useCommentsStore.getState().createThread(0, 10, 'A', 'Open');
    useCommentsStore.getState().createThread(20, 30, 'B', 'Also open');
    useCommentsStore.getState().resolveThread(id1);
    expect(selectUnresolvedThreads(useCommentsStore.getState())).toHaveLength(1);
  });

  it('selectResolvedThreads filters correctly', () => {
    const id1 = useCommentsStore.getState().createThread(0, 10, 'A', 'Open');
    useCommentsStore.getState().createThread(20, 30, 'B', 'Also open');
    useCommentsStore.getState().resolveThread(id1);
    expect(selectResolvedThreads(useCommentsStore.getState())).toHaveLength(1);
  });

  it('selectThreadById finds the correct thread', () => {
    const threadId = useCommentsStore.getState().createThread(0, 10, 'A', 'Test');
    const state = useCommentsStore.getState();
    const thread = selectThreadById(state, threadId);
    expect(thread?.id).toBe(threadId);
  });

  it('selectThreadById returns undefined for missing thread', () => {
    const state = useCommentsStore.getState();
    expect(selectThreadById(state, 'nonexistent')).toBeUndefined();
  });

  it('selectActiveThreadId returns active thread', () => {
    expect(selectActiveThreadId(useCommentsStore.getState())).toBeNull();
    useCommentsStore.getState().createThread(0, 10, 'A', 'Test');
    expect(selectActiveThreadId(useCommentsStore.getState())).not.toBeNull();
  });

  it('selectThreadCount returns count', () => {
    expect(selectThreadCount(useCommentsStore.getState())).toBe(0);
    useCommentsStore.getState().createThread(0, 10, 'A', 'First');
    useCommentsStore.getState().createThread(20, 30, 'B', 'Second');
    expect(selectThreadCount(useCommentsStore.getState())).toBe(2);
  });

  it('selectUnresolvedCount returns unresolved count', () => {
    const id1 = useCommentsStore.getState().createThread(0, 10, 'A', 'First');
    useCommentsStore.getState().createThread(20, 30, 'B', 'Second');
    expect(selectUnresolvedCount(useCommentsStore.getState())).toBe(2);
    useCommentsStore.getState().resolveThread(id1);
    expect(selectUnresolvedCount(useCommentsStore.getState())).toBe(1);
  });
});
