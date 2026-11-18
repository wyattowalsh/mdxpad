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
});
