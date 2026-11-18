import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { useDocumentStore } from '@renderer/stores/document-store';
import { useMultiFileAiStore } from '@renderer/stores/multi-file-ai-store';
import { useTabStore } from '@renderer/stores/tab-store';
import { MultiFileEditPanel } from './MultiFileEditPanel';

describe('MultiFileEditPanel', () => {
  beforeEach(() => {
    cleanup();
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
    useMultiFileAiStore.getState().reset();
  });

  it('accepts an edit for a file open in another tab', () => {
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
    useMultiFileAiStore.getState().startMultiFileEdit('session', [
      { path: '/notes/other.md', original: 'old', modified: 'revised' },
    ]);

    render(<MultiFileEditPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept edit for other.md' }));

    expect(useDocumentStore.getState().content).toBe('open');
    const other = useTabStore.getState().tabs.find((tab) => tab.filePath === '/notes/other.md');
    expect(other?.content).toBe('revised');
    expect(other?.isDirty).toBe(true);
    expect(screen.getByText('Applied')).toBeTruthy();
  });
});
