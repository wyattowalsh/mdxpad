import { beforeEach, describe, expect, it } from 'vitest';

import { registerLiveSourceText } from '@renderer/components/tabs/live-source-text';
import { useDocumentStore } from '@renderer/stores/document-store';
import { resetPendingExternalChanges } from '@renderer/components/tabs/external-tab-change';

import { applyWatchedFileEvent } from './watched-file-event';

describe('watched file events', () => {
  beforeEach(() => {
    registerLiveSourceText(null);
    resetPendingExternalChanges();
    useDocumentStore.getState().reset();
    useDocumentStore.setState({ filePath: '/notes/a.md', content: 'saved', savedContent: 'saved' });
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

  it('does not flag a conflict when the disk matches the last saved text', async () => {
    useDocumentStore.setState({
      filePath: '/notes/a.md',
      content: 'saved!',
      savedContent: 'saved',
      isDirty: true,
    });

    await applyWatchedFileEvent({ type: 'change', path: '/notes/a.md' }, async () => ({
      ok: true,
      value: 'saved',
    }));

    expect(useDocumentStore.getState().externalChangeDetected).toBe(false);
    expect(useDocumentStore.getState().content).toBe('saved!');
  });

  it('keeps keystrokes that have not been stored when the disk changes', async () => {
    registerLiveSourceText(() => 'saved!');

    await applyWatchedFileEvent({ type: 'change', path: '/notes/a.md' }, async () => ({
      ok: true,
      value: 'other',
    }));

    expect(useDocumentStore.getState().content).toBe('saved!');
    expect(useDocumentStore.getState().externalChangeDetected).toBe(true);
    expect(useDocumentStore.getState().externalContent).toBe('other');
  });
});
