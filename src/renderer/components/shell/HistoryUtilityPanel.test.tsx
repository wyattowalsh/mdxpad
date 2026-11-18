import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { useVersionHistoryStore } from '@renderer/stores/version-history-store';

import { HistoryUtilityPanel } from './HistoryUtilityPanel';

describe('HistoryUtilityPanel', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useVersionHistoryStore.getState().reset();
  });

  it('shows saved versions for the open file', async () => {
    useDocumentStore.setState({ filePath: '/tmp/note.mdx' });
    vi.stubGlobal('mdxpad', {
      history: {
        getHistory: vi.fn().mockResolvedValue({
          entries: [
            {
              id: 'snapshot-1',
              timestamp: Date.now(),
              source: 'manual',
              label: 'Saved copy',
            },
          ],
        }),
        getVersion: vi.fn(),
      },
    });

    render(<HistoryUtilityPanel />);

    await waitFor(() => {
      expect(screen.getByText('Saved copy')).toBeTruthy();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows why version history did not load', async () => {
    useDocumentStore.setState({ filePath: '/tmp/note.mdx' });
    vi.stubGlobal('mdxpad', {
      history: {
        getHistory: vi
          .fn()
          .mockRejectedValue(new Error('Open this file before reading its history')),
        getVersion: vi.fn(),
      },
    });

    render(<HistoryUtilityPanel />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Open this file before reading its history'
      );
    });
  });

  it('saves a snapshot of the editor text', async () => {
    useDocumentStore.setState({ filePath: '/tmp/note.mdx', content: '# Live' });
    const createSnapshot = vi.fn().mockResolvedValue({
      ok: true,
      entry: { id: 'snapshot-1', timestamp: 1, source: 'manual', label: 'Editor snapshot' },
    });
    const getHistory = vi.fn().mockResolvedValue({ entries: [] });
    vi.stubGlobal('mdxpad', {
      history: { getHistory, getVersion: vi.fn(), createSnapshot },
    });

    render(<HistoryUtilityPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Save a snapshot of the editor' }));

    await waitFor(() => {
      expect(createSnapshot).toHaveBeenCalledWith('/tmp/note.mdx', 'Editor snapshot', '# Live');
    });
  });
});
