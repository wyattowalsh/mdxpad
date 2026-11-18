import { beforeEach, describe, expect, it } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { resetPendingExternalChanges } from '@renderer/components/tabs/external-tab-change';

import { applyWatchedFileEvent } from './watched-file-event';

describe('watched file events', () => {
  beforeEach(() => {
    resetPendingExternalChanges();
    useDocumentStore.getState().reset();
    useDocumentStore.setState({ filePath: '/notes/a.md', content: 'saved' });
  });

  it('keeps the file open when a delete is replaced by a readable file', async () => {
    await applyWatchedFileEvent({ type: 'unlink', path: '/notes/a.md' }, async () => ({
      ok: true,
      value: 'saved',
    }));

    expect(useDocumentStore.getState().fileMissing).toBe(false);
    expect(useDocumentStore.getState().content).toBe('saved');
  });

  it('marks the open file missing when the delete stays deleted', async () => {
    await applyWatchedFileEvent({ type: 'unlink', path: '/notes/a.md' }, async () => ({
      ok: false,
    }));

    expect(useDocumentStore.getState().fileMissing).toBe(true);
    expect(useDocumentStore.getState().content).toBe('saved');
  });

  it('clears a missing notice when the file can be read again', async () => {
    useDocumentStore.getState().markFileMissing();

    await applyWatchedFileEvent({ type: 'change', path: '/notes/a.md' }, async () => ({
      ok: true,
      value: 'saved',
    }));

    expect(useDocumentStore.getState().fileMissing).toBe(false);
  });
});
