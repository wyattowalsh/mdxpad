import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCommentsStore } from '@renderer/stores/comments-store';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

import { CommentPersistence } from './CommentWorkspace';
import { readCommentThreads } from './comment-storage';

function untitledTab(fileName: string): string {
  return useTabStore.getState().addTab({
    filePath: null,
    fileName,
    isDirty: false,
    content: '',
    savedContent: '',
  });
}

describe('CommentPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    useCommentsStore.getState().reset();
    useTabStore.getState().reset();
    useDocumentStore.getState().reset();
  });

  it('does not show one untitled tab comments on another', () => {
    const first = untitledTab('Untitled');
    useDocumentStore.setState({ filePath: null });
    render(<CommentPersistence />);

    act(() => {
      useCommentsStore.getState().createThread(0, 4, 'You', 'First note');
    });

    act(() => {
      untitledTab('Untitled 2');
    });

    expect(useCommentsStore.getState().threads).toEqual([]);
    expect(readCommentThreads(`untitled:${first}`)).toHaveLength(1);
  });

  it('keeps comments when an untitled file is saved', () => {
    untitledTab('Untitled');
    useDocumentStore.setState({ filePath: null });
    render(<CommentPersistence />);

    act(() => {
      useCommentsStore.getState().createThread(0, 4, 'You', 'Keep me');
    });

    act(() => {
      useDocumentStore.setState({ filePath: '/tmp/saved.md' });
    });

    expect(useCommentsStore.getState().threads[0]?.messages[0]?.content).toBe('Keep me');
    expect(readCommentThreads('/tmp/saved.md')[0]?.messages[0]?.content).toBe('Keep me');
  });

  it('does not copy untitled comments onto another file', () => {
    const first = untitledTab('Untitled');
    useDocumentStore.setState({ filePath: null });
    render(<CommentPersistence />);

    act(() => {
      useCommentsStore.getState().createThread(0, 4, 'You', 'First note');
    });

    act(() => {
      useTabStore.getState().addTab({
        filePath: '/tmp/other.md',
        fileName: 'other.md',
        isDirty: false,
        content: '',
        savedContent: '',
      });
      useDocumentStore.setState({ filePath: '/tmp/other.md' });
    });

    expect(useCommentsStore.getState().threads).toEqual([]);
    expect(readCommentThreads('/tmp/other.md')).toEqual([]);
    expect(readCommentThreads(`untitled:${first}`)).toHaveLength(1);
  });
});
