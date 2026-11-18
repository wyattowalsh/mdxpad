import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    Reflect.deleteProperty(window, 'mdxpad');
  });

  it('accepts an edit for a file open in another tab', async () => {
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

    expect(await screen.findByText('Applied')).toBeTruthy();
    expect(useDocumentStore.getState().content).toBe('open');
    const other = useTabStore.getState().tabs.find((tab) => tab.filePath === '/notes/other.md');
    expect(other?.content).toBe('revised');
    expect(other?.isDirty).toBe(true);
  });

  it('writes a closed file and says when that file must be opened first', async () => {
    const writeFile = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: undefined })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'PERMISSION_DENIED', path: '/notes/secret.md' },
      });
    Object.defineProperty(window, 'mdxpad', { configurable: true, value: { writeFile } });
    useMultiFileAiStore.getState().startMultiFileEdit('session', [
      { path: '/notes/closed.md', original: 'old', modified: 'revised' },
      { path: '/notes/secret.md', original: 'hidden', modified: 'nope' },
    ]);

    render(<MultiFileEditPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept edit for closed.md' }));
    expect(await screen.findByText('Applied')).toBeTruthy();
    expect(writeFile).toHaveBeenCalledWith('/notes/closed.md', 'revised');

    fireEvent.click(screen.getByRole('button', { name: 'Accept edit for secret.md' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Open secret.md before accepting this edit.'
    );
    expect(screen.getByText('Pending')).toBeTruthy();
  });
});
