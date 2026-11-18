import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentId } from '@shared/types/document';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

import { registerLiveSourceText } from './live-source-text';
import {
  activateDocumentTab,
  activateRelativeDocumentTab,
  closeActiveDocumentTab,
  closeDocumentTab,
  hasUnsavedWork,
  reopenClosedTab,
  subscribeDocumentTabs,
} from './document-tabs';

describe('document tabs', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
    registerLiveSourceText(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows a deleted open file on its tab', () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore.getState().openDocument(
      { fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 },
      'saved a'
    );
    useDocumentStore.getState().markFileMissing();
    expect(useTabStore.getState().tabs[0]?.fileMissing).toBe(true);
    stop();
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

  it('saves an untitled draft before another file replaces the editor', async () => {
    const autosaveTrigger = vi.fn().mockResolvedValue({ ok: true, savedAt: 1 });
    vi.stubGlobal('mdxpad', { autosaveTrigger });
    const stop = subscribeDocumentTabs();
    useDocumentStore.getState().setContent('draft');

    useDocumentStore.getState().openDocument(
      { fileId: 'b' as DocumentId, filePath: '/docs/b.mdx', mtime: 1 },
      'saved b'
    );

    expect(autosaveTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: null,
        fileName: 'Untitled',
        content: 'draft',
      })
    );
    const saved = autosaveTrigger.mock.calls[0]?.[0] as { documentId?: string };
    expect(saved.documentId).not.toBe('b');
    expect(useTabStore.getState().tabs.find((tab) => tab.content === 'draft')?.isDirty).toBe(true);
    stop();
  });

  it('treats another open tab as unsaved work', () => {
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

    expect(useDocumentStore.getState().isDirty).toBe(false);
    expect(hasUnsavedWork()).toBe(true);
    stop();
  });

  it('keeps an untitled draft when New File starts another document', () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore.getState().setContent('draft');
    const draftId = useTabStore.getState().activeTabId;

    useDocumentStore.getState().newDocument();

    const tabs = useTabStore.getState().tabs;
    expect(tabs).toHaveLength(2);
    expect(tabs.find((tab) => tab.id === draftId)?.content).toBe('draft');
    expect(tabs.find((tab) => tab.id === draftId)?.isDirty).toBe(true);
    expect(useDocumentStore.getState().content).toBe('');
    expect(useDocumentStore.getState().filePath).toBeNull();
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

  it('keeps a tab open when its newest keystrokes are still only in the editor', () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore.getState().openDocument(
      { fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 },
      'Hello'
    );
    registerLiveSourceText(() => 'Hello!');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const id = useTabStore.getState().activeTabId;

    if (id) {
      closeDocumentTab(id);
    }

    expect(useTabStore.getState().tabs).toHaveLength(1);
    expect(useDocumentStore.getState().content).toBe('Hello!');
    registerLiveSourceText(null);
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
