import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentId } from '@shared/types/document';
import { useDocumentStore } from '@renderer/stores/document-store';

import { ExternalChangeNotice } from './ExternalChangeNotice';

describe('ExternalChangeNotice', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
  });

  it('says when the open file was deleted', () => {
    useDocumentStore.setState({ filePath: '/docs/a.mdx', content: 'saved a', fileMissing: true });
    render(<ExternalChangeNotice />);

    expect(screen.getByRole('alert').textContent).toContain('This file was deleted');
  });

  it('offers the disk version when the open file changed', () => {
    useDocumentStore.getState().setContent('local edits');
    useDocumentStore.getState().handleExternalChange('disk version', 10);
    render(<ExternalChangeNotice />);

    expect(screen.getByRole('alert').textContent).toContain('changed on disk');
    fireEvent.click(screen.getByRole('button', { name: 'Use the version on disk' }));

    expect(useDocumentStore.getState().content).toBe('disk version');
    expect(useDocumentStore.getState().externalChangeDetected).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('saves the editor copy to a new file', async () => {
    const saveFileAs = vi.fn().mockResolvedValue({
      ok: true,
      value: { id: 'file-2', path: '/docs/copy.md', name: 'copy.md' },
    });
    vi.stubGlobal('mdxpad', { saveFileAs });
    useDocumentStore.getState().setContent('local edits');
    useDocumentStore.getState().handleExternalChange('disk version', 10);
    render(<ExternalChangeNotice />);

    fireEvent.click(screen.getByRole('button', { name: 'Save my version as…' }));
    await waitFor(() => {
      expect(useDocumentStore.getState().filePath).toBe('/docs/copy.md');
    });

    expect(saveFileAs).toHaveBeenCalledWith('local edits');
    expect(useDocumentStore.getState().filePath).toBe('/docs/copy.md');
    expect(useDocumentStore.getState().content).toBe('local edits');
    expect(useDocumentStore.getState().externalChangeDetected).toBe(false);
    vi.unstubAllGlobals();
  });

  it('does not retarget a different file when the copy finishes', async () => {
    let finishSave: (value: {
      ok: true;
      value: { id: string; path: string; name: string };
    }) => void = () => undefined;
    const saveFileAs = vi.fn(
      () =>
        new Promise((resolve) => {
          finishSave = resolve;
        })
    );
    vi.stubGlobal('mdxpad', { saveFileAs });
    useDocumentStore.getState().openDocument(
      { fileId: 'file-1' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 },
      'saved'
    );
    useDocumentStore.getState().setContent('local edits');
    useDocumentStore.getState().handleExternalChange('disk version', 10);
    render(<ExternalChangeNotice />);

    fireEvent.click(screen.getByRole('button', { name: 'Save my version as…' }));
    await act(async () => {
      useDocumentStore.getState().openDocument(
        { fileId: 'file-2' as DocumentId, filePath: '/docs/other.md', mtime: 2 },
        'other'
      );
      finishSave({ ok: true, value: { id: 'file-3', path: '/docs/copy.md', name: 'copy.md' } });
    });

    await waitFor(() => {
      expect(saveFileAs).toHaveBeenCalledWith('local edits');
    });
    expect(useDocumentStore.getState().filePath).toBe('/docs/other.md');
    expect(useDocumentStore.getState().content).toBe('other');
    vi.unstubAllGlobals();
  });
});
