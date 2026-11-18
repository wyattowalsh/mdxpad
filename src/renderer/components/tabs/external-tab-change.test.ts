import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommandContext } from '@shared/types/commands';
import type { DocumentId } from '@shared/types/document';
import { saveFileCommand } from '@renderer/commands/file-commands';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

import { activateDocumentTab, hasUnsavedWork, subscribeDocumentTabs } from './document-tabs';
import {
  hasPendingExternalChange,
  noteFileRemoved,
  noteInactiveExternalChange,
  resetPendingExternalChanges,
} from './external-tab-change';

describe('external changes in background tabs', () => {
  beforeEach(() => {
    resetPendingExternalChanges();
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
  });

  it('shows a disk edit when a dirty background file is opened', () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore
      .getState()
      .openDocument({ fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 }, 'saved a');
    useDocumentStore.getState().setContent('edited a');
    useDocumentStore
      .getState()
      .openDocument({ fileId: 'b' as DocumentId, filePath: '/docs/b.mdx', mtime: 1 }, 'saved b');

    expect(noteInactiveExternalChange('/docs/a.mdx', 'disk a', 9)).toBe(true);
    const first = useTabStore.getState().tabs.find((tab) => tab.filePath === '/docs/a.mdx');
    expect(first?.content).toBe('edited a');
    if (first) {
      activateDocumentTab(first.id);
    }

    expect(useDocumentStore.getState().content).toBe('edited a');
    expect(useDocumentStore.getState().externalChangeDetected).toBe(true);
    expect(useDocumentStore.getState().externalContent).toBe('disk a');
    stop();
  });

  it('loads the disk text into a clean background file', () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore
      .getState()
      .openDocument({ fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 }, 'saved a');
    useDocumentStore
      .getState()
      .openDocument({ fileId: 'b' as DocumentId, filePath: '/docs/b.mdx', mtime: 1 }, 'saved b');

    expect(noteInactiveExternalChange('/docs/a.mdx', 'disk a', 9)).toBe(true);
    const first = useTabStore.getState().tabs.find((tab) => tab.filePath === '/docs/a.mdx');
    expect(first?.content).toBe('disk a');
    expect(first?.isDirty).toBe(false);
    if (first) {
      activateDocumentTab(first.id);
    }

    expect(useDocumentStore.getState().content).toBe('disk a');
    expect(useDocumentStore.getState().externalChangeDetected).toBe(false);
    stop();
  });

  it('leaves a background file unsaved when that file changed on disk', async () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore
      .getState()
      .openDocument({ fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 }, 'saved a');
    useDocumentStore.getState().setContent('edited a');
    useDocumentStore
      .getState()
      .openDocument({ fileId: 'b' as DocumentId, filePath: '/docs/b.mdx', mtime: 1 }, 'saved b');
    useDocumentStore.getState().setContent('edited b');
    noteInactiveExternalChange('/docs/a.mdx', 'disk a', 9);

    const writeFile = vi.fn().mockResolvedValue({ ok: true });
    const saveFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { id: 'b', path: '/docs/b.mdx', mtime: 2 },
    });
    const result = await saveFileCommand.execute({
      editor: null,
      document: {
        fileId: 'b',
        filePath: '/docs/b.mdx',
        content: 'edited b',
        isDirty: true,
      },
      api: { writeFile, saveFile },
      notify: () => undefined,
    } as unknown as CommandContext);

    expect(result.ok).toBe(true);
    expect(writeFile).not.toHaveBeenCalled();
    expect(saveFile).toHaveBeenCalled();
    expect(useDocumentStore.getState().filePath).toBe('/docs/a.mdx');
    expect(useDocumentStore.getState().content).toBe('edited a');
    expect(useDocumentStore.getState().externalChangeDetected).toBe(true);
    stop();
  });

  it('tells the editor when a background file is deleted', () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore.getState().openDocument(
      { fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 },
      'saved a'
    );
    useDocumentStore.getState().openDocument(
      { fileId: 'b' as DocumentId, filePath: '/docs/b.mdx', mtime: 1 },
      'saved b'
    );

    expect(noteFileRemoved('/docs/a.mdx', false)).toBe(true);
    expect(hasUnsavedWork()).toBe(true);
    const first = useTabStore.getState().tabs.find((tab) => tab.filePath === '/docs/a.mdx');
    if (first) {
      activateDocumentTab(first.id);
    }

    expect(useDocumentStore.getState().content).toBe('saved a');
    expect(useDocumentStore.getState().fileMissing).toBe(true);
    expect(useDocumentStore.getState().externalChangeDetected).toBe(false);
    stop();
  });

  it('writes a deleted file back when the editor is saved', async () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore.getState().openDocument(
      { fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 },
      'saved a'
    );
    noteFileRemoved('/docs/a.mdx', true);
    useDocumentStore.getState().markFileMissing();

    const saveFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { id: 'a', path: '/docs/a.mdx', mtime: 2 },
    });
    const result = await saveFileCommand.execute({
      editor: null,
      document: {
        fileId: 'a',
        filePath: '/docs/a.mdx',
        content: 'saved a',
        isDirty: false,
      },
      api: { writeFile: vi.fn(), saveFile },
      notify: () => undefined,
    } as unknown as CommandContext);

    expect(result.ok).toBe(true);
    expect(saveFile).toHaveBeenCalled();
    expect(useDocumentStore.getState().fileMissing).toBe(false);
    stop();
  });

  it('does not flag a background file when the disk matches its last save', () => {
    const stop = subscribeDocumentTabs();
    useDocumentStore
      .getState()
      .openDocument({ fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 }, 'saved a');
    useDocumentStore.getState().setContent('edited a');
    useDocumentStore
      .getState()
      .openDocument({ fileId: 'b' as DocumentId, filePath: '/docs/b.mdx', mtime: 1 }, 'saved b');

    expect(noteInactiveExternalChange('/docs/a.mdx', 'saved a', 9)).toBe(true);

    const first = useTabStore.getState().tabs.find((tab) => tab.filePath === '/docs/a.mdx');
    expect(first?.content).toBe('edited a');
    expect(first?.isDirty).toBe(true);
    expect(hasPendingExternalChange('/docs/a.mdx')).toBe(false);
    stop();
  });
});
