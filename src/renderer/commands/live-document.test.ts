import { beforeEach, describe, expect, it } from 'vitest';

import type { CommandContext } from '@shared/types/commands';
import type { DocumentId } from '@shared/types/document';

import { useDocumentStore } from '@renderer/stores/document-store';

import { liveDocumentContent } from './live-document';

describe('liveDocumentContent', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
  });

  it('reads the open editor when the command snapshot is older', () => {
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'saved'
    );
    useDocumentStore.getState().setContent('@article{a, title={Live}}');
    const ctx = {
      document: { filePath: '/notes/readme.md', content: 'saved', isDirty: false, fileId: 'file-1' },
    } as CommandContext;

    expect(liveDocumentContent(ctx)).toBe('@article{a, title={Live}}');
  });

  it('keeps the command text for a different file', () => {
    useDocumentStore.getState().setContent('other');
    const ctx = {
      document: { filePath: '/notes/readme.md', content: 'this file', isDirty: false, fileId: null },
    } as CommandContext;

    expect(liveDocumentContent(ctx)).toBe('this file');
  });

  it('reads keystrokes that have not reached the document store', () => {
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'Hello'
    );
    const ctx = {
      document: { filePath: '/notes/readme.md', content: 'Hello', isDirty: false, fileId: 'file-1' },
      editor: { state: { doc: { toString: () => 'Hello!' } }, isDestroyed: false },
    } as unknown as CommandContext;

    expect(liveDocumentContent(ctx)).toBe('Hello!');
  });

  it('uses the stored document when the source editor has been removed', () => {
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'stored after the editor closed'
    );
    const ctx = {
      document: {
        filePath: '/notes/readme.md',
        content: 'stored after the editor closed',
        isDirty: false,
        fileId: 'file-1',
      },
      editor: { state: { doc: { toString: () => 'stale keystrokes' } }, destroyed: true },
    } as unknown as CommandContext;

    expect(liveDocumentContent(ctx)).toBe('stored after the editor closed');
  });
});
