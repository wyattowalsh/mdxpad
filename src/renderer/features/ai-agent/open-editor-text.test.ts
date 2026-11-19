import { beforeEach, describe, expect, it } from 'vitest';

import type { DocumentId } from '@shared/types/document';
import { registerLiveSourceText } from '@renderer/components/tabs/live-source-text';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

import { openEditorFiles, openEditorText } from './open-editor-text';

function openNote(content: string): void {
  useDocumentStore.getState().openDocument(
    {
      fileId: 'file-1' as DocumentId,
      filePath: '/notes/a.md',
      mtime: 1,
    },
    content
  );
}

describe('openEditorText', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
    registerLiveSourceText(null);
  });

  it('returns unstored keystrokes for the open file', () => {
    openNote('stored');
    registerLiveSourceText(() => 'typed!');

    expect(openEditorText('/notes/a.md')).toBe('typed!');
  });

  it('returns stored text when the source editor is not registered', () => {
    openNote('stored');

    expect(openEditorText('/notes/a.md')).toBe('stored');
  });

  it('does not return text for a different file', () => {
    openNote('stored');
    registerLiveSourceText(() => 'typed!');

    expect(openEditorText('/notes/b.md')).toBeUndefined();
    expect(openEditorText(undefined)).toBeUndefined();
  });

  it('includes unsaved text from another open tab', () => {
    openNote('stored');
    registerLiveSourceText(() => 'typed!');
    useTabStore.setState({
      tabs: [
        {
          id: 'a',
          filePath: '/notes/a.md',
          fileName: 'a.md',
          isDirty: true,
          content: 'stored',
          savedContent: 'stored',
        },
        {
          id: 'b',
          filePath: '/notes/b.md',
          fileName: 'b.md',
          isDirty: true,
          content: 'other draft',
          savedContent: 'saved',
        },
        {
          id: 'new',
          filePath: null,
          fileName: 'Untitled',
          isDirty: true,
          content: 'untitled',
          savedContent: '',
        },
      ],
      activeTabId: 'a',
    });

    expect(openEditorFiles()).toEqual([
      { path: '/notes/a.md', content: 'typed!' },
      { path: '/notes/b.md', content: 'other draft' },
    ]);
  });
});
