import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

import { openShareLink, openSharedSnapshot } from './open-share-link';

const token = 'a'.repeat(32);

describe('openShareLink', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
    useDocumentStore.getState().setContent('local note');
    useTabStore.getState().addTab({
      filePath: null,
      fileName: 'Untitled',
      isDirty: true,
      content: 'local note',
      savedContent: '',
    });
  });

  it('opens the shared snapshot and keeps the document id off the filesystem', async () => {
    const read = vi.fn().mockResolvedValue({
      ok: true,
      docId: '/etc/passwd',
      accessMode: 'read-only',
      content: 'shared note',
    });
    Object.assign(window, { mdxpad: { share: { read } } });

    await expect(openShareLink(`mdxpad://share/${token}`)).resolves.toBe(true);
    expect(read).toHaveBeenCalledWith({ token });
    expect(useDocumentStore.getState().content).toBe('shared note');
    expect(useDocumentStore.getState().filePath).toBeNull();
    expect(useTabStore.getState().tabs.some((tab) => tab.content === 'local note')).toBe(true);
  });

  it('leaves the editor unchanged for an address that is not a share link', async () => {
    const read = vi.fn();
    Object.assign(window, { mdxpad: { share: { read } } });

    await expect(openShareLink('file:///etc/passwd')).resolves.toBe(false);
    expect(read).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().content).toBe('local note');
    openSharedSnapshot('another note');
    expect(useDocumentStore.getState().filePath).toBeNull();
    expect(useDocumentStore.getState().content).toBe('another note');
  });
});
