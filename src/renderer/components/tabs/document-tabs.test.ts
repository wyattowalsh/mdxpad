import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentId } from '@shared/types/document';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

import {
  activateDocumentTab,
  activateRelativeDocumentTab,
  closeActiveDocumentTab,
  closeDocumentTab,
  reopenClosedTab,
  subscribeDocumentTabs,
} from './document-tabs';

describe('document tabs', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
    vi.restoreAllMocks();
  });

  it('keeps unsaved edits when another file is opened and restored from its tab', () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore.getState().openDocument(
      { fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 },
      'saved a'
    );
    useDocumentStore.getState().setContent('edited a');
    useDocumentStore.getState().openDocument(
      { fileId: 'b' as DocumentId, filePath: '/docs/b.mdx', mtime: 1 },
      'saved b'
    );

    const first = useTabStore.getState().tabs.find((tab) => tab.filePath === '/docs/a.mdx');
    expect(first?.content).toBe('edited a');
    expect(first?.isDirty).toBe(true);
    expect(useDocumentStore.getState().filePath).toBe('/docs/b.mdx');

    useDocumentStore.getState().openDocument(
      { fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 2 },
      'disk a'
    );
    expect(useDocumentStore.getState().content).toBe('edited a');
    expect(useDocumentStore.getState().savedContent).toBe('saved a');

    const second = useTabStore.getState().tabs.find((tab) => tab.filePath === '/docs/b.mdx');
    if (second) {
      activateDocumentTab(second.id);
    }
    expect(useDocumentStore.getState().content).toBe('saved b');
    expect(useDocumentStore.getState().isDirty).toBe(false);
    stop();
  });

  it('keeps a saved untitled document on the same tab', () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore.getState().setContent('# Note');
    const id = useTabStore.getState().activeTabId;

    useDocumentStore.getState().markSaved({
      fileId: 'note' as DocumentId,
      filePath: '/docs/note.mdx',
      mtime: 1,
    });

    const tabs = useTabStore.getState().tabs;
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.id).toBe(id);
    expect(tabs[0]?.filePath).toBe('/docs/note.mdx');
    expect(tabs[0]?.isDirty).toBe(false);
    expect(tabs[0]?.content).toBe('# Note');
    stop();
  });

  it('turns a blank untitled tab into the opened file', () => {
    const stop = subscribeDocumentTabs();
    expect(useTabStore.getState().tabs).toHaveLength(1);

    useDocumentStore.getState().openDocument(
      { fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 },
      '# A'
    );

    expect(useTabStore.getState().tabs.map((tab) => tab.filePath)).toEqual(['/docs/a.mdx']);
    stop();
  });

  it('keeps a dirty tab open when close is cancelled', () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore.getState().setContent('notes');
    const id = useTabStore.getState().activeTabId;
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    if (id) {
      closeDocumentTab(id);
    }

    expect(useTabStore.getState().tabs).toHaveLength(1);
    expect(useDocumentStore.getState().content).toBe('notes');
    stop();
  });

  it('reopens a closed tab and moves between tabs', () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore.getState().openDocument(
      { fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 },
      'saved a'
    );
    useDocumentStore.getState().openDocument(
      { fileId: 'b' as DocumentId, filePath: '/docs/b.mdx', mtime: 1 },
      'saved b'
    );

    closeActiveDocumentTab();
    expect(useDocumentStore.getState().filePath).toBe('/docs/a.mdx');
    expect(useTabStore.getState().tabs).toHaveLength(1);

    reopenClosedTab();
    expect(useDocumentStore.getState().filePath).toBe('/docs/b.mdx');
    expect(useDocumentStore.getState().content).toBe('saved b');

    activateRelativeDocumentTab(-1);
    expect(useDocumentStore.getState().filePath).toBe('/docs/a.mdx');
    stop();
  });
});
