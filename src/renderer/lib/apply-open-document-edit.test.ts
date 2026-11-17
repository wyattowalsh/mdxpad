import { beforeEach, describe, expect, it } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import {
  applyOpenDocumentEdit,
  openDocumentEditPath,
  unwrapDocumentRevision,
} from './apply-open-document-edit';

describe('open document edits', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
  });

  it('unwraps a fenced revision', () => {
    expect(unwrapDocumentRevision('```md\n# Title\n```')).toBe('# Title');
  });

  it('replaces the open document and leaves a different path unchanged', () => {
    useDocumentStore.getState().setContent('old');
    expect(applyOpenDocumentEdit(openDocumentEditPath(null), 'new')).toBe(true);
    expect(useDocumentStore.getState().content).toBe('new');
    expect(applyOpenDocumentEdit('/other.mdx', 'nope')).toBe(false);
    expect(useDocumentStore.getState().content).toBe('new');
  });
});
