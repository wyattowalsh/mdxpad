import { beforeEach, describe, expect, it } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';

import { applyRestoredVersion } from './apply-restored-version';

describe('applyRestoredVersion', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
  });

  it('replaces the open document and clears the dirty flag', () => {
    useDocumentStore.setState({
      filePath: '/tmp/note.md',
      content: 'current',
      savedContent: 'current',
      isDirty: true,
    });

    expect(applyRestoredVersion('/tmp/note.md', 'restored')).toBe(true);
    const state = useDocumentStore.getState();
    expect(state.content).toBe('restored');
    expect(state.savedContent).toBe('restored');
    expect(state.isDirty).toBe(false);
  });

  it('leaves a different open file alone', () => {
    useDocumentStore.setState({
      filePath: '/tmp/other.md',
      content: 'keep',
      savedContent: 'keep',
    });

    expect(applyRestoredVersion('/tmp/note.md', 'restored')).toBe(false);
    expect(useDocumentStore.getState().content).toBe('keep');
  });
});
