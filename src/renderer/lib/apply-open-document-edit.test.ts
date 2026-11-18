import { beforeEach, describe, expect, it } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';
import {
  applyOpenDocumentEdit,
  openDocumentEditPath,
  unwrapDocumentRevision,
} from './apply-open-document-edit';

describe('open document edits', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
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

  it('writes an accepted edit into a file open in another tab', () => {
    useDocumentStore.setState({ content: 'open', filePath: '/notes/open.md' });
    const activeId = useTabStore.getState().addTab({
      filePath: '/notes/open.md',
      fileName: 'open.md',
      isDirty: false,
      content: 'open',
      savedContent: 'open',
    });
    useTabStore.getState().addTab({
      filePath: '/notes/other.md',
      fileName: 'other.md',
      isDirty: false,
      content: 'old',
      savedContent: 'old',
    });
    useTabStore.getState().setActiveTab(activeId);

    expect(applyOpenDocumentEdit('/notes/other.md', 'revised')).toBe(true);

    expect(useDocumentStore.getState().content).toBe('open');
    const other = useTabStore.getState().tabs.find((tab) => tab.filePath === '/notes/other.md');
    expect(other?.content).toBe('revised');
    expect(other?.isDirty).toBe(true);
  });
});
