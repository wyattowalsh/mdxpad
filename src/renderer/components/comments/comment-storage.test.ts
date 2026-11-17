import { beforeEach, describe, expect, it } from 'vitest';

import { useCommentsStore } from '@renderer/stores/comments-store';

import { readCommentThreads, writeCommentThreads } from './comment-storage';

describe('comment storage', () => {
  beforeEach(() => {
    localStorage.clear();
    useCommentsStore.getState().reset();
  });

  it('round-trips threads for one file', () => {
    const threadId = useCommentsStore.getState().createThread(1, 4, 'You', 'Hello');
    writeCommentThreads('/tmp/note.md', useCommentsStore.getState().threads);

    const stored = readCommentThreads('/tmp/note.md');
    expect(stored.map((thread) => thread.id)).toEqual([threadId]);
    expect(stored[0]?.messages[0]?.content).toBe('Hello');
    expect(readCommentThreads('/tmp/other.md')).toEqual([]);
  });
});
